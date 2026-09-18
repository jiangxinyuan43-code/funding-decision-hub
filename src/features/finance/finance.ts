import type { FinancialPlan, PurchaseGoal } from '../../types/models'

export interface ForecastPoint {
  date: string
  label: string
  balance: number
  income: number
  expense: number
  saving: number
}

function monthDiff(from: Date, to: Date) {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth())
}

export function monthlyNet(plan: FinancialPlan) {
  return plan.monthlySaving + plan.housingFund
}

function monthEnd(year: number, month: number) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

function oneTimeDepositDate(plan: FinancialPlan, now: Date) {
  return plan.extraIncomeDate ? new Date(`${plan.extraIncomeDate}T23:59:59`) : monthEnd(now.getFullYear(), now.getMonth())
}

function recurringDepositDates(plan: FinancialPlan, now: Date, target: Date) {
  const dates: Date[] = []
  const anchor = oneTimeDepositDate(plan, now)
  const months = monthDiff(anchor, target)
  for (let offset = 1; offset <= months; offset += 1) {
    const date = monthEnd(anchor.getFullYear(), anchor.getMonth() + offset)
    if (date > now && date <= target) dates.push(date)
  }
  return dates
}

export function forecastBalance(plan: FinancialPlan, now = new Date()) {
  const target = new Date(`${plan.targetDate}T23:59:59`)
  const depositDate = oneTimeDepositDate(plan, now)
  const oneTimeDeposit = depositDate > now && depositDate <= target ? plan.extraIncome : 0
  return Math.max(0, plan.currentBalance + oneTimeDeposit + monthlyNet(plan) * recurringDepositDates(plan, now, target).length)
}

export function buildForecast(plan: FinancialPlan, now = new Date()): ForecastPoint[] {
  const target = new Date(`${plan.targetDate}T23:59:59`)
  const points: ForecastPoint[] = [
    {
      date: now.toISOString(),
      label: '当前',
      balance: plan.currentBalance,
      income: 0,
      expense: 0,
      saving: 0,
    },
  ]

  let balance = plan.currentBalance
  const depositDate = oneTimeDepositDate(plan, now)
  if (plan.extraIncome > 0 && depositDate > now && depositDate <= target) {
    balance += plan.extraIncome
    points.push({
      date: depositDate.toISOString(),
      label: `${depositDate.getMonth() + 1}月底`,
      balance,
      income: 0,
      expense: 0,
      saving: plan.extraIncome,
    })
  }

  for (const date of recurringDepositDates(plan, now, target)) {
    balance += monthlyNet(plan)
    points.push({
      date: date.toISOString(),
      label: `${date.getMonth() + 1}月底`,
      balance,
      income: plan.housingFund,
      expense: 0,
      saving: plan.monthlySaving,
    })
  }
  return points
}

export function activeGoalTotal(goals: PurchaseGoal[]) {
  return goals.filter((goal) => goal.active).reduce((sum, goal) => sum + goal.budget, 0)
}

export function goalGap(plan: FinancialPlan, goals: PurchaseGoal[], now = new Date()) {
  return forecastBalance(plan, now) - activeGoalTotal(goals)
}
