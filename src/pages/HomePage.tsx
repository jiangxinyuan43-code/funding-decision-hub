import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarPlus, GitCompareArrows, Plus, Sparkles, TriangleAlert, WalletCards } from 'lucide-react'
import { db } from '../services/storage/db'
import { activeGoalTotal, forecastBalance, goalGap } from '../features/finance/finance'
import { currency, dateLabel, daysUntil, formatDate } from '../utils/format'
import { Progress } from '../components/ui/Progress'
import type { PCBuild } from '../types/models'

interface HomePageProps {
  onAddBuild: () => void
  onEditFinance: () => void
  onAddCountdown: () => void
  onCompare: () => void
  onOpenBuild: (build: PCBuild) => void
}

export function HomePage({ onAddBuild, onEditFinance, onAddCountdown, onCompare, onOpenBuild }: HomePageProps) {
  const finance = useLiveQuery(() => db.financePlans.get('primary'))
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const countdowns = useLiveQuery(() => db.countdowns.filter((countdown) => countdown.showOnHome).sortBy('targetDate'), []) ?? []
  const builds = useLiveQuery(() => db.builds.orderBy('updatedAt').reverse().toArray(), []) ?? []
  if (!finance) return <PageSkeleton />

  const forecast = forecastBalance(finance)
  const planTotal = activeGoalTotal(goals)
  const gap = goalGap(finance, goals)
  const ratio = planTotal ? (forecast / planTotal) * 100 : 0
  const primaryCountdown = countdowns[0]
  const days = primaryCountdown ? daysUntil(primaryCountdown.targetDate) : 999
  const priorityBuilds = builds.filter((build) => build.favorite).slice(0, 3)
  const unknownCount = builds.flatMap((build) => Object.values(build.components)).filter((field) => !field.value || field.confidence < 0.75 || /未明确|未知/.test(field.value)).length
  const isDecisionMode = days >= 0 && days <= 30

  return (
    <main className="page home-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{isDecisionMode ? '双十一决策模式' : '个人决策工作台'}</p>
          <h1>{isDecisionMode ? '进入最后收敛期' : '今天的资金与候选'}</h1>
        </div>
        <button className="icon-button desktop-only" type="button" onClick={onAddBuild} aria-label="添加配置" title="添加配置">
          <Plus size={22} />
        </button>
      </header>

      <section className="runway-card" aria-label="资金总览">
        <div className="runway-card__topline">
          <span>当前可用资金</span>
          <span>更新于 {formatDate(finance.updatedAt.slice(0, 10))}</span>
        </div>
        <div className="runway-card__amount">{currency.format(finance.currentBalance)}</div>
        <div className="runway-card__forecast">
          <div>
            <span>预计 {formatDate(finance.targetDate)}</span>
            <strong>{currency.format(forecast)}</strong>
          </div>
          <div>
            <span>全部目标</span>
            <strong>{currency.format(planTotal || finance.targetBudget)}</strong>
          </div>
        </div>
        <div className="runway-scale" aria-hidden="true">
          <span className="runway-scale__fill" style={{ width: `${Math.min(100, ratio)}%` }} />
          <i style={{ left: `${Math.min(96, Math.max(4, ratio))}%` }} />
        </div>
        <div className="runway-card__status">
          <span>{gap >= 0 ? '预计资金覆盖全部计划' : `当前计划比预计资金高 ${currency.format(Math.abs(gap))}`}</span>
          <strong className={gap >= 0 ? 'text-positive' : 'text-risk'}>{gap >= 0 ? `余量 ${currency.format(gap)}` : `缺口 ${currency.format(Math.abs(gap))}`}</strong>
        </div>
      </section>

      {isDecisionMode && (
        <section className="decision-strip">
          <div><Sparkles size={18} /><span>候选 {builds.filter((build) => ['candidate', 'priority'].includes(build.status)).length}</span></div>
          <div><span>重点 {priorityBuilds.length}</span></div>
          <div><TriangleAlert size={18} /><span>待确认 {unknownCount}</span></div>
        </section>
      )}

      <section className="quick-actions" aria-label="快捷操作">
        <button type="button" onClick={onAddBuild}><Plus size={20} /><span>添加配置</span></button>
        <button type="button" onClick={onEditFinance}><WalletCards size={20} /><span>更新资金</span></button>
        <button type="button" onClick={onAddCountdown}><CalendarPlus size={20} /><span>倒数日</span></button>
        <button type="button" onClick={onCompare}><GitCompareArrows size={20} /><span>开始对比</span></button>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">时间节点</p><h2>接下来</h2></div>
          <button className="text-button" type="button" onClick={onAddCountdown}>添加</button>
        </div>
        <div className="countdown-grid">
          {countdowns.slice(0, 3).map((countdown, index) => {
            const remaining = daysUntil(countdown.targetDate)
            return (
              <article className={index === 0 ? 'countdown-item is-primary' : 'countdown-item'} key={countdown.id}>
                <div className="countdown-item__date"><span>{formatDate(countdown.targetDate).slice(5)}</span><small>{countdown.targetTime}</small></div>
                <div><strong>{countdown.name}</strong><p>{countdown.note || dateLabel(remaining)}</p></div>
                <span className="countdown-days">{remaining >= 0 ? remaining : `+${Math.abs(remaining)}`}<small>天</small></span>
              </article>
            )
          })}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">我的重点候选</p><h2>{priorityBuilds.length ? `${priorityBuilds.length} 个方案` : '还没有重点候选'}</h2></div>
          <button className="text-button" type="button" onClick={onCompare}>去对比 <ArrowRight size={16} /></button>
        </div>
        <div className="candidate-list">
          {priorityBuilds.map((build) => (
            <button className="candidate-row" type="button" key={build.id} onClick={() => onOpenBuild(build)}>
              <div className="candidate-rank">{build.components.gpu.value.match(/\d{4}/)?.[0] ?? 'PC'}</div>
              <div className="candidate-row__main">
                <strong>{build.title}</strong>
                <span>{build.components.cpu.value.replace('AMD Ryzen 7 ', '')} · {build.components.gpu.value.replace('NVIDIA GeForce ', '')}</span>
                <Progress value={build.completeness} />
              </div>
              <div className="candidate-row__price"><strong>{currency.format(build.price)}</strong><span>{build.completeness}% 完整</span></div>
            </button>
          ))}
          {!priorityBuilds.length && <div className="empty-state compact"><p>把值得持续关注的方案标为重点，首页会集中显示。</p><button className="secondary-button" type="button" onClick={onAddBuild}>添加第一个方案</button></div>}
        </div>
      </section>
    </main>
  )
}

function PageSkeleton() {
  return <main className="page"><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-row" /></main>
}
