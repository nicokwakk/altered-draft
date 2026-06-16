import { Link } from 'react-router-dom'
import ReunionButton from './ReunionButton.jsx'
import ThemeToggle from './ThemeToggle.jsx'

// Top "menu pill" inspired by alteredcore.org's .altered-navbar: a rounded, bordered
// bar with the wordmark, ecosystem links, and the Re:Union + theme controls on the
// right. Used on the setup pages (Home, Lobby).
export default function TopNav() {
  return (
    <header className="w-full px-4 pt-4">
      <nav className="max-w-5xl mx-auto px-4 py-2 rounded-2xl bg-surface2 border border-line shadow-lg flex items-center gap-2">
        <Link to="/" className="font-display tracking-wide text-lg text-ink hover:text-accent transition-colors">
          <span className="text-accent">Altered</span> Draft
        </Link>
        <a href="https://alteredcore.org" target="_blank" rel="noopener noreferrer"
          className="hidden sm:inline ml-3 text-sm text-ink2 hover:text-accent transition-colors">
          Altered Core ↗
        </a>
        <div className="ml-auto flex items-center gap-2">
          <ReunionButton />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
