import {
  SignIn,
  SignUp,
  UserButton,
  UserProfile,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { ApiError, apiRequest } from './lib/api'
import type { Note, NotePayload } from './types/note'
import './App.css'

const AUTH_APPEARANCE = {
  elements: {
    card: 'auth-card',
    headerTitle: 'auth-title',
    headerSubtitle: 'auth-subtitle',
    socialButtonsBlockButton: 'auth-social',
    formButtonPrimary: 'auth-primary-btn',
    footerActionLink: 'auth-link',
  },
}

const EMPTY_DRAFT: NotePayload = {
  title: 'Untitled story',
  content: '',
  isPublished: false,
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route
        path="/security/*"
        element={
          <RequireAuth>
            <SecurityPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <WorkspacePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="loading-screen">Loading your workspace...</div>
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return children
}

function SignInPage() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <p className="auth-kicker">BlogStreet</p>
        <h1>Build notes, then publish your stories.</h1>
        <p>
          Use Google to sign in, then complete your OTP verification step for
          secure access.
        </p>
      </div>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/app"
        appearance={AUTH_APPEARANCE}
      />
    </div>
  )
}

function SignUpPage() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <p className="auth-kicker">BlogStreet</p>
        <h1>Create your writing command center.</h1>
        <p>
          Continue with Google, then enable OTP in your security settings for
          stronger account protection.
        </p>
      </div>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/app"
        appearance={AUTH_APPEARANCE}
      />
    </div>
  )
}

function SecurityPage() {
  return (
    <div className="profile-shell">
      <div className="profile-header">
        <Link to="/app">Back to workspace</Link>
        <UserButton />
      </div>
      <UserProfile path="/security" routing="path" />
    </div>
  )
}

function WorkspacePage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NotePayload>(EMPTY_DRAFT)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isOtpEnabled = Boolean(user?.twoFactorEnabled)
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  const wordCount = useMemo(() => {
    const trimmed = draft.content.trim()

    if (!trimmed) {
      return 0
    }

    return trimmed.split(/\s+/).length
  }, [draft.content])

  useEffect(() => {
    if (selectedNote) {
      setDraft({
        title: selectedNote.title,
        content: selectedNote.content,
        isPublished: selectedNote.isPublished,
      })
      return
    }

    setDraft(EMPTY_DRAFT)
  }, [selectedNote])

  useEffect(() => {
    void loadNotes()
  }, [])

  const loadNotes = async (): Promise<void> => {
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = await getSessionToken(getToken)
      const fetchedNotes = await apiRequest<Note[]>('/api/notes', token)
      setNotes(fetchedNotes)
      setSelectedNoteId((current) => {
        if (current && fetchedNotes.some((note) => note.id === current)) {
          return current
        }

        return fetchedNotes[0]?.id ?? null
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNote = async (): Promise<void> => {
    if (!isOtpEnabled) {
      setErrorMessage('Enable OTP first before creating or editing notes.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = await getSessionToken(getToken)
      const created = await apiRequest<Note>('/api/notes', token, {
        method: 'POST',
        body: JSON.stringify({
          title: 'New story',
          content: '',
          isPublished: false,
        }),
      })

      setNotes((current) => [created, ...current])
      setSelectedNoteId(created.id)
      setSuccessMessage('New note created.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!selectedNote) {
      setErrorMessage('Pick a note before saving.')
      return
    }

    if (!isOtpEnabled) {
      setErrorMessage('Enable OTP first before saving notes.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = await getSessionToken(getToken)
      const updated = await apiRequest<Note>(`/api/notes/${selectedNote.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      })

      setNotes((current) =>
        current
          .map((note) => (note.id === updated.id ? updated : note))
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      )
      setSuccessMessage('Saved successfully.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedNote) {
      return
    }

    const shouldDelete = window.confirm('Delete this note permanently?')

    if (!shouldDelete) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = await getSessionToken(getToken)
      await apiRequest<void>(`/api/notes/${selectedNote.id}`, token, {
        method: 'DELETE',
      })

      setNotes((current) => {
        const remaining = current.filter((note) => note.id !== selectedNote.id)
        setSelectedNoteId(remaining[0]?.id ?? null)
        return remaining
      })
      setSuccessMessage('Note deleted.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="kicker">BlogStreet Workspace</p>
          <h2>Draft like Notion. Publish like a newsroom.</h2>
        </div>
        <div className="header-actions">
          <Link to="/security" className="secondary-btn">
            Security
          </Link>
          <UserButton />
        </div>
      </header>

      {!isOtpEnabled && (
        <div className="otp-banner">
          OTP is required. Enable two-factor authentication in your{' '}
          <Link to="/security">security settings</Link> before creating or
          editing notes.
        </div>
      )}

      {errorMessage && <p className="message message-error">{errorMessage}</p>}
      {successMessage && <p className="message message-success">{successMessage}</p>}

      <div className="workspace-grid">
        <aside className="sidebar">
          <div className="sidebar-top">
            <button
              type="button"
              onClick={() => void handleCreateNote()}
              className="primary-btn"
              disabled={isSaving || !isOtpEnabled}
            >
              + New note
            </button>
          </div>

          <div className="note-list">
            {isLoading && <p className="subtle">Loading notes...</p>}
            {!isLoading && notes.length === 0 && (
              <p className="subtle">No notes yet. Start with your first story.</p>
            )}

            {notes.map((note, index) => (
              <button
                key={note.id}
                type="button"
                className={`note-item ${note.id === selectedNoteId ? 'active' : ''}`}
                onClick={() => setSelectedNoteId(note.id)}
                style={{ animationDelay: `${80 + index * 50}ms` }}
              >
                <span className="note-title">{note.title}</span>
                <span className="note-meta">
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(note.updatedAt))}
                </span>
                {note.isPublished && <span className="published-pill">Published</span>}
              </button>
            ))}
          </div>
        </aside>

        <main className="editor-pane">
          {selectedNote ? (
            <>
              <div className="editor-toolbar">
                <label className="switch-row" htmlFor="publish-toggle">
                  <input
                    id="publish-toggle"
                    type="checkbox"
                    checked={draft.isPublished}
                    disabled={!isOtpEnabled || isSaving}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        isPublished: event.target.checked,
                      }))
                    }
                  />
                  Mark as published
                </label>

                <div className="editor-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => void handleDelete()}
                    disabled={isSaving}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void handleSave()}
                    disabled={isSaving || !isOtpEnabled}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <input
                className="title-input"
                value={draft.title}
                disabled={!isOtpEnabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                maxLength={140}
              />

              <textarea
                className="content-input"
                value={draft.content}
                disabled={!isOtpEnabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, content: event.target.value }))
                }
                placeholder="Start writing your blog post..."
              />

              <div className="editor-footer">
                <span>{wordCount} words</span>
                <span>{Math.max(1, Math.ceil(wordCount / 220))} min read</span>
                <span>
                  Last saved:{' '}
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(selectedNote.updatedAt))}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>Pick or create a note to begin writing.</h3>
              <p>
                Your sidebar behaves like a Notion page list, and the editor lets
                you draft long-form content quickly.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

async function getSessionToken(
  getToken: () => Promise<string | null>,
): Promise<string> {
  const token = await getToken()

  if (!token) {
    throw new Error('No Clerk session token found. Sign in again.')
  }

  return token
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export default App
