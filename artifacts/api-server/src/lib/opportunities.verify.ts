import assert from "node:assert/strict";
import type { OpportunityRecord } from "@workspace/db";
import { buildOpportunityMatches } from "./opportunities";

const base = {
  tuitionSupportAmount: 120,
  monthlyIncomeAmount: 0,
  semesterIncomeAmount: 0,
  currentGap: 200,
  semesterDuration: 5,
  major: "Computer Science",
};

const recordDefaults = {
  provider: "Provider",
  sourceUrl: "https://example.com/opportunity",
  amount: "100 JOD",
  estimatedAmount: 100,
  deadline: "Check the provider",
  requirements: ["Apply with the provider"],
  verifiedAt: "2026-09-22",
  staleAfterDays: 90,
  applicationOpensAt: null,
  applicationClosesAt: null,
  isActive: true,
  majorKeywords: [],
  institution: null,
  minimumMonths: null,
  createdAt: new Date("2026-09-22T00:00:00Z"),
  updatedAt: new Date("2026-09-22T00:00:00Z"),
} satisfies Omit<OpportunityRecord, "id" | "name" | "type" | "target">;

const catalog: OpportunityRecord[] = [
  {
    ...recordDefaults,
    id: "support",
    name: "Support",
    type: "scholarship",
    target: "support",
  },
  {
    ...recordDefaults,
    id: "income",
    name: "Income",
    type: "paid-opportunity",
    target: "income",
    estimatedAmount: null,
  },
];

const noTargets = buildOpportunityMatches(
  {
    ...base,
    tuitionSupportAmount: 0,
  },
  catalog,
);
assert.equal(noTargets.opportunities.length, 0, "zero targets return no irrelevant matches");

const supportOnly = buildOpportunityMatches(base, catalog);
assert.ok(supportOnly.opportunities.length > 0, "support target receives matches");
assert.ok(
  supportOnly.opportunities.every((item) => item.type !== "paid-opportunity"),
  "support-only plans exclude paid opportunities",
);

const mixed = buildOpportunityMatches(
  {
    ...base,
    monthlyIncomeAmount: 100,
    semesterIncomeAmount: 500,
  },
  catalog,
);
assert.ok(
  mixed.opportunities.some((item) => item.type === "paid-opportunity"),
  "mixed plans include paid opportunities",
);
assert.ok(
  mixed.opportunities.every((item) => !item.impactExplanation.includes("about")),
  "impact does not use invented estimates",
);

process.stdout.write("opportunity matcher verification passed\n");