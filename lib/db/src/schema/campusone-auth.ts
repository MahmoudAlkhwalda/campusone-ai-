import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campusOneUsersTable = pgTable("campusone_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campusOneProfilesTable = pgTable("campusone_profiles", {
  userId: text("user_id").primaryKey().references(() => campusOneUsersTable.id, { onDelete: "cascade" }),
  profile: jsonb("profile").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const campusOneSessionsTable = pgTable("campusone_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => campusOneUsersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCampusOneUserSchema = createInsertSchema(campusOneUsersTable);
export const insertCampusOneProfileSchema = createInsertSchema(campusOneProfilesTable);
export const insertCampusOneSessionSchema = createInsertSchema(campusOneSessionsTable);

export type CampusOneUser = typeof campusOneUsersTable.$inferSelect;
export type CampusOneProfile = typeof campusOneProfilesTable.$inferSelect;
export type CampusOneSession = typeof campusOneSessionsTable.$inferSelect;
export type InsertCampusOneUser = z.infer<typeof insertCampusOneUserSchema>;