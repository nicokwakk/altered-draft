import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { isLoggedIn, fetchProfile, login as doLogin, logout as doLogout, getAccessToken } from '../lib/reunion.js'

const AuthContext = createContext(null)

// Provides Re:Union auth state to the app. Login is optional — when logged out,
// `user` is null and everything still works anonymously.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!isLoggedIn()) { setUser(null); setLoading(false); return }
    setUser(await fetchProfile())
    setLoading(false)
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  const value = {
    user,
    loading,
    login: (returnPath) => doLogin(returnPath),
    logout: () => { doLogout(); setUser(null) },
    getAccessToken,
    refreshUser,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
