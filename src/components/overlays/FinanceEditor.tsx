import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Save } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { db } from '../../services/storage/db'
import type { FinancialPlan, PurchaseGoal } from '../../types/models'
import { createId } from '../../utils/ids'

interface Props {
  open: boolean
  onClose: () => void
  notify: (message: string, tone?: 'success' | 'error') => void
}

function currentMonthEnd() {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function FinanceEditor({ open, onClose, notify }: Props) {
  const storedPlan = useLiveQuery(() => db.financePlans.get('primary'))
  const storedGoals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const [plan, setPlan] = useState<FinancialPlan | null>(null)
  const [goals, setGoals] = useState<PurchaseGoal[]>([])

  useEffect(() => { if (open && storedPlan) { setPlan({ ...storedPlan, extraIncomeDate: storedPlan.extraIncomeDate ?? currentMonthEnd() }); setGoals(storedGoals) } }, [open, storedGoals, storedPlan])
  if (!plan) return null
  const number = (key: keyof FinancialPlan, value: string) => setPlan({ ...plan, [key]: Math.max(0, Number(value) || 0) })
  const updateGoal = (id: string, patch: Partial<PurchaseGoal>) => setGoals((items) => items.map((goal) => goal.id === id ? { ...goal, ...patch } : goal))
  const addGoal = () => setGoals((items) => [...items, { id: createId('goal'), name: '新购买目标', category: '其他', budget: 0, targetDate: plan.targetDate, active: true }])
  const save = async () => {
    await db.transaction('rw', db.financePlans, db.goals, async () => {
      await db.financePlans.put({ ...plan, updatedAt: new Date().toISOString() })
      await db.goals.bulkPut(goals)
    })
    notify('资金计划已更新')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="更新资金计划" description="预测只计算真正进入购机资金池的金额，不会把工资和工资内储蓄重复相加。" size="wide">
      <div className="finance-formula-note">
        <strong>预计资金 = 当前资金 + 计划一次性存入 + 后续每月（实际存下 + 公积金提取）</strong>
        <p>每月工资与固定消耗仅用于帮助你核对储蓄计划，不会再次加入预计资金。</p>
      </div>
      <div className="form-grid">
        <label><span>当前资金</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.currentBalance} onChange={(event) => number('currentBalance', event.target.value)} /></div></label>
        <label><span>目标预算</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.targetBudget} onChange={(event) => number('targetBudget', event.target.value)} /></div></label>
        <label><span>每月工资（参考）</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.monthlyIncome} onChange={(event) => number('monthlyIncome', event.target.value)} /></div></label>
        <label><span>每月固定消耗（参考）</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.monthlyFixedExpense} onChange={(event) => number('monthlyFixedExpense', event.target.value)} /></div></label>
        <label><span>工资中每月实际存下</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.monthlySaving} onChange={(event) => number('monthlySaving', event.target.value)} /></div></label>
        <label><span>每月公积金提取</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.housingFund} onChange={(event) => number('housingFund', event.target.value)} /></div></label>
        <label><span>一次性存入金额</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={plan.extraIncome} onChange={(event) => number('extraIncome', event.target.value)} /></div></label>
        <label><span>一次性存入日期</span><input type="date" value={plan.extraIncomeDate ?? ''} onChange={(event) => setPlan({ ...plan, extraIncomeDate: event.target.value })} /></label>
        <label><span>预测目标日期</span><input type="date" value={plan.targetDate} onChange={(event) => setPlan({ ...plan, targetDate: event.target.value })} /></label>
      </div>

      <div className="editor-divider" />
      <div className="section-heading"><div><p className="eyebrow">资金池</p><h3>购买目标</h3></div><button className="text-button" type="button" onClick={addGoal}><Plus size={16} /> 新目标</button></div>
      <div className="goal-editor-list">
        {goals.map((goal) => (
          <div className="goal-editor-row" key={goal.id}>
            <label className="check-control"><input type="checkbox" checked={goal.active} onChange={(event) => updateGoal(goal.id, { active: event.target.checked })} /><span /></label>
            <input aria-label="目标名称" value={goal.name} onChange={(event) => updateGoal(goal.id, { name: event.target.value })} />
            <select aria-label="目标分类" value={goal.category} onChange={(event) => updateGoal(goal.id, { category: event.target.value as PurchaseGoal['category'] })}><option>电脑</option><option>手机</option><option>显示器</option><option>其他</option></select>
            <div className="money-input"><i>¥</i><input aria-label="目标预算" type="number" value={goal.budget} onChange={(event) => updateGoal(goal.id, { budget: Math.max(0, Number(event.target.value) || 0) })} /></div>
          </div>
        ))}
      </div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={save}><Save size={18} /> 保存计划</button></div>
    </Modal>
  )
}
