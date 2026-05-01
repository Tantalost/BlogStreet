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
  const strengthLabelClass = getStrengthLabelClass(strength.label)
  const strengthBarClass = getStrengthBarClass(strength.label)
  const passwordRules = [
    { label: 'Length >= 8 characters', passed: strength.rules.hasMinLength },
    { label: 'At least one uppercase letter', passed: strength.rules.hasUppercase },
    { label: 'At least one lowercase letter', passed: strength.rules.hasLowercase },
    { label: 'At least one number', passed: strength.rules.hasDigit },
    { label: 'At least one symbol', passed: strength.rules.hasSpecial },
  ]

  if (isSignedIn) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const u = username.trim().toLowerCase()
    const p = password.trim()
    const submitStrength = check_password_strength(p)
    if (!u || !p) { setErrorMessage('Username and password are required.'); return }
    if (submitStrength.label === 'Weak') { setErrorMessage('Password strength is too weak.'); return }
    if (p.length < 8) { setErrorMessage('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(p)) { setErrorMessage('Password must include at least one uppercase letter.'); return }
    if (!/[a-z]/.test(p)) { setErrorMessage('Password must include at least one lowercase letter.'); return }
    if (!/[0-9]/.test(p)) { setErrorMessage('Password must include at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(p)) { setErrorMessage('Password must include at least one symbol.'); return }
    if (p !== confirmPassword.trim()) { setErrorMessage('Passwords do not match.'); return }
    setIsSubmitting(true); setErrorMessage(null)
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: u, email: u, password: p }),
      }, { skipSessionCheck: true })
      navigate('/verify-otp', { state: { email: u } })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally { setIsSubmitting(false) }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f8f9fb] font-['Inter',system-ui,sans-serif]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.07) 1px, transparent 0)',
        backgroundSize: '14px 14px',
      }}
    >
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-6">
        <div className="landing-fade-up grid w-full overflow-hidden rounded-[30px] border border-white/70 bg-white/55 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl md:grid-cols-[1.05fr_minmax(340px,440px)]">
          <section className="relative border-b border-slate-200/70 bg-gradient-to-br from-white/80 via-slate-50/75 to-blue-50/70 p-7 md:border-b-0 md:border-r md:p-10">
            <Link to="/" className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
              Back to home
            </Link>
            <p className="mt-5 text-sm font-semibold tracking-wide text-blue-600">BlogStreet</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-950 md:text-[2.8rem]">
              Create your account.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
              Start writing with a secure account and keep your notes organized from day one.
            </p>
            <div className="landing-fade-up mt-8 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]" style={{ animationDelay: '140ms' }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Already registered?</p>
              <Link to="/sign-in" className="mt-2 inline-flex text-sm font-semibold text-blue-600 transition hover:text-blue-500">
                Sign in instead
              </Link>
            </div>
          </section>
          <form className="landing-fade-up bg-white/70 p-7 md:p-10" style={{ animationDelay: '100ms' }} onSubmit={(e) => void handleSubmit(e)}>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Create account</h2>
            <p className="mt-2 text-sm text-slate-600">Choose credentials for your new account.</p>
            <label className="mt-7 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Username</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={64}
                placeholder="Choose a username"
              />
            </label>
            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Password</span>
              <div className="relative mt-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-16 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  type={isPasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={256}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900 hover:scale-105 active:scale-95 cursor-pointer"
                  onClick={() => setIsPasswordVisible((prev) => !prev)}
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isPasswordVisible ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5 transition-transform duration-200"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5 transition-transform duration-200"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 5l18 14" />
                      <path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 5.9 1.9" />
                      <path d="M8.2 9.2a3 3 0 0 0 4.6 3.6" />
                      <path d="M6.2 14.2C4.5 13.1 3 12 2 12" />
                      <path d="M13.7 14.6c-.5.2-1.1.4-1.7.4-6.5 0-10-6-10-6" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Confirm password</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                maxLength={256}
                placeholder="Re-enter your password"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">At least 8 chars with uppercase, lowercase, number, and symbol.</p>
            <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span>Strength</span>
                <span className={strengthLabelClass}>{strength.label}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${strengthBarClass}`} style={{ width: `${strengthPercent}%` }} />
              </div>
              <div className="mt-2 grid gap-1 text-xs">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className={rule.passed ? 'text-emerald-700' : 'text-slate-500'}>
                    {rule.label}
                  </div>
                ))}
              </div>
            </div>
            {errorMessage && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account…' : 'Sign up'}
            </button>
            <p className="mt-5 text-center text-sm text-slate-600">
              Already have an account? <Link to="/sign-in" className="font-semibold text-blue-600 hover:text-blue-500">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
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
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  }

  const score = Object.values(rules).filter(Boolean).length
  let label: PasswordStrengthLabel = 'Weak'

  if (score >= 5) {
    label = 'Strong'
  } else if (score >= 3) {
    label = 'Medium'
  }

  return { score, label, rules }
}

function getStrengthLabelClass(label: PasswordStrengthLabel): string {
  if (label === 'Strong') return 'text-emerald-600'
  if (label === 'Medium') return 'text-amber-600'
  return 'text-red-600'
}

function getStrengthBarClass(label: PasswordStrengthLabel): string {
  if (label === 'Strong') return 'bg-emerald-500'
  if (label === 'Medium') return 'bg-amber-500'
  return 'bg-red-500'
}
