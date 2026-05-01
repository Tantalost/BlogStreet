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

  if (!state?.username || !state?.password) {
    return <Navigate to="/sign-up" replace />
  }

  const handleSendCode = async (): Promise<void> => {
    const e = email.trim().toLowerCase()
    if (!e) {
      setErrorMessage('Enter your email address to receive a code.')
      return
    }

    setIsSendingCode(true)
    setErrorMessage(null)
    try {
      const payload = await apiRequest<{ message?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: state.username,
          email: e,
          password: state.password,
        }),
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

    if (!e || !code) {
      setErrorMessage('Email and OTP code are required.')
      return
    }

    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('OTP code must be 6 digits.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await apiRequest('/api/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({ email: e, otp: code }),
      })

      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: state.username, password: state.password }),
      })
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
    if (!e) {
      setErrorMessage('Enter your email to resend the code.')
      return
    }

    setIsResending(true)
    setErrorMessage(null)
    try {
      const payload = await apiRequest<{ message?: string }>('/api/auth/register/resend', {
        method: 'POST',
        body: JSON.stringify({ email: e }),
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
    <div
      className="relative min-h-screen overflow-hidden bg-[#f8f9fb] font-['Inter',system-ui,sans-serif]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.07) 1px, transparent 0)',
        backgroundSize: '14px 14px',
      }}
    >
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6">
        <div className="landing-fade-up w-full overflow-hidden rounded-[30px] border border-white/70 bg-white/55 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-10">
          <Link to="/" className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
            Back to home
          </Link>
          <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-slate-900">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-600">Enter the 6-digit code sent to your email.</p>

          <form className="mt-6" onSubmit={(e) => void handleVerify(e)}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                placeholder="you@example.com"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.32)] transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => void handleSendCode()}
                disabled={isSendingCode}
              >
                {isSendingCode ? 'Sending…' : 'Send code'}
              </button>
              <p className="text-xs text-slate-500">Use the email you want to verify.</p>
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">OTP code</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
              />
            </label>

            {statusMessage && (
              <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {statusMessage}
              </p>
            )}
            {errorMessage && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={isSubmitting || !hasSentCode}
              >
                {isSubmitting ? 'Verifying…' : 'Verify email'}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => void handleResend()}
                disabled={isResending || !hasSentCode}
              >
                {isResending ? 'Resending…' : 'Resend code'}
              </button>
              <Link to="/sign-in" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
                Back to sign in
              </Link>
            </div>
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
