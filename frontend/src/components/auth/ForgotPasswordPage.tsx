import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { apiRequest, ApiError } from '../../lib/api'

type ForgotPasswordPageProps = {
  isSignedIn: boolean
}

export default function ForgotPasswordPage({ isSignedIn }: ForgotPasswordPageProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [hasSentCode, setHasSentCode] = useState(false)

  if (isSignedIn) return <Navigate to="/dashboard" replace />

  const handleSendCode = async (): Promise<void> => {
    const e = email.trim().toLowerCase()
    if (!e) { setErrorMessage('Enter your email address to receive a code.'); return }
    setIsSendingCode(true)
    setErrorMessage(null)
    try {
      const payload = await apiRequest<{ message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: e }),
      })
      setStatusMessage(payload.message ?? `We sent a code to ${e}.`)
      setHasSentCode(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleReset = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const e = email.trim().toLowerCase()
    const code = otp.trim()
    const np = newPassword.trim()
    const cp = confirmPassword.trim()

    if (!e || !code || !np) { setErrorMessage('Email, OTP code, and new password are required.'); return }
    if (!/^\d{6}$/.test(code)) { setErrorMessage('OTP code must be exactly 6 digits.'); return }
    if (np !== cp) { setErrorMessage('Passwords do not match.'); return }
    if (np.length < 8) { setErrorMessage('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(np)) { setErrorMessage('Password must include at least one uppercase letter.'); return }
    if (!/[a-z]/.test(np)) { setErrorMessage('Password must include at least one lowercase letter.'); return }
    if (!/[0-9]/.test(np)) { setErrorMessage('Password must include at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(np)) { setErrorMessage('Password must include at least one symbol.'); return }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await apiRequest('/api/auth/forgot-password/verify', { 
        method: 'POST', 
        body: JSON.stringify({ email: e, otp: code, newPassword: np }) 
      })
      setStatusMessage('Password has been reset successfully.')
      setTimeout(() => navigate('/sign-in', { replace: true }), 2000)
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
      const payload = await apiRequest<{ message?: string }>('/api/auth/forgot-password/resend', { 
        method: 'POST', 
        body: JSON.stringify({ email: e }) 
      })
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

          <h1 className="vop-title">Reset your password</h1>
          <p className="vop-subtitle">Enter your email to receive a verification code, then set a new password.</p>

          <div className="divider" />

          <form onSubmit={(e) => void handleReset(e)}>

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

            <div className="field">
              <label className="field-label">New password</label>
              <div className="password-wrap">
                <input
                  className="field-input"
                  type={isPasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  maxLength={256}
                  placeholder="Enter new password"
                  disabled={!hasSentCode}
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

            <div className="field">
              <label className="field-label">Confirm new password</label>
              <div className="password-wrap">
                <input
                  className="field-input"
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  maxLength={256}
                  placeholder="Confirm new password"
                  disabled={!hasSentCode}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
                  aria-label={isConfirmPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isConfirmPasswordVisible ? (
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
                ? <><span className="spinner" />Resetting…</>
                : <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M4.5 7L6.5 9L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Reset password
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
