import { describe, expect, it } from 'vitest'
import { activeGoalTotal, buildForecast, forecastBalance, goalGap, monthlyNet } from './finance'
import type { FinancialPlan, PurchaseGoal } from '../../types/models'

const plan: FinancialPlan = {
  id: 'primary',
  currentBalance: 10_000,
  monthlyIncome: 4_956,
  monthlyFixedExpense: 2_000,
  monthlySaving: 2_000,
  extraIncome: 1_000,
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
    expect(monthlyNet(plan)).toBe(6_456)
  })

  it('includes one-time income and full months through target month', () => {
    const now = new Date('2026-09-17T08:00:00+08:00')
    expect(forecastBalance(plan, now)).toBe(23_912)
    expect(buildForecast(plan, now)).toHaveLength(3)
  })

  it('uses only active goals in the shared funding pool', () => {
    expect(activeGoalTotal(goals)).toBe(17_100)
    expect(goalGap(plan, goals, new Date('2026-09-17T08:00:00+08:00'))).toBe(6_812)
  })
})
