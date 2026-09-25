import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const opportunityTypeEnum = pgEnum("opportunity_type", [
  "scholarship",
  "aid",
  "paid-opportunity",
]);

export const opportunityTargetEnum = pgEnum("opportunity_target", [
  "support",
  "income",
]);

export const opportunitiesTable = pgTable("opportunities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  sourceUrl: text("source_url").notNull(),
  type: opportunityTypeEnum("type").notNull(),
  amount: text("amount").notNull(),
  estimatedAmount: integer("estimated_amount"),
  deadline: text("deadline").notNull(),
  requirements: text("requirements").array().notNull(),
  verifiedAt: date("verified_at", { mode: "string" }).notNull(),
  staleAfterDays: integer("stale_after_days").notNull().default(90),
  applicationOpensAt: date("application_opens_at", { mode: "string" }),
  applicationClosesAt: date("application_closes_at", { mode: "string" }),
  isActive: boolean("is_active").notNull().default(true),
  target: opportunityTargetEnum("target").notNull(),
  majorKeywords: text("major_keywords").array().notNull().default([]),
  institution: text("institution"),
  minimumMonths: integer("minimum_months"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type OpportunityRecord = typeof opportunitiesTable.$inferSelect;