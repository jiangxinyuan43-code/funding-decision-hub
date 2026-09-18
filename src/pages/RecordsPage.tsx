import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Clock3, History, TrendingDown } from 'lucide-react'
import { db } from '../services/storage/db'
import { PriceTrend } from '../components/ui/PriceTrend'
import { currency, formatDate } from '../utils/format'
import type { PCBuild } from '../types/models'
import { buildSchemeNameMap } from '../features/pc-build/buildNames'

type RecordsView = 'price' | 'activity'

export function RecordsPage({ onOpenBuild }: { onOpenBuild: (build: PCBuild) => void }) {
  const builds = useLiveQuery(() => db.builds.orderBy('updatedAt').reverse().toArray(), []) ?? []
  const [view, setView] = useState<RecordsView>('price')
  const schemeNames = buildSchemeNameMap(builds)
  const pricedBuilds = builds.filter((build) => build.priceHistory.length > 0)
  const totalRecords = builds.reduce((total, build) => total + build.priceHistory.length, 0)
  const falling = builds.filter((build) => build.priceHistory.length > 1 && build.priceHistory[build.priceHistory.length - 1]!.price < build.priceHistory[0].price).length

  return (
    <main className="page records-page">
      <header className="page-heading">
        <div><p className="eyebrow">历史记录</p><h1>价格与收藏</h1></div>
        <div className="header-symbol"><History size={22} /></div>
      </header>

      <section className="record-summary" aria-label="记录概览">
        <div><strong>{totalRecords}</strong><span>价格记录</span></div>
        <div><strong>{falling}</strong><span>正在降价</span></div>
        <div><strong>{builds.length}</strong><span>历史方案</span></div>
      </section>

      <div className="segmented-control records-segments" role="tablist" aria-label="记录类型">
        <button className={view === 'price' ? 'is-active' : ''} type="button" role="tab" aria-selected={view === 'price'} onClick={() => setView('price')}>价格变化</button>
        <button className={view === 'activity' ? 'is-active' : ''} type="button" role="tab" aria-selected={view === 'activity'} onClick={() => setView('activity')}>收藏记录</button>
      </div>

      {view === 'price' ? (
        <section className="records-list" aria-label="价格历史">
          {pricedBuilds.map((build) => {
            const prices = build.priceHistory.map((point) => point.price)
            const lowest = Math.min(...prices)
            return (
              <article className="price-record" key={build.id}>
                <button className="price-record__header" type="button" onClick={() => onOpenBuild(build)}>
                  <div><span>{build.platform} · {build.store || '店铺待补充'} · {build.title}</span><strong>{schemeNames[build.id]}</strong></div>
                  <ChevronRight size={19} />
                </button>
                <div className="price-record__stats">
                  <div><span>当前价格</span><strong>{currency.format(build.price)}</strong></div>
                  <div><span>历史最低</span><strong className={build.price === lowest ? 'text-success' : ''}>{currency.format(lowest)}</strong></div>
                  <div><span>首次记录</span><strong>{currency.format(build.priceHistory[0].price)}</strong></div>
                </div>
                <PriceTrend points={build.priceHistory} />
              </article>
            )
          })}
          {!pricedBuilds.length && <div className="empty-state"><TrendingDown size={28} /><h2>还没有价格变化</h2><p>再次保存同一商品的新价格后，这里会形成趋势。</p></div>}
        </section>
      ) : (
        <section className="activity-list" aria-label="收藏活动">
          {builds.map((build) => (
            <button type="button" key={build.id} onClick={() => onOpenBuild(build)}>
              <span className="activity-icon"><Clock3 size={18} /></span>
              <span className="activity-copy"><strong>{schemeNames[build.id]}</strong><small>{build.createdAt === build.updatedAt ? '收藏了这个方案' : '更新了配置或价格'} · {formatDate(build.updatedAt.slice(0, 10))}</small></span>
              <span className="activity-price">{currency.format(build.price)}</span>
              <ChevronRight size={18} />
            </button>
          ))}
        </section>
      )}
    </main>
  )
}
