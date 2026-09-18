import { describe, expect, it } from 'vitest'
import { activeGoalTotal, buildForecast, forecastBalance, goalGap, monthlyNet } from './finance'
import type { FinancialPlan, PurchaseGoal } from '../../types/models'

const plan: FinancialPlan = {
  id: 'primary',
  currentBalance: 10_000,
  monthlyIncome: 5_426,
  monthlyFixedExpense: 2_000,
  monthlySaving: 1_500,
  extraIncome: 4_000,
  extraIncomeDate: '2026-09-30',
  housingFund: 1_500,
  targetBudget: 17_000,
  targetDate: '2026-11-11',
  updatedAt: '2026-09-17T00:00:00.000Z',
}

const goals: PurchaseGoal[] = [
  { id: '1', name: '主机', category: '电脑', budget: 15_500, targetDate: '2026-11-11', active: true },
  { id: '2', name: '显示器', category: '显示器', budget: 1_600, targetDate: '2026-11-11', active: true },
  { id: '3', name: '暂停目标', category: '其他', budget: 9_999, targetDate: '2027-01-01', active: false },
]

describe('finance forecast', () => {
  it('calculates monthly net contribution', () => {
    expect(monthlyNet(plan)).toBe(3_000)
  })

  it('includes the current month deposit and only later month-end contributions before the target', () => {
    const now = new Date('2026-09-17T08:00:00+08:00')
    expect(forecastBalance(plan, now)).toBe(17_000)
    expect(buildForecast(plan, now)).toHaveLength(3)
  })

  it('does not count a dated one-time deposit again after it has passed', () => {
    const now = new Date('2026-10-01T08:00:00+08:00')
    expect(forecastBalance({ ...plan, currentBalance: 14_000 }, now)).toBe(17_000)
  })

  it('uses only active goals in the shared funding pool', () => {
    expect(activeGoalTotal(goals)).toBe(17_100)
    expect(goalGap(plan, goals, new Date('2026-09-17T08:00:00+08:00'))).toBe(-100)
  })
})
