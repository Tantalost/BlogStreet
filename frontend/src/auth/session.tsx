import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'

export type AuthUser = {
  id: string
  username: string
  avatarUrl?: string | null
}

type AuthContextValue = {
  isLoaded: boolean
  isSignedIn: boolean
  user: AuthUser | null
  refreshSession: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function SessionAuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  const refreshSession = async (): Promise<void> => {
    try {
      const payload = await apiRequest<{ user: AuthUser }>('/api/auth/me')
      setUser(payload.user)
    } catch {
      setUser(null)
    } finally {
      setIsLoaded(true)
    }
  }

  useEffect(() => { void refreshSession() }, [])

  const logout = async (): Promise<void> => {
    await apiRequest<void>('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  const authValue = useMemo<AuthContextValue>(
    () => ({ isLoaded, isSignedIn: Boolean(user), user, refreshSession, logout }),
    [isLoaded, user],
  )

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
}

export function useSessionAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthContext is missing.')
  return context
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useSessionAuth()
  if (!isLoaded) return <div className="loading-screen">Loading workspace…</div>
  if (!isSignedIn) return <Navigate to="/" replace />
  return children
}
