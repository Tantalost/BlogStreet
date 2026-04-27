import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { ApiError, apiRequest } from '../../lib/api'
import AccountButton from './AccountButton'

type SecurityPageProps = {
  user?: {
    id: string
    username: string
    avatarUrl?: string | null
  } | null
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

export default function SecurityPage({ user, logout, refreshSession }: SecurityPageProps) {
  const [displayName, setDisplayName] = useState(user?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Use PNG, JPG, or WEBP image.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        setErrorMessage('Could not read selected image.')
        return
      }
      setAvatarUrl(result)
      setErrorMessage(null)
    }
    reader.onerror = () => setErrorMessage('Could not read selected image.')
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleSaveProfile = async (): Promise<void> => {
    const trimmedName = displayName.trim().toLowerCase()
    if (!trimmedName) {
      setErrorMessage('Name is required.')
      return
    }
    setIsSavingProfile(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          username: trimmedName,
          avatarUrl: avatarUrl.trim() || null,
        }),
      })
      await refreshSession()
      setSuccessMessage('Profile updated successfully.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePassword = async (): Promise<void> => {
    if (!currentPassword.trim()) {
      setErrorMessage('Current password is required.')
      return
    }
    if (!newPassword.trim()) {
      setErrorMessage('New password is required.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.')
      return
    }
    setIsSavingPassword(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMessage('Password updated successfully.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#f7f8fa] p-4 text-slate-800 sm:p-5"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)',
        backgroundSize: '14px 14px',
      }}
    >
      <div className="page-enter mx-auto w-full max-w-[1080px] rounded-[30px] border border-white/80 bg-white/70 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-8">
        <div className="panel-enter enter-delay-1 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
          <Link to="/dashboard" className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-slate-50">
            Back to dashboard
          </Link>
          <AccountButton username={user?.username} logout={logout} />
        </div>

        <div className="panel-enter enter-delay-2 mt-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Profile</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your account details in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                : <span className="text-xl font-semibold text-slate-700">{(user?.username?.[0] ?? 'W').toUpperCase()}</span>}
            </div>
            <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={() => imageInputRef.current?.click()}>
              Change image
            </button>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleSelectImage} hidden />
          </div>
        </div>

        {errorMessage && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
        {successMessage && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="panel-enter enter-delay-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Change name</h2>
            <p className="mt-1 text-sm text-slate-500">Update your display name/username.</p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Name</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                placeholder="Enter your name"
              />
            </label>
            <button
              type="button"
              className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-55"
              onClick={() => void handleSaveProfile()}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </section>

          <section className="panel-enter enter-delay-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
            <p className="mt-1 text-sm text-slate-500">Current password is required before changing password.</p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current password</span>
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">New password</span>
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Confirm new password</span>
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </label>
            <button
              type="button"
              className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-55"
              onClick={() => void handleSavePassword()}
              disabled={isSavingPassword}
            >
              {isSavingPassword ? 'Updating...' : 'Update password'}
            </button>
          </section>
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
