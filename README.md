# AI Model Playground

A full-stack application for comparing responses from multiple large language models side-by-side in real time. Submit a prompt once and watch GPT-4o, Claude Sonnet, and Grok stream their answers simultaneously into a three-panel interface.

**Live demo:** deployed to Vercel

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Technology Decisions](#technology-decisions)
5. [Streaming Architecture Deep-Dive](#streaming-architecture-deep-dive)
6. [Redux Strategy — Hydrating at Stream End](#redux-strategy--hydrating-at-stream-end)
7. [Challenges and Tradeoffs](#challenges-and-tradeoffs)
8. [Future Improvements](#future-improvements)

---

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma              # Database models: User, Comparison, ModelResponse, RefreshToken
│   └── migrations/                # SQL migration history
├── src/
│   ├── app/                       # Next.js App Router pages and API routes
│   │   ├── api/
│   │   │   ├── auth/              # login, logout, register, refresh, /me
│   │   │   └── comparisons/       # POST (stream), GET list, GET/DELETE by ID
│   │   ├── compare/               # /compare and /compare/[id] pages
│   │   ├── history/               # Saved comparisons list (auth-protected)
│   │   ├── login/
│   │   └── register/
│   ├── components/
│   │   ├── auth/                  # LoginForm, RegisterForm, ProtectedRoute
│   │   ├── comparison/            # Core UI — panels, streaming, markdown
│   │   │   ├── hooks/             # useComparisonStream, useChatHistory,
│   │   │   │                      #   useComparisonShare, useSnapshotRestore
│   │   │   ├── ComparisonContainer.tsx  # Smart root — owns all state and logic
│   │   │   ├── ComparisonView.tsx       # Presentational — prompt bubble + 3 panels
│   │   │   ├── ModelPanel.tsx           # Single model card
│   │   │   ├── StreamingResponse.tsx    # Raw text during stream, Markdown after
│   │   │   ├── MarkdownRenderer.tsx     # react-markdown + syntax highlighting
│   │   │   ├── MetricsDisplay.tsx       # Tokens, cost, response time
│   │   │   ├── PromptInput.tsx          # Textarea + submit
│   │   │   ├── CodeBlock.tsx            # Syntax-highlighted code blocks
│   │   │   └── ToolCallBlock.tsx        # Tool-call visualization
│   │   ├── history/               # HistoryContainer, HistoryList, ComparisonCard
│   │   ├── layout/                # Header, Footer
│   │   └── ui/                    # Button, Card, Input, Spinner, ErrorBoundary
│   ├── config/
│   │   ├── api-endpoints.ts       # Centralised API URL constants
│   │   └── env.ts                 # Zod-validated environment schema
│   ├── lib/
│   │   ├── ai-providers/
│   │   │   ├── base.ts            # Abstract adapter interface + stream event types
│   │   │   ├── vercel-gateway.ts  # Vercel AI Gateway adapter (all models)
│   │   │   └── index.ts           # Factory: getAdapter(modelId)
│   │   ├── auth/
│   │   │   ├── jwt.ts             # Access + refresh token sign/verify
│   │   │   ├── password.ts        # bcrypt hash/compare
│   │   │   └── validation.ts      # Zod schemas for auth and comparison inputs
│   │   ├── db/
│   │   │   └── prisma.ts          # Singleton Prisma client with PrismaPg adapter
│   │   ├── services/
│   │   │   └── comparison.service.ts  # SSE fan-out, DB writes, retry/backoff
│   │   └── utils/
│   │       ├── api-error-handler.ts
│   │       ├── api-response.ts
│   │       ├── constants.ts       # Model display names, provider colours
│   │       ├── errors.ts          # extractErrorMessage utility
│   │       └── rate-limit.ts      # LRU-cache based rate limiter
│   ├── middleware.ts              # Edge middleware: auth guards + cache headers
│   ├── store/
│   │   ├── store.ts               # Redux store with redux-persist
│   │   ├── hooks.ts               # useAppSelector, useAppDispatch
│   │   ├── api/
│   │   │   ├── baseApi.ts         # RTK Query base with cookie credentials
│   │   │   ├── authApi.ts         # auth RTK Query endpoints
│   │   │   └── comparisonApi.ts   # list, get, delete RTK Query endpoints
│   │   └── slices/
│   │       ├── authSlice.ts       # Authenticated user state
│   │       └── comparisonSlice.ts # Streaming state machine per model
│   └── types/
│       ├── api.ts
│       ├── auth.ts
│       ├── comparison.ts
│       ├── enums.ts               # ModelStatus, SSEEventType, RateLimitTier …
│       └── models.ts              # DEFAULT_MODELS, MODEL_CONFIGS, token limits
├── next.config.ts
├── tailwind.config.ts
├── prisma.config.ts
└── vercel.json
```

---

## Architecture

### High-Level Flow

```
Browser
  │
  ▼
Next.js App Router (Edge Middleware)
  │  — httpOnly cookie auth check on /history
  │  — Cache-Control: no-store on all pages
  │
  ├─ Page routes    /compare, /compare/[id], /history, /login, /register
  │
  └─ API routes     /api/*
       │
       ├─ /api/auth/*             JWT issue / refresh / revoke via httpOnly cookies
       │
       └─ /api/comparisons        POST → SSE stream
            │
            └─ ComparisonService
                 │
                 ├─ Prisma (PostgreSQL via PrismaPg adapter)
                 │    Comparison + ModelResponse rows created / updated
                 │
                 └─ Vercel AI Gateway  ← single API key, all providers
                      ├─ openai/gpt-4o
                      ├─ anthropic/claude-sonnet-4-5
                      └─ xai/grok-3-mini
```

### Frontend State Layers

| Layer | Technology | Responsibility |
|---|---|---|
| Server state | RTK Query | History list, single comparison fetch, delete |
| App state | Redux Toolkit | Auth user, model status / metrics / errors, prompt |
| Streaming text | `useRef` + `useState` | Live chunks during active stream — never enters Redux |
| Session persistence | `redux-persist` | Auth slice survives page refresh |
| Crash recovery | `localStorage` | In-flight snapshot restored on hard reload |

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or a Prisma Postgres / Neon connection string)
- A Vercel AI Gateway API key

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-model-playground
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# PostgreSQL — used by Prisma migrations and Prisma Client
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# For local dev with PrismaPg adapter (same value as above for a local DB)
# In Vercel Postgres: use the postgresql:// direct URL here
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/dbname"

# JWT secrets — generate with: openssl rand -base64 32
JWT_ACCESS_SECRET="your-access-secret-at-least-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-at-least-32-chars"

# Vercel AI Gateway key (provided by the hiring team)
AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"

# Optional — defaults to /api
NEXT_PUBLIC_API_URL="/api"
```

> **Vercel Postgres (Prisma Postgres):**
> Set `DATABASE_URL` to the `prisma+postgres://` Accelerate URL and
> `DIRECT_DATABASE_URL` to the plain `postgresql://` connection string.
> The `PrismaPg` adapter in `src/lib/db/prisma.ts` reads `DIRECT_DATABASE_URL`
> first so direct queries and migrations work, while Accelerate handles
> connection pooling in production.

### 3. Database setup

```bash
# Apply all migrations to the target database
npx prisma migrate deploy

# (Dev only) create a new migration after changing schema.prisma
npx prisma migrate dev --name <descriptive-name>

# Generate Prisma Client (also runs automatically on npm install via postinstall)
npx prisma generate

# Optional: open the visual data browser
npx prisma studio
```

### 4. Run in development

```bash
npm run dev
# → http://localhost:3000
```

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set all variables from `.env.local` in your Vercel project under
**Settings → Environment Variables**. The `vercel-build` script
(`prisma generate && next build`) runs automatically on every deploy.

### API Endpoints

#### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in, issues httpOnly cookies |
| POST | `/api/auth/logout` | Revoke tokens, clear cookies |
| POST | `/api/auth/refresh` | Rotate access token using refresh cookie |
| GET | `/api/auth/me` | Return the authenticated user object |

#### Comparisons

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/comparisons` | Execute comparison (SSE stream) |
| GET | `/api/comparisons` | List saved comparisons (paginated) |
| GET | `/api/comparisons/:id` | Fetch single comparison with all responses |
| DELETE | `/api/comparisons/:id` | Delete a comparison |

---

## Technology Decisions

### Next.js 15 (App Router)

The App Router co-locates server components, route handlers, and layouts without a separate Express server. Route handlers run as Vercel serverless functions — horizontal scaling is automatic. Edge Middleware enforces auth before a React tree is rendered, eliminating client-side redirect flicker on protected routes.

### Vercel AI SDK + AI Gateway

All model requests route through a single Vercel AI Gateway API key:

- **One credential** to manage regardless of how many providers are added.
- **Unified error surface** — transport errors, rate limits, and content-filter events come back in a consistent shape that maps to the `GatewayError.category` field used for UI error classification.
- **`streamText()`** from the AI SDK returns an `AsyncIterable` of text deltas, giving the service layer a clean iterator to forward as SSE events.

Adding a new model is a one-liner in `src/types/models.ts` — no additional API key or adapter is required.

### PostgreSQL + Prisma + PrismaPg Adapter

Prisma provides type-safe query building and migration management. The `@prisma/adapter-pg` package is used instead of the default native query-engine binary because Vercel's serverless runtime cannot execute native binaries at request time. The `PrismaPg` adapter connects via a standard `pg.Pool`, compatible with Vercel Postgres, Neon, Supabase, and any standard PostgreSQL host.

### Redux Toolkit + RTK Query

Redux Toolkit was chosen over React Context or Zustand for:

- **DevTools** — the Redux DevTools extension makes SSE event sequences and model status transitions easy to debug and replay.
- **Predictable state machine** — each model has a typed `ModelStatus` (`IDLE → PENDING → STREAMING → COMPLETED | ERROR | INTERRUPTED`). Immer reducers make every transition explicit and auditable.
- **RTK Query** — handles server-state (history list, single comparison) with automatic caching, deduplication, and loading states, eliminating manual `useEffect` fetch logic.

### Tailwind CSS v4

Tailwind v4 uses a single CSS file and a PostCSS plugin instead of a `tailwind.config.js` content scan. The `@theme` block in `globals.css` defines design tokens (colors, shadows, animations) as CSS custom properties that are shared across component classes and inline `style` props.

### Zod for Runtime Validation

Every API boundary — env vars, request bodies, auth inputs — is validated with Zod schemas before any business logic runs. The environment schema in `src/config/env.ts` validates at server startup, so a missing secret causes a loud crash rather than a silent runtime failure.

---

## Streaming Architecture Deep-Dive

### Server Side: SSE over a ReadableStream

`POST /api/comparisons` returns a `ReadableStream` with `Content-Type: text/event-stream`. `ComparisonService` fans out to all requested models in parallel using `Promise.allSettled`. Each model's `streamText()` async iterator pushes events through a shared `TransformStream`:

```
COMPARISON_STARTED  { comparisonId, models }
MODEL_STARTED       { modelId, provider }
MODEL_CHUNK         { modelId, chunk }          ← repeated for every text delta
MODEL_TOOL_CALL     { modelId, toolCall }        ← when the model invokes a tool
MODEL_COMPLETED     { modelId, metrics, finishReason }
MODEL_ERROR         { modelId, error, category }
ERROR               { error }                   ← stream-level fatal error
```

Events from different models interleave naturally — the client identifies them by `modelId`. Errors are categorised by `GatewayError.category` (`rate-limit`, `capability`, `auth`, `content-filter`, `timeout`, `server`, `unknown`) so the frontend renders context-aware recovery UI. An exponential-backoff retry loop (`MAX_RETRIES = 2`, base 2 s with jitter) runs per model before `MODEL_ERROR` is emitted.

### Client Side: Local Ref Buffer → Throttled setState → Redux at End

This is the central performance decision in the entire frontend.

**The problem with the naive approach:**

```
chunk arrives → dispatch(appendChunk) → Immer reducer
              → React re-render across all subscribers
              → MarkdownRenderer(tokenize(fullText))   ← O(n) sync parse every frame
```

For a 2 000-token response with markdown tables this creates hundreds of synchronous `tokenize()` calls per second on the main thread, freezing scroll, input, and the rest of the UI.

**The solution — three distinct layers:**

```
Layer 1: modelAccumulatorRef          (plain useRef — zero React involvement)
         ↕ string concat on every chunk
Layer 2: streamingTextsRef + flushStreamingDisplay()   (throttled 50 ms trailing)
         ↕ setStreamingTexts({ ...ref })  → React re-render ≤ 20 fps
         ↕ <pre className="whitespace-pre-wrap">{streamingText}</pre>
              NO markdown parsing during streaming
         ↕ on MODEL_COMPLETED / MODEL_ERROR
Layer 3: dispatch(modelCompleted({ responseText: fullText }))  → Redux
         ↕ status → COMPLETED → unmount <pre>, mount <MarkdownRenderer>
              tokenize() runs exactly ONCE per model
```

**Layer 1 — `modelAccumulatorRef`:**
A plain `useRef` object. String concatenation on every chunk is O(n) but has no Immer proxy, no subscriber notification, and no render cost — fast enough for even the most verbose models.

**Layer 2 — `streamingTextsRef` + throttled setState:**
A second ref mirrors the full accumulated text per model. `flushStreamingDisplay()` (a `useThrottledCallback` at 50 ms trailing) copies the ref snapshot into React state at most 20 times per second. `ModelPanel` renders `streamingText` through `<pre className="whitespace-pre-wrap">` — **zero markdown parsing while tokens arrive**.

**Layer 3 — Redux at stream end:**
When `MODEL_COMPLETED` or `MODEL_ERROR` fires, the full accumulated text is dispatched once as `responseText`. The panel transitions to `COMPLETED`, unmounts the `<pre>`, and mounts `<MarkdownRenderer>`. The expensive parse runs exactly once, after the user is ready to read.

**Result:** the UI stays interactive throughout streaming. The main thread is never blocked by markdown parsing on the hot chunk path.

---

## Redux Strategy — Hydrating at Stream End

`comparisonSlice.ts` treats streaming text as an implementation detail that does not belong in the store. The slice never receives individual chunks.

**What Redux owns:**

| Field | When set |
|---|---|
| `ModelStreamState.status` | On every SSE lifecycle event |
| `ModelStreamState.responseText` | Once on `modelCompleted` / `modelError` — full text in payload |
| `ModelStreamState.metrics` | On `modelCompleted` |
| `ModelStreamState.errorMessage` / `errorCategory` | On `modelError` |
| `ModelStreamState.toolCalls` | On each `MODEL_TOOL_CALL` |
| `ComparisonState.comparisonId` | On `COMPARISON_STARTED` (real UUID from backend) |
| `ComparisonState.isLoading` | On `startComparison` / `comparisonCompleted` |

**What Redux does not own (by design):**

- Individual text chunks during streaming
- Intermediate accumulated text before completion

This means the Redux DevTools timeline stays clean — one action per meaningful lifecycle transition rather than hundreds of `appendChunk` noise events.

**Snapshot / crash recovery:**

A `useEffect` in `ComparisonContainer` writes a JSON snapshot to `localStorage` whenever any model is `STREAMING` or `PENDING`. Before saving it merges the current `streamingTexts` (local React state) into the snapshot so partial responses survive a hard reload. On mount, `restoreFromSnapshot` rehydrates Redux with `INTERRUPTED` status for any mid-stream model, letting the user see what arrived before the interruption.

---

## Challenges and Tradeoffs

### 1. SSE Interleaving vs. Per-Model Connections

**Challenge:** One SSE connection per model would mean N round trips, N loading states to coordinate, and N abort controllers.

**Decision:** One SSE stream for all models with `modelId` on every event. The server fans out internally; a single `fetch` abort cancels the entire comparison.

**Tradeoff:** Streaming cannot begin until the server has connected to all models. In practice this is < 500 ms and the upside — unified abort, single HTTP connection, no per-provider CORS complexity — is well worth it.

### 2. Markdown Rendering During Streaming

**Challenge:** Running `<MarkdownRenderer>` on every chunk caused main-thread blockage that froze scroll and input.

**Decision:** Show raw `<pre>` text during streaming; switch to `<MarkdownRenderer>` once on completion.

**Tradeoff:** During streaming the response looks unstyled — code blocks are plain text, tables are raw pipe syntax. This is a deliberate UX tradeoff: an interactive UI with plain text is better than a frozen UI with formatted markdown. Most users wait for completion before reading anyway.

### 3. Redux for Streaming State

**Challenge:** Dispatching `appendChunk` to Redux on every chunk caused Immer overhead and triggered re-renders across all `useSelector` subscribers.

**Decision:** Keep Redux for metadata and final state only. Use a plain ref for the hot chunk path and a 50 ms throttled `setState` for display.

**Tradeoff:** Streaming text is not visible in the Redux DevTools during streaming. This is acceptable — the interesting debugging surface is the status transitions and final `responseText`, both of which are in Redux. The streamed text itself is transient.

### 4. Anonymous vs. Authenticated History

**Challenge:** Anonymous users should be able to use the app without registering, and their history should survive a page refresh.

**Decision:** Anonymous comparisons go to `localStorage` (max 20 entries). On login, anonymous history is preserved alongside the server history and deduplicated by `comparison_id`. Anonymous IDs are prefixed `anon-` to distinguish them from real database UUIDs.

**Tradeoff:** Anonymous history is device-local — it does not sync across devices and is lost if storage is cleared. This is communicated with a "Sign in to save comparisons" tip in the UI.

### 5. PrismaPg Adapter on Serverless

**Challenge:** Prisma's default query engine is a native binary that cannot run in Vercel's serverless runtime.

**Decision:** Use `@prisma/adapter-pg` which communicates via the Node.js `pg` driver over TCP. `DIRECT_DATABASE_URL` (plain `postgresql://`) bypasses Accelerate for migrations and local dev; `DATABASE_URL` (Accelerate `prisma+postgres://`) handles production pooling.

**Tradeoff:** Two environment variables to manage and document. The Zod env schema crashes the server on startup if either is missing, making misconfiguration loud and obvious.

### 6. JWT in httpOnly Cookies

**Decision:** Access tokens (15 min TTL) and refresh tokens (7 day TTL) live in `httpOnly`, `Secure`, `SameSite=Strict` cookies — never in `localStorage` or Redux state.

**Tradeoff:** Requires the API to be same-origin with the frontend, which is satisfied by Next.js route handlers. The benefit — tokens are inaccessible to `document.cookie` and immune to XSS exfiltration — outweighs the setup cost. The `baseQueryWithReauth` wrapper in RTK Query automatically retries requests after a 401 by calling `/api/auth/refresh` and replaying the original query, so token expiry is transparent to the user.

---

## Future Improvements

### Per-Model Regeneration UI

The service layer already supports regenerating a single model within an existing comparison (`stream=true, comparisonId=X, models=[modelId]`). Exposing this as a **Regenerate** button per panel would let users re-run a model that errored or produced a poor response without resubmitting the entire prompt.

### Handling Non-Text Model Outputs

Some models can return structured data beyond plain text. Not yet surfaced in the UI:

- **Structured JSON output** — collapsible JSON viewer with key highlighting
- **Image URLs** from image-capable models — inline `<img>` rendering
- **Reasoning tokens** (e.g., Claude extended thinking) — show/hide collapsible section
- **Citation annotations** — linked footnotes for retrieval-augmented models

### Progressive Markdown Rendering During Streaming

The current approach (raw `<pre>` → full `<MarkdownRenderer>` on complete) could be refined:

1. Buffer chunks until a complete block delimiter is detected (blank line, closing triple-backtick).
2. Render completed blocks as markdown incrementally.
3. Keep the current incomplete block as plain text.

This gives rich formatting for the already-finished portions of the response while the final block is still arriving, without the tokenizer blocking on incomplete syntax.

### Prompt Templates and Per-Model Configuration

Allow users to save reusable prompt templates and set per-model parameters (temperature, max tokens, system prompt) before submitting. The API already accepts a `models` array — extending it to accept `{ modelId, options }` tuples would enable this without breaking existing clients.

### Shareable Comparison Links

Generate a public read-only URL (`/share/[token]`) for any completed comparison. Requires a `shareToken` column on the `Comparison` model and a public route handler that bypasses the JWT auth check.

### Persistent Rate Limiting

The in-process LRU cache resets on cold starts and does not share state across serverless instances. A Redis-backed sliding window (e.g., Upstash Redis) keyed by user ID or IP would be consistent across all instances and deploys.

### Accessibility

- `aria-live="polite"` on streaming panels so screen readers announce completion.
- Keyboard navigation for the history sidebar.
- High-contrast theme toggle.
- Focus management after prompt submission.

### Test Coverage

- Unit tests for `ComparisonService` with a mock gateway adapter.
- Integration tests for API routes using `vitest` + `msw`.
- Component tests for `ModelPanel` status machine transitions using React Testing Library.

### Cost Tracking Dashboard

The `estimated_cost` field is already persisted per `ModelResponse`. A simple dashboard aggregating spend by model, date range, and user would help teams track API costs against budgets.
