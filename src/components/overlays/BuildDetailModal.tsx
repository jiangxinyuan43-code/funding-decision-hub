import { useEffect, useState } from 'react'
import { ExternalLink, Heart, Save, ShieldAlert, Star, TriangleAlert } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Progress } from '../ui/Progress'
import { PriceTrend } from '../ui/PriceTrend'
import { db } from '../../services/storage/db'
import { buildTags, calculateCompleteness, normalizeComponents } from '../../features/pc-build/hardware'
import { componentLabels, type BuildStatus, type ComponentKey, type PCBuild } from '../../types/models'
import { currency } from '../../utils/format'

interface Props {
  build: PCBuild | null
  onClose: () => void
  notify: (message: string, tone?: 'success' | 'error') => void
}

const statusLabels: Record<BuildStatus, string> = { pending: '待分析', watching: '观察中', candidate: '候选', priority: '重点候选', rejected: '已淘汰', purchased: '已购买' }

export function BuildDetailModal({ build, onClose, notify }: Props) {
  const [draft, setDraft] = useState<PCBuild | null>(build)
  useEffect(() => setDraft(build ? structuredClone(build) : null), [build])
  if (!draft) return null
  const updateComponent = (key: ComponentKey, value: string) => setDraft((current) => current ? { ...current, components: { ...current.components, [key]: { value, confidence: 1, source: 'manual', confirmed: true } } } : current)
  const save = async () => {
    const components = normalizeComponents(draft.components)
    await db.builds.put({ ...draft, components, completeness: calculateCompleteness(components), tags: buildTags(components, draft.price), updatedAt: new Date().toISOString() })
    notify('人工修正已保存')
    onClose()
  }
  const openProduct = () => {
    if (!draft.url) return notify('这个方案还没有商品链接', 'error')
    window.open(draft.url, '_blank', 'noopener,noreferrer')
  }
  const hasUnknownPsu = !draft.components.psu.value || /未明确|未知/.test(draft.components.psu.value)

  return (
    <Modal open={Boolean(build)} onClose={onClose} title={draft.title} description={`${draft.platform} · ${draft.store || '店铺待补充'}`} size="wide">
      <section className="build-detail-hero">
        <div><span>当前记录价格</span><strong>{currency.format(draft.price)}</strong><p>{draft.components.cpu.value.replace('AMD Ryzen 7 ', '')} + {draft.components.gpu.value.replace('NVIDIA GeForce ', '')}</p></div>
        <button className={draft.favorite ? 'favorite-button is-active' : 'favorite-button'} type="button" onClick={() => setDraft({ ...draft, favorite: !draft.favorite, status: !draft.favorite ? 'priority' : draft.status === 'priority' ? 'candidate' : draft.status })}><Heart size={19} fill={draft.favorite ? 'currentColor' : 'none'} />{draft.favorite ? '重点关注' : '设为重点'}</button>
      </section>

      <div className="detail-toolbar"><label><span>方案状态</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BuildStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><Progress value={draft.completeness} label="配置完整度" tone={draft.completeness < 75 ? 'amber' : 'green'} /></div>

      {hasUnknownPsu && <div className="warning-banner"><ShieldAlert size={19} /><div><strong>电源型号未明确</strong><p>只写功率不能判断电源质量，购买前确认品牌、完整型号、80 PLUS 与 ATX 标准。</p></div></div>}

      <section className="recognition-fields detail-fields">
        <div className="section-heading"><div><p className="eyebrow">配置明细</p><h3>点击字段可人工修正</h3></div><span>手工内容优先</span></div>
        <div className="component-form-grid">{(Object.keys(componentLabels) as ComponentKey[]).map((key) => { const field = draft.components[key]; const uncertain = !field.value || field.confidence < 0.75 || /未明确|未知/.test(field.value); return <label className={uncertain ? 'is-uncertain' : ''} key={key}><span>{componentLabels[key]}{uncertain && <small><TriangleAlert size={13} /> 待确认</small>}</span><input value={field.value} onChange={(event) => updateComponent(key, event.target.value)} placeholder="未明确" /><i>{field.source === 'manual' ? '手工' : `${field.source.toUpperCase()} ${Math.round(field.confidence * 100)}%`}</i></label> })}</div>
      </section>

      {draft.analysis && <section className="analysis-panel"><div className="section-heading"><div><p className="eyebrow">AI 分析</p><h3>已知差异与风险</h3></div><span>{Math.round(draft.analysis.confidence * 100)}% 置信</span></div><p className="analysis-summary">{draft.analysis.summary}</p><div className="analysis-columns"><div><h4><Star size={16} /> 优点</h4>{draft.analysis.advantages.map((item) => <p key={item}>{item}</p>)}</div><div><h4><TriangleAlert size={16} /> 需要确认</h4>{[...draft.analysis.risks, ...draft.analysis.unknowns].map((item) => <p key={item}>{item}</p>)}</div></div></section>}

      <section className="section-block inner-section"><div className="section-heading"><div><p className="eyebrow">价格历史</p><h3>变化轨迹</h3></div></div><PriceTrend points={draft.priceHistory} /></section>

      {draft.images.length > 0 && <section className="section-block inner-section"><div className="section-heading"><div><p className="eyebrow">原始截图</p><h3>{draft.images.length} 张图片</h3></div></div><div className="image-strip image-strip--detail">{draft.images.map((image) => <figure key={image.id}><a href={image.compressedDataUrl} target="_blank" rel="noreferrer"><img src={image.compressedDataUrl} alt={image.name} /></a></figure>)}</div></section>}

      <section className="section-block inner-section"><div className="section-heading"><div><p className="eyebrow">购买前</p><h3>确认清单</h3></div><span>{draft.checklist.filter((item) => item.done).length}/{draft.checklist.length}</span></div><div className="checklist">{draft.checklist.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={(event) => setDraft({ ...draft, checklist: draft.checklist.map((current) => current.id === item.id ? { ...current, done: event.target.checked } : current) })} /><span>{item.label}</span></label>)}</div></section>

      <div className="modal-actions modal-actions--spread"><button className="secondary-button" type="button" onClick={openProduct}><ExternalLink size={18} /> 查看商品</button><button className="primary-button" type="button" onClick={save}><Save size={18} /> 保存修改</button></div>
    </Modal>
  )
}
