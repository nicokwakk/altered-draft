import { useAuth } from '../auth/AuthProvider.jsx'

// Connect / Disconnect control for Re:Union login. Renders nothing while the initial
// auth check is in flight, "Connect Re:Union" when logged out, and the pseudo +
// Disconnect when logged in.
export default function ReunionButton({ className = '' }) {
  const { user, loading, login, logout } = useAuth()
  if (loading) return null
  if (!user) {
    return (
      <button onClick={() => login()}
        className={`px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors ${className}`}>
        Connect Re:Union
      </button>
    )
  }
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-gray-300" title="Signed in to Re:Union">{user.pseudo}</span>
      <button onClick={logout}
        className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 transition-colors">
        Disconnect
      </button>
    </div>
  )
}
