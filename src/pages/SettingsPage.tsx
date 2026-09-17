import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Database, Download, Eye, EyeOff, KeyRound, Moon, ShieldCheck, Smartphone, Sun, Upload } from 'lucide-react'
import { db, exportAllData, importAllData } from '../services/storage/db'
import type { ThemeMode, UserSettings } from '../types/models'

export function SettingsPage({ notify }: { notify: (message: string, tone?: 'success' | 'error') => void }) {
  const stored = useLiveQuery(() => db.settings.get('primary'))
  const [draft, setDraft] = useState<UserSettings | null>(null)
  const [showKey, setShowKey] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const counts = useLiveQuery(async () => ({ builds: await db.builds.count(), goals: await db.goals.count(), countdowns: await db.countdowns.count() }), [])

  useEffect(() => { if (stored) setDraft(stored) }, [stored])
  if (!draft) return <main className="page"><div className="skeleton skeleton-card" /></main>

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setDraft((current) => current ? { ...current, [key]: value } : current)
  const save = async () => { await db.settings.put(draft); notify('设置已保存') }
  const download = async () => {
    const content = await exportAllData()
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `funding-decision-hub-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('全部数据已导出')
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try { await importAllData(await file.text()); notify('数据导入完成') } catch (error) { notify(error instanceof Error ? error.message : '导入失败', 'error') }
    if (importInput.current) importInput.current.value = ''
  }

  const themes: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Smartphone },
  ]

  return (
    <main className="page settings-page">
      <header className="page-heading"><div><p className="eyebrow">我的</p><h1>本地数据与 AI</h1></div><ShieldCheck size={24} /></header>

      <section className="section-block settings-section">
        <div className="section-heading"><div><p className="eyebrow">AI Provider</p><h2>OpenAI-compatible 接口</h2></div><KeyRound size={20} /></div>
        <div className="privacy-note"><ShieldCheck size={18} /><p>API Key 仅保存在当前浏览器的 IndexedDB，不写入日志或 URL。只有你主动识别或比较时才会调用接口。</p></div>
        <div className="form-grid">
          <label><span>Provider 名称</span><input value={draft.aiProvider} onChange={(event) => set('aiProvider', event.target.value)} /></label>
          <label className="span-2"><span>API Base URL</span><input value={draft.apiBaseUrl} onChange={(event) => set('apiBaseUrl', event.target.value)} placeholder="https://api.example.com/v1" inputMode="url" /></label>
          <label className="span-2"><span>API Key</span><div className="password-field"><input type={showKey ? 'text' : 'password'} autoComplete="off" value={draft.apiKey} onChange={(event) => set('apiKey', event.target.value)} placeholder="sk-..." /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}>{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <label><span>文本模型</span><input value={draft.model} onChange={(event) => set('model', event.target.value)} /></label>
          <label><span>视觉模型</span><input value={draft.visionModel} onChange={(event) => set('visionModel', event.target.value)} /></label>
        </div>
        <button className="primary-button" type="button" onClick={save}><Check size={18} /> 保存 AI 设置</button>
      </section>

      <section className="section-block settings-section">
        <div className="section-heading"><div><p className="eyebrow">外观</p><h2>显示主题</h2></div></div>
        <div className="segmented-control">{themes.map(({ value, label, icon: Icon }) => <button className={draft.theme === value ? 'is-active' : ''} type="button" key={value} onClick={() => { set('theme', value); db.settings.update('primary', { theme: value }) }}><Icon size={17} />{label}</button>)}</div>
      </section>

      <section className="section-block settings-section">
        <div className="section-heading"><div><p className="eyebrow">数据管理</p><h2>备份与迁移</h2></div><Database size={20} /></div>
        <div className="data-stats"><div><strong>{counts?.builds ?? 0}</strong><span>配置</span></div><div><strong>{counts?.goals ?? 0}</strong><span>目标</span></div><div><strong>{counts?.countdowns ?? 0}</strong><span>倒数日</span></div></div>
        <div className="button-row"><button className="secondary-button" type="button" onClick={download}><Download size={18} /> 导出全部数据</button><button className="secondary-button" type="button" onClick={() => importInput.current?.click()}><Upload size={18} /> 导入 JSON</button></div>
        <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} />
        <p className="fine-print">导入采用合并更新，不会自动删除现有配置或价格历史。</p>
      </section>

      <section className="about-panel"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><div><strong>{draft.appName}</strong><p>V1.0 · 本地优先的个人决策工作台</p></div></section>
    </main>
  )
}
