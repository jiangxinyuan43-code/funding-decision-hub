import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeDatabase } from './services/storage/db'
import './styles.css'

async function retireLegacyOfflineCache() {
  if ('serviceWorker' in navigator) {
    const registrations = typeof navigator.serviceWorker.getRegistrations === 'function'
      ? await navigator.serviceWorker.getRegistrations()
      : [await navigator.serviceWorker.getRegistration()].filter(Boolean)
    await Promise.all(registrations.map((registration) => registration?.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('funding-decision-hub-')).map((key) => caches.delete(key)))
  }
}

async function start() {
  void retireLegacyOfflineCache().catch(() => undefined)
  await initializeDatabase()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary><App /></ErrorBoundary>
    </React.StrictMode>,
  )
}

start().catch(() => {
  document.getElementById('root')!.innerHTML = '<main class="fatal-state"><h1>本地数据初始化失败</h1><p>请检查浏览器是否允许使用 IndexedDB，然后刷新页面。</p></main>'
})
