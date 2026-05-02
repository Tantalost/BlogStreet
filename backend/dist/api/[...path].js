let cachedHandler = null;
async function getHandler() {
    if (cachedHandler)
        return cachedHandler;
    const mod = await import('../src/app.js');
    cachedHandler = mod.default;
    return cachedHandler;
}
export default async function vercelHandler(req, res) {
    const handler = await getHandler();
    await handler(req, res);
}
