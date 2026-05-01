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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background-color: #f0f4ff;
          background-image:
            radial-gradient(ellipse 70% 60% at 15% 0%,   rgba(37,99,235,0.09) 0%, transparent 65%),
            radial-gradient(ellipse 50% 40% at 85% 100%, rgba(96,165,250,0.10) 0%, transparent 60%),
            url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='%232563eb' fill-opacity='0.04'/%3E%3C/svg%3E");
          position: relative;
          overflow: hidden;
        }

        .lp-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 468px;
          background: #ffffff;
          border: 1px solid rgba(37,99,235,0.1);
          border-radius: 28px;
          padding: 44px 44px 40px;
          box-shadow:
            0 0 0 1px rgba(37,99,235,0.04),
            0 4px 6px rgba(37,99,235,0.04),
            0 24px 60px rgba(37,99,235,0.1),
            0 2px 4px rgba(0,0,0,0.04);
          animation: cardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        .lp-card::before {
          content: '';
          position: absolute;
          top: 0; left: 44px; right: 44px;
          height: 3px;
          background: linear-gradient(90deg, #2563eb, #60a5fa, #2563eb);
          border-radius: 0 0 4px 4px;
        }

        /* ── Brand pill ── */
        .brand-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 99px;
          padding: 5px 13px 5px 7px;
          margin-bottom: 28px;
          text-decoration: none;
        }
        .brand-dot {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .brand-dot svg { display: block; }
        .brand-name {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #2563eb;
        }

        /* ── Back link ── */
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: #64748b;
          text-decoration: none;
          padding: 5px 10px 5px 7px;
          border-radius: 99px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          margin-bottom: 28px;
        }
        .back-link:hover { background: #eff6ff; border-color: #bfdbfe; color: #2563eb; }
        .back-link svg { transition: transform 0.2s; }
        .back-link:hover svg { transform: translateX(-2px); }

        /* ── Headings ── */
        .lp-title {
          font-family: 'Sora', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.025em;
          line-height: 1.2;
          margin-bottom: 7px;
        }
        .lp-subtitle {
          font-size: 14px;
          color: #64748b;
          line-height: 1.55;
          margin-bottom: 28px;
        }

        /* ── Divider ── */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #e2e8f0 30%, #e2e8f0 70%, transparent);
          margin-bottom: 26px;
        }

        /* ── Fields ── */
        .field + .field { margin-top: 18px; }

        .field-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 7px;
        }

        .field-input {
          flex: 1;
          min-width: 0;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 11px 15px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          width: 100%;
        }
        .field-input::placeholder { color: #cbd5e1; }
        .field-input:focus {
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }

        /* ── Password wrapper ── */
        .password-wrap { position: relative; }
        .password-wrap .field-input { padding-right: 46px; }
        .eye-btn {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: #0f172a; }

        /* ── Alert ── */
        .alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-radius: 11px;
          padding: 11px 13px;
          font-size: 13px;
          line-height: 1.5;
          margin-top: 18px;
          animation: alertIn 0.2s ease both;
        }
        @keyframes alertIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
        .alert svg { flex-shrink: 0; margin-top: 1px; }
        .alert-error { background: #fef2f2; border: 1.5px solid #fecaca; color: #dc2626; }

        /* ── Primary button ── */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          background: #2563eb;
          color: #ffffff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          padding: 13px 20px;
          cursor: pointer;
          width: 100%;
          margin-top: 22px;
          transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.2), 0 6px 24px rgba(37,99,235,0.18);
        }
        .btn-primary:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 2px 6px rgba(37,99,235,0.3), 0 8px 20px rgba(37,99,235,0.22); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

        /* ── Spinner ── */
        .spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Footer ── */
        .footer-text {
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
          margin-top: 18px;
        }
        .footer-text a {
          font-weight: 600;
          color: #2563eb;
          text-decoration: none;
          transition: color 0.15s;
        }
        .footer-text a:hover { color: #1d4ed8; }

        /* ── Divider with text ── */
        .or-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
        }
        .or-line { flex: 1; height: 1px; background: #e2e8f0; }
        .or-text { font-size: 11px; font-weight: 600; color: #cbd5e1; letter-spacing: 0.06em; text-transform: uppercase; }

        @media (max-width: 500px) {
          .lp-card { padding: 32px 24px 28px; border-radius: 22px; }
          .lp-card::before { left: 24px; right: 24px; }
          .lp-title { font-size: 22px; }
        }
      `}</style>

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