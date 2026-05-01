export const SESSION_TIMEOUT_MS = 10 * 60 * 1000
export const INACTIVITY_LOGOUT_MESSAGE = 'You have been logged out due to inactivity'

type SessionTimeoutState = {
  startedAt: number | null
  lastActivityAt: number | null
  timeoutId: number | null
}

const sessionState: SessionTimeoutState = {
  startedAt: null,
  lastActivityAt: null,
  timeoutId: null,
}

let onSessionExpired: (() => void) | null = null

function scheduleExpiry(now: number): void {
  if (sessionState.lastActivityAt === null) return

  const elapsed = now - sessionState.lastActivityAt
  const remaining = Math.max(0, SESSION_TIMEOUT_MS - elapsed)

  if (sessionState.timeoutId !== null) {
    window.clearTimeout(sessionState.timeoutId)
  }

  sessionState.timeoutId = window.setTimeout(() => {
    if (hasSessionExpired()) {
      clearSessionState()
      onSessionExpired?.()
    }
  }, remaining)
}

export function startSession(now: number = Date.now()): void {
  sessionState.startedAt = now
  sessionState.lastActivityAt = now
  scheduleExpiry(now)
}

export function touchSession(now: number = Date.now()): void {
  if (sessionState.lastActivityAt === null) return
  sessionState.lastActivityAt = now
  scheduleExpiry(now)
}

export function clearSessionState(): void {
  if (sessionState.timeoutId !== null) {
    window.clearTimeout(sessionState.timeoutId)
  }
  sessionState.timeoutId = null
  sessionState.startedAt = null
  sessionState.lastActivityAt = null
}

export function hasActiveSession(): boolean {
  return sessionState.startedAt !== null && sessionState.lastActivityAt !== null
}

export function hasSessionExpired(now: number = Date.now()): boolean {
  if (!hasActiveSession()) return false
  return now - (sessionState.lastActivityAt ?? 0) > SESSION_TIMEOUT_MS
}

export function ensureSessionActive(now: number = Date.now()): boolean {
  if (!hasActiveSession()) return true
  if (hasSessionExpired(now)) {
    clearSessionState()
    onSessionExpired?.()
    return false
  }
  return true
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}
