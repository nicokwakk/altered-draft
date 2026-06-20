import { Component } from 'react'

// Catches render-time crashes anywhere in the app so the user sees a message (and the error
// is logged) instead of a blank white page. Important here because there's no local Node to
// run the app — a runtime crash that builds fine would otherwise ship silently.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-surface border border-line rounded-2xl p-6 space-y-4">
          <h1 className="font-display text-xl text-ink">Something went wrong</h1>
          <p className="text-sm text-muted">
            The page hit an unexpected error. Reloading usually fixes it; if it keeps happening, this
            detail helps with a bug report.
          </p>
          <pre className="text-xs text-red-400 bg-surface2 border border-line rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent hover:bg-accent2 text-on-accent font-bold rounded-lg text-sm transition-colors">
              Reload
            </button>
            <button onClick={() => { window.location.href = '/' }}
              className="px-4 py-2 bg-surface2 hover:bg-surface3 text-ink2 rounded-lg text-sm font-medium transition-colors">
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
