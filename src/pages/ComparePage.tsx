import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BrainCircuit, Check, GitCompareArrows, LoaderCircle, TriangleAlert } from 'lucide-react'
import { db } from '../services/storage/db'
import { compareBuildsLocally } from '../features/comparison/localComparison'
import { createAIProvider } from '../services/ai/client'
import { componentLabels, type ComparisonAnalysis, type ComponentKey } from '../types/models'
import { currency } from '../utils/format'

export function ComparePage({ notify }: { notify: (message: string, tone?: 'success' | 'error') => void }) {
  const builds = useLiveQuery(() => db.builds.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get('primary'))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<ComparisonAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const initializedSelection = useRef(false)

  useEffect(() => {
    if (!initializedSelection.current && builds.length >= 2) {
      initializedSelection.current = true
      setSelectedIds(builds.map((build) => build.id))
    }
  }, [builds])

  const selected = useMemo(() => selectedIds.map((id) => builds.find((build) => build.id === id)).filter(Boolean) as typeof builds, [builds, selectedIds])
  const localAnalysis = useMemo(() => compareBuildsLocally(selected), [selected])
  const displayAnalysis = analysis ?? localAnalysis
  const keys = Object.keys(componentLabels) as ComponentKey[]
  const isUnknown = (value: string, confidence: number) => !value || confidence < 0.75 || /未明确|未知/.test(value)

  const toggle = (id: string) => {
    setAnalysis(null)
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const runAI = async () => {
    if (!settings) return
    if (selected.length < 2) return notify('请先选择至少两个方案', 'error')
    setIsAnalyzing(true)
    try {
      const result = await createAIProvider(settings).compareBuilds(selected)
      setAnalysis(result)
      notify(result.source === 'hybrid' ? '完整报告已加入 AI 分析' : '已生成完整报告；AI 格式异常部分已自动降级')
    } catch (error) {
      setAnalysis(localAnalysis)
      notify(error instanceof Error ? error.message : 'AI 对比失败', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="page compare-page">
      <header className="page-heading"><div><p className="eyebrow">智能对比</p><h1>完整对比报告</h1></div><span className="selection-count">{selected.length} 项</span></header>
      <section className="compare-picker" aria-label="选择对比方案">
        {builds.map((build) => {
          const active = selectedIds.includes(build.id)
          return <button className={active ? 'compare-pick is-active' : 'compare-pick'} type="button" key={build.id} onClick={() => toggle(build.id)} aria-pressed={active}><span>{active ? <Check size={15} /> : null}</span><div><strong>{build.title}</strong><small>{currency.format(build.price)}</small></div></button>
        })}
      </section>

      {selected.length < 2 ? (
        <div className="empty-state"><GitCompareArrows size={30} /><h2>至少选择 2 个方案</h2><p>默认纳入配置库中的全部方案，你也可以取消不需要的项目。</p></div>
      ) : (
        <>
          <section className="comparison-insights">
            <div className="section-heading"><div><p className="eyebrow">差异摘要</p><h2>{displayAnalysis.source === 'hybrid' ? 'AI + 本地核验报告' : '基于现有配置的完整报告'}</h2></div><button className="secondary-button" type="button" onClick={runAI} disabled={isAnalyzing}>{isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <BrainCircuit size={17} />}{isAnalyzing ? '分析中' : 'AI 分析'}</button></div>
            <div className="insight-grid">
              <article className="insight-block insight-block--blue"><h3>核心差异</h3>{displayAnalysis.coreDifferences.map((text) => <p key={text}>{text}</p>)}</article>
              <article className="insight-block insight-block--amber"><h3><TriangleAlert size={17} /> 信息缺口</h3>{displayAnalysis.unknowns.length ? displayAnalysis.unknowns.map((text) => <p key={text}>{text}</p>) : <p>当前关键字段均有记录。</p>}</article>
              <article className="insight-block"><h3>价格</h3>{displayAnalysis.priceNotes.map((text) => <p key={text}>{text}</p>)}</article>
              <article className="insight-block"><h3>使用场景</h3>{displayAnalysis.usageNotes.map((text) => <p key={text}>{text}</p>)}</article>
            </div>
          </section>

          <section className="section-block risk-report">
            <div className="section-heading"><div><p className="eyebrow">逐台核验</p><h2>每个方案的风险与待确认项</h2></div><span>{selected.length} 个方案</span></div>
            <div className="risk-report__list">
              {selected.map((build) => {
                const items = displayAnalysis.risks[build.title] ?? []
                return <article key={build.id}><h3>{build.title}</h3>{items.length ? items.map((item) => <p key={item}><TriangleAlert size={15} /> {item}</p>) : <p><Check size={15} /> 现有记录中没有发现待确认项</p>}</article>
              })}
            </div>
          </section>

          <section className="section-block comparison-table-wrap">
            <div className="section-heading"><div><p className="eyebrow">参数对比</p><h2>逐项核对</h2></div><span>{selected.length} 个方案</span></div>
            <div className="comparison-mobile">
              <article className="comparison-group comparison-group--price">
                <h3>价格</h3>
                {selected.map((build) => <div key={build.id}><span>{build.title}</span><strong>{currency.format(build.price)}</strong></div>)}
              </article>
              {keys.map((key) => {
                const values = selected.map((build) => build.components[key].value || '未明确')
                const differs = new Set(values).size > 1
                return (
                  <article className={differs ? 'comparison-group has-difference' : 'comparison-group'} key={key}>
                    <h3>{componentLabels[key]}{differs && <small>有差异</small>}</h3>
                    {selected.map((build) => {
                      const field = build.components[key]
                      return <div className={isUnknown(field.value, field.confidence) ? 'is-unknown' : ''} key={build.id}><span>{build.title}</span><strong>{field.value || '未明确'}</strong>{isUnknown(field.value, field.confidence) && <small>待确认</small>}</div>
                    })}
                  </article>
                )
              })}
              <article className="comparison-group">
                <h3>完整度</h3>
                {selected.map((build) => <div key={build.id}><span>{build.title}</span><strong>{build.completeness}%</strong></div>)}
              </article>
            </div>
            <div className="comparison-table-scroller desktop-comparison">
              <table className="comparison-table">
                <thead><tr><th>项目</th>{selected.map((build) => <th key={build.id}><span>{build.title}</span><strong>{currency.format(build.price)}</strong></th>)}</tr></thead>
                <tbody>
                  {keys.map((key) => <tr key={key}><th>{componentLabels[key]}</th>{selected.map((build) => { const field = build.components[key]; return <td className={isUnknown(field.value, field.confidence) ? 'is-unknown' : ''} key={build.id}>{field.value || '未明确'}{isUnknown(field.value, field.confidence) && <small>待确认</small>}</td> })}</tr>)}
                  <tr><th>完整度</th>{selected.map((build) => <td key={build.id}>{build.completeness}%</td>)}</tr>
                  <tr><th>店铺</th>{selected.map((build) => <td key={build.id}>{build.store || '未填写'}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
