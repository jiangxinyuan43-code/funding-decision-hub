import { BarChart3, Home, Layers3, Settings, WalletCards, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

export type PageId = 'home' | 'finance' | 'builds' | 'compare' | 'settings'

const navigation = [
  { id: 'home' as const, label: '首页', icon: Home },
  { id: 'finance' as const, label: '资金', icon: WalletCards },
  { id: 'builds' as const, label: '配置', icon: Layers3 },
  { id: 'compare' as const, label: '对比', icon: BarChart3 },
  { id: 'settings' as const, label: '我的', icon: Settings },
]

interface AppShellProps {
  appName: string
  activePage: PageId
  online: boolean
  children: ReactNode
  onNavigate: (page: PageId) => void
}

export function AppShell({ appName, activePage, online, children, onNavigate }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="side-navigation" aria-label="主导航">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <strong className="brand-name">{appName}</strong>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={activePage === id ? 'nav-item is-active' : 'nav-item'} type="button" key={id} onClick={() => onNavigate(id)}>
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {!online && <div className="offline-badge"><WifiOff size={15} /> 离线可用</div>}
      </aside>

      <div className="workspace">
        <header className="mobile-header">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <strong>{appName}</strong>
          {!online && <WifiOff size={18} aria-label="当前离线" />}
        </header>
        {children}
      </div>

      <nav className="bottom-navigation" aria-label="主导航">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button className={activePage === id ? 'bottom-nav-item is-active' : 'bottom-nav-item'} type="button" key={id} onClick={() => onNavigate(id)}>
            <Icon size={21} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
