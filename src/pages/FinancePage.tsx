import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CircleDollarSign, Pencil, Target } from 'lucide-react'
import { db } from '../services/storage/db'
import { activeGoalTotal, buildForecast, forecastBalance, goalGap, monthlyNet } from '../features/finance/finance'
import { currency, formatDate } from '../utils/format'

export function FinancePage({ onEdit }: { onEdit: () => void }) {
  const plan = useLiveQuery(() => db.financePlans.get('primary'))
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  if (!plan) return <main className="page"><div className="skeleton skeleton-card" /></main>
  const forecast = forecastBalance(plan)
  const points = buildForecast(plan)
  const maxBalance = Math.max(plan.targetBudget, ...points.map((point) => point.balance))
  const gap = goalGap(plan, goals)

  return (
    <main className="page finance-page">
      <header className="page-heading">
        <div><p className="eyebrow">资金预测</p><h1>把目标放进时间里</h1></div>
        <button className="icon-button" type="button" onClick={onEdit} aria-label="编辑资金计划" title="编辑资金计划"><Pencil size={20} /></button>
      </header>

      <section className="finance-summary-grid">
        <article className="metric-panel metric-panel--dark">
          <span>目标日预计资金</span>
          <strong>{currency.format(forecast)}</strong>
          <p>{formatDate(plan.targetDate)} · 每月净增加 {currency.format(monthlyNet(plan))}</p>
        </article>
        <article className="metric-panel"><span>计划总额</span><strong>{currency.format(activeGoalTotal(goals))}</strong><p>{goals.filter((goal) => goal.active).length} 个进行中目标</p></article>
        <article className="metric-panel"><span>预计余量</span><strong className={gap >= 0 ? 'text-positive' : 'text-risk'}>{currency.format(gap)}</strong><p>{gap >= 0 ? '预计可覆盖当前计划' : '需要降低预算或提高储蓄'}</p></article>
      </section>

      <section className="section-block chart-panel">
        <div className="section-heading"><div><p className="eyebrow">资金时间线</p><h2>余额预测</h2></div><span className="legend-dot">预计余额</span></div>
        <div className="bar-chart" role="img" aria-label="资金余额预测柱状图">
          {points.map((point) => (
            <div className="bar-chart__item" key={point.date}>
              <span className="bar-chart__value">{Math.round(point.balance / 1000)}k</span>
              <div className="bar-chart__track"><i style={{ height: `${Math.max(8, (point.balance / maxBalance) * 100)}%` }} /></div>
              <span>{point.label}</span>
            </div>
          ))}
        </div>
        <div className="chart-footnote">计算口径：当前资金 + 指定日期的一次性存入 + 后续每月（工资中实际存下 + 公积金提取）</div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">资金池</p><h2>购买目标</h2></div><button className="text-button" type="button" onClick={onEdit}>管理</button></div>
        <div className="goal-list">
          {goals.map((goal) => (
            <article className={goal.active ? 'goal-row' : 'goal-row is-muted'} key={goal.id}>
              <div className="goal-icon">{goal.active ? <Target size={19} /> : <Check size={19} />}</div>
              <div><strong>{goal.name}</strong><span>{goal.category} · {formatDate(goal.targetDate)}</span></div>
              <strong className="goal-budget">{currency.format(goal.budget)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">每月流入流出</p><h2>计划构成</h2></div><CircleDollarSign size={20} /></div>
        <dl className="money-ledger">
          <div><dt>每月工资（参考）</dt><dd>{currency.format(plan.monthlyIncome)}</dd></div>
          <div><dt>工资中实际存下</dt><dd>+ {currency.format(plan.monthlySaving)}</dd></div>
          <div><dt>公积金预计提取</dt><dd>+ {currency.format(plan.housingFund)}</dd></div>
          <div><dt>固定消耗（参考）</dt><dd>{currency.format(plan.monthlyFixedExpense)}</dd></div>
          <div className="money-ledger__total"><dt>每月净增加</dt><dd>{currency.format(monthlyNet(plan))}</dd></div>
        </dl>
      </section>
    </main>
  )
}
