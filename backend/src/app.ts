import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
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

type DbUser = {
  id: string
  username: string
  password_hash: string
  avatar_url: string | null
}

type AuthenticatedRequest = express.Request & {
  user?: {
    id: string
    username: string
  }
}

const SALT_ROUNDS = 12

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
const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.').max(64),
  password: z.string().min(1, 'Password is required.').max(1024),
})

const userCreateSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(1024)
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must include at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol.'),
})

const profileUpdateSchema = z.object({
  username: z.string().trim().min(3).max(64).optional(),
  avatarUrl: z
    .string()
    .trim()
    .max(2_000_000, 'Image is too large. Use a smaller image.')
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,|^https?:\/\//i, 'Invalid image format.')
    .optional(),
  currentPassword: z.string().min(1, 'Current password is required.').max(1024).optional(),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters.')
    .max(1024)
    .regex(/[A-Z]/, 'New password must include at least one uppercase letter.')
    .regex(/[a-z]/, 'New password must include at least one lowercase letter.')
    .regex(/[0-9]/, 'New password must include at least one number.')
    .regex(/[^A-Za-z0-9]/, 'New password must include at least one symbol.')
    .optional(),
}).refine((payload) => {
  const hasAnyField = payload.username !== undefined || payload.avatarUrl !== undefined || payload.newPassword !== undefined
  return hasAnyField
}, { message: 'Provide at least one profile field to update.' }).refine((payload) => {
  if (payload.newPassword !== undefined) return Boolean(payload.currentPassword)
  return true
}, { message: 'Current password is required to change password.' })

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
app.use(cookieParser())

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function comparePassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash)
}

function issueSession(res: express.Response, user: { id: string; username: string }): void {
  const signOptions: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] }
  const token = jwt.sign({ sub: user.id, username: user.username }, config.jwtSecret, signOptions)
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

function clearSession(res: express.Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  })
}

function requireUser(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void {
  const token = req.cookies?.[config.cookieName]

  if (!token) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload
    const userId = decoded.sub
    const username = decoded.username

    if (typeof userId !== 'string' || typeof username !== 'string') {
      res.status(401).json({ error: 'Unauthorized.' })
      return
    }

    req.user = { id: userId, username }
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized.' })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const username = normalizeUsername(parsed.data.username)

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, password_hash, avatar_url')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'Request failed.' })
    return
  }

  const user = data as DbUser | null
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials.' })
    return
  }

  const isValidPassword = await comparePassword(parsed.data.password, user.password_hash)
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid credentials.' })
    return
  }

  issueSession(res, { id: user.id, username: user.username })
  res.json({ user: { id: user.id, username: user.username, avatarUrl: user.avatar_url } })
})

app.post('/api/auth/logout', (_req, res) => {
  clearSession(res)
  res.status(204).send()
})

app.get('/api/auth/me', requireUser, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, avatar_url')
    .eq('id', req.user.id)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'Failed to load session.' })
    return
  }

  if (!data) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  res.json({ user: { id: data.id, username: data.username, avatarUrl: data.avatar_url } })
})

app.post('/api/auth/register', async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const username = normalizeUsername(parsed.data.username)
  const passwordHash = await hashPassword(parsed.data.password)
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ username, password_hash: passwordHash })
    .select('id, username, avatar_url')
    .single()

  if (error) {
    const isConflict = typeof error.message === 'string' && error.message.toLowerCase().includes('duplicate')
    res
      .status(isConflict ? 409 : 500)
      .json({ error: isConflict ? 'Username already taken.' : 'Failed to create user.' })
    return
  }

  res.status(201).json(data)
})

app.patch('/api/auth/profile', requireUser, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  const parsed = profileUpdateSchema.safeParse(req.body)

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from('users')
    .select('id, username, password_hash, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (existingUserError) {
    res.status(500).json({ error: 'Failed to load profile.' })
    return
  }

  const dbUser = existingUser as DbUser | null
  if (!dbUser) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  if (parsed.data.newPassword && parsed.data.currentPassword) {
    const isCurrentPasswordValid = await comparePassword(parsed.data.currentPassword, dbUser.password_hash)
    if (!isCurrentPasswordValid) {
      res.status(401).json({ error: 'Current password is incorrect.' })
      return
    }
  }

  const nextUsername = parsed.data.username ? normalizeUsername(parsed.data.username) : undefined
  const updatePayload: { username?: string; avatar_url?: string | null; password_hash?: string } = {}

  if (nextUsername !== undefined) updatePayload.username = nextUsername
  if (parsed.data.avatarUrl !== undefined) updatePayload.avatar_url = parsed.data.avatarUrl
  if (parsed.data.newPassword !== undefined) {
    updatePayload.password_hash = await hashPassword(parsed.data.newPassword)
  }

  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from('users')
    .update(updatePayload)
    .eq('id', userId)
    .select('id, username, avatar_url')
    .maybeSingle()

  if (updateError) {
    const isConflict = typeof updateError.message === 'string' && updateError.message.toLowerCase().includes('duplicate')
    res.status(isConflict ? 409 : 500).json({ error: isConflict ? 'Username already taken.' : 'Failed to update profile.' })
    return
  }

  if (!updatedUser) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  const user = {
    id: updatedUser.id,
    username: updatedUser.username,
    avatarUrl: updatedUser.avatar_url,
  }
  issueSession(res, { id: user.id, username: user.username })
  res.json({ user })
})

app.get('/api/notes', requireUser, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id

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

app.post('/api/notes', requireUser, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
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

  const { data, error } = await supabaseAdmin.from('notes').insert(payload).select('*').single()

  if (error) {
    res.status(500).json({ error: 'Failed to create note.' })
    return
  }

  res.status(201).json(mapDbNote(data as DbNote))
})

app.patch('/api/notes/:id', requireUser, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
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

app.delete('/api/notes/:id', requireUser, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
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

export default app
