import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/campusone";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] Warning: DATABASE_URL is not set. Defaulting to local postgres connection string.",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
