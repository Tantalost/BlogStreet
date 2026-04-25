import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, apiRequest } from './lib/api'
import type { Note, NotePayload } from './types/note'
import './App.css'

type AuthUser = {
  id: string
  username: string
}

type AuthContextValue = {
  isLoaded: boolean
  isSignedIn: boolean
  user: AuthUser | null
  refreshSession: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const EMPTY_DRAFT: NotePayload = {
  title: 'Untitled story',
  content: '',
  isPublished: false,
}

type BlogSection =
  | {
      kind: 'image'
      src: string
      alt: string
      caption: string
    }
  | {
      kind: 'text'
      text: string
    }

type NotePreview = {
  imageSrc: string | null
  textPreview: string
}

const DASHBOARD_TAG_OPTIONS = ['Education', 'Lifestyle', 'Business', 'Personal', 'Travel']

function App() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  const refreshSession = async (): Promise<void> => {
    try {
      const payload = await apiRequest<{ user: AuthUser }>('/api/auth/me')
      setUser(payload.user)
    } catch {
      setUser(null)
    } finally {
      setIsLoaded(true)
    }
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  const logout = async (): Promise<void> => {
    await apiRequest<void>('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  const authValue = useMemo<AuthContextValue>(
    () => ({
      isLoaded,
      isSignedIn: Boolean(user),
      user,
      refreshSession,
      logout,
    }),
    [isLoaded, user],
  )

  return (
    <AuthContext.Provider value={authValue}>
      <Routes>
        <Route path="/" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in" element={<LoginPage />} />
        <Route path="/sign-up" element={<RegisterPage />} />
        <Route
          path="/security"
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
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/design"
          element={
            <RequireAuth>
              <WorkspacePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </AuthContext.Provider>
  )
}

function useSessionAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('AuthContext is missing.')
  }

  return context
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useSessionAuth()

  if (!isLoaded) {
    return <div className="loading-screen">Loading your workspace...</div>
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return children
}

function LoginPage() {
  const { isSignedIn, refreshSession } = useSessionAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedPassword = password.trim()

    if (!normalizedUsername || !normalizedPassword) {
      setErrorMessage('Username and password are required.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
        }),
      })
      await refreshSession()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <p className="auth-kicker">BlogStreet</p>
        <h1>Build notes, then publish your stories.</h1>
        <p>
          Sign in with your BlogStreet account to continue to your writing workspace.
        </p>
      </div>
      <form className="auth-card auth-local-form" onSubmit={(event) => void handleSubmit(event)}>
        <h2 className="auth-title">Sign in</h2>
        <p className="auth-subtitle">Use your username and password.</p>
        <label className="note-field">
          <span className="section-label">Username</span>
          <input
            className="title-input"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={64}
          />
        </label>
        <label className="note-field">
          <span className="section-label">Password</span>
          <input
            className="title-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={256}
          />
        </label>
        {errorMessage && <p className="message message-error">{errorMessage}</p>}
        <button type="submit" className="primary-btn auth-primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="auth-switch">
          No account yet?{' '}
          <Link to="/sign-up" className="auth-link">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}

function RegisterPage() {
  const { isSignedIn, refreshSession } = useSessionAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedPassword = password.trim()

    if (!normalizedUsername || !normalizedPassword) {
      setErrorMessage('Username and password are required.')
      return
    }

    if (normalizedPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }

    if (!/[A-Z]/.test(normalizedPassword)) {
      setErrorMessage('Password must include at least one uppercase letter.')
      return
    }

    if (!/[a-z]/.test(normalizedPassword)) {
      setErrorMessage('Password must include at least one lowercase letter.')
      return
    }

    if (!/[0-9]/.test(normalizedPassword)) {
      setErrorMessage('Password must include at least one number.')
      return
    }

    if (!/[^A-Za-z0-9]/.test(normalizedPassword)) {
      setErrorMessage('Password must include at least one symbol.')
      return
    }

    if (normalizedPassword !== confirmPassword.trim()) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
        }),
      })
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
        }),
      })
      await refreshSession()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <p className="auth-kicker">BlogStreet</p>
        <h1>Create your account and start writing.</h1>
        <p>Register with a username and password to access your workspace.</p>
      </div>
      <form className="auth-card auth-local-form" onSubmit={(event) => void handleSubmit(event)}>
        <h2 className="auth-title">Create account</h2>
        <p className="auth-subtitle">Choose credentials for your new account.</p>
        <label className="note-field">
          <span className="section-label">Username</span>
          <input
            className="title-input"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={64}
          />
        </label>
        <label className="note-field">
          <span className="section-label">Password</span>
          <input
            className="title-input"
            type={isPasswordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={256}
          />
        </label>
        <label className="note-field">
          <span className="section-label">Confirm password</span>
          <input
            className="title-input"
            type={isPasswordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            maxLength={256}
          />
        </label>
        <label className="switch-row auth-show-password">
          <input
            type="checkbox"
            checked={isPasswordVisible}
            onChange={(event) => setIsPasswordVisible(event.target.checked)}
          />
          Show password
        </label>
        <p className="subtle auth-password-hint">
          Use at least 8 characters with uppercase, lowercase, number, and symbol.
        </p>
        {errorMessage && <p className="message message-error">{errorMessage}</p>}
        <button type="submit" className="primary-btn auth-primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Sign up'}
        </button>
        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/sign-in" className="auth-link">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}

function AccountButton() {
  const { user, logout } = useSessionAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogout = async (): Promise<void> => {
    setIsSubmitting(true)
    try {
      await logout()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      className="chip-btn"
      onClick={() => void handleLogout()}
      disabled={isSubmitting}
      title={user?.username ? `Signed in as ${user.username}` : 'Sign out'}
    >
      {isSubmitting ? 'Signing out...' : 'Sign out'}
    </button>
  )
}

function SecurityPage() {
  const { user } = useSessionAuth()

  return (
    <div className="profile-shell">
      <div className="profile-header">
        <Link to="/app">Back to dashboard</Link>
        <AccountButton />
      </div>
      <div className="auth-intro">
        <h2 className="auth-title">Account</h2>
        <p className="auth-subtitle">Signed in as {user?.username ?? 'Unknown user'}</p>
      </div>
    </div>
  )
}

function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noteTags] = useState<Record<string, string>>(() => loadNoteTags())
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPublishedToast, setShowPublishedToast] = useState(
    searchParams.get('published') === '1',
  )

  const availableTags = useMemo(() => {
    const tags = new Set<string>()

    notes.forEach((note) => {
      const noteTag = noteTags[note.id]
      if (noteTag) {
        tags.add(noteTag)
      }
    })

    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }, [noteTags, notes])

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const inTab =
        activeTab === 'all' || noteTags[note.id] === activeTab
      const query = searchQuery.trim().toLowerCase()
      const inSearch =
        query.length === 0 ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)

      return inTab && inSearch
    })
  }, [activeTab, noteTags, notes, searchQuery])

  useEffect(() => {
    if (activeTab === 'all') {
      return
    }

    if (!availableTags.includes(activeTab)) {
      setActiveTab('all')
    }
  }, [activeTab, availableTags])

  useEffect(() => {
    void loadNotes()
  }, [])

  useEffect(() => {
    if (searchParams.get('published') !== '1') {
      return
    }

    const timer = window.setTimeout(() => {
      setShowPublishedToast(false)
      setSearchParams({}, { replace: true })
    }, 2200)

    return () => window.clearTimeout(timer)
  }, [searchParams, setSearchParams])

  const loadNotes = async (): Promise<void> => {
    setErrorMessage(null)

    try {
      const fetchedNotes = await apiRequest<Note[]>('/api/notes')
      setNotes(fetchedNotes)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-appbar">
        <label className="dashboard-search">
          <span aria-hidden>🔎</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search notes"
          />
        </label>
        <div className="dashboard-userbar">
          <AccountButton />
        </div>
      </header>

      {errorMessage && <p className="message message-error">{errorMessage}</p>}
      {showPublishedToast && (
        <p className="message message-success publish-toast">
          Note archived. Your dashboard has been updated.
        </p>
      )}

      <section className="dashboard-board">
        <div className="dashboard-board-top">
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`board-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`board-tab ${activeTab === tag ? 'active' : ''}`}
                onClick={() => setActiveTab(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="dashboard-board-actions">
            <span className="subtle">
              {isLoading ? 'Loading...' : `${filteredNotes.length} notes`}
            </span>
            <Link to="/design" className="add-note-link">
              ＋ Add new note
            </Link>
          </div>
        </div>

        <div className="dashboard-grid">
          {isLoading && (
            <>
              <div className="skeleton-note-tile" />
              <div className="skeleton-note-tile" />
              <div className="skeleton-note-tile" />
              <div className="skeleton-note-tile" />
            </>
          )}
          {!isLoading && filteredNotes.length === 0 && (
            <p className="subtle">
              No notes found. Try another tab or create a new note.
            </p>
          )}
          {filteredNotes.map((note) => {
            const preview = getNotePreview(note.content)

            return (
              <Link key={note.id} to={`/design?note=${note.id}`} className="dashboard-tile">
                <p className="dashboard-tile-date">
                  {new Intl.DateTimeFormat('en', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(note.updatedAt))}
                </p>
                <h3 className="dashboard-tile-title">{note.title}</h3>
                <p className="dashboard-tile-text">{preview.textPreview}</p>
                <div className="dashboard-tile-image">
                  {preview.imageSrc ? (
                    <img src={preview.imageSrc} alt={note.title} loading="lazy" />
                  ) : (
                    <div className="dashboard-note-placeholder" aria-hidden>
                      No image
                    </div>
                  )}
                </div>
                {note.isPublished && <span className="published-pill">Archived</span>}
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function WorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NotePayload>(EMPTY_DRAFT)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishingTransition, setIsPublishingTransition] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLivePreview, setIsLivePreview] = useState(false)
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [noteTags, setNoteTags] = useState<Record<string, string>>(() => loadNoteTags())
  const [imageCaptionInput, setImageCaptionInput] = useState('')
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null)
  const [pendingImageName, setPendingImageName] = useState('')
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const pendingEmptyDraftNoteIdRef = useRef<string | null>(null)

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )
  const selectedNoteTag = selectedNoteId ? noteTags[selectedNoteId] ?? '' : ''

  const wordCount = useMemo(() => {
    const trimmed = draft.content.trim()

    if (!trimmed) {
      return 0
    }

    return trimmed.split(/\s+/).length
  }, [draft.content])

  useEffect(() => {
    if (selectedNote) {
      if (pendingEmptyDraftNoteIdRef.current === selectedNote.id) {
        setDraft(EMPTY_DRAFT)
        pendingEmptyDraftNoteIdRef.current = null
        return
      }

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
      const fetchedNotes = await apiRequest<Note[]>('/api/notes')
      const requestedNoteId = searchParams.get('note')
      setNotes(fetchedNotes)
      setSelectedNoteId((current) => {
        if (
          requestedNoteId &&
          fetchedNotes.some((note) => note.id === requestedNoteId)
        ) {
          return requestedNoteId
        }

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
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const created = await apiRequest<Note>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Untitled note',
          content: '',
          isPublished: false,
        }),
      })

      setNotes((current) => [created, ...current])
      pendingEmptyDraftNoteIdRef.current = created.id
      setSelectedNoteId(created.id)
      setSuccessMessage('New note created.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async (
    showDefaultMessage = true,
    payloadOverride?: NotePayload,
  ): Promise<boolean> => {
    if (!selectedNote) {
      setErrorMessage('Pick a note before saving.')
      return false
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const payload = payloadOverride ?? draft
      const updated = await apiRequest<Note>(`/api/notes/${selectedNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      setNotes((current) =>
        current
          .map((note) => (note.id === updated.id ? updated : note))
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      )
      if (showDefaultMessage) {
        setSuccessMessage('Saved successfully.')
      }
      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async (): Promise<void> => {
    if (isPublishingTransition) {
      return
    }

    const publishPayload: NotePayload = {
      ...draft,
      isPublished: true,
    }
    setDraft(publishPayload)
    const saved = await handleSave(false, publishPayload)
    if (!saved) {
      return
    }

    setSuccessMessage('Archiving note...')
    setIsPublishingTransition(true)

    window.setTimeout(() => {
      navigate('/app?published=1')
    }, 760)
  }

  const handleRequestDelete = (): void => {
    if (!selectedNote) {
      return
    }

    setIsDeleteModalOpen(true)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedNote) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await apiRequest<void>(`/api/notes/${selectedNote.id}`, {
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
      setIsDeleteModalOpen(false)
    }
  }

  const handleAddImageSection = (): void => {
    imageInputRef.current?.click()
  }

  const handleImageFileSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    const isAllowedType =
      selectedFile.type === 'image/jpeg' || selectedFile.type === 'image/png'

    if (!isAllowedType) {
      setErrorMessage('Only JPG and PNG files are allowed.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''

      if (!dataUrl) {
        setErrorMessage('Could not read the selected image.')
        event.target.value = ''
        return
      }
      setPendingImageDataUrl(dataUrl)
      setPendingImageName(selectedFile.name)
      setImageCaptionInput('')
      setIsCaptionModalOpen(true)
      setErrorMessage(null)
      event.target.value = ''
    }

    reader.onerror = () => {
      setErrorMessage('Could not read the selected image.')
      event.target.value = ''
    }

    reader.readAsDataURL(selectedFile)
  }

  const handleConfirmImageSection = (): void => {
    if (!pendingImageDataUrl) {
      setIsCaptionModalOpen(false)
      return
    }

    const caption = imageCaptionInput.trim()
    const imageBlock = `![${caption || pendingImageName}](${pendingImageDataUrl})`

    setDraft((current) => {
      const sectionSeparator = current.content.trim().length > 0 ? '\n\n' : ''
      return {
        ...current,
        content: `${current.content}${sectionSeparator}${imageBlock}`,
      }
    })

    setSuccessMessage('Image section added to your draft.')
    setIsCaptionModalOpen(false)
    setPendingImageDataUrl(null)
    setPendingImageName('')
    setImageCaptionInput('')
  }

  const handleCancelImageSection = (): void => {
    setIsCaptionModalOpen(false)
    setPendingImageDataUrl(null)
    setPendingImageName('')
    setImageCaptionInput('')
  }

  const handleNoteTagChange = (tag: string): void => {
    if (!selectedNoteId) {
      return
    }

    setNoteTags((current) => {
      const next = { ...current }

      if (!tag) {
        delete next[selectedNoteId]
      } else {
        next[selectedNoteId] = tag
      }

      saveNoteTags(next)
      return next
    })
  }

  const parsedSections = useMemo(() => parseBlogSections(draft.content), [draft.content])
  const notePreview = useMemo(() => getNotePreview(draft.content), [draft.content])

  return (
    <div
      className={`workspace-shell ${isPublishingTransition ? 'workspace-shell-leaving' : ''}`}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={handleImageFileSelected}
        hidden
      />
      {isCaptionModalOpen && (
        <div className="modal-overlay" role="presentation">
          <div
            className="caption-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="caption-modal-title"
          >
            <h3 id="caption-modal-title">Add image caption</h3>
            <p className="subtle">This caption will appear under the image in your blog post.</p>
            <input
              className="caption-input"
              value={imageCaptionInput}
              onChange={(event) => setImageCaptionInput(event.target.value)}
              placeholder={pendingImageName || 'Optional caption'}
              maxLength={120}
              autoFocus
            />
            <div className="caption-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={handleCancelImageSection}
              >
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={handleConfirmImageSection}>
                Add section
              </button>
            </div>
          </div>
        </div>
      )}
      {isDeleteModalOpen && (
        <div className="modal-overlay" role="presentation">
          <div
            className="caption-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <h3 id="delete-modal-title">Delete note?</h3>
            <p className="subtle">
              This action cannot be undone. The selected note will be permanently removed.
            </p>
            <div className="caption-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn danger-btn"
                onClick={() => void handleDelete()}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Delete note'}
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="workspace-topbar">
        <div className="workspace-brand">
          <p className="kicker">BlogStreet Studio</p>
          <h2>Create notes with title, tag, image, and content.</h2>
        </div>
        <div className="workspace-top-actions">
          <Link to="/app" className="chip-btn">
            Dashboard
          </Link>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handlePublish()}
            disabled={isSaving || !selectedNote || isPublishingTransition}
          >
            {isPublishingTransition ? 'Redirecting...' : isSaving ? 'Archiving...' : 'Archive'}
          </button>
          <AccountButton />
        </div>
      </header>

      {errorMessage && <p className="message message-error">{errorMessage}</p>}
      {successMessage && <p className="message message-success">{successMessage}</p>}

      <div className="workspace-grid">
        <aside className="design-sidebar">
          <div className="note-sidebar-header">
            <p className="panel-title">Notes</p>
            <p className="subtle">Create and manage your note entries.</p>
          </div>

          <div className="sidebar-top">
            <button
              type="button"
              onClick={() => void handleCreateNote()}
              className="primary-btn"
              disabled={isSaving || isPublishingTransition}
            >
              + New Note
            </button>
          </div>

          <div className="note-list">
            <p className="section-label">Your notes</p>
            {isLoading && (
              <>
                <div className="skeleton-note-card" />
                <div className="skeleton-note-card" />
                <div className="skeleton-note-card" />
              </>
            )}
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
                {note.isPublished && <span className="published-pill">Archived</span>}
              </button>
            ))}
          </div>
        </aside>

        <main className="preview-pane">
          <div className="preview-toolbar">
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setSelectedNoteId(notes[0]?.id ?? null)
                setSuccessMessage('Returned to homepage view.')
              }}
            >
              Home
            </button>
            <button
              type="button"
              className={`chip-btn ${isLivePreview ? 'chip-active' : ''}`}
              onClick={() => setIsLivePreview((current) => !current)}
            >
              {isLivePreview ? 'Exit Live' : 'View Live'}
            </button>
          </div>

          {selectedNote ? (
            <div className="preview-card note-editor-card">
              <div className="preview-header">
                <div>
                  <h3>Note Editor</h3>
                  <p>Fill in each field to build your note.</p>
                </div>
                <div className="mini-nav">
                  {notes.slice(0, 3).map((note) => (
                    <button
                      key={`mini-${note.id}`}
                      type="button"
                      onClick={() => setSelectedNoteId(note.id)}
                      className={note.id === selectedNoteId ? 'active' : ''}
                    >
                      {note.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hero-banner note-hero">
                <div className="hero-icon" aria-hidden>
                  📝
                </div>
                <div>
                  <h4>{draft.title || 'Untitled note'}</h4>
                  <p>
                    {selectedNoteTag
                      ? `Tagged as ${selectedNoteTag}`
                      : 'Pick a tag to organize this note on dashboard.'}
                  </p>
                </div>
              </div>

              {!isLivePreview && <div className="editor-toolbar">
                <label className="switch-row" htmlFor="archive-toggle">
                  <input
                    id="archive-toggle"
                    type="checkbox"
                    checked={draft.isPublished}
                    disabled={isSaving}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        isPublished: event.target.checked,
                      }))
                    }
                  />
                  Mark as archived
                </label>

                <div className="editor-actions">
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={handleAddImageSection}
                    disabled={isSaving || isPublishingTransition}
                  >
                    Add Image
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleRequestDelete}
                    disabled={isSaving || isPublishingTransition}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void handleSave()}
                    disabled={isSaving || isPublishingTransition}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>}

              {!isLivePreview ? (
                <div className="note-form-grid">
                  <label className="note-field">
                    <span className="section-label">Title</span>
                    <input
                      className="title-input"
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, title: event.target.value }))
                      }
                      maxLength={140}
                      placeholder="Enter note title"
                    />
                  </label>

                  <label className="note-field">
                    <span className="section-label">Tag</span>
                    <select
                      className="note-tag-select"
                      value={selectedNoteTag}
                      onChange={(event) => handleNoteTagChange(event.target.value)}
                    >
                      <option value="">No tag</option>
                      {DASHBOARD_TAG_OPTIONS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="note-field">
                    <span className="section-label">Image</span>
                    <div className="note-image-field">
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={handleAddImageSection}
                        disabled={isSaving || isPublishingTransition}
                      >
                        Add Image
                      </button>
                      <div className="note-image-preview">
                        {notePreview.imageSrc ? (
                          <img src={notePreview.imageSrc} alt="Note preview" loading="lazy" />
                        ) : (
                          <span className="subtle">No image yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <label className="note-field note-field-full">
                    <span className="section-label">Contents</span>
                    <textarea
                      className="content-input"
                      value={draft.content}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, content: event.target.value }))
                      }
                      placeholder="Start writing your note..."
                    />
                  </label>
                </div>
              ) : (
                <h2 className="live-title">{draft.title || 'Untitled story'}</h2>
              )}
              {isLivePreview && (
                <article className="live-content">
                  {parsedSections.length > 0 ? (
                    parsedSections.map((section, index) => {
                      if (section.kind === 'image') {
                        return (
                          <figure key={`img-${index}`} className="content-image-section">
                            <img src={section.src} alt={section.alt} loading="lazy" />
                            {section.caption && <figcaption>{section.caption}</figcaption>}
                          </figure>
                        )
                      }

                      return (
                        <p key={`text-${index}`} className="content-text-section">
                          {section.text}
                        </p>
                      )
                    })
                  ) : (
                    <p className="content-text-section">
                      Your story preview will appear here once you start writing.
                    </p>
                  )}
                </article>
              )}

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
            </div>
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

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

function parseBlogSections(content: string): BlogSection[] {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const imageMatch = block.match(/^!\[(.*)\]\((.+)\)$/i)

    if (imageMatch) {
      const [, altText, src] = imageMatch
      const trimmedSrc = src.trim()
      const isValidImageSrc =
        /^https?:\/\//i.test(trimmedSrc) || /^data:image\/(png|jpeg|jpg);base64,/i.test(trimmedSrc)

      if (!isValidImageSrc) {
        return {
          kind: 'text',
          text: block,
        }
      }

      const caption = altText.trim()

      return {
        kind: 'image',
        src: trimmedSrc,
        alt: caption || 'Blog image',
        caption,
      }
    }

    return {
      kind: 'text',
      text: block,
    }
  })
}

function getNotePreview(content: string): NotePreview {
  const sections = parseBlogSections(content)
  const firstImage = sections.find((section) => section.kind === 'image')
  const firstText = sections.find((section) => section.kind === 'text')

  return {
    imageSrc: firstImage?.kind === 'image' ? firstImage.src : null,
    textPreview:
      firstText?.kind === 'text' && firstText.text.trim().length > 0
        ? firstText.text.slice(0, 160)
        : 'No content yet.',
  }
}

function loadNoteTags(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem('blogstreet-note-tags')
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveNoteTags(tags: Record<string, string>): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem('blogstreet-note-tags', JSON.stringify(tags))
}

export default App
