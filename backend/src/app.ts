import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { randomInt } from 'node:crypto'
import nodemailer from 'nodemailer'
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
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000
const MAX_ACTIVITY_LOG_CACHE = 500
const OTP_EXPIRY_MS = 10 * 60 * 1000
const OTP_MAX_ATTEMPTS = 3

type AuthEventType = 'SUCCESS' | 'FAILED' | 'LOCKED' | 'LOGOUT'

type FailedLoginRecord = {
  failedAttempts: number
  lockedAt: number | null
}

type PendingRegistration = {
  username: string
  email: string
  passwordHash: string
  otp: string
  expiresAt: number
  attempts: number
}

const failedAttemptsByUsername = new Map<string, FailedLoginRecord>()
const activityLogEntries: string[] = []
const pendingRegistrationsByEmail = new Map<string, PendingRegistration>()

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

const registerStartSchema = z.object({
  username: z.string().trim().min(3).max(64),
  email: z.string().trim().email('Email is invalid.').max(255).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(1024)
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must include at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol.'),
})

const registerVerifySchema = z.object({
  email: z.string().trim().email('Email is invalid.').max(255),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP code must be 6 digits.'),
})

const resendOtpSchema = z.object({
  email: z.string().trim().email('Email is invalid.').max(255),
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

const otpTransport = nodemailer.createTransport({
  host: config.brevoSmtpHost,
  port: config.brevoSmtpPort,
  secure: config.brevoSmtpPort === 465,
  auth: {
    user: config.brevoSmtpUser,
    pass: config.brevoSmtpPass,
  },
})

const otpFromAddress = {
  name: config.brevoFromName,
  address: config.brevoFromEmail,
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

async function sendOtpEmail(email: string, otpCode: string): Promise<void> {
  const html = `
  <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
    <div style="padding: 32px;">
      <p style="font-size: 11px; font-weight: 600; color: #888; letter-spacing: 0.08em; margin: 0 0 6px; text-transform: uppercase;">BlogStreet</p>
      <h1 style="font-size: 20px; font-weight: 500; color: #111; margin: 0 0 16px;">Verify your identity</h1>
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 24px;">Use the code below to complete your sign-in. It's valid for the next 10 minutes.</p>

      <div style="background: #f7f7f5; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
        <span style="font-size: 28px; font-weight: 500; letter-spacing: 0.18em; color: #111; font-family: 'Courier New', monospace;">${otpCode.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
        <p style="font-size: 12px; color: #999; margin: 8px 0 0;">Expires in 10 minutes</p>
      </div>

      <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 0;">If you didn't request this, you can safely ignore this email. Your account remains secure.</p>
    </div>

    <div style="padding: 14px 32px; border-top: 1px solid #e5e5e5;">
      <p style="font-size: 12px; color: #aaa; margin: 0;">© ${new Date().getFullYear()} BlogStreet</p>
    </div>
  </div>
`

  await otpTransport.sendMail({
    from: otpFromAddress,
    to: email,
    subject: 'Your BlogStreet verification code',
    html,
  })
}

function getPendingRegistrationByUsername(username: string): PendingRegistration | null {
  for (const pending of pendingRegistrationsByEmail.values()) {
    if (pending.username === username) return pending
  }
  return null
}

function isPendingExpired(pending: PendingRegistration, now: number): boolean {
  return now > pending.expiresAt
}

function getFailedAttemptRecord(username: string): FailedLoginRecord {
  const existing = failedAttemptsByUsername.get(username)
  if (existing) return existing
  const record: FailedLoginRecord = { failedAttempts: 0, lockedAt: null }
  failedAttemptsByUsername.set(username, record)
  return record
}

function resetFailedAttempts(record: FailedLoginRecord): void {
  record.failedAttempts = 0
  record.lockedAt = null
}

function getRemainingLockoutMs(record: FailedLoginRecord, now: number): number {
  if (!record.lockedAt) return 0
  const remaining = LOCKOUT_DURATION_MS - (now - record.lockedAt)
  return remaining > 0 ? remaining : 0
}

function formatAttemptsRemainingMessage(remainingAttempts: number): string {
  const suffix = remainingAttempts === 1 ? '' : 's'
  return `Invalid credentials. ${remainingAttempts} attempt${suffix} remaining.`
}

function formatLockoutMessage(remainingMs: number): string {
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  if (minutes > 0) {
    return `Account locked. Try again in ${minutes}m ${seconds}s.`
  }
  return `Account locked. Try again in ${seconds}s.`
}

function formatFailedAttemptDetail(attemptNumber: number): string {
  return `Invalid credentials (attempt ${attemptNumber}/${MAX_FAILED_ATTEMPTS})`
}

function formatLockoutDetail(attemptNumber: number): string {
  return `Account locked (attempt ${attemptNumber}/${MAX_FAILED_ATTEMPTS})`
}

function registerFailedAttempt(
  record: FailedLoginRecord,
  now: number,
): { locked: boolean; message: string; failedAttempts: number } {
  record.failedAttempts += 1

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.failedAttempts = MAX_FAILED_ATTEMPTS
    record.lockedAt = now
    return { locked: true, message: formatLockoutMessage(LOCKOUT_DURATION_MS), failedAttempts: record.failedAttempts }
  }

  const remainingAttempts = MAX_FAILED_ATTEMPTS - record.failedAttempts
  return { locked: false, message: formatAttemptsRemainingMessage(remainingAttempts), failedAttempts: record.failedAttempts }
}

function formatLogTimestamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function formatLogEntry(timestamp: Date, username: string, eventType: AuthEventType, detail: string): string {
  return `[${formatLogTimestamp(timestamp)}] user=${username} | event=${eventType} | detail=${detail}`
}

function appendLogEntry(entry: string): void {
  activityLogEntries.push(entry)
  if (activityLogEntries.length > MAX_ACTIVITY_LOG_CACHE) {
    activityLogEntries.splice(0, activityLogEntries.length - MAX_ACTIVITY_LOG_CACHE)
  }
}

function log_event(username: string, eventType: AuthEventType, detail: string): void {
  const safeUsername = username || 'unknown'
  const timestamp = new Date()
  const entry = formatLogEntry(timestamp, safeUsername, eventType, detail)
  appendLogEntry(entry)
  void supabaseAdmin
    .from('auth_activity_log')
    .insert({
      username: safeUsername,
      event_type: eventType,
      detail,
      created_at: timestamp.toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error('Failed to persist activity log.', error)
    })
}

async function loadActivityLogFromDb(): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('auth_activity_log')
    .select('username, event_type, detail, created_at')
    .order('created_at', { ascending: true })
    .limit(MAX_ACTIVITY_LOG_CACHE)

  if (error) {
    console.error('Failed to load activity log.', error)
    return
  }

  data?.forEach((row) => {
    const timestamp = row.created_at ? new Date(row.created_at) : new Date()
    const entry = formatLogEntry(
      timestamp,
      row.username ?? 'unknown',
      row.event_type as AuthEventType,
      row.detail ?? '',
    )
    appendLogEntry(entry)
  })
}

function getActivityLogTail(limit: number): string[] {
  return activityLogEntries.slice(-limit)
}

void loadActivityLogFromDb()

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
    log_event('unknown', 'FAILED', 'Invalid payload.')
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const username = normalizeUsername(parsed.data.username)
  const now = Date.now()
  const lockRecord = getFailedAttemptRecord(username)
  const remainingLockoutMs = getRemainingLockoutMs(lockRecord, now)

  if (remainingLockoutMs > 0) {
    log_event(username, 'LOCKED', formatLockoutMessage(remainingLockoutMs))
    res.status(423).json({ error: formatLockoutMessage(remainingLockoutMs) })
    return
  }

  if (lockRecord.lockedAt) {
    resetFailedAttempts(lockRecord)
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, password_hash, avatar_url')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    log_event(username, 'FAILED', 'User lookup failed.')
    res.status(500).json({ error: 'Request failed.' })
    return
  }

  const user = data as DbUser | null
  if (!user) {
    const { locked, message, failedAttempts } = registerFailedAttempt(lockRecord, now)
    const detail = locked
      ? formatLockoutDetail(failedAttempts)
      : formatFailedAttemptDetail(failedAttempts)
    log_event(username, locked ? 'LOCKED' : 'FAILED', detail)
    res.status(locked ? 423 : 401).json({ error: message })
    return
  }

  const isValidPassword = await comparePassword(parsed.data.password, user.password_hash)
  if (!isValidPassword) {
    const { locked, message, failedAttempts } = registerFailedAttempt(lockRecord, now)
    const detail = locked
      ? formatLockoutDetail(failedAttempts)
      : formatFailedAttemptDetail(failedAttempts)
    log_event(username, locked ? 'LOCKED' : 'FAILED', detail)
    res.status(locked ? 423 : 401).json({ error: message })
    return
  }

  resetFailedAttempts(lockRecord)
  log_event(username, 'SUCCESS', 'Login successful.')
  issueSession(res, { id: user.id, username: user.username })
  res.json({ user: { id: user.id, username: user.username, avatarUrl: user.avatar_url } })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[config.cookieName]
  let username = 'unknown'
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload
      if (typeof decoded.username === 'string') username = decoded.username
    } catch {
      // Ignore invalid tokens when logging out.
    }
  }
  log_event(username, 'LOGOUT', 'User logged out.')
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

app.get('/api/auth/activity', requireUser, async (req: AuthenticatedRequest, res) => {
  if (activityLogEntries.length === 0) {
    await loadActivityLogFromDb()
  }

  // Only return activity entries related to the requesting user
  const username = req.user?.username ?? ''
  // Entries are formatted like: "[ts] user=username | event=... | detail=..."
  const userEntries = activityLogEntries.filter((entry) => entry.includes(`user=${username} |`))
  const tail = userEntries.slice(-20)
  res.json({ entries: tail })
})

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerStartSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const username = normalizeUsername(parsed.data.username)

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .limit(1)

  if (error) {
    res.status(500).json({ error: 'Failed to check existing users.' })
    return
  }

  if (data && data.length > 0) {
    res.status(409).json({ error: 'Username is already taken.' })
    return
  }

  // If no email provided, just return availability check (from RegisterPage)
  if (!parsed.data.email) {
    res.status(200).json({ message: 'Username is available.' })
    return
  }

  // If email provided, create pending registration and send OTP (from VerifyOtpPage)
  const email = normalizeEmail(parsed.data.email)
  // Check if email is already registered
  const { data: emailData, error: emailError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)

  if (emailError) {
    res.status(500).json({ error: 'Failed to check existing emails.' })
    return
  }

  if (emailData && emailData.length > 0) {
    res.status(409).json({ error: 'This email is already in use.' })
    return
  }

  const [otp, passwordHash] = await Promise.all([
    Promise.resolve(generateOtpCode()),
    bcrypt.hash(parsed.data.password, SALT_ROUNDS),
  ])

  try {
    await sendOtpEmail(email, otp)
  } catch {
    res.status(500).json({ error: 'Failed to send verification code.' })
    return
  }

  const pending: PendingRegistration = {
    username,
    email,
    passwordHash,
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  }

  pendingRegistrationsByEmail.set(email, pending)
  res.status(200).json({ message: `We sent a code to ${email}.` })
})

app.post('/api/auth/register/verify', async (req, res) => {
  const parsed = registerVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const email = normalizeEmail(parsed.data.email)
  const otp = parsed.data.otp.trim()
  const pending = pendingRegistrationsByEmail.get(email)

  if (!pending) {
    res.status(400).json({ error: 'No pending registration found. Please request a new code.' })
    return
  }

  const now = Date.now()
  if (isPendingExpired(pending, now)) {
    pendingRegistrationsByEmail.delete(email)
    res.status(410).json({ error: 'Verification code expired. Please request a new one.' })
    return
  }

  if (pending.otp !== otp) {
    pending.attempts += 1
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      pendingRegistrationsByEmail.delete(email)
      res.status(400).json({ error: 'Verification code invalid. Please request a new one.' })
      return
    }
    res.status(401).json({
      error: `Invalid code. ${OTP_MAX_ATTEMPTS - pending.attempts} attempt(s) remaining.`,
    })
    return
  }

  const verifiedAt = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      username: pending.username,
      email: pending.email,
      password_hash: pending.passwordHash,
      email_verified_at: verifiedAt,
    })
    .select('id, username, avatar_url')
    .single()

  if (error) {
    const isConflict = typeof error.message === 'string' && error.message.toLowerCase().includes('duplicate')
    res
      .status(isConflict ? 409 : 500)
      .json({ error: isConflict ? 'Username is already taken.' : 'Failed to create user.' })
    return
  }

  pendingRegistrationsByEmail.delete(email)
  res.status(201).json({ user: data })
})

app.post('/api/auth/register/resend', async (req, res) => {
  const parsed = resendOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' })
    return
  }

  const email = normalizeEmail(parsed.data.email)
  const pending = pendingRegistrationsByEmail.get(email)

  if (!pending) {
    res.status(400).json({ error: 'No pending registration found. Please sign up again.' })
    return
  }

  if (isPendingExpired(pending, Date.now())) {
    pendingRegistrationsByEmail.delete(email)
    res.status(410).json({ error: 'Registration expired. Please sign up again.' })
    return
  }

  const otp = generateOtpCode()
  try {
    await sendOtpEmail(email, otp)
  } catch {
    res.status(500).json({ error: 'Failed to send verification code.' })
    return
  }

  pending.otp = otp
  pending.expiresAt = Date.now() + OTP_EXPIRY_MS
  pending.attempts = 0

  res.json({ message: 'A new verification code has been sent.' })
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