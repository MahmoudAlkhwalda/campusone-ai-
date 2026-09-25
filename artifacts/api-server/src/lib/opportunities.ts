import type { OpportunityMatchInput } from "@workspace/api-zod";
import { db, opportunitiesTable, type OpportunityRecord } from "@workspace/db";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} JOD`;

export function buildOpportunityMatches(
  input: OpportunityMatchInput,
  catalog: OpportunityRecord[],
) {
  const target = input.tuitionSupportAmount + input.semesterIncomeAmount;
  const normalizedMajor = input.major.toLowerCase();

  const opportunities = catalog
    .filter((item) =>
      item.target === "support"
        ? input.tuitionSupportAmount > 0
        : input.monthlyIncomeAmount > 0,
    )
    .map((item) => {
      const majorMatch =
        item.majorKeywords.length === 0 ||
        item.majorKeywords.some((keyword) => normalizedMajor.includes(keyword));
      const durationMatch =
        item.minimumMonths == null || input.semesterDuration >= item.minimumMonths;
      const contribution =
        item.estimatedAmount == null
          ? null
          : Math.min(item.estimatedAmount, input.currentGap || target);
      const targetKind = item.target === "income" ? "monthly income" : "tuition support";
      const impactExplanation =
        contribution == null
          ? `The provider does not publish a directly comparable JOD award for this opportunity, so CampusOne does not estimate a gap reduction. If confirmed, any received amount can be compared with the plan's ${money(item.target === "income" ? input.semesterIncomeAmount : input.tuitionSupportAmount)} ${targetKind} target.`
          : `The published amount starts at ${money(item.estimatedAmount!)}. If you received that amount, up to ${money(contribution)} could cover the current ${money(input.currentGap)} engine-generated gap; the actual effect cannot exceed the amount confirmed by the provider.`;
      const relevanceExplanation = [
        `Shown because this is a ${item.target === "income" ? "stipend-bearing paid opportunity" : "tuition or student-support program"} and the plan includes a ${money(item.target === "income" ? input.monthlyIncomeAmount : input.tuitionSupportAmount)} ${targetKind} target.`,
        item.institution
          ? `CampusOne does not know your institution, so compatibility with ${item.institution} is unverified and must be confirmed before applying.`
          : "This opportunity is not tied to a university in the published source.",
        majorMatch && item.majorKeywords.length > 0
          ? `Its published field focus is relevant to ${input.major}.`
          : item.majorKeywords.length > 0
            ? `Its published fields do not directly match ${input.major}; check whether the provider accepts another relevant field.`
            : "It is not restricted to a named major on the published source.",
        item.minimumMonths != null
          ? durationMatch
            ? `Its minimum ${item.minimumMonths}-month duration fits within the ${input.semesterDuration}-month plan horizon.`
            : `Its minimum ${item.minimumMonths}-month duration extends beyond the ${input.semesterDuration}-month plan horizon.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      return {
        item,
        majorMatch,
        durationMatch,
        opportunity: {
          id: item.id,
          name: item.name,
          provider: item.provider,
          sourceUrl: item.sourceUrl,
          type: item.type,
          amount: item.amount,
          estimatedAmount: item.estimatedAmount,
          deadline: item.deadline,
          requirements: item.requirements,
          verificationStatus: "verified-source" as const,
          verifiedAt: item.verifiedAt,
          impactExplanation,
          relevanceExplanation,
          eligibilityNotice:
            "This is a target-aligned catalog suggestion, not a confirmed eligibility match. The provider must confirm institution and program compatibility, an open application or vacancy, selection, and the final award, loan, or pay. CampusOne does not guarantee any outcome.",
        },
      };
    })
    .sort((a, b) => {
      if (a.majorMatch !== b.majorMatch) return a.majorMatch ? -1 : 1;
      if (a.durationMatch !== b.durationMatch) return a.durationMatch ? -1 : 1;
      const aDistance =
        a.item.estimatedAmount == null
          ? Number.POSITIVE_INFINITY
          : Math.abs(a.item.estimatedAmount - target);
      const bDistance =
        b.item.estimatedAmount == null
          ? Number.POSITIVE_INFINITY
          : Math.abs(b.item.estimatedAmount - target);
      return aDistance - bDistance;
    })
    .map(({ opportunity }) => opportunity);

  return {
    targets: {
      tuitionSupportAmount: input.tuitionSupportAmount,
      monthlyIncomeAmount: input.monthlyIncomeAmount,
      semesterIncomeAmount: input.semesterIncomeAmount,
      currentGap: input.currentGap,
    },
    opportunities,
    disclaimer:
      "Source verification means CampusOne checked the linked provider page for the displayed program terms on the verification date. It does not confirm that the student qualifies, that an application is currently open, or that the provider will make an award, loan, or employment offer.",
  };
}

export async function matchOpportunities(input: OpportunityMatchInput) {
  const today = new Date().toISOString().slice(0, 10);
  const catalog = await db
    .select()
    .from(opportunitiesTable)
    .where(
      and(
        eq(opportunitiesTable.isActive, true),
        or(
          isNull(opportunitiesTable.applicationOpensAt),
          lte(opportunitiesTable.applicationOpensAt, today),
        ),
        or(
          isNull(opportunitiesTable.applicationClosesAt),
          gte(opportunitiesTable.applicationClosesAt, today),
        ),
        sql`${opportunitiesTable.verifiedAt} + ${opportunitiesTable.staleAfterDays} >= ${today}::date`,
      ),
    );

  return buildOpportunityMatches(input, catalog);
}