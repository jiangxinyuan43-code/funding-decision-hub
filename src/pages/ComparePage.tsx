import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    if (!selectedIds.length && builds.length >= 2) setSelectedIds(builds.filter((build) => build.favorite).slice(0, 3).map((build) => build.id))
  }, [builds, selectedIds.length])

  const selected = useMemo(() => selectedIds.map((id) => builds.find((build) => build.id === id)).filter(Boolean) as typeof builds, [builds, selectedIds])
  const localAnalysis = useMemo(() => compareBuildsLocally(selected), [selected])
  const displayAnalysis = analysis ?? localAnalysis
  const keys = Object.keys(componentLabels) as ComponentKey[]

  const toggle = (id: string) => {
    setAnalysis(null)
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current)
  }

  const runAI = async () => {
    if (!settings) return
    if (selected.length < 2) return notify('请先选择至少两个方案', 'error')
    setIsAnalyzing(true)
    try {
      setAnalysis(await createAIProvider(settings).compareBuilds(selected))
      notify('AI 对比已更新')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'AI 对比失败', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="page compare-page">
      <header className="page-heading"><div><p className="eyebrow">智能对比</p><h1>差异先于结论</h1></div><span className="selection-count">{selected.length}/4</span></header>
      <section className="compare-picker" aria-label="选择对比方案">
        {builds.map((build) => {
          const active = selectedIds.includes(build.id)
          return <button className={active ? 'compare-pick is-active' : 'compare-pick'} type="button" key={build.id} onClick={() => toggle(build.id)} aria-pressed={active}><span>{active ? <Check size={15} /> : null}</span><div><strong>{build.title}</strong><small>{currency.format(build.price)}</small></div></button>
        })}
      </section>

      {selected.length < 2 ? (
        <div className="empty-state"><GitCompareArrows size={30} /><h2>选择 2–4 个方案</h2><p>对比只呈现差异、风险和信息缺口，最终决定仍由你完成。</p></div>
      ) : (
        <>
          <section className="comparison-insights">
            <div className="section-heading"><div><p className="eyebrow">差异摘要</p><h2>先看最影响决策的部分</h2></div><button className="secondary-button" type="button" onClick={runAI} disabled={isAnalyzing}>{isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <BrainCircuit size={17} />}{isAnalyzing ? '分析中' : 'AI 分析'}</button></div>
            <div className="insight-grid">
              <article className="insight-block insight-block--blue"><h3>核心差异</h3>{displayAnalysis.coreDifferences.slice(0, 4).map((text) => <p key={text}>{text}</p>)}</article>
              <article className="insight-block insight-block--amber"><h3><TriangleAlert size={17} /> 信息缺口</h3>{displayAnalysis.unknowns.length ? displayAnalysis.unknowns.slice(0, 5).map((text) => <p key={text}>{text}</p>) : <p>当前关键字段均有记录。</p>}</article>
              <article className="insight-block"><h3>价格</h3>{displayAnalysis.priceNotes.map((text) => <p key={text}>{text}</p>)}</article>
              <article className="insight-block"><h3>使用场景</h3>{displayAnalysis.usageNotes.map((text) => <p key={text}>{text}</p>)}</article>
            </div>
          </section>

          <section className="section-block comparison-table-wrap">
            <div className="section-heading"><div><p className="eyebrow">参数矩阵</p><h2>逐项核对</h2></div><span>横向滑动</span></div>
            <div className="comparison-table-scroller">
              <table className="comparison-table">
                <thead><tr><th>项目</th>{selected.map((build) => <th key={build.id}><span>{build.title}</span><strong>{currency.format(build.price)}</strong></th>)}</tr></thead>
                <tbody>
                  {keys.map((key) => <tr key={key}><th>{componentLabels[key]}</th>{selected.map((build) => { const field = build.components[key]; return <td className={!field.value || field.confidence < 0.75 || /未明确|未知/.test(field.value) ? 'is-unknown' : ''} key={build.id}>{field.value || '未明确'}{field.confidence < 0.75 && <small>待确认</small>}</td> })}</tr>)}
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
