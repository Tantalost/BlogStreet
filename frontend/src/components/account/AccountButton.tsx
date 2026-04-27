import { useState } from 'react'

type AccountButtonProps = {
  username?: string
  logout: () => Promise<void>
}

export default function AccountButton({ username, logout }: AccountButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogout = async (): Promise<void> => {
    setIsSubmitting(true)
    try { await logout() } finally { setIsSubmitting(false) }
  }

  return (
    <button
      type="button"
      className="cursor-pointer rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-[0_14px_26px_rgba(239,68,68,0.28)] disabled:cursor-not-allowed disabled:opacity-55"
      onClick={() => void handleLogout()}
      disabled={isSubmitting}
      title={username ? `Signed in as ${username}` : 'Log out'}
    >
      {isSubmitting ? 'Logging out…' : 'Log out'}
    </button>
  )
}
