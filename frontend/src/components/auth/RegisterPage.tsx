import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError, apiRequest } from '../../lib/api'

type RegisterPageProps = {
  isSignedIn: boolean
  refreshSession: () => Promise<void>
}

export default function RegisterPage({ isSignedIn, refreshSession }: RegisterPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (isSignedIn) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const u = username.trim().toLowerCase()
    const p = password.trim()
    if (!u || !p) { setErrorMessage('Username and password are required.'); return }
    if (p.length < 8) { setErrorMessage('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(p)) { setErrorMessage('Password must include at least one uppercase letter.'); return }
    if (!/[a-z]/.test(p)) { setErrorMessage('Password must include at least one lowercase letter.'); return }
    if (!/[0-9]/.test(p)) { setErrorMessage('Password must include at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(p)) { setErrorMessage('Password must include at least one symbol.'); return }
    if (p !== confirmPassword.trim()) { setErrorMessage('Passwords do not match.'); return }
    setIsSubmitting(true); setErrorMessage(null)
    try {
      await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
      await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
      await refreshSession()
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
            <p className="mt-5 text-sm font-semibold tracking-wide text-blue-600">WebNote</p>
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
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={256}
                placeholder="Create a strong password"
              />
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
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={isPasswordVisible} onChange={(e) => setIsPasswordVisible(e.target.checked)} />
              Show password
            </label>
            <p className="mt-2 text-xs text-slate-500">At least 8 chars with uppercase, lowercase, number, and symbol.</p>
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
