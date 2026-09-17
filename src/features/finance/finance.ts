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
  return plan.monthlyIncome + plan.monthlySaving + plan.housingFund - plan.monthlyFixedExpense
}

export function forecastBalance(plan: FinancialPlan, now = new Date()) {
  const target = new Date(`${plan.targetDate}T23:59:59`)
  const months = monthDiff(now, target)
  return Math.max(0, plan.currentBalance + plan.extraIncome + monthlyNet(plan) * months)
}

export function buildForecast(plan: FinancialPlan, now = new Date()): ForecastPoint[] {
  const target = new Date(`${plan.targetDate}T23:59:59`)
  const totalMonths = Math.max(1, monthDiff(now, target))
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

  let balance = plan.currentBalance + plan.extraIncome
  for (let index = 1; index <= totalMonths; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1)
    balance += monthlyNet(plan)
    points.push({
      date: date.toISOString(),
      label: `${date.getMonth() + 1}月`,
      balance,
      income: plan.monthlyIncome + plan.housingFund,
      expense: plan.monthlyFixedExpense,
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
