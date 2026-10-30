# CodeForge

CodeForge is an AI-native development environment. The web client is a React + TypeScript SPA with Monaco Editor, Supabase Auth, and a Cloudflare Worker API.

## Production target

- Worker: https://codeforge-ide.vasudevaya.workers.dev
- Repository: https://github.com/ram1234598766-dotcom/codeforge-ide
- Supabase project: codeforge-ide (eu-west-1)

## Architecture

- Supabase Auth verifies user identity. The browser uses only the Supabase publishable key.
- The Cloudflare Worker validates the user's Supabase access token before accessing user data.
- D1 stores workspaces, workspace state, files, agent-run metadata, and audit events.
- KV caches workspace state for short periods; D1 is the source of truth.
- Worker Static Assets serves the Vite build and routes `/api/*` through the Worker.

## Existing Cloudflare resources

The Worker configuration binds the existing D1 database named `k` and KV namespace titled `k`. The D1 schema migration is in `migrations/0001_initial.sql`. The schema was applied to the existing D1 database during this setup.

The D1 database currently has tables for workspaces, workspace state, workspace files, agent runs, and audit events.

## Local development and validation

```sh
npm --prefix apps/web install
cp apps/web/.env.example apps/web/.env.local
npm --prefix apps/web run dev
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npx wrangler deploy --dry-run
```

## Required environment configuration before deployment

Set these Worker runtime variables/secrets in Cloudflare Dashboard → Workers & Pages → codeforge-ide → Settings → Variables and Secrets:

- `SUPABASE_URL`: `https://rbgnjcquiqszkeiumueo.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: the current Supabase publishable key (secret binding used by the Worker runtime)

Set these build-time variables in the Worker build environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The Supabase publishable key is intended for public clients. Never use a Supabase service-role key in the browser or commit private credentials.

The `.github/workflows/deploy-worker.yml` workflow deploys on pushes to `main` after configuration is present. Configure these repository settings:

- Repository variable `VITE_SUPABASE_URL`
- Repository secrets `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` (same current Supabase publishable key)
- Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare token should be narrowly scoped to the CodeForge account with Workers Scripts Edit, D1 Edit, and Workers KV Storage Edit. Do not reuse any token previously pasted into chat; revoke it and create a replacement first.

## Implemented in this foundation branch

- Supabase email/password sign-in and account creation
- Authenticated Worker API
- D1 workspace creation and listing
- D1 workspace file persistence
- D1 workspace state persistence
- KV cache for workspace state
- Monaco editor with save-to-D1
- CI workflow for TypeScript checking, Vite build, and Wrangler dry-run

## Still to build

- AI provider execution, BYO model keys, and multi-agent orchestration
- Approval workflow and agent-run API/UI
- Sandboxed terminal and test/build runner
- Git status, commits, branches, and pull requests
- Repository indexing and cross-file search
- Realtime collaboration
- Desktop and mobile clients
- End-to-end, integration, accessibility, and security test coverage

These capabilities are not represented as completed or simulated actions in the current UI.
