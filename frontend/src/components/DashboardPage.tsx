import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import type { Note } from '../types/note'

type DashboardUser = {
  id: string
  username: string
  avatarUrl?: string | null
} | null

type DashboardPageProps = {
  user: DashboardUser
  logout: () => Promise<void>
}

type NotePreview = {
  imageSrc: string | null
  textPreview: string
}

type BlogSection =
  | { kind: 'image'; src: string; alt: string; caption: string }
  | { kind: 'text'; text: string }

export default function DashboardPageComponent({ user, logout }: DashboardPageProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noteTags] = useState<Record<string, string>>(() => loadNoteTags())
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    notes.forEach((note) => {
      if (note.isPublished) return
      const t = noteTags[note.id]
      if (t) tags.add(t)
    })
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }, [noteTags, notes])

  const filteredNotes = useMemo(() => notes.filter((note) => {
    const inTab = activeTab === 'all'
      ? !note.isPublished
      : !note.isPublished && noteTags[note.id] === activeTab
    const q = searchQuery.trim().toLowerCase()
    const inSearch = q.length === 0 || note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q)
    return inTab && inSearch
  }), [activeTab, noteTags, notes, searchQuery])

  const stats = useMemo(() => {
    const total = notes.filter((n) => !n.isPublished).length
    const deleted = notes.filter((n) => n.isPublished).length
    return { total, deleted }
  }, [notes])

  useEffect(() => {
    if (activeTab !== 'all' && !availableTags.includes(activeTab)) setActiveTab('all')
  }, [activeTab, availableTags])

  useEffect(() => { void loadNotes() }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent): void => {
      if (!profileMenuRef.current) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (!profileMenuRef.current.contains(target)) setIsProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

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

  const userInitial = (user?.username?.trim()[0] ?? 'W').toUpperCase()

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true)
    try {
      await logout()
      setIsProfileMenuOpen(false)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#f7f8fa] p-3 text-slate-800 sm:p-4"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)',
        backgroundSize: '14px 14px',
      }}
    >
      <div className={`page-enter mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-white/80 bg-white/65 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl ${isSidebarCollapsed ? 'lg:grid-cols-[86px_1fr]' : 'lg:grid-cols-[240px_1fr]'}`}>
        <aside className="panel-enter enter-delay-1 border-b border-slate-200/70 bg-white/70 px-4 pb-4 pt-6 transition-[width] duration-200 lg:border-b-0 lg:border-r lg:pt-7">
          <div className={`flex items-center rounded-xl px-2 py-1 ${isSidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white p-[2px] shadow-sm">
              <img src="/brand-logo.png" alt="WebNote logo" className="h-full w-full rounded-[6px] object-cover" />
            </div>
            {!isSidebarCollapsed && <span className="text-xl font-semibold tracking-tight">WebNote</span>}
          </div>

          {!isSidebarCollapsed && <p className="mt-8 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">General</p>}
          <nav className="mt-3 space-y-1.5">
            <Link to="/dashboard" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M2.5 7.2L8 2.8l5.5 4.4v5.3a1 1 0 0 1-1 1h-3.3V9.3H6.8v4.2H3.5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                </svg>
              </span>
              {!isSidebarCollapsed && 'Home'}
            </Link>
            <Link to="/create-note" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M2.8 5.3h10.4l-.8 8.2H3.6z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                  <path d="M6 5.3v-1a2 2 0 1 1 4 0v1" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                </svg>
              </span>
              {!isSidebarCollapsed && 'Notes'}
            </Link>
            <Link to="/deleted-notes" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-rose-50 text-rose-600">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M3.5 4.5h9M6 4.5v-1h4v1M5.2 6.2l.5 6h4.6l.5-6" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {!isSidebarCollapsed && 'Deleted Notes'}
            </Link>
          </nav>
        </aside>

        <main className="panel-enter enter-delay-2 px-4 pb-4 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                  <path d="M3 4.5h10M3 8h10M3 11.5h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-600">
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                  <rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.35" />
                  <path d="M5 2.5v2M11 2.5v2M2.5 6.2h11" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                </svg>
              </span>
              <span>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-500">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-slate-500" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.35" />
                  <path d="M10.5 10.5L13.2 13.2" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="ml-2 w-28 bg-transparent text-slate-700 outline-none placeholder:text-slate-400 sm:w-40"
                />
              </label>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white pl-2 pr-2 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  title={user?.username ? `Signed in as ${user.username}` : 'Profile menu'}
                >
                  <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                      : userInitial}
                  </span>
                  <span className="max-w-[120px] truncate text-sm font-semibold text-slate-700">
                    {user?.username ?? 'Profile'}
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path d="M3.5 6l4.5 4 4.5-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isProfileMenuOpen && (
                  <div className="profile-menu-pop absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.14)]">
                    <Link to="/profile" className="block px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={() => setIsProfileMenuOpen(false)}>
                      Profile
                    </Link>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? 'Logging out…' : 'Logout'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <h1 className="panel-enter enter-delay-3 mt-9 text-4xl font-medium tracking-tight text-slate-400 sm:mt-10 sm:text-5xl">
            {greeting()}, <span className="font-semibold text-slate-900">{user?.username ?? 'Writer'}</span>
          </h1>
          {errorMessage && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}

          <section className="panel-enter enter-delay-4 mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:mt-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-3xl font-semibold tracking-tight">Your Notes</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setActiveTab('all')} className={`rounded-full px-3 py-1.5 text-sm font-medium ${activeTab === 'all' ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-100'}`}>All</button>
                {availableTags.slice(0, 3).map((tag) => (
                  <button key={tag} type="button" onClick={() => setActiveTab(tag)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${activeTab === tag ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {tag}
                  </button>
                ))}
                <Link to="/create-note" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold transition hover:bg-slate-50">+ Add note</Link>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pinned Preview</p>
                {isLoading && <p className="mt-3 text-sm text-slate-400">Loading note preview…</p>}
                {!isLoading && filteredNotes[0] && (() => {
                  const note = filteredNotes[0]
                  const preview = getNotePreview(note.content)
                  const tag = noteTags[note.id]
                  return (
                    <Link to={`/create-note?note=${note.id}`} className="mt-3 block rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                      {preview.imageSrc && <img src={preview.imageSrc} alt={note.title} className="mb-3 h-40 w-full rounded-xl object-cover" loading="lazy" />}
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(note.updatedAt))}
                      </p>
                      <h4 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight text-slate-900">{note.title}</h4>
                      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600">{preview.textPreview}</p>
                      <div className="mt-3 flex items-center justify-between">
                        {tag ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{tag}</span> : <span />}
                        {note.isPublished && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Deleted</span>}
                      </div>
                    </Link>
                  )
                })()}
                {!isLoading && !filteredNotes[0] && <p className="mt-3 text-sm text-slate-400">No notes available yet.</p>}
              </article>

              <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recent Notes</p>
                <div className="mt-3 space-y-2.5">
                  {isLoading && <p className="text-sm text-slate-400">Loading notes…</p>}
                  {!isLoading && filteredNotes.slice(1, 7).map((note) => {
                    const preview = getNotePreview(note.content)
                    const percent = 35 + (note.title.length % 55)
                    return (
                      <Link key={note.id} to={`/create-note?note=${note.id}`} className="grid grid-cols-[1fr_110px_58px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm transition hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{note.title}</p>
                          <p className="truncate text-xs text-slate-500">{preview.textPreview}</p>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-sky-400" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="text-right text-xs font-semibold text-slate-500">{percent}%</div>
                      </Link>
                    )
                  })}
                  {!isLoading && filteredNotes.length <= 1 && (
                    <p className="py-8 text-center text-sm text-slate-400">Create more notes to populate this panel.</p>
                  )}
                </div>
              </article>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Notes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Deleted Notes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.deleted}</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

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
