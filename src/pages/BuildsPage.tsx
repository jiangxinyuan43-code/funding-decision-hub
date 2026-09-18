import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Filter, Heart, Plus, Search, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { db } from '../services/storage/db'
import type { BuildStatus, PCBuild } from '../types/models'
import { currency } from '../utils/format'
import { Progress } from '../components/ui/Progress'
import { buildSchemeNameMap } from '../features/pc-build/buildNames'

const statusLabels: Record<BuildStatus | 'all', string> = {
  all: '全部',
  pending: '待分析',
  watching: '观察中',
  candidate: '候选',
  priority: '重点候选',
  rejected: '已淘汰',
  purchased: '已购买',
}

export function BuildsPage({ onAdd, onOpen }: { onAdd: () => void; onOpen: (build: PCBuild) => void }) {
  const builds = useLiveQuery(() => db.builds.toArray(), []) ?? []
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<BuildStatus | 'all'>('all')
  const [sort, setSort] = useState('updated')
  const [showFilters, setShowFilters] = useState(false)
  const schemeNames = useMemo(() => buildSchemeNameMap(builds), [builds])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return builds
      .filter((build) => status === 'all' || build.status === status)
      .filter((build) => !needle || [build.title, build.store, build.platform, ...build.tags, ...Object.values(build.components).map((field) => field.value)].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === 'price-low') return a.price - b.price
        if (sort === 'price-high') return b.price - a.price
        if (sort === 'completeness') return b.completeness - a.completeness
        if (sort === 'favorite') return Number(b.favorite) - Number(a.favorite)
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [builds, query, sort, status])

  const pendingUnknowns = builds.filter((build) => Object.values(build.components).some((field) => !field.value || field.confidence < 0.75)).length

  return (
    <main className="page builds-page">
      <header className="page-heading">
        <div><p className="eyebrow">配置库</p><h1>收藏的整机方案</h1></div>
        <button className="primary-icon-button" type="button" onClick={onAdd} aria-label="添加整机方案"><Plus size={22} /></button>
      </header>

      <section className="stats-strip" aria-label="配置统计">
        <div><strong>{builds.length}</strong><span>收藏方案</span></div>
        <div><strong>{builds.filter((build) => build.favorite).length}</strong><span>重点候选</span></div>
        <div><strong>{pendingUnknowns}</strong><span>待确认</span></div>
        <div><strong>{builds.filter((build) => build.status === 'rejected').length}</strong><span>已淘汰</span></div>
      </section>

      <div className="search-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 CPU、GPU、店铺或标签" />
        </label>
        <button className={showFilters ? 'icon-button is-active' : 'icon-button'} type="button" onClick={() => setShowFilters((value) => !value)} aria-label="筛选和排序"><SlidersHorizontal size={19} /></button>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <label><span><Filter size={15} /> 状态</span><select value={status} onChange={(event) => setStatus(event.target.value as BuildStatus | 'all')}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">最近更新</option><option value="price-low">价格低到高</option><option value="price-high">价格高到低</option><option value="completeness">配置完整度</option><option value="favorite">重点关注</option></select></label>
        </div>
      )}

      <div className="build-grid">
        {filtered.map((build) => {
          const unknowns = Object.values(build.components).filter((field) => !field.value || field.confidence < 0.75 || /未明确|未知/.test(field.value)).length
          return (
            <button className="build-card" type="button" key={build.id} onClick={() => onOpen(build)}>
              <div className="build-card__head">
                <span className={`status-pill status-pill--${build.status}`}>{statusLabels[build.status]}</span>
                {build.favorite && <Heart size={17} fill="currentColor" aria-label="重点关注" />}
              </div>
              <div className="build-card__title"><div><h2>{schemeNames[build.id]}</h2><p>{build.title}</p></div><strong>{currency.format(build.price)}</strong></div>
              <div className="build-card__specs">
                <span><small>CPU</small>{build.components.cpu.value || '待补充'}</span>
                <span><small>GPU</small>{build.components.gpu.value || '待补充'} {build.components.vram.value && `· ${build.components.vram.value}`}</span>
                <span><small>RAM / SSD</small>{build.components.ram.value || '—'} · {build.components.ssd.value || '—'}</span>
              </div>
              <Progress value={build.completeness} label="配置完整度" tone={build.completeness < 75 ? 'amber' : 'green'} />
              <div className="build-card__foot"><span>{build.platform} · {build.store || '店铺待补充'}</span>{unknowns > 0 && <span className="risk-inline"><TriangleAlert size={14} /> {unknowns} 项待确认</span>}</div>
              <div className="tag-row">{build.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </button>
          )
        })}
      </div>
      {!filtered.length && <div className="empty-state"><Search size={28} /><h2>没有匹配的方案</h2><p>调整搜索或筛选条件，或者收藏一个新方案。</p><button className="secondary-button" type="button" onClick={onAdd}>添加整机方案</button></div>}
    </main>
  )
}
