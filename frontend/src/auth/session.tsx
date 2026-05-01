import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import {
  INACTIVITY_LOGOUT_MESSAGE,
  clearSessionState,
  ensureSessionActive,
  hasActiveSession,
  setSessionExpiredHandler,
  startSession,
  touchSession,
} from './sessionTimeout'

export type AuthUser = {
  id: string
  username: string
  avatarUrl?: string | null
}

type AuthContextValue = {
  isLoaded: boolean
  isSignedIn: boolean
  user: AuthUser | null
  logoutMessage: string | null
  refreshSession: () => Promise<void>
  logout: () => Promise<void>
  clearLogoutMessage: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function SessionAuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)

  const logoutDueToInactivity = useCallback((): void => {
    setLogoutMessage(INACTIVITY_LOGOUT_MESSAGE)
    clearSessionState()
    setUser(null)
    void apiRequest<void>('/api/auth/logout', { method: 'POST' }, { skipSessionCheck: true })
  }, [])

  const refreshSession = async (): Promise<void> => {
    try {
      const payload = await apiRequest<{ user: AuthUser }>('/api/auth/me')
      setUser(payload.user)
      setLogoutMessage(null)
      if (hasActiveSession()) {
        touchSession()
      } else {
        startSession()
      }
    } catch {
      setUser(null)
      clearSessionState()
    } finally {
      setIsLoaded(true)
    }
  }

  useEffect(() => { void refreshSession() }, [])

  useEffect(() => {
    setSessionExpiredHandler(logoutDueToInactivity)
    return () => setSessionExpiredHandler(null)
  }, [logoutDueToInactivity])

  useEffect(() => {
    if (!user) return

    const handleActivity = () => {
      if (!ensureSessionActive()) return
      touchSession()
    }

    window.addEventListener('pointerdown', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity)

    return () => {
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [user])

  const logout = async (): Promise<void> => {
    await apiRequest<void>('/api/auth/logout', { method: 'POST' }, { skipSessionCheck: true })
    clearSessionState()
    setUser(null)
    setLogoutMessage(null)
  }

  const clearLogoutMessage = useCallback((): void => setLogoutMessage(null), [])

  const authValue = useMemo<AuthContextValue>(
    () => ({ isLoaded, isSignedIn: Boolean(user), user, logoutMessage, refreshSession, logout, clearLogoutMessage }),
    [isLoaded, user, logoutMessage, clearLogoutMessage],
  )

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
}

export function useSessionAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthContext is missing.')
  return context
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, logoutMessage } = useSessionAuth()
  if (!isLoaded) return <div className="loading-screen">Loading workspace…</div>
  if (!isSignedIn && logoutMessage) {
    return <Navigate to="/sign-in" replace state={{ message: logoutMessage }} />
  }
  if (!isSignedIn) return <Navigate to="/" replace />
  return children
}
