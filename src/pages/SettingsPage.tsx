import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, ChevronRight, Database, Download, Eye, EyeOff, KeyRound, LoaderCircle, Moon, PlugZap, ShieldCheck, Smartphone, Sun, Trash2, Upload, WalletCards } from 'lucide-react'
import { clearUserData, db, exportAllData, importAllData } from '../services/storage/db'
import { createAIProvider } from '../services/ai/client'
import type { ThemeMode, UserSettings } from '../types/models'

export function SettingsPage({ notify, onEditFinance }: { notify: (message: string, tone?: 'success' | 'error') => void; onEditFinance: () => void }) {
  const stored = useLiveQuery(() => db.settings.get('primary'))
  const [draft, setDraft] = useState<UserSettings | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testingVision, setTestingVision] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [confirmingKeyRemoval, setConfirmingKeyRemoval] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const counts = useLiveQuery(async () => ({ builds: await db.builds.count(), goals: await db.goals.count(), countdowns: await db.countdowns.count() }), [])

  useEffect(() => { if (stored) setDraft(stored) }, [stored])
  if (!draft) return <main className="page"><div className="skeleton skeleton-card" /></main>

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setDraft((current) => current ? { ...current, [key]: value } : current)
  const save = async () => {
    const next = { ...draft, apiBaseUrl: draft.apiBaseUrl.trim(), model: draft.model.trim(), visionModel: draft.visionModel.trim() }
    await db.settings.put(next)
    setDraft(next)
    notify('AI 设置已保存')
  }
  const removeApiKey = async () => {
    await db.settings.update('primary', { apiKey: '' })
    setDraft((current) => current ? { ...current, apiKey: '' } : current)
    setAiTestResult(null)
    setConfirmingKeyRemoval(false)
    notify('API Key 已从当前浏览器移除')
  }
  const testConnection = async () => {
    setTestingConnection(true)
    try {
      await createAIProvider(draft).testConnection()
      const message = `连接成功，${draft.model} 可以正常响应`
      setAiTestResult({ message, tone: 'success' })
      notify(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接测试失败'
      setAiTestResult({ message, tone: 'error' })
      notify(message, 'error')
    } finally {
      setTestingConnection(false)
    }
  }
  const testVision = async () => {
    setTestingVision(true)
    try {
      await createAIProvider(draft).testVision()
      const message = `图片识别正常，${draft.visionModel || draft.model} 已提取测试配置`
      setAiTestResult({ message, tone: 'success' })
      notify(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片能力测试失败'
      setAiTestResult({ message, tone: 'error' })
      notify(message, 'error')
    } finally {
      setTestingVision(false)
    }
  }
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
    if (file.size > 100 * 1024 * 1024) {
      notify('备份文件超过 100MB，请检查文件是否正确', 'error')
      if (importInput.current) importInput.current.value = ''
      return
    }
    try {
      const result = await importAllData(await file.text())
      notify(`导入完成：${result.builds} 个配置、${result.goals} 个目标、${result.countdowns} 个倒数日`)
    } catch (error) { notify(error instanceof Error ? error.message : '导入失败', 'error') }
    if (importInput.current) importInput.current.value = ''
  }
  const resetData = async () => {
    if (resetPhrase !== '清空') return notify('请输入“清空”后再继续', 'error')
    await clearUserData()
    setShowReset(false)
    setResetPhrase('')
    notify('资金、配置、目标和倒数日已清空')
  }

  const themes: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Smartphone },
  ]

  return (
    <main className="page settings-page">
      <header className="page-heading"><div><p className="eyebrow">我的</p><h1>本地数据与 AI</h1></div><ShieldCheck size={24} /></header>

      <section className="settings-link-section" aria-label="资金设置">
        <button type="button" onClick={onEditFinance}>
          <span className="settings-link-icon"><WalletCards size={21} /></span>
          <span><strong>资金计划</strong><small>余额、收支、目标预算与购买目标</small></span>
          <ChevronRight size={19} />
        </button>
      </section>

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
        <p className="fine-print">连接测试会使用当前填写的文本模型发送一次最小请求；图片识别仍要求视觉模型支持图片输入。</p>
        <div className="settings-ai-actions">
          <button className="secondary-button" type="button" onClick={testConnection} disabled={testingConnection}>{testingConnection ? <LoaderCircle className="spin" size={18} /> : <PlugZap size={18} />}{testingConnection ? '测试中' : '测试连接'}</button>
          <button className="secondary-button" type="button" onClick={testVision} disabled={testingVision}>{testingVision ? <LoaderCircle className="spin" size={18} /> : <Eye size={18} />}{testingVision ? '识别中' : '测试图片识别'}</button>
          <button className="primary-button settings-ai-actions__save" type="button" onClick={save}><Check size={18} /> 保存 AI 设置</button>
        </div>
        {aiTestResult && <p className={`ai-test-result ai-test-result--${aiTestResult.tone}`} role="status">{aiTestResult.message}</p>}
        <div className="settings-subaction">
          {!confirmingKeyRemoval ? (
            <button className="danger-text-button" type="button" onClick={() => setConfirmingKeyRemoval(true)} disabled={!draft.apiKey}><Trash2 size={16} /> 移除当前 API Key</button>
          ) : (
            <div className="inline-confirmation" role="alert"><span>只移除当前浏览器保存的密钥，模型名称会保留。</span><button type="button" onClick={() => setConfirmingKeyRemoval(false)}>取消</button><button type="button" onClick={removeApiKey}>确认移除</button></div>
          )}
        </div>
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
        <div className="data-danger-zone">
          {!showReset ? (
            <button className="danger-text-button" type="button" onClick={() => setShowReset(true)}><Trash2 size={17} /> 清空本地业务数据</button>
          ) : (
            <div className="reset-confirmation" role="alert">
              <AlertTriangle size={20} />
              <div><strong>这会清空资金、配置、目标和倒数日</strong><p>AI 设置会保留。建议先导出备份；操作无法撤销。</p></div>
              <label><span>输入“清空”确认</span><input value={resetPhrase} onChange={(event) => setResetPhrase(event.target.value)} placeholder="清空" autoComplete="off" /></label>
              <div><button className="secondary-button" type="button" onClick={() => { setShowReset(false); setResetPhrase('') }}>取消</button><button className="danger-button" type="button" onClick={resetData} disabled={resetPhrase !== '清空'}><Trash2 size={17} /> 清空数据</button></div>
            </div>
          )}
        </div>
      </section>

      <section className="about-panel"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><div><strong>{draft.appName}</strong><p>V1.1.1 · 本地优先的个人决策工作台</p></div></section>
    </main>
  )
}
