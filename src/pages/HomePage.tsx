import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarDays, CalendarPlus, PencilLine, Plus } from 'lucide-react'
import { db } from '../services/storage/db'
import { activeGoalTotal, forecastBalance, goalGap } from '../features/finance/finance'
import { currency, dateLabel, daysUntil, formatDate } from '../utils/format'
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
  const countdowns = useLiveQuery(async () => {
    const items = await db.countdowns.filter((countdown) => countdown.showOnHome).toArray()
    return items.sort((left, right) => Number(right.pinned) - Number(left.pinned) || left.targetDate.localeCompare(right.targetDate))
  }, []) ?? []
  const builds = useLiveQuery(() => db.builds.orderBy('updatedAt').reverse().toArray(), []) ?? []
  if (!finance) return <PageSkeleton />

  const forecast = forecastBalance(finance)
  const planTotal = activeGoalTotal(goals)
  const gap = goalGap(finance, goals)
  const ratio = planTotal ? (forecast / planTotal) * 100 : 0
  const primaryCountdown = countdowns[0]
  const days = primaryCountdown ? daysUntil(primaryCountdown.targetDate) : 999
  const priorityBuilds = builds.filter((build) => build.favorite).slice(0, 3)
  const budgetRows = goals.filter((goal) => goal.active).slice(0, 3)

  return (
    <main className="page home-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">双十一购机计划</p>
          <h1>个人资金计划</h1>
        </div>
        <button className="icon-button desktop-only" type="button" onClick={onAddBuild} aria-label="添加配置" title="添加配置">
          <Plus size={22} />
        </button>
      </header>

      <section className="runway-card" aria-label="资金总览">
        <div className="runway-card__topline">
          <span>我的购机资金</span>
          <button type="button" onClick={onEditFinance} aria-label="编辑资金计划"><PencilLine size={17} /> 编辑</button>
        </div>
        <div className="runway-card__amount">{currency.format(finance.currentBalance)}</div>
        <div className="runway-card__forecast">
          <div>
            <span>预计双十一可用资金</span>
            <strong>{currency.format(forecast)}</strong>
          </div>
          <div>
            <span>购机目标</span>
            <strong>{currency.format(planTotal || finance.targetBudget)}</strong>
          </div>
        </div>
        <div className="runway-scale" aria-hidden="true">
          <span className="runway-scale__fill" style={{ width: `${Math.min(100, ratio)}%` }} />
          <i style={{ left: `${Math.min(96, Math.max(4, ratio))}%` }} />
        </div>
        <div className="runway-card__status">
          <span>{Math.round(Math.min(100, Math.max(0, ratio)))}% 已覆盖</span>
          <strong className={gap >= 0 ? 'text-positive' : 'text-risk'}>{gap >= 0 ? `预计余量 ${currency.format(gap)}` : `还差 ${currency.format(Math.abs(gap))}`}</strong>
        </div>
        <p className="runway-card__updated">更新于 {formatDate(finance.updatedAt.slice(0, 10))}</p>
      </section>

      <section className="countdown-card" aria-label="双十一倒计时">
        <div className="countdown-card__topline">
          <span><CalendarDays size={18} /> {primaryCountdown?.name ?? '双十一'}</span>
          <button type="button" onClick={onAddCountdown} aria-label="添加倒数日"><CalendarPlus size={18} /></button>
        </div>
        {primaryCountdown ? (
          <>
            <div className="countdown-card__number">{days >= 0 ? days : `+${Math.abs(days)}`}<small>天</small></div>
            <div className="countdown-card__date">{formatDate(primaryCountdown.targetDate)} · {primaryCountdown.targetTime}</div>
            <p>{primaryCountdown.note || dateLabel(days)}</p>
          </>
        ) : (
          <button className="countdown-card__empty" type="button" onClick={onAddCountdown}>添加重要日期</button>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">预算状态</p><h2>资金怎么分配</h2></div>
          <button className="text-button" type="button" onClick={onEditFinance}>调整</button>
        </div>
        <dl className="budget-list">
          {budgetRows.length ? budgetRows.map((goal) => (
            <div key={goal.id}><dt>{goal.name}</dt><dd>{currency.format(goal.budget)}</dd></div>
          )) : <div><dt>购机预算</dt><dd>{currency.format(finance.targetBudget)}</dd></div>}
          <div className="budget-list__total"><dt>预计可用</dt><dd>{currency.format(forecast)}</dd></div>
        </dl>
      </section>

      <section className="section-block favorites-section">
        <div className="section-heading">
          <div><p className="eyebrow">最近关注</p><h2>{priorityBuilds.length ? `${priorityBuilds.length} 个重点方案` : '还没有重点候选'}</h2></div>
          <button className="text-button" type="button" onClick={onCompare}>去对比 <ArrowRight size={16} /></button>
        </div>
        <div className="home-favorites">
          {priorityBuilds.map((build) => (
            <button className="home-favorite-card" type="button" key={build.id} onClick={() => onOpenBuild(build)}>
              <div className="home-favorite-card__icon">{build.components.gpu.value.match(/\d{4}/)?.[0] ?? 'PC'}</div>
              <div className="home-favorite-card__copy">
                <span>{build.platform} · {build.store || '店铺待补充'}</span>
                <strong>{build.title}</strong>
                <small>{build.components.cpu.value.replace('AMD Ryzen 7 ', '')} · {build.components.gpu.value.replace('NVIDIA GeForce ', '')}</small>
              </div>
              <div className="home-favorite-card__price"><strong>{currency.format(build.price)}</strong><span>{build.completeness}% 完整</span><ArrowRight size={16} /></div>
            </button>
          ))}
          {!priorityBuilds.length && <div className="empty-state compact"><p>把值得持续关注的方案标为重点，首页会集中显示。</p><button className="secondary-button" type="button" onClick={onAddBuild}>添加第一个方案</button></div>}
        </div>
        {priorityBuilds.length > 0 && <button className="home-add-button" type="button" onClick={onAddBuild}><Plus size={18} /> 添加配置</button>}
      </section>
    </main>
  )
}

function PageSkeleton() {
  return <main className="page"><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-row" /></main>
}
