import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import {
  campusOneProfilesTable,
  campusOneSessionsTable,
  campusOneUsersTable,
  db,
} from "@workspace/db";
import {
  GetAuthSessionResponse,
  LogInBody,
  LogInResponse,
  SaveStudentProfileBody,
  SaveStudentProfileResponse,
  SignUpBody,
  SignUpResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "campusone_session";
const SESSION_DAYS = 30;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const authAttempts = new Map<string, { count: number; resetAt: number }>();
let lastAttemptSweep = 0;

function consumeAuthAttempt(key: string, limit: number) {
  const now = Date.now();
  if (now - lastAttemptSweep > 60_000 || authAttempts.size > 1_000) {
    for (const [storedKey, attempt] of authAttempts) {
      if (attempt.resetAt <= now) authAttempts.delete(storedKey);
    }
    while (authAttempts.size > 5_000) {
      const oldestKey = authAttempts.keys().next().value;
      if (!oldestKey) break;
      authAttempts.delete(oldestKey);
    }
    lastAttemptSweep = now;
  }
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function authAttemptKey(req: Request, action: "signup" | "login", email: string) {
  return `${action}:${req.ip}:${email.trim().toLowerCase()}`;
}

function clientAttemptKey(req: Request, action: "signup" | "login") {
  return `${action}:ip:${req.ip}`;
}

function cookieValue(req: Request, name: string) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (current && typeof current === "object" && "code" in current && current.code === "23505") {
      return true;
    }
    current = current && typeof current === "object" && "cause" in current
      ? current.cause
      : null;
  }
  return false;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, hashHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

async function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(campusOneSessionsTable).values({ tokenHash: tokenHash(token), userId, expiresAt });
  setSessionCookie(res, token, expiresAt);
}

async function currentAccount(req: Request) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  const rows = await db.select({
    user: campusOneUsersTable,
    profile: campusOneProfilesTable.profile,
  }).from(campusOneSessionsTable)
    .innerJoin(campusOneUsersTable, eq(campusOneSessionsTable.userId, campusOneUsersTable.id))
    .leftJoin(campusOneProfilesTable, eq(campusOneProfilesTable.userId, campusOneUsersTable.id))
    .where(and(eq(campusOneSessionsTable.tokenHash, tokenHash(token)), gt(campusOneSessionsTable.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

router.post("/auth/signup", async (req, res, next) => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
    return;
  }
  const attemptKey = authAttemptKey(req, "signup", parsed.data.email);
  if (!consumeAuthAttempt(clientAttemptKey(req, "signup"), 20) || !consumeAuthAttempt(attemptKey, 5)) {
    res.status(429).json({ error: "Too many account attempts. Please wait and try again." });
    return;
  }
  try {
    const email = parsed.data.email.trim().toLowerCase();
    const [user] = await db.insert(campusOneUsersTable).values({
      id: randomUUID(),
      name: parsed.data.name.trim(),
      email,
      passwordHash: await hashPassword(parsed.data.password),
    }).returning();
    authAttempts.delete(attemptKey);
    await createSession(res, user.id);
    res.status(201).json(SignUpResponse.parse({
      authenticated: true,
      user: { id: user.id, name: user.name, email: user.email },
      profile: null,
    }));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "An account already exists for this email." });
      return;
    }
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  const parsed = LogInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  const attemptKey = authAttemptKey(req, "login", parsed.data.email);
  if (!consumeAuthAttempt(clientAttemptKey(req, "login"), 60) || !consumeAuthAttempt(attemptKey, 10)) {
    res.status(429).json({ error: "Too many login attempts. Please wait and try again." });
    return;
  }
  try {
    const [user] = await db.select().from(campusOneUsersTable)
      .where(eq(campusOneUsersTable.email, parsed.data.email.trim().toLowerCase())).limit(1);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }
    authAttempts.delete(attemptKey);
    await createSession(res, user.id);
    const [saved] = await db.select().from(campusOneProfilesTable).where(eq(campusOneProfilesTable.userId, user.id)).limit(1);
    res.json(LogInResponse.parse({
      authenticated: true,
      user: { id: user.id, name: user.name, email: user.email },
      profile: saved?.profile ?? null,
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    const token = cookieValue(req, SESSION_COOKIE);
    if (token) await db.delete(campusOneSessionsTable).where(eq(campusOneSessionsTable.tokenHash, tokenHash(token)));
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/auth/session", async (req, res, next) => {
  try {
    const account = await currentAccount(req);
    res.json(GetAuthSessionResponse.parse(account ? {
      authenticated: true,
      user: { id: account.user.id, name: account.user.name, email: account.user.email },
      profile: account.profile,
    } : { authenticated: false, user: null, profile: null }));
  } catch (error) {
    next(error);
  }
});

router.put("/profile", async (req, res, next) => {
  const parsed = SaveStudentProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check the student profile and try again." });
    return;
  }
  try {
    const account = await currentAccount(req);
    if (!account) {
      res.status(401).json({ error: "Sign in to save this profile." });
      return;
    }
    await db.insert(campusOneProfilesTable).values({ userId: account.user.id, profile: parsed.data })
      .onConflictDoUpdate({ target: campusOneProfilesTable.userId, set: { profile: parsed.data, updatedAt: new Date() } });
    res.json(SaveStudentProfileResponse.parse(parsed.data));
  } catch (error) {
    next(error);
  }
});

export default router;