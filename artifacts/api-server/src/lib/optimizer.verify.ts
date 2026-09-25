import assert from "node:assert/strict";
import { opportunityTargetsFor, optimizeSemester } from "./optimizer";
import { simulateSemester, type SimulationInput } from "./simulation";

const ahmadBaseline = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
  name: "Ahmad",
  major: "Computer Science",
  creditHours: 15,
  costPerCredit: 50,
  semesterDuration: 5,
  currentBalance: 1050,
  monthlyIncome: 100,
  transportation: 70,
  food: 90,
  otherExpenses: 40,
  tuitionPayments: [
    { month: 1, amount: 300 },
    { month: 3, amount: 450 },
  ],
  ...overrides,
});

const gapOf = (result: ReturnType<typeof simulateSemester>) =>
  Math.max(0, -result.lowestProjectedBalance);

const verify = () => {
  const ahmad = ahmadBaseline();
  const ahmad18 = ahmadBaseline({
    creditHours: 18,
    tuitionPayments: [
      { month: 1, amount: 360 },
      { month: 3, amount: 540 },
    ],
  });
  const smallGap = ahmadBaseline({
    creditHours: 12,
    costPerCredit: 0,
    currentBalance: 100,
    monthlyIncome: 100,
    transportation: 40,
    food: 50,
    otherExpenses: 31,
    tuitionPayments: [],
  });
  const irreducibleGap = ahmadBaseline({
    creditHours: 15,
    costPerCredit: 0,
    semesterDuration: 12,
    currentBalance: 0,
    monthlyIncome: 0,
    transportation: 300,
    food: 500,
    otherExpenses: 200,
    tuitionPayments: [],
  });
  const stableStudent = ahmadBaseline({
    creditHours: 12,
    costPerCredit: 0,
    currentBalance: 1000,
    monthlyIncome: 200,
    transportation: 30,
    food: 50,
    otherExpenses: 20,
    tuitionPayments: [],
  });
  const outOfHorizonPayment = ahmadBaseline({
    creditHours: 4,
    costPerCredit: 50,
    semesterDuration: 2,
    currentBalance: 100,
    monthlyIncome: 0,
    transportation: 0,
    food: 0,
    otherExpenses: 0,
    tuitionPayments: [{ month: 3, amount: 200.123 }],
  });
  const scenarios: Array<[string, SimulationInput]> = [
    ["Ahmad baseline", ahmad],
    ["Ahmad 18-credit FutureMe", ahmad18],
    ["small gap", smallGap],
    ["large irreducible gap", irreducibleGap],
    ["stable student", stableStudent],
    ["out-of-horizon tuition payment", outOfHorizonPayment],
  ];

  for (const [name, input] of scenarios) {
    const output = optimizeSemester(input);
    assert.deepEqual(output.baseline, simulateSemester(input), `${name}: baseline`);
    assert.deepEqual(
      output.recommendation.result,
      simulateSemester(output.recommendation.profile),
      `${name}: recommendation is engine output`,
    );
    for (const alternative of output.alternatives) {
      assert.deepEqual(
        alternative.result,
        simulateSemester(alternative.profile),
        `${name}: alternative is engine output`,
      );
    }
    assert.ok(output.evaluatedCandidates > 1, `${name}: candidates`);
    assert.ok(output.recommendation.changes.livingSpendReductionPercent <= 20, `${name}: spending bound`);
    assert.ok(output.recommendation.changes.monthlyIncomeAddition <= 300, `${name}: income bound`);
    assert.ok(output.recommendation.changes.tuitionPaymentShiftMonths <= 1, `${name}: timing bound`);
    assert.ok(output.recommendation.changes.supportPercent <= 15, `${name}: support bound`);
    assert.ok(output.recommendation.changes.creditHoursReduction <= 3, `${name}: credit bound`);
    for (const intervention of output.interventions) {
      assert.deepEqual(
        intervention.isolatedResult,
        simulateSemester(intervention.isolatedResult.profile),
        `${name}: intervention is engine output`,
      );
      assert.equal(
        intervention.gapReduction,
        Math.round((gapOf(output.baseline) - gapOf(intervention.isolatedResult)) * 100) / 100,
        `${name}: intervention effect`,
      );
    }
  }

  const baselineResult = optimizeSemester(ahmad);
  assert.equal(baselineResult.baseline.finalProjectedBalance, -200, "Ahmad baseline balance");
  assert.equal(baselineResult.baseline.firstRiskMonth, 4, "Ahmad baseline risk");
  assert.equal(baselineResult.baseline.financialHealthScore, 63, "Ahmad baseline health");

  const futureResult = optimizeSemester(ahmad18);
  assert.equal(futureResult.baseline.finalProjectedBalance, -350, "18-credit balance");
  assert.equal(futureResult.baseline.firstRiskMonth, 3, "18-credit risk");
  assert.equal(futureResult.baseline.financialHealthScore, 42, "18-credit health");
  const combinedTargets = opportunityTargetsFor(ahmad18, {
    livingSpendReductionPercent: 0,
    monthlyIncomeAddition: 100,
    tuitionPaymentShiftMonths: 0,
    supportPercent: 15,
    creditHoursReduction: 3,
  });
  assert.equal(combinedTargets.tuitionSupportAmount, 112.5, "support target uses post-credit-reduction tuition");
  assert.equal(combinedTargets.monthlyIncomeAmount, 100, "monthly income target stays exact");
  assert.equal(combinedTargets.semesterIncomeAmount, 500, "semester income target stays exact");

  const smallResult = optimizeSemester(smallGap);
  assert.equal(smallResult.baseline.finalProjectedBalance, -5, "small gap fixture");
  assert.equal(smallResult.stabilized, true, "small gap is stabilized");
  assert.equal(smallResult.recommendation.gap, 0, "small gap is eliminated");

  const largeResult = optimizeSemester(irreducibleGap);
  assert.equal(largeResult.stabilized, false, "large gap remains unresolved");
  assert.equal(largeResult.gapReduced, true, "large gap is reduced");
  assert.ok(largeResult.recommendation.gap > 0, "large gap remains visible");

  const stableResult = optimizeSemester(stableStudent);
  assert.equal(stableResult.stabilized, true, "stable case stays stable");
  assert.deepEqual(
    stableResult.recommendation.changes,
    {
      livingSpendReductionPercent: 0,
      monthlyIncomeAddition: 0,
      tuitionPaymentShiftMonths: 0,
      supportPercent: 0,
      creditHoursReduction: 0,
    },
    "stable case avoids unnecessary changes",
  );
  assert.equal(stableResult.interventions.length, 0, "stable case has no interventions");

  const horizonResult = optimizeSemester(outOfHorizonPayment);
  assert.equal(horizonResult.baseline.finalProjectedBalance, 100, "out-of-horizon payment stays excluded");
  assert.deepEqual(
    horizonResult.recommendation.profile,
    outOfHorizonPayment,
    "zero-change candidate preserves every valid input exactly",
  );
  assert.deepEqual(
    horizonResult.recommendation.result,
    simulateSemester(outOfHorizonPayment),
    "zero-change candidate matches direct simulation with out-of-horizon payment",
  );
  assert.equal(horizonResult.interventions.length, 0, "stable horizon case adds no interventions");

  const nonSevere = optimizeSemester(smallGap);
  assert.equal(
    nonSevere.recommendation.changes.creditHoursReduction,
    0,
    "3-credit reduction is reserved for severe gaps",
  );
  process.stdout.write("optimizer verification passed\n");
};

verify();