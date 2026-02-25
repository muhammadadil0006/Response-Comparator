# AI Model Playground

A full-stack web application that allows users to compare responses from three different AI models (GPT-4o, Claude 3 Sonnet, and Grok 2) side-by-side in a parallel view with real-time streaming.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)

## Features

- **Side-by-Side Comparison**: View responses from GPT-4o, Claude 3 Sonnet, and Grok 2 simultaneously
- **Real-Time Streaming**: SSE-based streaming for live response display with typing indicators
- **Performance Metrics**: Track response time, token usage, and estimated cost per model
- **Authentication**: JWT-based auth with access/refresh token rotation
- **Comparison History**: Save and revisit past comparisons (authenticated users)
- **Responsive Design**: Works across desktop, tablet, and mobile devices
- **Rate Limiting**: IP-based rate limiting to prevent API abuse

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| State | Redux Toolkit + RTK Query |
| Database | Prisma Postgres + Prisma ORM v7 |
| Auth | JWT (httpOnly cookies) + bcryptjs |
| AI SDKs | Vercel AI Gateway (@ai-sdk/gateway) |
| Streaming | Server-Sent Events (SSE) |
| Testing | Jest + Playwright |
| Deployment | Vercel |

## Project Structure

```
ai-model-playground/
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # SQL migration files
├── prisma.config.ts            # Prisma config (datasource URL, migration path)
├── generated/
│   └── prisma/                 # Auto-generated Prisma Client (gitignored)
├── e2e/
│   └── auth-flow.spec.ts       # E2E tests
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/            # Auth API routes
│   │   │   │   ├── register/
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   ├── refresh/
│   │   │   │   └── me/
│   │   │   └── comparisons/     # Comparison API routes
│   │   │       └── [id]/
│   │   ├── compare/             # Compare page
│   │   ├── history/             # History page (protected)
│   │   ├── login/               # Login page
│   │   ├── register/            # Register page
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   └── globals.css
│   ├── components/
│   │   ├── auth/                # Auth components
│   │   ├── comparison/          # Comparison components
│   │   ├── history/             # History components
│   │   ├── layout/              # Header, Footer
│   │   ├── ui/                  # Reusable UI components
│   │   └── Providers.tsx        # Redux provider
│   ├── config/
│   │   └── env.ts               # Environment validation
│   ├── lib/
│   │   ├── ai-providers/        # AI model adapters
│   │   ├── auth/                # Auth utilities
│   │   ├── db/                  # Prisma client
│   │   ├── services/            # Business logic
│   │   └── utils/               # Shared utilities
│   ├── store/
│   │   ├── api/                 # RTK Query API slices
│   │   ├── slices/              # Redux slices
│   │   ├── store.ts             # Store configuration
│   │   └── hooks.ts             # Typed hooks
│   ├── types/                   # TypeScript types
│   ├── middleware.ts            # Next.js middleware
│   └── __tests__/               # Unit tests
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── playwright.config.ts
├── jest.config.js
└── vercel.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or a Prisma Postgres cloud database)
- Vercel AI Gateway API key

### 1. Install Dependencies

```bash
cd ai-model-playground
npm install
```

### 2. Configure Environment

Copy the sample environment file and fill in your values:

```bash
cp .env.sample .env
```

Required environment variables:

```env
# Database (Prisma Postgres or any PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# JWT Secrets (generate unique random strings)
JWT_ACCESS_SECRET="your-access-secret-key-min-16-chars"
JWT_REFRESH_SECRET="your-refresh-secret-key-min-16-chars"

# Vercel AI Gateway
AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"

# App
NEXT_PUBLIC_API_URL="/api"
```

### 3. Set Up Database (Prisma Postgres)

This project uses the ESM-first `prisma-client` generator with a `prisma.config.ts` config file and the `@prisma/adapter-pg` driver adapter.

#### Key files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (models, relations, indexes) |
| `prisma.config.ts` | Prisma config — datasource URL, migration path |
| `generated/prisma/` | Auto-generated Prisma Client (gitignored) |
| `src/lib/db/prisma.ts` | Singleton PrismaClient with `PrismaPg` adapter |

#### First-time setup

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Baseline your existing database (if tables already exist)
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init

# 3. Or, if starting fresh (creates tables from scratch)
npx prisma migrate dev --name init

# 4. (Optional) Open Prisma Studio
npx prisma studio
```

#### Fresh database reset

If you need to wipe everything and start over:

```bash
npx prisma migrate reset --force
```

This drops all tables, re-applies every migration, and regenerates the client.

---

### Prisma Migrations Guide

All schema changes must go through migrations — never use `prisma db push` in a team workflow.

#### Creating a Migration

After editing `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name describe-your-change
```

Creates a new SQL file in `prisma/migrations/<timestamp>_describe-your-change/migration.sql`, applies it, and regenerates the client.

#### Applying Migrations (Production / CI)

```bash
npx prisma generate
npx prisma migrate deploy
```

Applies all pending migrations without creating new ones. Always run `prisma generate` first in CI so the client is available.

#### Rolling Back a Migration

Prisma does **not** have a built-in rollback command. To undo the last migration:

**Option A** — Create a reverse migration:

```bash
# Revert schema.prisma to the previous state
git checkout HEAD~1 -- prisma/schema.prisma

# Create a migration that undoes the change
npx prisma migrate dev --name rollback-describe-what-you-undo
```

**Option B** — Write reverse SQL manually:

```bash
# Create empty migration
npx prisma migrate dev --create-only --name rollback-change-name

# Edit the generated migration.sql with your reverse SQL
# Then apply
npx prisma migrate dev
```

#### Marking a Migration as Applied / Rolled Back

```bash
# Mark a migration as already applied (baselining)
npx prisma migrate resolve --applied <migration_name>

# Mark a migration as rolled back (after manual SQL reversal)
npx prisma migrate resolve --rolled-back <migration_name>
```

#### Introspecting an Existing Database

If you connect to a database that already has tables:

```bash
npx prisma db pull
```

This reads the live database schema and updates `prisma/schema.prisma` to match.

#### Common Commands Reference

| Command | Purpose |
|---------|---------|
| `npx prisma generate` | Generate Prisma Client from schema |
| `npx prisma migrate dev --name <name>` | Create & apply a new migration (dev) |
| `npx prisma migrate dev --create-only --name <name>` | Create migration SQL without applying |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma migrate status` | Show migration status |
| `npx prisma migrate reset --force` | Drop DB, re-apply all migrations |
| `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` | Generate SQL from schema |
| `npx prisma migrate resolve --applied <name>` | Mark migration as applied |
| `npx prisma migrate resolve --rolled-back <name>` | Mark migration as rolled back |
| `npx prisma db pull` | Introspect live database into schema |
| `npx prisma studio` | Open visual DB browser |

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Comparisons

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/comparisons` | Execute comparison (supports streaming) |
| GET | `/api/comparisons` | List saved comparisons |
| GET | `/api/comparisons/:id` | Get comparison details |
| DELETE | `/api/comparisons/:id` | Delete a comparison |

## Architecture Decisions

### Why SSE over WebSockets?
Server-Sent Events are used for streaming because they work natively with Vercel's serverless/Lambda architecture without requiring persistent connections. WebSocket support on Vercel requires additional infrastructure.

### Why Redux Toolkit + RTK Query?
RTK Query provides built-in cache management, request deduplication, and optimistic updates with minimal boilerplate. Redux Toolkit manages complex streaming state (concurrent model responses, sync scroll, error states) in a predictable way.

### Why Cookie-based JWT?
httpOnly cookies prevent XSS attacks from accessing tokens. The dual-token pattern (short-lived access + long-lived refresh) balances security with user experience. The `baseQueryWithReauth` pattern automatically refreshes expired tokens.

### Why Adapter Pattern for AI Providers?
Each AI provider has a unique SDK and API shape. The adapter pattern normalizes them behind a common interface (`AIAdapter`), making it trivial to add new providers or swap implementations without touching business logic.

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run Playwright e2e tests
```

## Deployment (Vercel)

1. Push your code to a Git repository
2. Import the project in [Vercel](https://vercel.com)
3. Set all environment variables in Vercel's dashboard
4. Vercel will auto-detect Next.js and deploy

The `vercel.json` configures the deployment region to `iad1` for optimal US East Coast latency.

## Testing

### Unit Tests

```bash
npm run test
```

Tests cover:
- JWT token generation and verification
- Password hashing and verification
- Zod validation schemas
- Rate limiter functionality
- UI component rendering

### E2E Tests

```bash
npm run test:e2e
```

Tests cover:
- Authentication flow (login, register, redirect)
- Comparison page interaction
- Navigation and routing

## Future Improvements

- Add dark mode toggle
- Support for additional AI models (Gemini, Llama)
- Comparison sharing via unique URLs
- Export comparisons as PDF/Markdown
- User preference settings (default models, temperature)
- Token usage analytics dashboard
- Prompt templates library

## License

MIT
