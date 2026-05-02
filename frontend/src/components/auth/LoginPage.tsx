import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useSessionAuth } from '../../auth/session'
import { ApiError, apiRequest } from '../../lib/api'

type LoginPageProps = {
  isSignedIn: boolean
  refreshSession: () => Promise<void>
}

export default function LoginPage({ isSignedIn, refreshSession }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const location = useLocation()
  const { clearLogoutMessage } = useSessionAuth()

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message
    if (message) {
      setErrorMessage(message)
      clearLogoutMessage()
    }
  }, [location.state, clearLogoutMessage])

  if (isSignedIn) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const u = username.trim().toLowerCase()
    const p = password.trim()
    if (!u || !p) { setErrorMessage('Username and password are required.'); return }
    setIsSubmitting(true); setErrorMessage(null)
    try {
      await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
      await refreshSession()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally { setIsSubmitting(false) }
  }

  return (
    <>

      <div className="lp-root">
        <div className="lp-card">
          <Link to="/" className="back-link">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8.5 10.5L4.5 6.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </Link>
          <h1 className="lp-title">Welcome back</h1>
          <p className="lp-subtitle">Sign in to your BlogStreet account to continue.</p>
          <div className="divider" />
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label className="field-label" htmlFor="lp-username">Username</label>
              <input
                id="lp-username"
                className="field-input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={64}
                placeholder="Enter your username"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="lp-password">Password</label>
              <div className="password-wrap">
                <input
                  id="lp-password"
                  className="field-input"
                  type={isPasswordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={256}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setIsPasswordVisible((prev) => !prev)}
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isPasswordVisible ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 5l18 14"/>
                      <path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 5.9 1.9"/>
                      <path d="M8.2 9.2a3 3 0 0 0 4.6 3.6"/>
                      <path d="M13.7 14.6c-.5.2-1.1.4-1.7.4-6.5 0-10-6-10-6"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="alert alert-error">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="#dc2626" strokeWidth="1.4"/>
                  <path d="M7.5 4.5V8M7.5 10.5H7.51" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {errorMessage}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <><span className="spinner" />Signing in…</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7H11.5M8 3.5L11.5 7L8 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign in
                </>
              )}
            </button>
          </form>

          <p className="footer-text" style={{ marginTop: 16 }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>

          <p className="footer-text" style={{ marginTop: 20 }}>
            No account yet? <Link to="/sign-up">Create one</Link>
          </p>

        </div>
      </div>
    </>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}