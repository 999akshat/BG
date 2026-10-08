# BharatGuide-AI

Turn any instruction document into clear, numbered steps translated into **Hindi,
Tamil, Telugu and Bengali**, and generate a short 3D animated video for each step.

This repository is fully self-contained: it runs on standard open tooling plus
your own Supabase project and your own AI provider. There is no dependency on any
low-code or hosted app builder.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Radix UI, Lucide icons |
| Framework | TanStack Start (SSR + typed server functions), Vite |
| Language | TypeScript (strict) |
| Database / Auth / Storage | Supabase (PostgreSQL, Row Level Security, Auth, Storage) |
| Migrations | Drizzle Kit (`drizzle/`) |
| AI (text + translation) | Any OpenAI-compatible chat-completions endpoint |
| AI (3D step videos) | Any video-generation API exposing async `/videos` jobs |
| PDF text extraction | pdfjs-dist |
| Quality | ESLint, Prettier |

## Getting started

```sh
cp .env.example .env      # fill in your own credentials
bun install               # or: npm install
bun run dev               # http://localhost:8080
```

Scripts: `dev`, `build`, `preview`, `lint`, `format`.

## Environment variables

See `.env.example`. Summary:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server side.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — browser side.
- `AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL` — text/translation model.
- `AI_VIDEO_BASE_URL`, `AI_VIDEO_API_KEY`, `AI_VIDEO_MODEL` — step-video model.
- `DB_MIGRATION_URL` — direct Postgres URL used by Drizzle migrations.
- `CRON_SECRET` — bearer secret for scheduled endpoints (optional).

Never commit `.env`. Only `VITE_*` values ever reach the browser.

## Backend setup (Supabase)

1. Create a project, then apply the SQL in `drizzle/migrations/` (in order) with
   `bunx drizzle-kit migrate` or the SQL editor.
2. Keep Row Level Security enabled — every row is scoped to `auth.uid()`.
3. Create a **private** storage bucket named `generated-videos`; the app serves
   videos through short-lived signed URLs.
4. Enable Email auth, and Google auth if you want the Google button: add your
   OAuth client ID/secret and your site URL as a redirect URL.

## Project structure

```
src/
  routes/                  file-based routes (/, /auth, /library, /document/$id)
  components/              app shell, step card, UI primitives
  lib/
    documents.functions.ts server functions: create document, steps, translation
    video.functions.ts     server functions: 3D video generate / poll / store
    ai.server.ts           provider-neutral AI calls (text + video)
    pdf-text.ts            PDF -> text extraction
    languages.ts           Hindi / Tamil / Telugu / Bengali config
  integrations/supabase/   client, admin client, auth middleware, generated types
drizzle/                   schema + SQL migrations
```

## How it works

1. **Input** — paste text or upload a PDF; text is extracted in the browser.
2. **Structure + translate** — a server function asks the model for strict JSON:
   3–15 ordered steps with a title, detail, and an English visual description,
   written in the chosen language.
3. **Persist** — document and steps are stored per user with RLS.
4. **Animate** — per step, a cinematic 3D prompt is built and submitted as a video
   job; the app polls it, downloads the result, stores it privately, and plays it.
   Scenes rejected by a provider safety filter are automatically rewritten into a
   neutral, object-only version and retried.

## Deployment

A standard Vite + TanStack Start app: `bun run build`, then deploy to Vercel,
Netlify, Cloudflare, Railway, Render, or your own Node/Bun server. Set the same
environment variables in your hosting provider.

## License

MIT — see the repository owner.
