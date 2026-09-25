import type { SemesterSimulationInput } from "@workspace/api-zod";
import { simulateSemester, type SemesterSimulationResult } from "./simulation";

export type OptimizerChanges = {
  livingSpendReductionPercent: number;
  monthlyIncomeAddition: number;
  tuitionPaymentShiftMonths: number;
  supportPercent: number;
  creditHoursReduction: number;
};

export type OptimizerCandidate = {
  profile: SemesterSimulationInput;
  result: SemesterSimulationResult;
  changes: OptimizerChanges;
  targets: OpportunityTargets;
  stabilized: boolean;
  gap: number;
};

export type OpportunityTargets = {
  tuitionSupportAmount: number;
  monthlyIncomeAmount: number;
  semesterIncomeAmount: number;
  currentGap: number;
};

export type OptimizerIntervention = {
  kind: string;
  label: string;
  changes: OptimizerChanges;
  isolatedResult: SemesterSimulationResult;
  gapReduction: number;
  scoreChange: number;
  stabilized: boolean;
  whyThisHelps: string;
};

export type SemesterOptimizationResult = {
  baseline: SemesterSimulationResult;
  recommendation: OptimizerCandidate;
  alternatives: OptimizerCandidate[];
  interventions: OptimizerIntervention[];
  evaluatedCandidates: number;
  stabilized: boolean;
  gapReduced: boolean;
  policy: string;
};

const emptyChanges = (): OptimizerChanges => ({
  livingSpendReductionPercent: 0,
  monthlyIncomeAddition: 0,
  tuitionPaymentShiftMonths: 0,
  supportPercent: 0,
  creditHoursReduction: 0,
});

const gapOf = (result: SemesterSimulationResult) =>
  Math.max(0, -result.lowestProjectedBalance);
const isStable = (result: SemesterSimulationResult) =>
  result.firstRiskMonth === null && result.lowestProjectedBalance >= 0;
const money = (value: number) => Math.round(value * 100) / 100;

export function opportunityTargetsFor(
  input: SemesterSimulationInput,
  changes: OptimizerChanges,
): OpportunityTargets {
  const reducedCredits = Math.max(1, input.creditHours - changes.creditHoursReduction);
  const tuitionScale =
    input.creditHours * input.costPerCredit === 0
      ? 1
      : (reducedCredits * input.costPerCredit) / (input.creditHours * input.costPerCredit);
  return {
    tuitionSupportAmount: money(
      input.tuitionPayments.reduce((sum, payment) => sum + payment.amount, 0) *
        tuitionScale *
        (changes.supportPercent / 100),
    ),
    monthlyIncomeAmount: changes.monthlyIncomeAddition,
    semesterIncomeAmount: money(changes.monthlyIncomeAddition * input.semesterDuration),
    currentGap: gapOf(simulateSemester(input)),
  };
}

function makeProfile(
  input: SemesterSimulationInput,
  changes: OptimizerChanges,
): SemesterSimulationInput {
  if (
    changes.livingSpendReductionPercent === 0 &&
    changes.monthlyIncomeAddition === 0 &&
    changes.tuitionPaymentShiftMonths === 0 &&
    changes.supportPercent === 0 &&
    changes.creditHoursReduction === 0
  ) {
    return {
      ...input,
      tuitionPayments: input.tuitionPayments.map((payment) => ({ ...payment })),
    };
  }
  const reducedCredits = Math.max(1, input.creditHours - changes.creditHoursReduction);
  const originalTuition = input.creditHours * input.costPerCredit;
  const revisedTuition = reducedCredits * input.costPerCredit;
  const tuitionScale =
    originalTuition === 0 ? 1 : revisedTuition / originalTuition;
  const supportScale = 1 - changes.supportPercent / 100;
  const shift = changes.tuitionPaymentShiftMonths;
  const tuitionPayments = input.tuitionPayments.map((payment) => ({
    month:
      payment.month > input.semesterDuration
        ? payment.month
        : Math.min(input.semesterDuration, payment.month + shift),
    amount: money(payment.amount * tuitionScale * supportScale),
  }));
  const livingScale = 1 - changes.livingSpendReductionPercent / 100;

  return {
    ...input,
    creditHours: reducedCredits,
    monthlyIncome: money(input.monthlyIncome + changes.monthlyIncomeAddition),
    food: money(input.food * livingScale),
    transportation: money(input.transportation * livingScale),
    otherExpenses: money(input.otherExpenses * livingScale),
    tuitionPayments,
  };
}

function candidate(
  input: SemesterSimulationInput,
  changes: OptimizerChanges,
): OptimizerCandidate {
  const profile = makeProfile(input, changes);
  const result = simulateSemester(profile);
  return {
    profile,
    result,
    changes,
    targets: opportunityTargetsFor(input, changes),
    stabilized: isStable(result),
    gap: gapOf(result),
  };
}

function changeMagnitude(changes: OptimizerChanges) {
  return (
    changes.livingSpendReductionPercent +
    changes.monthlyIncomeAddition / 100 +
    changes.tuitionPaymentShiftMonths * 2 +
    changes.supportPercent +
    changes.creditHoursReduction * 20
  );
}

export function optimizeSemester(
  input: SemesterSimulationInput,
): SemesterOptimizationResult {
  const baseline = simulateSemester(input);
  const severeGap = gapOf(baseline) >= 100;
  const living = [0, 5, 10, 15, 20];
  const income = [0, 50, 100, 150, 200, 250, 300].map((value) =>
    Math.min(300, value),
  );
  const support = [0, 5, 10, 15];
  const reductions = severeGap && input.creditHours > 12 ? [0, 3] : [0];
  const candidates: OptimizerCandidate[] = [];
  const seen = new Set<string>();

  for (const livingSpendReductionPercent of living) {
    for (const monthlyIncomeAddition of income) {
      for (const tuitionPaymentShiftMonths of [0, 1]) {
        for (const supportPercent of support) {
          for (const creditHoursReduction of reductions) {
            const changes = {
              livingSpendReductionPercent,
              monthlyIncomeAddition,
              tuitionPaymentShiftMonths,
              supportPercent,
              creditHoursReduction,
            };
            const key = JSON.stringify(changes);
            if (!seen.has(key)) {
              seen.add(key);
              candidates.push(candidate(input, changes));
            }
          }
        }
      }
    }
  }

  const baselineGap = gapOf(baseline);
  candidates.sort((a, b) => {
    if (a.stabilized !== b.stabilized) return a.stabilized ? -1 : 1;
    const gapReduction = baselineGap - a.gap - (baselineGap - b.gap);
    if (gapReduction !== 0) return gapReduction > 0 ? -1 : 1;
    const magnitude = changeMagnitude(a.changes) - changeMagnitude(b.changes);
    if (magnitude !== 0) return magnitude;
    if (a.changes.creditHoursReduction !== b.changes.creditHoursReduction) {
      return a.changes.creditHoursReduction - b.changes.creditHoursReduction;
    }
    return JSON.stringify(a.changes).localeCompare(JSON.stringify(b.changes));
  });

  const recommendation = candidates[0];
  const alternatives = candidates
    .filter((item) => item !== recommendation)
    .slice(0, 3);
  const interventionDefinitions: Array<{
    kind: string;
    label: string;
    changes: OptimizerChanges;
    whyThisHelps: string;
  }> = [];
  if (recommendation.changes.livingSpendReductionPercent > 0) {
    interventionDefinitions.push({
      kind: "living-spend",
      label: `Reduce living spending by ${recommendation.changes.livingSpendReductionPercent}%`,
      changes: { ...emptyChanges(), livingSpendReductionPercent: recommendation.changes.livingSpendReductionPercent },
      whyThisHelps: "Lower recurring food, transport, and other costs leaves more cash at the end of each month.",
    });
  }
  if (recommendation.changes.monthlyIncomeAddition > 0) {
    interventionDefinitions.push({
      kind: "income",
      label: `Add JOD ${recommendation.changes.monthlyIncomeAddition} monthly income`,
      changes: { ...emptyChanges(), monthlyIncomeAddition: recommendation.changes.monthlyIncomeAddition },
      whyThisHelps: "Additional monthly income directly increases each projected balance.",
    });
  }
  if (recommendation.changes.tuitionPaymentShiftMonths > 0) {
    interventionDefinitions.push({
      kind: "tuition-timing",
      label: "Move tuition payments one month later",
      changes: { ...emptyChanges(), tuitionPaymentShiftMonths: recommendation.changes.tuitionPaymentShiftMonths },
      whyThisHelps: "A later payment can avoid an early-month negative balance without changing total tuition.",
    });
  }
  if (recommendation.changes.supportPercent > 0) {
    interventionDefinitions.push({
      kind: "support",
      label: `Model ${recommendation.changes.supportPercent}% potential tuition support`,
      changes: { ...emptyChanges(), supportPercent: recommendation.changes.supportPercent },
      whyThisHelps: "A transparent potential support assumption lowers modeled out-of-pocket tuition; it is not a named award or eligibility claim.",
    });
  }
  if (recommendation.changes.creditHoursReduction > 0) {
    interventionDefinitions.push({
      kind: "academic-load",
      label: `Reduce the academic load by ${recommendation.changes.creditHoursReduction} credits`,
      changes: { ...emptyChanges(), creditHoursReduction: recommendation.changes.creditHoursReduction },
      whyThisHelps: "Fewer credits lower modeled tuition, but this option is shown only for severe gaps and carries academic disruption.",
    });
  }
  const interventions = interventionDefinitions.map((definition) => {
    const isolated = candidate(input, definition.changes);
    return {
      ...definition,
      isolatedResult: isolated.result,
      gapReduction: money(baselineGap - isolated.gap),
      scoreChange: isolated.result.financialHealthScore - baseline.financialHealthScore,
      stabilized: isolated.stabilized,
    };
  });

  return {
    baseline,
    recommendation,
    alternatives,
    interventions,
    evaluatedCandidates: candidates.length,
    stabilized: recommendation.stabilized,
    gapReduced: recommendation.gap < baselineGap,
    policy: "Candidates are deterministic and bounded: living costs up to 20% lower, income additions up to JOD 300/month, one-month tuition rescheduling, potential support up to 15% of out-of-pocket tuition, and a 3-credit reduction only for a gap of at least JOD 100 when credit hours exceed 12. Support is an assumption, not a named scholarship or eligibility decision. Academic-load changes receive a high ranking penalty.",
  };
}