const requireEnv = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};
export const config = {
    port: Number(process.env.PORT ?? 4000),
    clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://localhost:5174')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'blogstreet_session',
    isProduction: process.env.NODE_ENV === 'production',
    brevoSmtpHost: requireEnv('BREVO_SMTP_HOST'),
    brevoSmtpPort: Number(process.env.BREVO_SMTP_PORT ?? 587),
    brevoSmtpUser: requireEnv('BREVO_SMTP_USER'),
    brevoSmtpPass: requireEnv('BREVO_SMTP_PASS'),
    brevoFromEmail: requireEnv('BREVO_FROM_EMAIL'),
    brevoFromName: process.env.BREVO_FROM_NAME ?? 'BlogStreet',
};
