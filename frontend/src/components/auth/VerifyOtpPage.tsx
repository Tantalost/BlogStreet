import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest, ApiError } from '../../lib/api'
import { useSessionAuth } from '../../auth/session'

type VerifyOtpLocationState = {
  username?: string
  password?: string
}

type VerifyOtpPageProps = {
  isSignedIn: boolean
}

export default function VerifyOtpPage({ isSignedIn }: VerifyOtpPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshSession } = useSessionAuth()
  const state = (location.state as VerifyOtpLocationState | null) ?? null

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [hasSentCode, setHasSentCode] = useState(false)

  if (isSignedIn) return <Navigate to="/dashboard" replace />
  if (!state?.username || !state?.password) return <Navigate to="/sign-up" replace />

  const handleSendCode = async (): Promise<void> => {
    const e = email.trim().toLowerCase()
    if (!e) { setErrorMessage('Enter your email address to receive a code.'); return }
    setIsSendingCode(true)
    setErrorMessage(null)
    try {
      const payload = await apiRequest<{ message?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: state.username, email: e, password: state.password }),
      })
      setStatusMessage(payload.message ?? `We sent a code to ${e}.`)
      setHasSentCode(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const e = email.trim().toLowerCase()
    const code = otp.trim()
    if (!e || !code) { setErrorMessage('Email and OTP code are required.'); return }
    if (!/^\d{6}$/.test(code)) { setErrorMessage('OTP code must be exactly 6 digits.'); return }
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await apiRequest('/api/auth/register/verify', { method: 'POST', body: JSON.stringify({ email: e, otp: code }) })
      await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: state.username, password: state.password }) })
      await refreshSession()
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async (): Promise<void> => {
    const e = email.trim().toLowerCase()
    if (!e) { setErrorMessage('Enter your email to resend the code.'); return }
    setIsResending(true)
    setErrorMessage(null)
    try {
      const payload = await apiRequest<{ message?: string }>('/api/auth/register/resend', { method: 'POST', body: JSON.stringify({ email: e }) })
      setStatusMessage(payload.message ?? 'A new verification code has been sent.')
      setHasSentCode(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <>

      <div className="vop-root">
        <div className="vop-card">

          <Link to="/" className="back-link">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8.5 10.5L4.5 6.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </Link>

          <div className="progress-bar">
            <div className="progress-seg done" />
            <div className="progress-seg active" />
          </div>

          <div className="step-chip">
            <div className="step-num">3</div>
            <span className="step-label">Email Verification</span>
          </div>

          <h1 className="vop-title">Verify your email</h1>
          <p className="vop-subtitle">Enter the 6-digit code we'll send to confirm your account.</p>

          <div className="divider" />

          <form onSubmit={(e) => void handleVerify(e)}>

            <div className="field">
              <label className="field-label">Email address</label>
              <div className="input-row">
                <input
                  className="field-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  placeholder="you@example.com"
                  disabled={isSendingCode}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleSendCode()}
                  disabled={isSendingCode || !email.trim()}
                >
                  {isSendingCode
                    ? <><span className="spinner" />Sending…</>
                    : <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M11.5 1.5L6 7M11.5 1.5H8M11.5 1.5V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 3H2C1.45 3 1 3.45 1 4V11C1 11.55 1.45 12 2 12H9C9.55 12 10 11.55 10 11V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        Send code
                      </>
                  }
                </button>
              </div>
              {!hasSentCode && <p className="hint-text">We'll send a one-time code to this address.</p>}
            </div>

            <div className="field">
              <label className="field-label">Verification code</label>
              <input
                className="field-input otp-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                disabled={!hasSentCode}
              />
            </div>

            {statusMessage && (
              <div className="alert alert-success">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M12.5 4L6 10.5L3 7.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {statusMessage}
              </div>
            )}
            {errorMessage && (
              <div className="alert alert-error">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="#dc2626" strokeWidth="1.4"/>
                  <path d="M7.5 4.5V8M7.5 10.5H7.51" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary btn-full"
              style={{ marginTop: 22 }}
              disabled={isSubmitting || !hasSentCode || otp.length < 6}
            >
              {isSubmitting
                ? <><span className="spinner" />Verifying…</>
                : <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M4.5 7L6.5 9L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Verify email
                  </>
              }
            </button>

            <div className="actions-row">
              <button
                type="button"
                className="btn-outline"
                onClick={() => void handleResend()}
                disabled={isResending || !hasSentCode}
              >
                {isResending
                  ? <><span className="spinner spinner-blue" />Resending…</>
                  : <>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2 6.5A4.5 4.5 0 0 1 10 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <path d="M8.5 1.5L10.5 3.5L8.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Resend code
                    </>
                }
              </button>
              <Link to="/sign-in" className="link-text">Sign in instead →</Link>
            </div>

          </form>
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