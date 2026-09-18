import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BrainCircuit, Check, GitCompareArrows, LoaderCircle, TriangleAlert } from 'lucide-react'
import { db } from '../services/storage/db'
import { compareBuildsLocally } from '../features/comparison/localComparison'
import { createAIProvider } from '../services/ai/client'
import { componentLabels, type ComparisonDimension, type ComponentKey, type PCBuild } from '../types/models'
import { currency } from '../utils/format'

const scoreLabels: Array<{ key: ComparisonDimension; label: string }> = [
  { key: 'performance', label: '性能' }, { key: 'value', label: '性价比' }, { key: 'compatibility', label: '兼容性与稳定性' },
  { key: 'upgrade', label: '扩展与升级' }, { key: 'thermals', label: '散热与噪音' }, { key: 'afterSales', label: '售后与风险' },
]

function displayName(build: PCBuild, builds: PCBuild[]) {
  const index = builds.findIndex((item) => item.id === build.id)
  const match = build.title.match(/(9800X3D|7800X3D|9950X3D|7950X3D).*?(RTX\s*\d{4}(?:\s*Ti)?)/i)
  return match ? `${match[1]} + ${match[2]}` : `方案${String.fromCharCode(65 + Math.max(0, index))}`
}

export function ComparePage({ notify }: { notify: (message: string, tone?: 'success' | 'error') => void }) {
  const builds = useLiveQuery(() => db.builds.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get('primary'))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<ReturnType<typeof compareBuildsLocally> | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const initializedSelection = useRef(false)

  useEffect(() => {
    if (!initializedSelection.current && builds.length >= 2) { initializedSelection.current = true; setSelectedIds(builds.map((build) => build.id)) }
  }, [builds])

  const selected = useMemo(() => selectedIds.map((id) => builds.find((build) => build.id === id)).filter(Boolean) as typeof builds, [builds, selectedIds])
  const localAnalysis = useMemo(() => compareBuildsLocally(selected), [selected])
  const displayAnalysis = analysis ?? localAnalysis
  const report = displayAnalysis.report
  const keys = Object.keys(componentLabels) as ComponentKey[]
  const isUnknown = (value: string, confidence: number) => !value || confidence < 0.75 || /未明确|未知/.test(value)

  const toggle = (id: string) => { setAnalysis(null); setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  const runAI = async () => {
    if (!settings) return
    if (selected.length < 2) return notify('请先选择至少两个方案', 'error')
    setIsAnalyzing(true)
    try { const result = await createAIProvider(settings).compareBuilds(selected); setAnalysis(result); notify(result.source === 'hybrid' ? 'AI 补充已合并，评分仍以本地核验为准' : '已生成报告；AI 异常部分已自动降级') }
    catch (error) { setAnalysis(localAnalysis); notify(error instanceof Error ? error.message : 'AI 对比失败', 'error') }
    finally { setIsAnalyzing(false) }
  }

  return <main className="page compare-page">
    <header className="page-heading"><div><p className="eyebrow">结论优先</p><h1>购机决策报告</h1><p className="page-heading__note">先看排名，再核对配置和风险。</p></div><span className="selection-count">{selected.length} 项</span></header>
    <section className="compare-picker" aria-label="选择对比方案">{builds.map((build) => { const active = selectedIds.includes(build.id); return <button className={active ? 'compare-pick is-active' : 'compare-pick'} type="button" key={build.id} onClick={() => toggle(build.id)} aria-pressed={active}><span>{active ? <Check size={15} /> : null}</span><div><strong>{displayName(build, builds)}</strong><small>{currency.format(build.price)} · {build.title}</small></div></button> })}</section>
    {selected.length < 2 ? <div className="empty-state"><GitCompareArrows size={30} /><h2>至少选择 2 个方案</h2><p>默认纳入配置库中的全部方案，也可以取消不需要的项目。</p></div> : <>
      {report && <>
        <section className="decision-summary" aria-label="最终推荐"><div className="decision-summary__label">最终推荐</div><h2>{report.winner} <span>首选</span></h2><p>{report.coreReason}</p><div className="decision-summary__answers"><div><small>第二推荐</small><strong>{report.runnerUp}</strong></div><div><small>不建议</small><strong>{report.avoid}</strong></div></div><p className="decision-summary__assumption">评分假设：{report.assumption}</p></section>
        <section className="section-block report-section"><div className="section-heading"><div><p className="eyebrow">总评分与排名</p><h2>明确排序</h2></div><button className="secondary-button" type="button" onClick={runAI} disabled={isAnalyzing}>{isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <BrainCircuit size={17} />}{isAnalyzing ? '分析中' : 'AI 补充'}</button></div><div className="ranking-list">{report.rankings.map((item) => <article className={`ranking-row ranking-row--${item.recommendation === '不建议' ? 'risk' : item.rank === 1 ? 'winner' : 'normal'}`} key={item.buildId}><div className="ranking-row__rank">{item.rank}</div><div className="ranking-row__main"><div><strong>{item.shortTitle}</strong><span>{item.recommendation} · {item.headline}</span></div><b>{item.total}<small>/100</small></b><div className="score-mini">{scoreLabels.map(({ key, label }) => <span key={key}>{label} {item.scores[key]}</span>)}</div></div></article>)}</div></section>
        <section className="section-block report-section"><div className="section-heading"><div><p className="eyebrow">需求假设</p><h2>为什么这样分配权重</h2></div><span>合计 100%</span></div><div className="weight-list">{report.weights.map((item) => <div className="weight-row" key={item.key}><div><strong>{item.label}</strong><p>{item.reason}</p></div><b>{item.weight}%</b></div>)}</div></section>
        <section className="section-block report-section"><div className="section-heading"><div><p className="eyebrow">性能与体验预估</p><h2>实际使用会怎样</h2></div></div><div className="bullet-report">{report.experience.map((item) => <p key={item}>{item}</p>)}</div></section>
        <section className="section-block report-section"><div className="section-heading"><div><p className="eyebrow">性价比</p><h2>每元性能与价格判断</h2></div></div><div className="bullet-report">{report.valueNotes.map((item) => <p key={item}>{item}</p>)}<p className="report-footnote">{report.priceFreshness}</p></div></section>
      </>}
      <section className="section-block risk-report report-section"><div className="section-heading"><div><p className="eyebrow">风险、短板与坑点</p><h2>下单前逐台核验</h2></div><span>{selected.length} 个方案</span></div><div className="risk-report__list">{selected.map((build) => { const items = displayAnalysis.risks[build.title] ?? []; return <article key={build.id}><h3>{displayName(build, builds)}</h3>{items.length ? items.map((item) => <p key={item}><TriangleAlert size={15} /> {item}</p>) : <p><Check size={15} /> 当前记录没有待确认项</p>}</article> })}</div></section>
      <section className="section-block comparison-table-wrap report-section"><div className="section-heading"><div><p className="eyebrow">核心配置对比</p><h2>先看影响结论的部件</h2></div><span>{selected.length} 个方案</span></div><div className="comparison-mobile"><article className="comparison-group comparison-group--price"><h3>价格与店铺</h3>{selected.map((build) => <div key={build.id}><span>{displayName(build, builds)}</span><strong>{currency.format(build.price)}<small>{build.platform} · {build.store || '店铺未知'}</small></strong></div>)}</article>{keys.map((key) => { const values = selected.map((build) => build.components[key].value || '未明确'); const differs = new Set(values).size > 1; return <article className={differs ? 'comparison-group has-difference' : 'comparison-group'} key={key}><h3>{componentLabels[key]}{differs && <small>有差异</small>}</h3>{selected.map((build) => { const field = build.components[key]; return <div className={isUnknown(field.value, field.confidence) ? 'is-unknown' : ''} key={build.id}><span>{displayName(build, builds)}</span><strong>{field.value || '未明确'}{isUnknown(field.value, field.confidence) && <small>需确认</small>}</strong></div> })}</article> })}</div><div className="comparison-table-scroller desktop-comparison"><table className="comparison-table"><thead><tr><th>项目</th>{selected.map((build) => <th key={build.id}><span>{displayName(build, builds)}</span><strong>{currency.format(build.price)}</strong></th>)}</tr></thead><tbody>{keys.map((key) => <tr key={key}><th>{componentLabels[key]}</th>{selected.map((build) => { const field = build.components[key]; return <td className={isUnknown(field.value, field.confidence) ? 'is-unknown' : ''} key={build.id}>{field.value || '未明确'}{isUnknown(field.value, field.confidence) && <small>需确认</small>}</td> })}</tr>)}<tr><th>店铺</th>{selected.map((build) => <td key={build.id}>{build.platform} · {build.store || '未填写'}</td>)}</tr></tbody></table></div></section>
      {report && <section className="final-conclusion"><p className="eyebrow">最终结论</p><h2>{report.finalSentence}</h2><div className="final-conclusion__check"><strong>下单前必须确认</strong><span>电源具体型号</span><span>主板完整型号</span><span>SSD 品牌与质保</span></div></section>}
    </>}
  </main>
}
