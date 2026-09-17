import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Avoid logging application state or API credentials from the browser.
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-state">
          <AlertTriangle size={28} />
          <h1>这个页面暂时没有正常加载</h1>
          <p>你的本地数据仍在。刷新页面后可以继续使用。</p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>刷新页面</button>
        </main>
      )
    }
    return this.props.children
  }
}
