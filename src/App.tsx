import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { AppShell, type PageId } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { FinancePage } from './pages/FinancePage'
import { BuildsPage } from './pages/BuildsPage'
import { ComparePage } from './pages/ComparePage'
import { SettingsPage } from './pages/SettingsPage'
import { AddBuildModal } from './components/overlays/AddBuildModal'
import { FinanceEditor } from './components/overlays/FinanceEditor'
import { CountdownEditor } from './components/overlays/CountdownEditor'
import { BuildDetailModal } from './components/overlays/BuildDetailModal'
import { db } from './services/storage/db'
import type { PCBuild } from './types/models'

interface ToastState { message: string; tone: 'success' | 'error' }

export default function App() {
  const settings = useLiveQuery(() => db.settings.get('primary'))
  const [activePage, setActivePage] = useState<PageId>('home')
  const [addBuildOpen, setAddBuildOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false)
  const [selectedBuild, setSelectedBuild] = useState<PCBuild | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    if (!settings) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = settings.theme === 'system' ? (query.matches ? 'dark' : 'light') : settings.theme
      document.documentElement.dataset.theme = mode
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#111719' : '#f4f6f8')
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [settings])

  const notify = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }

  const pages: Record<PageId, React.ReactNode> = {
    home: <HomePage onAddBuild={() => setAddBuildOpen(true)} onEditFinance={() => setFinanceOpen(true)} onAddCountdown={() => setCountdownOpen(true)} onCompare={() => setActivePage('compare')} onOpenBuild={setSelectedBuild} />,
    finance: <FinancePage onEdit={() => setFinanceOpen(true)} />,
    builds: <BuildsPage onAdd={() => setAddBuildOpen(true)} onOpen={setSelectedBuild} />,
    compare: <ComparePage notify={notify} />,
    settings: <SettingsPage notify={notify} />,
  }

  return (
    <>
      <AppShell appName={settings?.appName ?? '我的资金 & 购机助手'} activePage={activePage} online={online} onNavigate={setActivePage}>
        {pages[activePage]}
      </AppShell>
      <AddBuildModal open={addBuildOpen} onClose={() => setAddBuildOpen(false)} notify={notify} />
      <FinanceEditor open={financeOpen} onClose={() => setFinanceOpen(false)} notify={notify} />
      <CountdownEditor open={countdownOpen} onClose={() => setCountdownOpen(false)} notify={notify} />
      <BuildDetailModal build={selectedBuild} onClose={() => setSelectedBuild(null)} notify={notify} />
      {toast && <div className={`toast toast--${toast.tone}`} role="status">{toast.tone === 'success' ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}<span>{toast.message}</span></div>}
    </>
  )
}
