# ReelForge (`video-editor-ai`)

AI-assisted video editor built with Next.js, Remotion, and a multi-provider LLM agent. ReelForge lets users create/edit short-form videos (for example, Instagram Reels) through a timeline UI and a chat copilot that can mutate project JSON, fetch/generate media, and manage versions.

## What this app does

- Authenticated, project-based video editing workflow.
- Fullscreen editor with:
  - Real-time video preview (Remotion player)
  - Sidebar chat agent
  - Session history
  - Version history
  - Model/provider settings
- AI agent endpoint that streams server-sent events (SSE) as it reasons and executes tools.
- PostgreSQL persistence for users, projects, chat, versions, assets, provider configs, and AI sessions/events.

---

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling/UI:** Tailwind CSS v4, Radix UI primitives, Lucide icons
- **Video runtime:** Remotion (`@remotion/player`, `remotion`)
- **AI providers:** Anthropic, OpenAI, Gemini, GitHub Copilot (device flow)
- **ORM/DB:** Drizzle ORM + Postgres (`postgres` driver)
- **Auth:** `better-auth` (email/password)
- **State:** Zustand stores for editor/chat/model/session state

---

## High-level architecture

```text
Browser UI (App Router pages + client components)
  ├─ Dashboard (/dashboard) -> Project CRUD
  ├─ Editor (/editor/[projectId])
  │   ├─ Remotion preview
  │   ├─ Chat sidebar (agent orchestration)
  │   ├─ Session/version panels
  │   └─ Settings panel (providers/models)
  └─ Auth pages (login/signup)

API Routes (/api/*)
  ├─ /api/auth/*      -> better-auth handlers + Copilot device flow route
  ├─ /api/projects    -> list/create
  ├─ /api/projects/:id -> read/update/delete
  ├─ /api/agent       -> SSE agent stream, tool execution, session logging
  ├─ /api/providers   -> provider config + model availability
  └─ /api/models      -> model catalogs (live/static)

Data Layer (src/lib/storage)
  ├─ Drizzle schema + DB client
  ├─ Project/session/provider stores
  └─ S3-backed asset metadata + chat persistence

Render Layer (src/remotion)
  └─ Video schema -> visual composition/elements/animations
```

---

## Key user flows

1. **Sign up / login** with better-auth.
2. **Create a project** from dashboard (empty template or Instagram reel template).
3. **Open editor** for a project.
4. **Chat with agent** in sidebar (e.g., "add text overlay", "find stock beach clip").
5. Agent emits streamed updates, calls tools, and updates the `VideoProject` schema.
6. Project can be manually/auto saved, versioned, and revisited via session history.

---

## Project structure

```text
src/
  app/
    api/                  # Route handlers (agent, auth, projects, providers, models)
    dashboard/            # Dashboard pages/layout
    editor/[projectId]/   # Main editor page
    login/, signup/       # Auth pages
  agent/
    tools/                # Agent tool definitions + executors
    skills/               # Higher-level creative skills
    mcp/                  # MCP manager/config
    prompts/              # System prompt
  components/
    editor/               # Editor shell + preview + version history
    sidebar/              # Chat/sessions/settings/versions side panels
    chat/                 # Chat widgets
    dashboard/            # Project cards/new project dialog
    ui/                   # Reusable UI primitives
  lib/
    auth*.ts              # better-auth server/client helpers
    schema/               # VideoProject schema + defaults + validation
    storage/              # Drizzle db schema and data stores
    models/               # Provider model registry
    copilot/              # Copilot token exchange helpers
  remotion/
    VideoComposition.tsx  # Composition entry
    elements/             # Renderable element components
    animations/           # Animation engine
  stores/                 # Zustand client state stores
```

---

## Environment variables

Copy `.env.example` to `.env.local`.

```bash
cp .env.example .env.local
```

### Required for local boot

- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- At least one agent-capable provider key (recommended: `ANTHROPIC_API_KEY`)

### Required for specific features

- `GEMINI_API_KEY`: video review tooling
- `AWS_*` + `S3_BUCKET_NAME`: asset storage/render outputs
- `FAL_KEY`, `ELEVENLABS_API_KEY`, `PEXELS_API_KEY`: optional generation/media integrations

---

## Local development

### 1) Install dependencies

```bash
npm install
```

### 2) Start Postgres

Use any local Postgres instance and update `DATABASE_URL`.

### 3) Run Drizzle migrations (if you have migration files)

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 4) Start dev server

```bash
npm run dev
```

App: <http://localhost:3000>

---

## Scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — run ESLint

---

## API overview

### `POST /api/agent`

Streams SSE events for an agent run.

Request includes:

- `message`
- `project` (full `VideoProject` JSON)
- optional `conversationHistory`, `sessionId`, `providerId`, `modelId`

Behavior:

- Authenticates user session
- Resolves provider credentials (user config first, then env fallback)
- Runs provider-specific agent path (OpenAI/Copilot/etc.)
- Logs session events and token usage
- Returns streamed events (`tool_call`, `tool_result`, `project_updated`, `done`, `error`, ...)

### `GET/POST /api/projects`

- `GET`: list current user projects
- `POST`: create project from template and create initial version

### `GET/PUT/DELETE /api/projects/:projectId`

- Ownership-checked project read/update/delete

### `GET/POST /api/providers`, `PUT/DELETE /api/providers/:providerId`

- Persist per-user provider configs, default models, enable/disable states

### `GET /api/models?provider=<id>`

- Returns provider model list (live if key/token available, static fallback)

### `POST /api/auth/copilot`

- Device flow lifecycle (`initiate`, `poll`, `disconnect`, `status`)

---

## Database schema (summary)

Core tables include:

- Auth: `users`, `sessions`, `accounts`, `verifications`
- Editor domain: `projects`, `project_versions`, `assets`, `chat_messages`, `render_jobs`
- Agent domain: `ai_sessions`, `session_events`, `provider_configs`

`projects.project_data` stores the full `VideoProject` document as JSONB.

---

## Notes for contributors

- Most domain operations are centralized in `src/lib/storage/*-store.ts`.
- Keep `VideoProject` updates schema-valid (`src/lib/schema`).
- Agent functionality is split between:
  - orchestration (`src/agent/agent-core.ts`, `src/agent/agent-openai.ts`)
  - tool contracts (`src/agent/tools/tool-definitions.ts`)
  - tool execution (`src/agent/tools/tool-executor.ts`)
- For UI changes in editor sidebars, inspect corresponding Zustand stores in `src/stores/*`.

---

## Deployment considerations

- Set all required env vars in deployment target.
- Ensure Postgres + object storage are reachable from runtime.
- Next.js API routes in this app are expected to run on Node.js runtime (agent route explicitly sets `runtime = "nodejs"`).
