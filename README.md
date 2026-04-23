# BlogStreet

A Notion-inspired blog drafting workspace with:
- React frontend
- Clerk authentication (Google sign-in + OTP-ready MFA)
- Express backend
- Supabase database

## Stack

- Frontend: Vite + React + TypeScript + Clerk React
- Backend: Express + TypeScript + Clerk Express
- Database: Supabase (PostgreSQL)

## 1) Configure Supabase

Run the SQL schema in [supabase/schema.sql](supabase/schema.sql) inside your Supabase SQL editor.

This creates the `notes` table with timestamps and indexing.

## 2) Configure Clerk

In Clerk Dashboard:

1. Enable Google OAuth provider under social connections.
2. Enable Multi-Factor Authentication and set OTP/TOTP as allowed method.
3. For strict security, set MFA to required for your app.

## 3) Set environment variables

Create env files from examples.

### Frontend

Copy [client/.env.example](client/.env.example) to `client/.env` and set values:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL` (default `http://localhost:4000`)

### Backend

Copy [server/.env.example](server/.env.example) to `server/.env` and set values:

- `PORT`
- `CLIENT_ORIGIN`
- `CLERK_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) Install and run

From project root:

```bash
npm install
npm install --workspace server
npm install --workspace client
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## 5) Build check

```bash
npm run build
```

## Security flow

- Sign in with Google using Clerk.
- Clerk handles OTP challenge during sign-in when MFA is required.
- In-app edits are blocked until user has OTP enabled (`twoFactorEnabled`).
- API routes are protected via Clerk session token verification.

## API endpoints

- `GET /api/health`
- `GET /api/notes`
- `POST /api/notes`
- `PATCH /api/notes/:id`
- `DELETE /api/notes/:id`
