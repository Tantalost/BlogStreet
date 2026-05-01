import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import DashboardPageComponent from './components/DashboardPage'
import WorkspacePageComponent from './components/WorkspacePage'
import DeletedNotesPageComponent from './components/DeletedNotesPage'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import VerifyOtpPage from './components/auth/VerifyOtpPage'
import SecurityPageComponent from './components/account/SecurityPage'
import { RequireAuth, SessionAuthProvider, useSessionAuth } from './auth/session'
import './App.css'

function App() {
  useEffect(() => {
    const seenKey = 'webnote-page-animations-seen'
    const hasSeenAnimations = window.sessionStorage.getItem(seenKey) === '1'
    if (hasSeenAnimations) {
      document.documentElement.classList.add('animations-seen')
      return
    }
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(seenKey, '1')
      document.documentElement.classList.add('animations-seen')
    }, 900)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <SessionAuthProvider>
      <AppRoutes />
    </SessionAuthProvider>
  )
}

function AppRoutes() {
  const { user, refreshSession } = useSessionAuth()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<LoginPage isSignedIn={Boolean(user)} refreshSession={refreshSession} />} />
      <Route path="/sign-up" element={<RegisterPage isSignedIn={Boolean(user)} refreshSession={refreshSession} />} />
      <Route path="/verify-otp" element={<VerifyOtpPage isSignedIn={Boolean(user)} />} />
      <Route path="/profile" element={<RequireAuth><SecurityPage /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/create-note" element={<RequireAuth><WorkspacePage /></RequireAuth>} />
      <Route path="/design" element={<RequireAuth><WorkspacePage /></RequireAuth>} />
      <Route path="/deleted-notes" element={<RequireAuth><DeletedNotesPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function SecurityPage() {
  const { user, logout, refreshSession } = useSessionAuth()
  return <SecurityPageComponent user={user} logout={logout} refreshSession={refreshSession} />
}

function DashboardPage() {
  const { user, logout } = useSessionAuth()
  return <DashboardPageComponent user={user} logout={logout} />
}

function WorkspacePage() {
  return <WorkspacePageComponent />
}

function DeletedNotesPage() {
  const { user, logout } = useSessionAuth()
  return <DeletedNotesPageComponent user={user} logout={logout} />
}

export default App