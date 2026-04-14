# Claude Code + WhatsApp Manager + Telegram Bot — Monorepo

## Overview

Unified bilingual (Arabic/English) platform combining:
1. **Claude Code تعلّم** — Educational platform teaching Claude Code to Arab developers with AI RAG chat
2. **WhatsApp Manager** — Multi-session WhatsApp manager via wppconnect
3. **Telegram Bot** — grammY-powered Telegram assistant (via API)

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, **TypeScript**: 5.9
- **API server**: Express 5, Socket.IO, Pino logger, JWT + bcrypt auth
- **Database**: PostgreSQL + Drizzle ORM + pgvector (for RAG)
- **AI**: Anthropic Claude API via `@anthropic-ai/sdk`
- **Telegram**: grammY
- **WhatsApp**: @wppconnect-team/wppconnect (requires Chrome system libs)
- **Frontend**: React 19 + Vite + Shadcn UI + Tailwind v4
- **State**: React Query (TanStack) + React Context (auth)
- **Routing**: wouter
- **Build**: esbuild (with external list for native modules)

## Artifacts / Services

| Service | Path | Port |
|---------|------|------|
| API Server | `/api` | 8080 |
| Claude Education | `/education` | 25013 |
| WhatsApp Dashboard | `/whatsapp` | 23097 |

## Database Schema (15 tables)

`users`, `whatsapp_sessions`, `messages`, `api_keys`, `audit_logs`, `settings`,
`content_chunks`, `conversations`, `chat_messages`, `user_progress`, `resources`,
`resource_translations`, `resource_suggestions`, `telegram_users`, `telegram_conversations`

## Seed Data

- Admin: `admin / admin123` (must change password on first login)
- Employees: `emp1 / pass123`, `emp2 / pass123`, `emp3 / pass123`
- 3 WhatsApp sessions, 10 content chunks, 6 resources, 9 settings, 20 audit logs

## Key Commands

```bash
pnpm --filter @workspace/db run push       # Push DB schema
pnpm --filter @workspace/scripts run seed  # Seed database
pnpm --filter @workspace/api-server run dev  # Run API server
```

## Design System

- Dark mode default, Arabic RTL first
- Font: Cairo (Google Fonts)
- Background: `#0A0A0F`, Card: `#12121A`
- Primary: `#7C3AED` (purple), gradient to `#3B82F6` (blue)

## Important Notes

- **wppconnect**: Needs Chrome system libraries (`libglib-2.0`, etc.) — works in production (Docker/VPS) but limited in Replit sandbox
- **JWT secret**: Falls back to `"dev-secret-change-in-production"` if `JWT_SECRET` env is unset
- **ANTHROPIC_API_KEY**: Returns Arabic error message gracefully if missing
- **esbuild external**: `@wppconnect-team/wppconnect` and `sharp` are external (not bundled)
- **API prefix**: All routes at `/api/...`; Vite proxies `/api` → `localhost:8080`

## Auth Flow

- JWT stored in httpOnly cookie
- `mustChangePassword` field forces password change on first login
- Admin role required for `/admin/*` routes

## RAG Chat Pipeline

1. User sends message → `/api/chat/conversations/:id/messages`
2. Embed query via pgvector cosine similarity search on `content_chunks`
3. Build context from top-K chunks → Claude API → stream response
4. Store sources in response metadata
