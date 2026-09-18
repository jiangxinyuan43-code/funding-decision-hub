import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BrainCircuit, Check, ChevronDown, GitCompareArrows, LoaderCircle, TriangleAlert } from 'lucide-react'
import { db } from '../services/storage/db'
import { compareBuildsLocally } from '../features/comparison/localComparison'
import { buildSchemeNameMap } from '../features/pc-build/buildNames'
import { createAIProvider } from '../services/ai/client'
import { componentLabels, type ComponentKey, type PCBuild } from '../types/models'
import { currency } from '../utils/format'

type LocalAnalysis = ReturnType<typeof compareBuildsLocally>

export function ComparePage({ notify }: { notify: (message: string, tone?: 'success' | 'error') => void }) {
  const builds = useLiveQuery(() => db.builds.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get('primary'))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<{ selectionKey: string; value: LocalAnalysis } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const initializedSelection = useRef(false)

  useEffect(() => {
    if (!initializedSelection.current && builds.length >= 2) {
      initializedSelection.current = true
      setSelectedIds(builds.map((build) => build.id))
    }
  }, [builds])

  const schemeNames = useMemo(() => buildSchemeNameMap(builds), [builds])
  const selected = useMemo(() => selectedIds.map((id) => builds.find((build) => build.id === id)).filter(Boolean) as PCBuild[], [builds, selectedIds])
  const selectionKey = selected.map((build) => build.id).sort().join('|')
  const currentSelectionKey = useRef(selectionKey)
  currentSelectionKey.current = selectionKey
  const localAnalysis = useMemo(() => compareBuildsLocally(selected, schemeNames), [selected, schemeNames])
  const displayAnalysis = analysis?.selectionKey === selectionKey ? analysis.value : localAnalysis
  const report = displayAnalysis.report
  const keys = Object.keys(componentLabels) as ComponentKey[]
  const selectedNames = selected.map((build) => schemeNames[build.id]).join('、')
  const pendingCount = displayAnalysis.unknowns.length
  const winnerRanking = report?.rankings[0]
  const scoreLead = winnerRanking && report?.rankings[1] ? Math.round((winnerRanking.total - report.rankings[1].total) * 10) / 10 : 0
  const isUnknown = (value: string, confidence: number) => !value || confidence < 0.75 || /未明确|未知/.test(value)

  const toggle = (id: string) => {
    setAnalysis(null)
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const runAI = async () => {
    if (!settings) return
    if (selected.length < 2) return notify('请先选择至少两个方案', 'error')
    const requestSelectionKey = selectionKey
    setIsAnalyzing(true)
    try {
      const result = await createAIProvider(settings).compareBuilds(selected)
      if (currentSelectionKey.current !== requestSelectionKey) return
      setAnalysis({ selectionKey: requestSelectionKey, value: { ...result, report: localAnalysis.report } })
      notify(result.source === 'hybrid' ? 'AI 补充已合并，评分仍以本地核验为准' : '已生成报告；AI 异常部分已自动降级')
    } catch (error) {
      if (currentSelectionKey.current !== requestSelectionKey) return
      setAnalysis({ selectionKey: requestSelectionKey, value: localAnalysis })
      notify(error instanceof Error ? error.message : 'AI 对比失败', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return <main className="page compare-page">
    <header className="page-heading"><div><p className="eyebrow">结论优先</p><h1>购机决策报告</h1><p className="page-heading__note">选择变化后，结论和排名会立即重算。</p></div><span className="selection-count">{selected.length} 项</span></header>

    <section className="compare-picker" aria-label="选择对比方案">{builds.map((build) => {
      const active = selectedIds.includes(build.id)
      return <button className={active ? 'compare-pick is-active' : 'compare-pick'} type="button" key={build.id} onClick={() => toggle(build.id)} aria-pressed={active}>
        <span>{active ? <Check size={15} /> : null}</span>
        <div><strong>{schemeNames[build.id]}</strong><small>{currency.format(build.price)} · {build.title}</small></div>
      </button>
    })}</section>

    {selected.length < 2 ? <div className="empty-state"><GitCompareArrows size={30} /><h2>至少选择 2 个方案</h2><p>当前推荐已清空，重新勾选两个或更多方案后会立即生成。</p></div> : <>
      <p className="comparison-scope" aria-live="polite"><Check size={15} /> 当前仅比较：<strong>{selectedNames}</strong></p>

      {report && <>
        <section className="decision-summary" aria-label="最终推荐">
          <div className="decision-summary__label">当前首选</div>
          <h2>{report.winner} <span>第 1 名</span></h2>
          <p className="decision-summary__product">{winnerRanking?.title}</p>
          <p>{report.coreReason}</p>
          <div className="decision-summary__answers">
            <div><small>第二推荐</small><strong>{report.runnerUp}</strong></div>
            <div><small>领先分差</small><strong>{scoreLead > 0 ? `${scoreLead} 分` : '分数接近'}</strong></div>
            <div><small>待确认</small><strong>{pendingCount ? `${pendingCount} 项` : '无'}</strong></div>
          </div>
        </section>

        <section className="section-block report-section">
          <div className="section-heading"><div><p className="eyebrow">总评分与排名</p><h2>比较结果</h2></div><button className="secondary-button" type="button" onClick={runAI} disabled={isAnalyzing}>{isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <BrainCircuit size={17} />}{isAnalyzing ? '分析中' : 'AI 补充'}</button></div>
          <div className="ranking-list">{report.rankings.map((item) => <article className={`ranking-row ranking-row--${item.recommendation === '不建议' ? 'risk' : item.rank === 1 ? 'winner' : 'normal'}`} key={item.buildId}>
            <div className="ranking-row__rank">{item.rank}</div>
            <div className="ranking-row__main">
              <div><strong>{item.shortTitle}</strong><small>{item.title}</small><span>{item.recommendation} · {item.headline}</span></div>
              <b>{item.total}<small>/100</small></b>
              <div className="score-mini"><span>性能 {item.scores.performance}</span><span>性价比 {item.scores.value}</span><span>稳定性 {item.scores.compatibility}</span></div>
            </div>
          </article>)}</div>
        </section>

        <details className="report-details report-section">
          <summary>查看评分依据与使用体验 <ChevronDown size={17} /></summary>
          <div className="report-details__content">
            <p className="report-assumption"><strong>评分假设</strong>{report.assumption}</p>
            <section><div className="section-heading"><div><p className="eyebrow">权重</p><h2>为什么这样评分</h2></div><span>合计 100%</span></div><div className="weight-list">{report.weights.map((item) => <div className="weight-row" key={item.key}><div><strong>{item.label}</strong><p>{item.reason}</p></div><b>{item.weight}%</b></div>)}</div></section>
            <section><div className="section-heading"><div><p className="eyebrow">体验预估</p><h2>实际使用会怎样</h2></div></div><div className="bullet-report">{report.experience.map((item) => <p key={item}>{item}</p>)}</div></section>
            <section><div className="section-heading"><div><p className="eyebrow">价格判断</p><h2>性价比依据</h2></div></div><div className="bullet-report">{report.valueNotes.map((item) => <p key={item}>{item}</p>)}<p className="report-footnote">{report.priceFreshness}</p></div></section>
          </div>
        </details>
      </>}

      <section className="section-block risk-report report-section"><div className="section-heading"><div><p className="eyebrow">购买前核验</p><h2>{pendingCount ? `${pendingCount} 项信息影响判断` : '没有待确认项'}</h2></div><span>{selected.length} 个方案</span></div><div className="risk-report__list">{selected.map((build) => {
        const items = displayAnalysis.risks[build.title] ?? []
        return <article key={build.id}><h3>{schemeNames[build.id]}</h3><small>{build.title}</small>{items.length ? items.map((item) => <p key={item}><TriangleAlert size={15} /> {item}</p>) : <p><Check size={15} /> 当前记录没有待确认项</p>}</article>
      })}</div></section>

      <section className="section-block comparison-table-wrap report-section"><div className="section-heading"><div><p className="eyebrow">核心配置</p><h2>差异对照</h2></div><span>{selected.length} 个方案</span></div><div className="comparison-mobile"><article className="comparison-group comparison-group--price"><h3>价格与店铺</h3>{selected.map((build) => <div key={build.id}><span>{schemeNames[build.id]}</span><strong>{currency.format(build.price)}<small>{build.platform} · {build.store || '店铺未知'}</small></strong></div>)}</article>{keys.map((key) => {
        const values = selected.map((build) => build.components[key].value || '未明确')
        const differs = new Set(values).size > 1
        return <article className={differs ? 'comparison-group has-difference' : 'comparison-group'} key={key}><h3>{componentLabels[key]}{differs && <small>有差异</small>}</h3>{selected.map((build) => {
          const field = build.components[key]
          return <div className={isUnknown(field.value, field.confidence) ? 'is-unknown' : ''} key={build.id}><span>{schemeNames[build.id]}</span><strong>{field.value || '未明确'}{isUnknown(field.value, field.confidence) && <small>需确认</small>}</strong></div>
        })}</article>
      })}</div><div className="comparison-table-scroller desktop-comparison"><table className="comparison-table"><thead><tr><th>项目</th>{selected.map((build) => <th key={build.id}><span>{schemeNames[build.id]}</span><strong>{currency.format(build.price)}</strong></th>)}</tr></thead><tbody>{keys.map((key) => <tr key={key}><th>{componentLabels[key]}</th>{selected.map((build) => {
        const field = build.components[key]
        return <td className={isUnknown(field.value, field.confidence) ? 'is-unknown' : ''} key={build.id}>{field.value || '未明确'}{isUnknown(field.value, field.confidence) && <small>需确认</small>}</td>
      })}</tr>)}<tr><th>店铺</th>{selected.map((build) => <td key={build.id}>{build.platform} · {build.store || '未填写'}</td>)}</tr></tbody></table></div></section>
    </>}
  </main>
}
