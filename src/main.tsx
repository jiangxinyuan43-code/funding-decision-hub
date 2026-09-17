import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeDatabase } from './services/storage/db'
import './styles.css'

async function start() {
  await initializeDatabase()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary><App /></ErrorBoundary>
    </React.StrictMode>,
  )
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  }
}

start().catch(() => {
  document.getElementById('root')!.innerHTML = '<main class="fatal-state"><h1>本地数据初始化失败</h1><p>请检查浏览器是否允许使用 IndexedDB，然后刷新页面。</p></main>'
})
