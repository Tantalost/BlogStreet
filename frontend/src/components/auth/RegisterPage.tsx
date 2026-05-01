import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, apiRequest } from '../../lib/api'

type RegisterPageProps = {
  isSignedIn: boolean
  refreshSession: () => Promise<void>
}

export default function RegisterPage({ isSignedIn, refreshSession: _refreshSession }: RegisterPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const passwordValue = password.trim()
  const strength = check_password_strength(passwordValue)
  const strengthPercent = Math.round((strength.score / 5) * 100)

  const passwordRules = [
    { label: 'Length ≥ 8 characters',        passed: strength.rules.hasMinLength },
    { label: 'At least one uppercase letter', passed: strength.rules.hasUppercase },
    { label: 'At least one lowercase letter', passed: strength.rules.hasLowercase },
    { label: 'At least one number',           passed: strength.rules.hasDigit },
    { label: 'At least one symbol',           passed: strength.rules.hasSpecial },
  ]

  if (isSignedIn) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const u = username.trim().toLowerCase()
    const p = password.trim()
    const submitStrength = check_password_strength(p)
    if (!u || !p)                        { setErrorMessage('Username and password are required.'); return }
    if (submitStrength.label === 'Weak') { setErrorMessage('Password strength is too weak.'); return }
    if (p.length < 8)                    { setErrorMessage('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(p))               { setErrorMessage('Password must include at least one uppercase letter.'); return }
    if (!/[a-z]/.test(p))               { setErrorMessage('Password must include at least one lowercase letter.'); return }
    if (!/[0-9]/.test(p))               { setErrorMessage('Password must include at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(p))        { setErrorMessage('Password must include at least one symbol.'); return }
    if (p !== confirmPassword.trim())    { setErrorMessage('Passwords do not match.'); return }
    setIsSubmitting(true); setErrorMessage(null)
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      }, { skipSessionCheck: true })
      navigate('/verify-otp', { state: { username: u, password: p } })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally { setIsSubmitting(false) }
  }

  return (
    <>

      <div className="rp-root">
        <div className="rp-card">
          <Link to="/" className="back-link">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8.5 10.5L4.5 6.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </Link>

          <div className="progress-bar">
            <div className="progress-seg active" />
            <div className="progress-seg" />
          </div>

          <div className="step-chip">
            <div className="step-num">1</div>
            <span className="step-label">Account Details</span>
          </div>

          <h1 className="rp-title">Create your account</h1>
          <p className="rp-subtitle">Choose a username and a strong password to get started.</p>

          <div className="divider" />
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="form-grid">
              <div className="form-col">
                <div className="field">
                  <label className="field-label" htmlFor="rp-username">Username</label>
                  <input
                    id="rp-username"
                    className="field-input"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={64}
                    placeholder="Choose a username"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="rp-confirm">Confirm password</label>
                  <input
                    id="rp-confirm"
                    className="field-input"
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    maxLength={256}
                    placeholder="Re-enter your password"
                  />
                </div>
              </div>

              <div className="form-col">
                <div className="field">
                  <label className="field-label" htmlFor="rp-password">Password</label>
                  <div className="password-wrap">
                    <input
                      id="rp-password"
                      className="field-input"
                      type={isPasswordVisible ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      maxLength={256}
                      placeholder="Create a strong password"
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

                  <div className="strength-box">
                    <div className="strength-header">
                      <span>Strength</span>
                      <span className={`strength-label ${strength.label.toLowerCase()}`}>{strength.label}</span>
                    </div>
                    <div className="strength-track">
                      <div
                        className={`strength-fill ${strength.label.toLowerCase()}`}
                        style={{ width: `${strengthPercent}%` }}
                      />
                    </div>
                    <div className="rule-list">
                      {passwordRules.map((rule) => (
                        <div key={rule.label} className={`rule-item${rule.passed ? ' pass' : ''}`}>
                          <div className="rule-dot" />
                          {rule.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
                <><span className="spinner" />Creating account…</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Continue
                </>
              )}
            </button>

          </form>

          <p className="footer-text">
            Already have an account? <Link to="/sign-in">Sign in</Link>
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

type PasswordStrengthLabel = 'Weak' | 'Medium' | 'Strong'

type PasswordStrengthResult = {
  score: number
  label: PasswordStrengthLabel
  rules: {
    hasMinLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasDigit: boolean
    hasSpecial: boolean
  }
}

function check_password_strength(password: string): PasswordStrengthResult {
  const rules = {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit:     /[0-9]/.test(password),
    hasSpecial:   /[^A-Za-z0-9]/.test(password),
  }
  const score = Object.values(rules).filter(Boolean).length
  let label: PasswordStrengthLabel = 'Weak'
  if (score >= 5) label = 'Strong'
  else if (score >= 3) label = 'Medium'
  return { score, label, rules }
}