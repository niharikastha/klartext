# Klartext

**Understand German bureaucracy in your own language.**

Klartext takes a German official document — a rental contract, a tax assessment, a residence-permit letter — and turns it into something you can act on: a plain-language summary in your language, a risk assessment, the key facts pulled out as data, and every deadline extracted as a dated task.

Built for the situation every immigrant in Germany knows: a letter arrives, it is in formal *Amtsdeutsch*, it has a deadline in it somewhere, and machine-translating it word for word does not tell you what you are supposed to *do*.

---

## What it does

**Upload → analyse → act.** Drop in a PDF, photo, or text file and the analysis runs in the background:

| | |
| --- | --- |
| **Translates and explains** | Plain-language summary in any of **16 languages**, alongside a full translation — not a literal one, an explanatory one |
| **Flags risk** | Each document is rated `low` / `medium` / `high` with a written reason, so a routine confirmation and a payment demand do not look alike |
| **Extracts the facts** | Reference numbers, amounts, dates and names pulled into structured key–value data |
| **Finds every deadline** | Action items with a title, description, due date, priority (`low`→`urgent`) and category (`deadline`, `payment`, `appointment`, `document`, `other`) |
| **Puts dates on a calendar** | A month view that merges extracted deadlines with your own events, so nothing sits buried inside a document |
| **Answers follow-up questions** | An AI chat that can search across *all* your documents, not just the one on screen |
| **Re-translates on demand** | Switch language after the fact without re-analysing, and keep a revision history you can restore from |
| **Tags and organises** | User-defined tags across documents |

### The chat is agentic, not a text box

"Ask AI" runs a tool-calling loop (up to **4 rounds**) with **5 tools** the model can call on its own — `list_my_documents`, `list_my_action_items`, `search_documents`, `get_document_details`, `get_full_document_text`. So *"do I have anything about my health insurance, and when is it due?"* becomes: search → open the match → read the deadline → answer, with the documents it used cited back as references.

Responses stream over **Server-Sent Events**, and each tool call is pushed to the UI as it happens, so the wait is visible rather than blank.

---

## Screenshots

<!-- Add 3–4 screenshots here: dashboard, a document detail view, the calendar, Ask AI mid-tool-call. -->

---

## How it works

```
 upload (multer, ≤10MB)
        │  .pdf .jpg .jpeg .png .webp .txt
        ▼
 documents table ─── analysisStatus: pending
        │
        │  fire-and-forget: the HTTP request returns immediately,
        │  the UI polls for status
        ▼
 DocumentAnalysisAgent
        │  pdf-parse for text PDFs, vision for images
        │  one structured call → summary, type, risk, extracted data,
        │                        translation, action items
        │  withRetry: 3 retries, exponential backoff on 503,
        │             honours the 429 retry-after hint (≤65s)
        ▼
 analysis_results + action_items ─── analysisStatus: completed | failed
        │
        ├──► deadlines surface on the calendar
        └──► the chat's tools can read all of it
```

### Two AI providers, swappable by config

`AI_PROVIDER` decides who does what, and the choice is logged at boot:

| `AI_PROVIDER` | Document analysis | Chat |
| --- | --- | --- |
| *(empty — default)* | Gemini | Groq |
| `groq` | Groq | Groq |

Gemini handles analysis by default because it reads document *images* directly; Groq handles chat because it is fast enough to stream and supports the tool-calling loop. Neither choice is baked into the call sites — `DocumentAnalysisAgent` is the only file that knows which provider is in play.

---

## Stack

| | |
| --- | --- |
| **Backend** | NestJS 10, TypeORM 0.3, PostgreSQL 16, Passport JWT, Swagger |
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind, shadcn/ui, Zustand, Framer Motion |
| **AI** | Google Gemini (`@google/generative-ai`), Groq (`groq-sdk`) |
| **Parsing** | `pdf-parse` for text PDFs, model vision for scans and photos |
| **Monorepo** | npm workspaces + Turborepo, shared types in `packages/shared` |

---

## Getting started

**Prerequisites:** Node 20+, Docker, and an API key for at least one provider — [Gemini](https://aistudio.google.com/apikey) (free tier) and/or [Groq](https://console.groq.com/keys) (free tier).

```bash
git clone <this-repo> && cd klartext
cp .env.example .env     # then fill it in — see the table below
npm install
npm run dev              # starts Postgres in Docker, then the API and the web app
```

| | |
| --- | --- |
| Web app | http://localhost:3004 |
| API | http://localhost:4002/api |
| Swagger | http://localhost:4002/api/docs |

Register an account in the UI, set your native language in **Profile**, then upload one of the files in [`sample-documents/`](sample-documents) — six real-world German document types (Anmeldung, Arbeitsvertrag, Aufenthaltstitel, Krankenversicherung, Mietvertrag, Steuerbescheid) are checked in so you can try it without hunting for a document of your own.

No migration step: TypeORM runs with `synchronize: true` outside production, so the schema is created on first boot.

### Environment

All of it lives in **one `.env` at the repo root** — the API reads it via `envFilePath: '../../.env'`, and Next picks up `NEXT_PUBLIC_*` from the same file.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://klartext:klartext_secret@localhost:5433/klartext_db` — **port 5433**, which is what `docker-compose.yml` publishes |
| `JWT_SECRET` | any long random string |
| `GEMINI_API_KEY` | required unless `AI_PROVIDER=groq` |
| `GROQ_API_KEY` | required for chat in every mode |
| `GROQ_MODEL` | optional; defaults to `qwen/qwen3.6-27b` |
| `AI_PROVIDER` | empty for Gemini analysis + Groq chat, or `groq` for both |
| `FRONTEND_URL` | `http://localhost:3004` — this is the CORS allowlist |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4002` |

The two URL variables are the ones worth double-checking. `FRONTEND_URL` is passed straight to `enableCors`, so a wrong port there fails as a browser CORS error rather than a server error, and `NEXT_PUBLIC_API_URL` is inlined into the frontend bundle at build time — changing it needs a rebuild, not a restart.

---

## API

Every route is under `/api` and, apart from `auth/*`, behind a JWT bearer token. Full schema at `/api/docs`.

| Group | Routes |
| --- | --- |
| `auth` | `POST login`, `register`, `refresh`, `forgot-password`, `reset-password` |
| `documents` | `POST upload` · `GET /` · `GET :id` · `DELETE :id` |
| `analysis` | `POST :id/retranslate` · `POST :id/reanalyze` · `GET :id/translations` · `GET :id/revisions` · `POST :id/revisions/:revisionId/restore` · `POST :id/chat` |
| `action-items` | `POST /` · `PATCH :id` · `PATCH :id/complete` · `PATCH :id/uncomplete` · `PATCH :id/deadline` · `DELETE :id` |
| `calendar-events` | `GET /` · `POST /` · `PATCH :id` · `DELETE :id` |
| `chat-sessions` | `GET /` · `POST /` · `GET :id` · `PATCH :id` · `DELETE :id` · `POST :id/messages` (SSE) · `POST :id/follow-ups` |
| `tags` | `GET /` · `POST /` · `PATCH :id` · `DELETE :id` · `GET document/:documentId` · `PUT document/:documentId` |
| `users` | `GET me` · `PATCH me` · `POST me/avatar` · `POST me/password` |

---

## Project structure

```
apps/
  api/                     NestJS
    src/
      analysis/            the AI layer
        agents/document-analysis.agent.ts   ← both providers + retry live here
      documents/           upload, multer config, listing
      action-items/        extracted tasks
      calendar/            user-created events
      chat/                tool-calling loop + SSE streaming
      tags/  users/  auth/
    uploads/               uploaded files (gitignored)
  web/                     Next.js 14 App Router
    src/app/(auth)/        login, register, password reset
    src/app/(dashboard)/   dashboard, upload, documents, action-items,
                           calendar, ask-ai, profile
packages/
  shared/                  types shared by both apps
sample-documents/          six German documents to test with
```

---

## Known gaps

This is a working portfolio project, not a hosted service. The shortfalls are deliberate and known rather than discovered later:

- **Password reset has no mailer.** `forgotPassword` generates a hashed, 1-hour token and returns the reset URL *in the HTTP response* so the flow is testable in development. The token handling is real; the delivery is not. Wiring an SMTP provider is the whole of the remaining work — and the response must stop including the URL at the same time.
- **Uploads are served as static files.** `/uploads` is mounted without an auth check, so a document is protected only by its UUID filename. These are people's tax assessments and rental contracts; a real deployment needs the file streamed through a guarded route that verifies ownership.
- **Rate limiting is configured but not applied.** `ThrottlerModule` is registered at 20 requests/60s, but no `ThrottlerGuard` is attached, so nothing is enforced yet.
- **No migrations.** `synchronize: true` is convenient in development and destructive in production; a deployment needs TypeORM migrations and `synchronize: false`.
- **Postgres is published on all interfaces.** `docker-compose.yml` maps `5433:5432` with a default password. Fine on a laptop behind a router, not fine on a public host — bind it to `127.0.0.1`.
- **No tests.** Manual testing against `sample-documents/` only.
- **Analysis is fire-and-forget.** A server restart mid-analysis leaves a document stuck on `pending` with nothing to retry it; a real job queue would fix both.

---

## Why "Klartext"

German for *plain language* — literally "clear text". It is what you ask for when someone is being needlessly official at you.
