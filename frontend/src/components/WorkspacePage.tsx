import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import type { Note, NotePayload } from '../types/note'

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

type CoverImageState = {
  src: string
  alt: string
}

const DASHBOARD_TAG_OPTIONS = ['Education', 'Lifestyle', 'Business', 'Personal', 'Travel']

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NotePayload>(EMPTY_DRAFT)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishingTransition] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLivePreview, setIsLivePreview] = useState(false)
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(null)
  const [noteTags, setNoteTags] = useState<Record<string, string>>(() => loadNoteTags())
  const [imageCaptionInput, setImageCaptionInput] = useState('')
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null)
  const [pendingImageName, setPendingImageName] = useState('')
  const [coverImage, setCoverImage] = useState<CoverImageState | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const pendingEmptyDraftNoteIdRef = useRef<string | null>(null)

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId) ?? null, [notes, selectedNoteId])
  const selectedNoteTag = selectedNoteId ? noteTags[selectedNoteId] ?? '' : ''
  const wordCount = useMemo(() => {
    const t = draft.content.trim()
    return t ? t.split(/\s+/).length : 0
  }, [draft.content])
  const composedContent = useMemo(() => composeContentForStorage(draft.content, coverImage), [draft.content, coverImage])
  const parsedSections = useMemo(() => parseBlogSections(composedContent), [composedContent])
  const notePreview = useMemo(() => getNotePreview(composedContent), [composedContent])

  useEffect(() => {
    if (selectedNote) {
      if (pendingEmptyDraftNoteIdRef.current === selectedNote.id) {
        setDraft(EMPTY_DRAFT)
        setCoverImage(null)
        pendingEmptyDraftNoteIdRef.current = null
        return
      }
      const { textContent, image } = splitContentForEditor(selectedNote.content)
      setDraft({ title: selectedNote.title, content: textContent, isPublished: selectedNote.isPublished })
      setCoverImage(image)
      return
    }
    setDraft(EMPTY_DRAFT)
    setCoverImage(null)
  }, [selectedNote])

  useEffect(() => { void loadNotes() }, [])

  const loadNotes = async (): Promise<void> => {
    setErrorMessage(null); setSuccessMessage(null)
    try {
      const fetched = await apiRequest<Note[]>('/api/notes')
      const requested = searchParams.get('note')
      const activeNotes = fetched.filter((note) => !note.isPublished)
      setNotes(activeNotes)
      setSelectedNoteId((cur) => {
        if (requested && activeNotes.some((n) => n.id === requested)) return requested
        if (cur && activeNotes.some((n) => n.id === cur)) return cur
        return activeNotes[0]?.id ?? null
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
      setSuccessModalMessage('New note created successfully.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally { setIsSaving(false) }
  }

  const handleSave = async (showMsg = true, payloadOverride?: NotePayload): Promise<boolean> => {
    if (!selectedNote) { setErrorMessage('Pick a note before saving.'); return false }
    setIsSaving(true); setErrorMessage(null); setSuccessMessage(null)
    try {
      const payloadBase = payloadOverride ?? draft
      const payload: NotePayload = {
        ...payloadBase,
        content: composeContentForStorage(payloadBase.content, coverImage),
      }
      const updated = await apiRequest<Note>(`/api/notes/${selectedNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setNotes((cur) => cur.map((n) => n.id === updated.id ? updated : n).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
      if (showMsg) {
        setSuccessMessage('Saved successfully.')
        setSuccessModalMessage('Note saved successfully.')
      }
      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      return false
    } finally { setIsSaving(false) }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedNote) return
    setIsSaving(true); setErrorMessage(null); setSuccessMessage(null)
    try {
      const deletePayload: NotePayload = {
        title: draft.title,
        content: composeContentForStorage(draft.content, coverImage),
        isPublished: true,
      }
      const movedToTrash = await apiRequest<Note>(`/api/notes/${selectedNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify(deletePayload),
      })
      setNotes((cur) => {
        const remaining = cur.filter((n) => n.id !== movedToTrash.id)
        setSelectedNoteId(remaining[0]?.id ?? null)
        return remaining
      })
      setSuccessMessage('Note moved to Deleted Notes.')
      setSuccessModalMessage('Note moved to Deleted Notes successfully.')
      window.setTimeout(() => navigate('/deleted-notes'), 220)
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
    setCoverImage({ src: pendingImageDataUrl, alt: caption || 'image' })
    setSuccessMessage('Image section added.')
    setSuccessModalMessage('Cover image added successfully.')
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

  return (
    <div className="workspace-theme min-h-screen bg-[#f7f8fa] p-4 text-slate-800 sm:p-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)', backgroundSize: '14px 14px' }}>
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={handleImageFileSelected} hidden />
      <div className={`page-enter mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-[1500px] overflow-hidden rounded-[30px] border border-white/80 bg-white/65 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl ${isPublishingTransition ? 'workspace-shell-leaving' : ''}`}>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 bg-white/70 px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">BlogStreet Notes</h2>
            <p className="mt-0.5 text-sm text-slate-500">Draft, edit, and organize your notes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {errorMessage && <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{errorMessage}</span>}
            {successMessage && <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">{successMessage}</span>}
            <Link to="/dashboard" className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-slate-50">Dashboard</Link>
          </div>
        </header>

        <div className="workspace-grid bg-transparent">
          <aside className="panel-enter enter-delay-1 design-sidebar bg-white/55">
            <div className="sidebar-header">
              <div className="sidebar-header-top">
                <span className="sidebar-title">Notes</span>
                <span className="sidebar-count">{notes.length}</span>
              </div>
              <button type="button" className="sidebar-new-btn" onClick={() => void handleCreateNote()} disabled={isSaving || isPublishingTransition}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
                New note
              </button>
            </div>

            <div className="sidebar-notes-section">
              <span className="sidebar-section-label">Your notes</span>
              {isLoading && [0, 1, 2].map((i) => <div key={i} className="skeleton-note-card" />)}
              {!isLoading && notes.length === 0 && <p className="subtle" style={{ fontSize: '.82rem' }}>No notes yet. Start your first story.</p>}
              {notes.map((note, i) => (
                <button key={note.id} type="button" className={`note-item ${note.id === selectedNoteId ? 'active' : ''}`} onClick={() => setSelectedNoteId(note.id)} style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="note-title">{note.title}</span>
                  <span className="note-meta">
                    {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(note.updatedAt))}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="panel-enter enter-delay-2 preview-pane !p-5 sm:!p-6">
            <div className="preview-toolbar mb-1.5">
              <button type="button" className={`chip-btn ${isLivePreview ? 'chip-active' : ''}`} onClick={() => setIsLivePreview((c) => !c)}>
                {isLivePreview ? 'Exit preview' : 'Live preview'}
              </button>
              {selectedNote && (
                <div className="mini-nav">
                  {notes.slice(0, 3).map((note) => (
                    <button key={`mini-${note.id}`} type="button" onClick={() => setSelectedNoteId(note.id)} className={note.id === selectedNoteId ? 'active' : ''}>
                      {note.title.length > 22 ? note.title.slice(0, 22) + '…' : note.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedNote ? (
              <div className="panel-enter enter-delay-3 preview-card !border-blue-100 !bg-white shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                <div className="editor-card-header !border-blue-100 !bg-blue-50/60">
                  <div className="editor-card-title-group">
                    <h3>{isLivePreview ? 'Preview' : 'Edit note'}</h3>
                    <p>{isLivePreview ? 'Reading mode — how your note looks' : 'Fill in the fields to build your note'}</p>
                  </div>
                  {!isLivePreview && (
                    <div className="editor-card-actions">
                      <button type="button" className="secondary-btn !border-blue-600 !bg-blue-600 !text-white !shadow-[0_10px_20px_rgba(37,99,235,0.22)] hover:-translate-y-0.5 hover:!border-red-500 hover:!bg-red-500 hover:!shadow-[0_14px_26px_rgba(239,68,68,0.28)]" onClick={() => setIsDeleteModalOpen(true)} disabled={isSaving || isPublishingTransition}>Delete</button>
                      <button type="button" className="primary-btn" onClick={() => void handleSave()} disabled={isSaving || isPublishingTransition}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                {!isLivePreview && (
                  <div className="editor-toolbar !border-blue-100 !bg-blue-50/45">
                    <div className="switch-row">Manage and review your note</div>
                    <button type="button" className="chip-btn !border-blue-200 !bg-white !text-slate-700 hover:!bg-blue-50" onClick={() => imageInputRef.current?.click()} disabled={isSaving || isPublishingTransition}>Add image</button>
                  </div>
                )}

                {!isLivePreview ? (
                  <div className="editor-card-body">
                    <div className="note-form-grid">
                      <label className="note-field">
                        <span className="note-field-label">Title</span>
                        <input className="title-input !border-slate-200 !bg-white focus:!border-blue-300 focus:!shadow-[0_0_0_3px_rgba(59,130,246,0.18)]" value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} maxLength={140} placeholder="Enter note title…" />
                      </label>

                      <label className="note-field">
                        <span className="note-field-label">Tag</span>
                        <select className="note-tag-select !border-slate-200 !bg-white focus:!border-blue-300 focus:!shadow-[0_0_0_3px_rgba(59,130,246,0.18)]" value={selectedNoteTag} onChange={(e) => handleNoteTagChange(e.target.value)}>
                          <option value="">No tag</option>
                          {DASHBOARD_TAG_OPTIONS.map((tag) => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                      </label>

                      <div className="note-field">
                        <span className="note-field-label">Cover image</span>
                        <div className="note-image-preview !border-slate-200 !bg-white">
                          {notePreview.imageSrc
                            ? <img src={notePreview.imageSrc} alt="Note preview" loading="lazy" />
                            : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem' }}>
                                <button type="button" className="chip-btn" style={{ fontSize: '.75rem' }} onClick={() => imageInputRef.current?.click()} disabled={isSaving || isPublishingTransition}>
                                  Upload image
                                </button>
                              </div>
                            )
                          }
                        </div>
                      </div>

                      <label className="note-field note-field-full">
                        <span className="note-field-label">Content</span>
                        <textarea className="content-input !border-slate-200 !bg-white focus:!border-blue-300 focus:!shadow-[0_0_0_3px_rgba(59,130,246,0.18)]" value={draft.content} onChange={(e) => setDraft((c) => ({ ...c, content: e.target.value }))} placeholder="Start writing your note…" />
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

                <div className="editor-footer !border-blue-100 !bg-blue-50/50">
                  <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
                  <span>{Math.max(1, Math.ceil(wordCount / 220))} min read</span>
                  <span>Last saved: {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(selectedNote.updatedAt))}</span>
                  {selectedNoteTag && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedNoteTag}</span>}
                </div>
              </div>
            ) : (
              <div className="preview-card" style={{ padding: 0 }}>
                <div className="empty-state">
                  <div className="empty-state-icon">✦</div>
                  <h3>Pick or create a note to begin writing</h3>
                  <p>Your notes appear in the sidebar on the left.</p>
                  <button type="button" className="primary-btn" style={{ marginTop: '.5rem' }} onClick={() => void handleCreateNote()} disabled={isSaving}>
                    + Create first note
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {isCaptionModalOpen && (
        <div className="modal-overlay">
          <div className="caption-modal" role="dialog" aria-modal="true" aria-labelledby="caption-modal-title">
            <h3 id="caption-modal-title">Add image caption</h3>
            <p>This caption will appear below the image in your note.</p>
            <input className="caption-input" value={imageCaptionInput} onChange={(e) => setImageCaptionInput(e.target.value)} placeholder={pendingImageName || 'Optional caption…'} maxLength={120} autoFocus />
            <div className="caption-actions">
              <button type="button" className="secondary-btn" onClick={() => { setIsCaptionModalOpen(false); setPendingImageDataUrl(null); setPendingImageName(''); setImageCaptionInput('') }}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleConfirmImageSection}>Add image</button>
            </div>
          </div>
        </div>
      )}

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

      {successModalMessage && (
        <div className="modal-overlay">
          <div className="caption-modal" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
            <h3 id="success-modal-title">Success</h3>
            <p>{successModalMessage}</p>
            <div className="caption-actions">
              <button type="button" className="primary-btn !bg-blue-600 hover:!bg-blue-500" onClick={() => setSuccessModalMessage(null)}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
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

function splitContentForEditor(content: string): { textContent: string; image: CoverImageState | null } {
  const sections = parseBlogSections(content)
  const firstImage = sections.find((s) => s.kind === 'image')
  const textContent = sections
    .filter((s): s is Extract<BlogSection, { kind: 'text' }> => s.kind === 'text')
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join('\n\n')

  return {
    textContent,
    image: firstImage?.kind === 'image'
      ? { src: firstImage.src, alt: firstImage.caption || firstImage.alt || 'image' }
      : null,
  }
}

function composeContentForStorage(textContent: string, coverImage: CoverImageState | null): string {
  const cleanText = textContent.trim()
  if (!coverImage?.src) return cleanText
  const alt = coverImage.alt.trim() || 'image'
  const imageBlock = `![${alt}](${coverImage.src})`
  return cleanText.length > 0 ? `${imageBlock}\n\n${cleanText}` : imageBlock
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
