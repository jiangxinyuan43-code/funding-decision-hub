import { useEffect, useState } from 'react'
import { ExternalLink, Heart, ImageOff, Save, ShieldAlert, Star, Trash2, TriangleAlert, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Progress } from '../ui/Progress'
import { PriceTrend } from '../ui/PriceTrend'
import { deleteBuild as deleteStoredBuild, getBuildImages, putBuild } from '../../services/storage/db'
import { buildTags, calculateCompleteness, normalizeComponents } from '../../features/pc-build/hardware'
import { componentLabels, type BuildStatus, type ComponentKey, type PCBuild } from '../../types/models'
import { currency } from '../../utils/format'
import { createId } from '../../utils/ids'
import { normalizeHttpUrl } from '../../utils/url'

interface Props {
  build: PCBuild | null
  onClose: () => void
  notify: (message: string, tone?: 'success' | 'error') => void
}

const statusLabels: Record<BuildStatus, string> = { pending: '待分析', watching: '观察中', candidate: '候选', priority: '重点候选', rejected: '已淘汰', purchased: '已购买' }

function cloneBuild(build: PCBuild): PCBuild {
  return {
    ...build,
    tags: [...build.tags],
    components: Object.fromEntries(Object.entries(build.components).map(([key, field]) => [key, { ...field }])) as PCBuild['components'],
    images: build.images.map((image) => ({ ...image })),
    priceHistory: build.priceHistory.map((point) => ({ ...point })),
    snapshots: build.snapshots.map((snapshot) => ({
      ...snapshot,
      components: Object.fromEntries(Object.entries(snapshot.components).map(([key, field]) => [key, { ...field }])) as PCBuild['components'],
      imageIds: [...snapshot.imageIds],
    })),
    analysis: build.analysis ? {
      ...build.analysis,
      advantages: [...build.analysis.advantages],
      risks: [...build.analysis.risks],
      unknowns: [...build.analysis.unknowns],
      upgradeConsiderations: [...build.analysis.upgradeConsiderations],
    } : undefined,
    checklist: build.checklist.map((item) => ({ ...item })),
  }
}

export function BuildDetailModal({ build, onClose, notify }: Props) {
  const [draft, setDraft] = useState<PCBuild | null>(build)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useEffect(() => {
    let active = true
    setDraft(build ? cloneBuild(build) : null)
    setConfirmingDelete(false)
    if (build) {
      getBuildImages(build.id).then((images) => {
        if (active) setDraft(cloneBuild({ ...build, images }))
      }).catch(() => undefined)
    }
    return () => { active = false }
  }, [build])
  if (!draft) return null
  const updateComponent = (key: ComponentKey, value: string) => setDraft((current) => current ? { ...current, components: { ...current.components, [key]: { value, confidence: 1, source: 'manual', confirmed: true } } } : current)
  const save = async () => {
    if (!build) return
    let productUrl = ''
    try {
      productUrl = normalizeHttpUrl(draft.url)
    } catch (error) {
      return notify(error instanceof Error ? error.message : '商品链接格式不正确', 'error')
    }
    const components = normalizeComponents(draft.components)
    const now = new Date().toISOString()
    const priceChanged = draft.price > 0 && draft.price !== build.price
    const recordChanged = priceChanged || productUrl !== build.url || JSON.stringify(components) !== JSON.stringify(build.components)
    await putBuild({
      ...draft,
      title: draft.title.trim() || '未命名整机方案',
      store: draft.store.trim(),
      url: productUrl,
      note: draft.note.trim(),
      components,
      completeness: calculateCompleteness(components),
      tags: buildTags(components, draft.price),
      priceHistory: priceChanged ? [...draft.priceHistory, { id: createId('price'), price: draft.price, recordedAt: now }] : draft.priceHistory,
      snapshots: recordChanged ? [...draft.snapshots, { id: createId('snapshot'), price: build.price, components: build.components, imageIds: draft.images.map((image) => image.id), url: build.url, createdAt: now }] : draft.snapshots,
      updatedAt: now,
    })
    notify(priceChanged ? '修改已保存，并记录本次价格' : '配置修改已保存')
    onClose()
  }
  const openProduct = () => {
    if (!draft.url) return notify('这个方案还没有商品链接', 'error')
    try {
      window.open(normalizeHttpUrl(draft.url), '_blank', 'noopener,noreferrer')
    } catch (error) {
      notify(error instanceof Error ? error.message : '商品链接格式不正确', 'error')
    }
  }
  const removeImage = (id: string) => setDraft((current) => current ? { ...current, images: current.images.filter((image) => image.id !== id) } : current)
  const deleteBuild = async () => {
    await deleteStoredBuild(draft.id)
    notify('配置已删除')
    onClose()
  }
  const hasUnknownPsu = !draft.components.psu.value || /未明确|未知/.test(draft.components.psu.value)

  return (
    <Modal open={Boolean(build)} onClose={onClose} title={draft.title} description={`${draft.platform} · ${draft.store || '店铺待补充'}`} size="wide">
      <section className="build-detail-hero">
        <div><span>当前记录价格</span><strong>{currency.format(draft.price)}</strong><p>{draft.components.cpu.value.replace('AMD Ryzen 7 ', '')} + {draft.components.gpu.value.replace('NVIDIA GeForce ', '')}</p></div>
        <button className={draft.favorite ? 'favorite-button is-active' : 'favorite-button'} type="button" onClick={() => setDraft({ ...draft, favorite: !draft.favorite, status: !draft.favorite ? 'priority' : draft.status === 'priority' ? 'candidate' : draft.status })}><Heart size={19} fill={draft.favorite ? 'currentColor' : 'none'} />{draft.favorite ? '重点关注' : '设为重点'}</button>
      </section>

      <section className="section-block inner-section build-basics">
        <div className="section-heading"><div><p className="eyebrow">方案信息</p><h3>价格与来源</h3></div><span>修改价格会写入历史</span></div>
        <div className="form-grid">
          <label className="span-2"><span>商品名称</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label><span>当前价格</span><div className="money-input"><i>¥</i><input type="number" min="0" inputMode="decimal" value={draft.price || ''} onChange={(event) => setDraft({ ...draft, price: Math.max(0, Number(event.target.value) || 0) })} /></div></label>
          <label><span>店铺</span><input value={draft.store} onChange={(event) => setDraft({ ...draft, store: event.target.value })} placeholder="店铺名称" /></label>
          <label className="span-2"><span>商品链接</span><input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} inputMode="url" placeholder="https://" /></label>
          <label className="span-2"><span>备注</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} rows={3} placeholder="优惠、售后或需要确认的事项" /></label>
        </div>
      </section>

      <div className="detail-toolbar"><label><span>方案状态</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BuildStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><Progress value={draft.completeness} label="配置完整度" tone={draft.completeness < 75 ? 'amber' : 'green'} /></div>

      {hasUnknownPsu && <div className="warning-banner"><ShieldAlert size={19} /><div><strong>电源型号未明确</strong><p>只写功率不能判断电源质量，购买前确认品牌、完整型号、80 PLUS 与 ATX 标准。</p></div></div>}

      <section className="recognition-fields detail-fields">
        <div className="section-heading"><div><p className="eyebrow">配置明细</p><h3>点击字段可人工修正</h3></div><span>手工内容优先</span></div>
        <div className="component-form-grid">{(Object.keys(componentLabels) as ComponentKey[]).map((key) => { const field = draft.components[key]; const uncertain = !field.value || field.confidence < 0.75 || /未明确|未知/.test(field.value); return <label className={uncertain ? 'is-uncertain' : ''} key={key}><span>{componentLabels[key]}{uncertain && <small><TriangleAlert size={13} /> 待确认</small>}</span><input value={field.value} onChange={(event) => updateComponent(key, event.target.value)} placeholder="未明确" /><i>{field.source === 'manual' ? '手工' : `${field.source.toUpperCase()} ${Math.round(field.confidence * 100)}%`}</i></label> })}</div>
      </section>

      {draft.analysis && <section className="analysis-panel"><div className="section-heading"><div><p className="eyebrow">AI 分析</p><h3>已知差异与风险</h3></div><span>{Math.round(draft.analysis.confidence * 100)}% 置信</span></div><p className="analysis-summary">{draft.analysis.summary}</p><div className="analysis-columns"><div><h4><Star size={16} /> 优点</h4>{draft.analysis.advantages.map((item) => <p key={item}>{item}</p>)}</div><div><h4><TriangleAlert size={16} /> 需要确认</h4>{[...draft.analysis.risks, ...draft.analysis.unknowns].map((item) => <p key={item}>{item}</p>)}</div></div></section>}

      <section className="section-block inner-section"><div className="section-heading"><div><p className="eyebrow">价格历史</p><h3>变化轨迹</h3></div></div><PriceTrend points={draft.priceHistory} /></section>

      <section className="section-block inner-section">
        <div className="section-heading"><div><p className="eyebrow">原始截图</p><h3>{draft.images.length ? `${draft.images.length} 张图片` : '没有保留截图'}</h3></div></div>
        {draft.images.length > 0 ? (
          <div className="image-strip image-strip--detail">{draft.images.map((image) => <figure key={image.id}><a href={image.compressedDataUrl} target="_blank" rel="noreferrer"><img src={image.compressedDataUrl} alt={image.name} /></a><button type="button" onClick={() => removeImage(image.id)} aria-label={`移除 ${image.name}`} title="移除图片"><X size={15} /></button></figure>)}</div>
        ) : <div className="empty-inline"><ImageOff size={18} /><span>可以删除不再需要的截图；保存后才会生效。</span></div>}
      </section>

      <section className="section-block inner-section"><div className="section-heading"><div><p className="eyebrow">购买前</p><h3>确认清单</h3></div><span>{draft.checklist.filter((item) => item.done).length}/{draft.checklist.length}</span></div><div className="checklist">{draft.checklist.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={(event) => setDraft({ ...draft, checklist: draft.checklist.map((current) => current.id === item.id ? { ...current, done: event.target.checked } : current) })} /><span>{item.label}</span></label>)}</div></section>

      <section className="danger-zone" aria-label="删除配置">
        {!confirmingDelete ? (
          <button className="danger-text-button" type="button" onClick={() => setConfirmingDelete(true)}><Trash2 size={17} /> 删除这条配置</button>
        ) : (
          <div className="delete-confirmation" role="alert">
            <div><strong>确认删除“{draft.title}”？</strong><p>截图、价格历史和检查清单会一起删除，且无法撤销。</p></div>
            <button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>取消</button>
            <button className="danger-button" type="button" onClick={deleteBuild}><Trash2 size={17} /> 确认删除</button>
          </div>
        )}
      </section>

      <div className="modal-actions modal-actions--spread"><button className="secondary-button" type="button" onClick={openProduct}><ExternalLink size={18} /> 查看商品</button><button className="primary-button" type="button" onClick={save}><Save size={18} /> 保存修改</button></div>
    </Modal>
  )
}
