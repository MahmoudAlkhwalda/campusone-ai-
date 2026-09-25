import { SimulateSemesterBody, type SemesterSimulationInput } from "@workspace/api-zod";

export type SimulationInput = SemesterSimulationInput;

export type MonthlyForecast = {
  month: number;
  label: string;
  startingBalance: number;
  income: number;
  tuition: number;
  food: number;
  transportation: number;
  otherExpenses: number;
  totalExpenses: number;
  endingBalance: number;
  isAtRisk: boolean;
};

export type SemesterSimulationResult = {
  profile: SimulationInput;
  tuition: number;
  monthlyBalances: MonthlyForecast[];
  finalProjectedBalance: number;
  firstRiskMonth: number | null;
  financialHealthScore: number;
  totalIncome: number;
  totalExpenses: number;
  totalTuition: number;
  lowestProjectedBalance: number;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export function simulateSemester(
  profile: SimulationInput,
): SemesterSimulationResult {
  const tuition = profile.creditHours * profile.costPerCredit;
  const paymentByMonth = new Map<number, number>();

  for (const payment of profile.tuitionPayments) {
    if (payment.month <= profile.semesterDuration) {
      paymentByMonth.set(
        payment.month,
        (paymentByMonth.get(payment.month) ?? 0) + payment.amount,
      );
    }
  }

  const monthlyLivingExpenses =
    profile.food + profile.transportation + profile.otherExpenses;
  const monthlyBalances: MonthlyForecast[] = [];
  let balance = profile.currentBalance;

  for (let month = 1; month <= profile.semesterDuration; month += 1) {
    const startingBalance = balance;
    const income = profile.monthlyIncome;
    const tuitionPayment = paymentByMonth.get(month) ?? 0;
    const totalExpenses = tuitionPayment + monthlyLivingExpenses;
    balance = startingBalance + income - totalExpenses;

    monthlyBalances.push({
      month,
      label: `Month ${month}`,
      startingBalance: roundCurrency(startingBalance),
      income: roundCurrency(income),
      tuition: roundCurrency(tuitionPayment),
      food: roundCurrency(profile.food),
      transportation: roundCurrency(profile.transportation),
      otherExpenses: roundCurrency(profile.otherExpenses),
      totalExpenses: roundCurrency(totalExpenses),
      endingBalance: roundCurrency(balance),
      isAtRisk: balance < 0,
    });
  }

  const firstRiskMonth =
    monthlyBalances.find((month) => month.isAtRisk)?.month ?? null;
  const finalProjectedBalance = roundCurrency(balance);
  const totalIncome = roundCurrency(profile.monthlyIncome * profile.semesterDuration);
  const totalTuition = roundCurrency(
    monthlyBalances.reduce((sum, month) => sum + month.tuition, 0),
  );
  const totalExpenses = roundCurrency(
    monthlyBalances.reduce((sum, month) => sum + month.totalExpenses, 0),
  );
  const lowestProjectedBalance = roundCurrency(
    Math.min(profile.currentBalance, ...monthlyBalances.map((month) => month.endingBalance)),
  );

  const deficitPenalty = Math.min(68, Math.max(0, -lowestProjectedBalance) / 7);
  const riskPenalty = firstRiskMonth === null ? 0 : 8;
  const financialHealthScore = Math.max(
    0,
    Math.min(100, Math.round(100 - deficitPenalty - riskPenalty)),
  );

  return {
    profile,
    tuition: roundCurrency(tuition),
    monthlyBalances,
    finalProjectedBalance,
    firstRiskMonth,
    financialHealthScore,
    totalIncome,
    totalExpenses,
    totalTuition,
    lowestProjectedBalance,
  };
}