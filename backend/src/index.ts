import 'dotenv/config'
import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { config } from './config.js'
import { supabaseAdmin } from './supabase.js'

type DbNote = {
  id: string
  user_id: string
  title: string
  content: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(140),
  content: z.string().max(2_000_000, 'Content is too large. Use smaller images.').default(''),
  isPublished: z.boolean().default(false),
})

const updateNoteSchema = createNoteSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Provide at least one field to update.',
  })

const noteIdSchema = z.string().uuid('Invalid note id.')

const mapDbNote = (note: DbNote) => ({
  id: note.id,
  title: note.title,
  content: note.content ?? '',
  isPublished: note.is_published,
  createdAt: note.created_at,
  updatedAt: note.updated_at,
})

const app = express()

app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true,
  }),
)
app.use(express.json({ limit: '6mb' }))
app.use(
  clerkMiddleware({
    publishableKey: config.clerkPublishableKey,
    secretKey: config.clerkSecretKey,
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/notes', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req)

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: 'Failed to load notes.' })
    return
  }

  res.json(data.map((note) => mapDbNote(note as DbNote)))
})

app.post('/api/notes', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req)
  const parsed = createNoteSchema.safeParse(req.body)

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const payload = {
    user_id: userId,
    title: parsed.data.title,
    content: parsed.data.content,
    is_published: parsed.data.isPublished,
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    res.status(500).json({ error: 'Failed to create note.' })
    return
  }

  res.status(201).json(mapDbNote(data as DbNote))
})

app.patch('/api/notes/:id', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req)
  const parsedId = noteIdSchema.safeParse(req.params.id)
  const parsedPayload = updateNoteSchema.safeParse(req.body)

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  if (!parsedId.success) {
    res.status(400).json({ error: parsedId.error.issues[0]?.message ?? 'Invalid note id.' })
    return
  }

  if (!parsedPayload.success) {
    res.status(400).json({ error: parsedPayload.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const updatePayload: {
    title?: string
    content?: string
    is_published?: boolean
  } = {}

  if (parsedPayload.data.title !== undefined) {
    updatePayload.title = parsedPayload.data.title.trim()
  }

  if (parsedPayload.data.content !== undefined) {
    updatePayload.content = parsedPayload.data.content
  }

  if (parsedPayload.data.isPublished !== undefined) {
    updatePayload.is_published = parsedPayload.data.isPublished
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .update(updatePayload)
    .eq('id', parsedId.data)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'Failed to update note.' })
    return
  }

  if (!data) {
    res.status(404).json({ error: 'Note not found.' })
    return
  }

  res.json(mapDbNote(data as DbNote))
})

app.delete('/api/notes/:id', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req)
  const parsedId = noteIdSchema.safeParse(req.params.id)

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  if (!parsedId.success) {
    res.status(400).json({ error: parsedId.error.issues[0]?.message ?? 'Invalid note id.' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .delete()
    .eq('id', parsedId.data)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'Failed to delete note.' })
    return
  }

  if (!data) {
    res.status(404).json({ error: 'Note not found.' })
    return
  }

  res.status(204).send()
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)

  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: 'Uploaded image is too large. Please choose a smaller JPG/PNG file.',
    })
    return
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    res.status((error as { status: number }).status).json({ error: 'Request failed.' })
    return
  }

  res.status(500).json({ error: 'Internal server error.' })
})

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`)
})
