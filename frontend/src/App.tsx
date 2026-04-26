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
  | { kind: 'image'; src: string; alt: string; caption: string }
  | { kind: 'text'; text: string }

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

  useEffect(() => { void refreshSession() }, [])

  const logout = async (): Promise<void> => {
    await apiRequest<void>('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  const authValue = useMemo<AuthContextValue>(
    () => ({ isLoaded, isSignedIn: Boolean(user), user, refreshSession, logout }),
    [isLoaded, user],
  )

  return (
    <AuthContext.Provider value={authValue}>
      <Routes>
        <Route path="/" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in" element={<LoginPage />} />
        <Route path="/sign-up" element={<RegisterPage />} />
        <Route path="/security" element={<RequireAuth><SecurityPage /></RequireAuth>} />
        <Route path="/app" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/design" element={<RequireAuth><WorkspacePage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </AuthContext.Provider>
  )
}

function useSessionAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthContext is missing.')
  return context
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useSessionAuth()
  if (!isLoaded) return <div className="loading-screen">Loading workspace…</div>
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return children
}

// ─────────────────────────────────────────
// Auth Pages (unchanged logic, same UI)
// ─────────────────────────────────────────

function LoginPage() {
  const { isSignedIn, refreshSession } = useSessionAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (isSignedIn) return <Navigate to="/app" replace />

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const u = username.trim().toLowerCase()
    const p = password.trim()
    if (!u || !p) { setErrorMessage('Username and password are required.'); return }
    setIsSubmitting(true); setErrorMessage(null)
    try {
      await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
      await refreshSession()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally { setIsSubmitting(false) }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <p className="auth-kicker">WebNote</p>
        <h1>Build notes, then publish your stories.</h1>
        <p>Sign in with your WebNote account to continue to your writing workspace.</p>
      </div>
      <form className="auth-card auth-local-form" onSubmit={(e) => void handleSubmit(e)}>
        <h2 className="auth-title">Sign in</h2>
        <p className="auth-subtitle">Use your username and password.</p>
        <label className="note-field">
          <span className="note-field-label">Username</span>
          <input className="title-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} />
        </label>
        <label className="note-field">
          <span className="note-field-label">Password</span>
          <input className="title-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={256} />
        </label>
        {errorMessage && <p className="message message-error">{errorMessage}</p>}
        <button type="submit" className="primary-btn auth-primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-switch">No account yet? <Link to="/sign-up" className="auth-link">Sign up</Link></p>
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

  if (isSignedIn) return <Navigate to="/app" replace />

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
    <div className="auth-shell">
      <div className="auth-intro">
        <p className="auth-kicker">WebNote</p>
        <h1>Create your account and start writing.</h1>
        <p>Register with a username and password to access your workspace.</p>
      </div>
      <form className="auth-card auth-local-form" onSubmit={(e) => void handleSubmit(e)}>
        <h2 className="auth-title">Create account</h2>
        <p className="auth-subtitle">Choose credentials for your new account.</p>
        <label className="note-field">
          <span className="note-field-label">Username</span>
          <input className="title-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} />
        </label>
        <label className="note-field">
          <span className="note-field-label">Password</span>
          <input className="title-input" type={isPasswordVisible ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={256} />
        </label>
        <label className="note-field">
          <span className="note-field-label">Confirm password</span>
          <input className="title-input" type={isPasswordVisible ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} maxLength={256} />
        </label>
        <label className="switch-row auth-show-password">
          <input type="checkbox" checked={isPasswordVisible} onChange={(e) => setIsPasswordVisible(e.target.checked)} />
          Show password
        </label>
        <p className="subtle auth-password-hint">At least 8 chars with uppercase, lowercase, number, and symbol.</p>
        {errorMessage && <p className="message message-error">{errorMessage}</p>}
        <button type="submit" className="primary-btn auth-primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="auth-switch">Already have an account? <Link to="/sign-in" className="auth-link">Sign in</Link></p>
      </form>
    </div>
  )
}

function AccountButton() {
  const { user, logout } = useSessionAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogout = async (): Promise<void> => {
    setIsSubmitting(true)
    try { await logout() } finally { setIsSubmitting(false) }
  }

  return (
    <button
      type="button"
      className="chip-btn"
      onClick={() => void handleLogout()}
      disabled={isSubmitting}
      title={user?.username ? `Signed in as ${user.username}` : 'Sign out'}
    >
      {isSubmitting ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

function SecurityPage() {
  const { user } = useSessionAuth()
  return (
    <div className="profile-shell">
      <div className="profile-header">
        <Link to="/app">← Back to dashboard</Link>
        <AccountButton />
      </div>
      <div className="auth-intro">
        <h2 className="auth-title">Account</h2>
        <p className="auth-subtitle">Signed in as {user?.username ?? 'Unknown user'}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// DASHBOARD PAGE (Redesigned)
// ─────────────────────────────────────────

function DashboardPage() {
  const { user } = useSessionAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noteTags] = useState<Record<string, string>>(() => loadNoteTags())
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPublishedToast, setShowPublishedToast] = useState(searchParams.get('published') === '1')

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    notes.forEach((note) => { const t = noteTags[note.id]; if (t) tags.add(t) })
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }, [noteTags, notes])

  const filteredNotes = useMemo(() => notes.filter((note) => {
    const inTab = activeTab === 'all' || noteTags[note.id] === activeTab
    const q = searchQuery.trim().toLowerCase()
    const inSearch = q.length === 0 || note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q)
    return inTab && inSearch
  }), [activeTab, noteTags, notes, searchQuery])

  const stats = useMemo(() => {
    const total = notes.length
    const archived = notes.filter((n) => n.isPublished).length
    const drafts = total - archived
    return { total, archived, drafts }
  }, [notes])

  useEffect(() => {
    if (activeTab !== 'all' && !availableTags.includes(activeTab)) setActiveTab('all')
  }, [activeTab, availableTags])

  useEffect(() => { void loadNotes() }, [])

  useEffect(() => {
    if (searchParams.get('published') !== '1') return
    const timer = window.setTimeout(() => {
      setShowPublishedToast(false)
      setSearchParams({}, { replace: true })
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [searchParams, setSearchParams])

  const loadNotes = async (): Promise<void> => {
    setErrorMessage(null)
    try {
      const fetched = await apiRequest<Note[]>('/api/notes')
      setNotes(fetched)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="dashboard-shell">
      {/* Topbar */}
      <header className="dashboard-appbar">
        <div className="dashboard-brand">
          <div className="dashboard-brand-logo">W</div>
          <div className="dashboard-brand-text">
            <h2>WebNote</h2>
            <p>{greeting()}, {user?.username ?? 'writer'}</p>
          </div>
        </div>
        <label className="dashboard-search">
          <svg className="dashboard-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
          />
        </label>
        <div className="dashboard-userbar">
  
          <AccountButton />
        </div>
      </header>

      {errorMessage && <p className="message message-error">{errorMessage}</p>}
      {showPublishedToast && <p className="message message-success publish-toast">Note archived. Your dashboard has been updated.</p>}

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon orange">📝</div>
          <div>
            <p className="stat-label">Total notes</p>
            <p className="stat-value">{stats.total}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold">✍️</div>
          <div>
            <p className="stat-label">Drafts</p>
            <p className="stat-value">{stats.drafts}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📦</div>
          <div>
            <p className="stat-label">Archived</p>
            <p className="stat-value">{stats.archived}</p>
          </div>
        </div>
      </div>

      {/* Board */}
      <section className="dashboard-board">
        <div className="dashboard-board-top">
          <div className="dashboard-tabs">
            <button type="button" className={`board-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
              All
            </button>
            {availableTags.map((tag) => (
              <button key={tag} type="button" className={`board-tab ${activeTab === tag ? 'active' : ''}`} onClick={() => setActiveTab(tag)}>
                {tag}
              </button>
            ))}
          </div>
          <div className="dashboard-board-actions">
            <span className="subtle">{isLoading ? 'Loading…' : `${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}`}</span>
            <Link to="/design" className="add-note-link">
              <span>+</span> Add new note
            </Link>
          </div>
        </div>

        <div className="dashboard-grid">
          {isLoading && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton-note-tile" style={{ animationDelay: `${i * 80}ms` }} />)}
          {!isLoading && filteredNotes.length === 0 && (
            <p className="subtle" style={{ gridColumn: '1/-1', padding: '2rem 0' }}>
              No notes found. Try another tab or create a new note.
            </p>
          )}
          {filteredNotes.map((note, i) => {
            const preview = getNotePreview(note.content)
            const tag = noteTags[note.id]
            return (
              <Link
                key={note.id}
                to={`/design?note=${note.id}`}
                className="dashboard-tile"
                style={{ animationDelay: `${i * 50}ms`, opacity: 0, animation: `liftIn 420ms ease ${i * 50}ms forwards` }}
              >
                <div className="dashboard-tile-image">
                  {preview.imageSrc
                    ? <img src={preview.imageSrc} alt={note.title} loading="lazy" />
                    : <div className="dashboard-note-placeholder">✦</div>
                  }
                </div>
                <div className="dashboard-tile-body">
                  <div className="dashboard-tile-header">
                    <p className="dashboard-tile-date">
                      {new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(note.updatedAt))}
                    </p>
                  </div>
                  <h3 className="dashboard-tile-title">{note.title}</h3>
                  <p className="dashboard-tile-text">{preview.textPreview}</p>
                  <div className="dashboard-tile-footer">
                    {tag ? <span className="dashboard-tile-tag">{tag}</span> : <span />}
                    {note.isPublished && <span className="published-pill">Archived</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────
// WORKSPACE PAGE (Redesigned)
// ─────────────────────────────────────────

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

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId) ?? null, [notes, selectedNoteId])
  const selectedNoteTag = selectedNoteId ? noteTags[selectedNoteId] ?? '' : ''

  const wordCount = useMemo(() => {
    const t = draft.content.trim()
    return t ? t.split(/\s+/).length : 0
  }, [draft.content])

  useEffect(() => {
    if (selectedNote) {
      if (pendingEmptyDraftNoteIdRef.current === selectedNote.id) {
        setDraft(EMPTY_DRAFT)
        pendingEmptyDraftNoteIdRef.current = null
        return
      }
      setDraft({ title: selectedNote.title, content: selectedNote.content, isPublished: selectedNote.isPublished })
      return
    }
    setDraft(EMPTY_DRAFT)
  }, [selectedNote])

  useEffect(() => { void loadNotes() }, [])

  const loadNotes = async (): Promise<void> => {
    setErrorMessage(null); setSuccessMessage(null)
    try {
      const fetched = await apiRequest<Note[]>('/api/notes')
      const requested = searchParams.get('note')
      setNotes(fetched)
      setSelectedNoteId((cur) => {
        if (requested && fetched.some((n) => n.id === requested)) return requested
        if (cur && fetched.some((n) => n.id === cur)) return cur
        return fetched[0]?.id ?? null
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNote = async (): Promise<void> => {
    setIsSaving(true); setErrorMessage(null); setSuccessMessage(null)
    try {
      const created = await apiRequest<Note>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled note', content: '', isPublished: false }),
      })
      setNotes((cur) => [created, ...cur])
      pendingEmptyDraftNoteIdRef.current = created.id
      setSelectedNoteId(created.id)
      setSuccessMessage('New note created.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally { setIsSaving(false) }
  }

  const handleSave = async (showMsg = true, payloadOverride?: NotePayload): Promise<boolean> => {
    if (!selectedNote) { setErrorMessage('Pick a note before saving.'); return false }
    setIsSaving(true); setErrorMessage(null); setSuccessMessage(null)
    try {
      const payload = payloadOverride ?? draft
      const updated = await apiRequest<Note>(`/api/notes/${selectedNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setNotes((cur) => cur.map((n) => n.id === updated.id ? updated : n).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
      if (showMsg) setSuccessMessage('Saved successfully.')
      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      return false
    } finally { setIsSaving(false) }
  }

  const handlePublish = async (): Promise<void> => {
    if (isPublishingTransition) return
    const p: NotePayload = { ...draft, isPublished: true }
    setDraft(p)
    const saved = await handleSave(false, p)
    if (!saved) return
    setSuccessMessage('Archiving note…')
    setIsPublishingTransition(true)
    window.setTimeout(() => navigate('/app?published=1'), 760)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedNote) return
    setIsSaving(true); setErrorMessage(null); setSuccessMessage(null)
    try {
      await apiRequest<void>(`/api/notes/${selectedNote.id}`, { method: 'DELETE' })
      setNotes((cur) => {
        const remaining = cur.filter((n) => n.id !== selectedNote.id)
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

  const handleImageFileSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setErrorMessage('Only JPG and PNG files are allowed.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) { setErrorMessage('Could not read the selected image.'); event.target.value = ''; return }
      setPendingImageDataUrl(dataUrl)
      setPendingImageName(file.name)
      setImageCaptionInput('')
      setIsCaptionModalOpen(true)
      setErrorMessage(null)
      event.target.value = ''
    }
    reader.onerror = () => { setErrorMessage('Could not read the selected image.'); event.target.value = '' }
    reader.readAsDataURL(file)
  }

  const handleConfirmImageSection = (): void => {
    if (!pendingImageDataUrl) { setIsCaptionModalOpen(false); return }
    const caption = imageCaptionInput.trim()
    const imageBlock = `![${caption || pendingImageName}](${pendingImageDataUrl})`
    setDraft((cur) => {
      const sep = cur.content.trim().length > 0 ? '\n\n' : ''
      return { ...cur, content: `${cur.content}${sep}${imageBlock}` }
    })
    setSuccessMessage('Image section added.')
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
    if (!selectedNoteId) return
    setNoteTags((cur) => {
      const next = { ...cur }
      if (!tag) delete next[selectedNoteId]
      else next[selectedNoteId] = tag
      saveNoteTags(next)
      return next
    })
  }

  const parsedSections = useMemo(() => parseBlogSections(draft.content), [draft.content])
  const notePreview = useMemo(() => getNotePreview(draft.content), [draft.content])

  return (
    <div className={`workspace-shell ${isPublishingTransition ? 'workspace-shell-leaving' : ''}`}>
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={handleImageFileSelected} hidden />

      {/* Caption Modal */}
      {isCaptionModalOpen && (
        <div className="modal-overlay">
          <div className="caption-modal" role="dialog" aria-modal="true" aria-labelledby="caption-modal-title">
            <h3 id="caption-modal-title">Add image caption</h3>
            <p>This caption will appear below the image in your note.</p>
            <input
              className="caption-input"
              value={imageCaptionInput}
              onChange={(e) => setImageCaptionInput(e.target.value)}
              placeholder={pendingImageName || 'Optional caption…'}
              maxLength={120}
              autoFocus
            />
            <div className="caption-actions">
              <button type="button" className="secondary-btn" onClick={handleCancelImageSection}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleConfirmImageSection}>Add image</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="caption-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <h3 id="delete-modal-title">Delete note?</h3>
            <p>This action cannot be undone. The note will be permanently removed.</p>
            <div className="caption-actions">
              <button type="button" className="secondary-btn" onClick={() => setIsDeleteModalOpen(false)} disabled={isSaving}>Cancel</button>
              <button type="button" className="primary-btn danger-btn" onClick={() => void handleDelete()} disabled={isSaving}>
                {isSaving ? 'Deleting…' : 'Delete note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <header className="workspace-topbar">
        <div className="workspace-brand">
          <div className="workspace-brand-logo">W</div>
          <div className="workspace-brand-info">
            <h2>WebNote Studio</h2>
            <p>Draft, edit, and organise your notes</p>
          </div>
        </div>
        <div className="workspace-top-actions">
          {errorMessage && <span className="message message-error" style={{ margin: 0, padding: '.3rem .7rem', fontSize: '.78rem' }}>{errorMessage}</span>}
          {successMessage && <span className="message message-success" style={{ margin: 0, padding: '.3rem .7rem', fontSize: '.78rem' }}>{successMessage}</span>}
          <Link to="/app" className="chip-btn" style={{ textDecoration: 'none' }}>← Dashboard</Link>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handlePublish()}
            disabled={isSaving || !selectedNote || isPublishingTransition}
          >
            {isPublishingTransition ? 'Redirecting…' : isSaving ? 'Saving…' : '📦 Archive note'}
          </button>
          <AccountButton />
        </div>
      </header>

      {/* Grid */}
      <div className="workspace-grid">
        {/* Sidebar */}
        <aside className="design-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-top">
              <span className="sidebar-title">Notes</span>
              <span className="sidebar-count">{notes.length}</span>
            </div>
            <button
              type="button"
              className="sidebar-new-btn"
              onClick={() => void handleCreateNote()}
              disabled={isSaving || isPublishingTransition}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
              New note
            </button>
          </div>

          <div className="sidebar-notes-section">
            <span className="sidebar-section-label">Your notes</span>
            {isLoading && [0, 1, 2].map((i) => <div key={i} className="skeleton-note-card" />)}
            {!isLoading && notes.length === 0 && (
              <p className="subtle" style={{ fontSize: '.82rem' }}>No notes yet. Start your first story.</p>
            )}
            {notes.map((note, i) => (
              <button
                key={note.id}
                type="button"
                className={`note-item ${note.id === selectedNoteId ? 'active' : ''}`}
                onClick={() => setSelectedNoteId(note.id)}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="note-title">{note.title}</span>
                <span className="note-meta">
                  {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(note.updatedAt))}
                </span>
                {note.isPublished && <span className="published-pill">Archived</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* Editor / Preview */}
        <main className="preview-pane">
          {/* Toolbar row */}
          <div className="preview-toolbar">
            <button
              type="button"
              className={`chip-btn ${isLivePreview ? 'chip-active' : ''}`}
              onClick={() => setIsLivePreview((c) => !c)}
            >
              {isLivePreview ? '✕ Exit preview' : '👁 Live preview'}
            </button>
            {selectedNote && (
              <div className="mini-nav">
                {notes.slice(0, 3).map((note) => (
                  <button
                    key={`mini-${note.id}`}
                    type="button"
                    onClick={() => setSelectedNoteId(note.id)}
                    className={note.id === selectedNoteId ? 'active' : ''}
                  >
                    {note.title.length > 22 ? note.title.slice(0, 22) + '…' : note.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedNote ? (
            <div className="preview-card">
              {/* Card Header */}
              <div className="editor-card-header">
                <div className="editor-card-title-group">
                  <h3>{isLivePreview ? 'Preview' : 'Edit note'}</h3>
                  <p>{isLivePreview ? 'Reading mode — how your note looks' : 'Fill in the fields to build your note'}</p>
                </div>
                {!isLivePreview && (
                  <div className="editor-card-actions">
                    <button type="button" className="secondary-btn" onClick={() => setIsDeleteModalOpen(true)} disabled={isSaving || isPublishingTransition}>
                      🗑 Delete
                    </button>
                    <button type="button" className="primary-btn" onClick={() => void handleSave()} disabled={isSaving || isPublishingTransition}>
                      {isSaving ? 'Saving…' : '✓ Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Archive toggle */}
              {!isLivePreview && (
                <div className="editor-toolbar">
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={draft.isPublished}
                      disabled={isSaving}
                      onChange={(e) => setDraft((c) => ({ ...c, isPublished: e.target.checked }))}
                    />
                    Mark as archived
                  </label>
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isSaving || isPublishingTransition}
                  >
                    🖼 Add image
                  </button>
                </div>
              )}

              {/* Editor Body */}
              {!isLivePreview ? (
                <div className="editor-card-body">
                  <div className="note-form-grid">
                    {/* Title */}
                    <label className="note-field">
                      <span className="note-field-label">Title</span>
                      <input
                        className="title-input"
                        value={draft.title}
                        onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))}
                        maxLength={140}
                        placeholder="Enter note title…"
                      />
                    </label>

                    {/* Tag */}
                    <label className="note-field">
                      <span className="note-field-label">Tag</span>
                      <select
                        className="note-tag-select"
                        value={selectedNoteTag}
                        onChange={(e) => handleNoteTagChange(e.target.value)}
                      >
                        <option value="">No tag</option>
                        {DASHBOARD_TAG_OPTIONS.map((tag) => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </select>
                    </label>

                    {/* Image */}
                    <div className="note-field">
                      <span className="note-field-label">Cover image</span>
                      <div className="note-image-preview">
                        {notePreview.imageSrc
                          ? <img src={notePreview.imageSrc} alt="Note preview" loading="lazy" />
                          : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem' }}>
                              <span style={{ fontSize: '1.5rem', opacity: .35 }}>🖼</span>
                              <button
                                type="button"
                                className="chip-btn"
                                style={{ fontSize: '.75rem' }}
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isSaving || isPublishingTransition}
                              >
                                Upload image
                              </button>
                            </div>
                          )
                        }
                      </div>
                    </div>

                    {/* Content */}
                    <label className="note-field note-field-full">
                      <span className="note-field-label">Content</span>
                      <textarea
                        className="content-input"
                        value={draft.content}
                        onChange={(e) => setDraft((c) => ({ ...c, content: e.target.value }))}
                        placeholder="Start writing your note… Use two blank lines to separate sections. To add an image inline, click 'Add image' above."
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="live-title">{draft.title || 'Untitled story'}</h2>
                  <article className="live-content">
                    {parsedSections.length > 0 ? parsedSections.map((section, i) => {
                      if (section.kind === 'image') {
                        return (
                          <figure key={`img-${i}`} className="content-image-section">
                            <img src={section.src} alt={section.alt} loading="lazy" />
                            {section.caption && <figcaption>{section.caption}</figcaption>}
                          </figure>
                        )
                      }
                      return <p key={`text-${i}`} className="content-text-section">{section.text}</p>
                    }) : (
                      <p className="content-text-section" style={{ opacity: .5 }}>Your story preview will appear here once you start writing.</p>
                    )}
                  </article>
                </>
              )}

              {/* Footer */}
              <div className="editor-footer">
                <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
                <span>{Math.max(1, Math.ceil(wordCount / 220))} min read</span>
                <span>
                  Last saved: {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(selectedNote.updatedAt))}
                </span>
                {selectedNoteTag && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedNoteTag}</span>}
              </div>
            </div>
          ) : (
            <div className="preview-card" style={{ padding: 0 }}>
              <div className="empty-state">
                <div className="empty-state-icon">✦</div>
                <h3>Pick or create a note to begin writing</h3>
                <p>Your notes appear in the sidebar on the left. Create a new one or select an existing note to start editing.</p>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ marginTop: '.5rem' }}
                  onClick={() => void handleCreateNote()}
                  disabled={isSaving}
                >
                  + Create first note
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

function parseBlogSections(content: string): BlogSection[] {
  return content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const m = block.match(/^!\[(.*)\]\((.+)\)$/i)
      if (m) {
        const [, altText, src] = m
        const s = src.trim()
        const valid = /^https?:\/\//i.test(s) || /^data:image\/(png|jpeg|jpg);base64,/i.test(s)
        if (!valid) return { kind: 'text', text: block }
        const caption = altText.trim()
        return { kind: 'image', src: s, alt: caption || 'Blog image', caption }
      }
      return { kind: 'text', text: block }
    })
}

function getNotePreview(content: string): NotePreview {
  const sections = parseBlogSections(content)
  const firstImage = sections.find((s) => s.kind === 'image')
  const firstText = sections.find((s) => s.kind === 'text')
  return {
    imageSrc: firstImage?.kind === 'image' ? firstImage.src : null,
    textPreview: firstText?.kind === 'text' && firstText.text.trim().length > 0
      ? firstText.text.slice(0, 160)
      : 'No content yet.',
  }
}

function loadNoteTags(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem('blogstreet-note-tags')
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch { return {} }
}

function saveNoteTags(tags: Record<string, string>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('blogstreet-note-tags', JSON.stringify(tags))
}

export default App