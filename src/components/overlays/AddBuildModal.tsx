import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ImagePlus, LoaderCircle, Plus, Save, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { db, getBuildImages, putBuild } from '../../services/storage/db'
import { compressImages } from '../../services/image/compress'
import { createAIProvider } from '../../services/ai/client'
import { buildTags, calculateCompleteness, findLikelyDuplicate, normalizeComponents } from '../../features/pc-build/hardware'
import { componentLabels, emptyComponents, type BuildAnalysis, type BuildComponents, type ComponentKey, type PCBuild, type Platform, type StoredImage } from '../../types/models'
import { createId } from '../../utils/ids'
import { normalizeHttpUrl } from '../../utils/url'

interface Props { open: boolean; onClose: () => void; notify: (message: string, tone?: 'success' | 'error') => void }

const checklist = () => ['CPU 型号确认', 'GPU 型号确认', '显存确认', '主板型号确认', '内存容量确认', 'SSD 型号确认', '电源型号确认', '散热确认', '店铺售后确认', '最终价格确认'].map((label) => ({ id: createId('check'), label, done: false }))

export function AddBuildModal({ open, onClose, notify }: Props) {
  const settings = useLiveQuery(() => db.settings.get('primary'))
  const builds = useLiveQuery(() => db.builds.toArray(), []) ?? []
  const galleryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<StoredImage[]>([])
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState<Platform>('京东')
  const [store, setStore] = useState('')
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState(0)
  const [note, setNote] = useState('')
  const [components, setComponents] = useState<BuildComponents>(emptyComponents)
  const [analysis, setAnalysis] = useState<BuildAnalysis | undefined>()
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (!open) return
    setImages([]); setTitle(''); setPlatform('京东'); setStore(''); setUrl(''); setPrice(0); setNote(''); setComponents(emptyComponents()); setAnalysis(undefined)
  }, [open])

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setIsProcessingImages(true)
    try {
      if (images.length + files.length > 10) throw new Error('一次最多保留 10 张图片')
      const compressed = await compressImages(files)
      setImages((current) => [...current, ...compressed])
    } catch (error) { notify(error instanceof Error ? error.message : '图片处理失败', 'error') } finally { setIsProcessingImages(false) }
  }

  const setComponent = (key: ComponentKey, value: string) => setComponents((current) => ({ ...current, [key]: { value, confidence: 1, source: 'manual', confirmed: true } }))

  const analyze = async () => {
    if (!settings) return
    if (!images.length) return notify('请先上传至少一张配置截图', 'error')
    setIsAnalyzing(true)
    try {
      const result = await createAIProvider(settings).analyzeImages(images.map((image) => image.compressedDataUrl), note)
      setTitle((current) => current || result.title)
      setPlatform(result.platform)
      setStore((current) => current || result.store)
      setPrice((current) => current || result.price)
      setComponents((current) => Object.fromEntries(
        (Object.keys(componentLabels) as ComponentKey[]).map((key) => [key, result.fields[key].value ? { value: result.fields[key].value, confidence: result.fields[key].confidence, source: 'ai', confirmed: result.fields[key].confidence >= 0.75 } : current[key]]),
      ) as BuildComponents)
      setAnalysis({ summary: result.summary, advantages: result.advantages, risks: result.risks, unknowns: result.unknowns, upgradeConsiderations: [], confidence: 0.85, generatedAt: new Date().toISOString() })
      notify('AI 识别完成，请确认低置信度字段')
    } catch (error) { notify(error instanceof Error ? error.message : 'AI 识别失败，可继续手工录入', 'error') } finally { setIsAnalyzing(false) }
  }

  const save = async () => {
    let productUrl = ''
    try {
      productUrl = normalizeHttpUrl(url)
    } catch (error) {
      return notify(error instanceof Error ? error.message : '商品链接格式不正确', 'error')
    }
    const normalized = normalizeComponents(components)
    const now = new Date().toISOString()
    const resolvedTitle = title.trim() || [normalized.cpu.value, normalized.gpu.value].filter(Boolean).join(' + ') || '未命名整机方案'
    const candidate: PCBuild = {
      id: createId('build'), title: resolvedTitle, platform, store: store.trim(), url: productUrl, price: Math.max(0, price),
      status: Object.values(normalized).some((field) => field.value) ? 'watching' : 'pending', favorite: false,
      tags: buildTags(normalized, price), completeness: calculateCompleteness(normalized), components: normalized, images,
      priceHistory: price > 0 ? [{ id: createId('price'), price, recordedAt: now }] : [], snapshots: [], analysis, checklist: checklist(), note, createdAt: now, updatedAt: now,
    }
    const duplicate = findLikelyDuplicate(candidate, builds)
    if (duplicate) {
      const priceChanged = price > 0 && price !== duplicate.price
      const existingImages = await getBuildImages(duplicate.id)
      await putBuild({
        ...duplicate,
        title: resolvedTitle || duplicate.title,
        platform,
        store: store || duplicate.store,
        url: productUrl || duplicate.url,
        price: price || duplicate.price,
        components: normalized,
        completeness: candidate.completeness,
        tags: candidate.tags,
        images: [...existingImages, ...images],
        analysis: analysis ?? duplicate.analysis,
        priceHistory: priceChanged ? [...duplicate.priceHistory, { id: createId('price'), price, recordedAt: now }] : duplicate.priceHistory,
        snapshots: [...duplicate.snapshots, { id: createId('snapshot'), price: duplicate.price, components: duplicate.components, imageIds: existingImages.map((image) => image.id), url: duplicate.url, createdAt: now }],
        note: note || duplicate.note,
        updatedAt: now,
      })
      notify(priceChanged ? '识别为同一商品，已追加价格记录' : '识别为同一商品，已更新配置快照')
    } else {
      await putBuild(candidate)
      notify('方案已保存，可继续收藏下一台')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="添加整机方案" description="截图、链接和价格先保存，AI 识别失败也不会阻塞收藏。" size="wide">
      <section className="upload-zone">
        <div className="upload-zone__actions">
          <button type="button" onClick={() => cameraInput.current?.click()}><Camera size={21} /><span><strong>拍照</strong><small>直接拍配置页</small></span></button>
          <button type="button" onClick={() => galleryInput.current?.click()}><ImagePlus size={21} /><span><strong>从相册选择</strong><small>最多 10 张</small></span></button>
        </div>
        <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />
        <input ref={galleryInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />
        {isProcessingImages && <p className="processing-line"><LoaderCircle className="spin" size={16} /> 正在压缩，保留文字清晰度…</p>}
        {images.length > 0 && <div className="image-strip">{images.map((image) => <figure key={image.id}><img src={image.compressedDataUrl} alt={image.name} /><button type="button" onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))} aria-label={`移除 ${image.name}`}><Trash2 size={15} /></button></figure>)}<button className="add-image-tile" type="button" onClick={() => galleryInput.current?.click()} aria-label="继续添加图片"><Plus size={20} /></button></div>}
      </section>

      <div className="form-grid">
        <label className="span-2"><span>商品名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="可留空，保存时按 CPU + GPU 命名" /></label>
        <label><span>平台</span><select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}><option>京东</option><option>淘宝</option><option>天猫</option><option>抖音</option><option>其他</option></select></label>
        <label><span>店铺</span><input value={store} onChange={(event) => setStore(event.target.value)} placeholder="店铺名称" /></label>
        <label className="span-2"><span>商品链接</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="链接无法解析也可以保存" inputMode="url" /></label>
        <label><span>当前价格</span><div className="money-input"><i>¥</i><input type="number" inputMode="decimal" value={price || ''} onChange={(event) => setPrice(Math.max(0, Number(event.target.value) || 0))} placeholder="0" /></div></label>
        <label><span>备注</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="优惠、售后或需要确认的事项" /></label>
      </div>

      <div className="recognition-bar"><div><Sparkles size={19} /><span><strong>AI 识别配置</strong><small>{settings?.apiKey ? `使用 ${settings.visionModel}` : '先在“我的”中配置 API Key'}</small></span></div><button className="secondary-button" type="button" onClick={analyze} disabled={isAnalyzing || !images.length}>{isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{isAnalyzing ? '识别中' : '开始识别'}</button></div>

      <section className="recognition-fields">
        <div className="section-heading"><div><p className="eyebrow">人工确认</p><h3>结构化配置</h3></div><span>低于 75% 自动待确认</span></div>
        <div className="component-form-grid">{(Object.keys(componentLabels) as ComponentKey[]).map((key) => { const field = components[key]; const uncertain = Boolean(field.value && field.confidence < 0.75); return <label className={uncertain ? 'is-uncertain' : ''} key={key}><span>{componentLabels[key]}{uncertain && <small><TriangleAlert size={13} /> 待确认</small>}</span><input value={field.value} onChange={(event) => setComponent(key, event.target.value)} placeholder="未识别，点击填写" /><i>{field.source === 'ai' ? `AI ${Math.round(field.confidence * 100)}%` : '手工'}</i></label> })}</div>
      </section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={save}><Save size={18} /> 保存方案</button></div>
    </Modal>
  )
}
