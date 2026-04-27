type Handler = (req: unknown, res: unknown) => unknown | Promise<unknown>

let cachedHandler: Handler | null = null

async function getHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler

  // Vercel may load this file as CommonJS; dynamic import bridges to ESM backend module.
  const mod = await import('../backend/src/app.js')
  cachedHandler = (mod.default as Handler)
  return cachedHandler
}

export default async function vercelHandler(req: unknown, res: unknown): Promise<void> {
  const handler = await getHandler()
  await handler(req, res)
}
