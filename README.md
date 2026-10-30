# CodeForge

CodeForge is an AI-native development environment. The web client is a React + TypeScript SPA with Monaco Editor, Supabase Auth, and a Cloudflare Worker API.

## Production target

- Worker: https://codeforge-ide.vasudevaya.workers.dev
- Repository: https://github.com/ram1234598766-dotcom/codeforge-ide
- Supabase project: codeforge-ide (eu-west-1)

## Architecture

- Supabase Auth verifies user identity. The browser uses only the Supabase publishable key.
- The Cloudflare Worker validates the user's Supabase access token before accessing user data.
- D1 stores workspaces, workspace state, files, agent-run metadata, audit events, collaboration membership/invites, provider credentials, file versions, and approval requests.
- KV caches workspace state for short periods; D1 is the source of truth.
- Worker Static Assets serves the Vite build and routes `/api/*` through the Worker.

## Existing Cloudflare resources

The Worker configuration binds the existing D1 database named `k` and KV namespace titled `k`. The D1 schema migration is in `migrations/0001_initial.sql`. The schema was applied to the existing D1 database during this setup.

The D1 schema is versioned in `migrations/`; migration 0005 adds the approval-gated code-change queue.

## Local development and validation

```sh
npm --prefix apps/web install
cp apps/web/.env.example apps/web/.env.local
npm --prefix apps/web run dev
npm --prefix apps/web test
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

The `.github/workflows/deploy-worker.yml` workflow deploys after a pull request is merged into `main` (and can also be started manually with `workflow_dispatch`). Configure these repository settings:

- Repository variable `VITE_SUPABASE_URL`
- Repository secrets `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` (same current Supabase publishable key)
- Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare token should be narrowly scoped to the CodeForge account with Workers Scripts Edit, D1 Edit, and Workers KV Storage Edit. Do not reuse any token previously pasted into chat; revoke it and create a replacement first.

## Implemented

- Supabase email/password sign-in and account creation
- Authenticated Worker APIs with per-user ownership checks
- D1 workspaces, workspace files, workspace state, agent runs, audit events, and encrypted per-user provider credentials
- KV caching for workspace state and a basic per-user AI request limit
- Monaco editor with multi-file tabs, D1 saving, keyboard shortcuts, and workspace-state restoration
- Workspace creation, rename, deletion, file creation, deletion, and file-path search
- Persisted AI run history and a D1-backed activity timeline
- Sandboxed browser HTML preview
- Ctrl/Cmd+S save and Ctrl/Cmd+P file search shortcuts
- Cloudflare Workers AI coding agents: coder, planner, reviewer, debugger, tester, refactorer, security, and documentation
- Bring-your-own model keys for OpenAI, DeepSeek, Groq, and OpenRouter, encrypted with AES-GCM in D1 and decrypted only in the Worker
- GitHub and Google OAuth sign-in buttons via Supabase Auth (providers must be enabled in the Supabase dashboard)
- Persisted AI run history and an activity timeline
- Sandboxed browser HTML preview (not a server-side runtime)
- Approval-gated workspace code changes: editor drafts enter a Monaco side-by-side diff review queue; approvals enforce workspace roles, reject stale file versions, preserve pre-change snapshots, invalidate cached state, and emit audit events
- CI for unit tests, TypeScript checking, Vite build, and Wrangler dry-run
- Merged-PR production deployment workflow

Workers AI requests are usage-based and may incur Cloudflare charges. Agent responses are suggestions: they do not directly edit files, execute shell commands, or deploy code.

## Desktop and mobile shells

- **Desktop:** Tauri 2 shell at `apps/desktop`, loading the hosted Worker website in a native window. No local filesystem or shell permissions are granted yet.
- **Mobile:** Expo SDK 58 / React Native 0.88 shell at `apps/mobile`, loading the responsive hosted website in a WebView. Native offline editor, notifications, and app-store signing are not yet implemented.

Build commands: `pnpm build:desktop` and `pnpm build:mobile`. The `Native shells CI` workflow validates both projects.

## Still to build

- Agent-generated patch extraction and automatic proposal creation from model output
- Isolated terminal, test, and build execution using a remote sandbox
- GitHub repository connection, clone/import, status, commits, branches, and pull requests
- Semantic repository indexing and cross-file search
- Realtime collaboration
- Native desktop/mobile editor integrations, local filesystem access, and app-store packaging
- Comprehensive end-to-end, integration, accessibility, and security test coverage

These capabilities are not represented as completed or simulated actions in the current UI.


## Release pipeline

Merges to `main` run the CodeForge Worker deployment workflow after the repository's deployment variables and secrets are configured. The workflow runs tests and type-checking, builds `apps/web/dist`, updates the Worker-side Supabase publishable-key secret, and deploys the Worker using the root `wrangler.toml` configuration. CI separately runs unit tests, type-checking, the production build, and a Wrangler dry-run.

### OAuth providers

Email/password authentication works with the configured Supabase project. GitHub and Google buttons use Supabase OAuth; enable each provider under Supabase Dashboard → Authentication → Providers and add `https://codeforge-ide.vasudevaya.workers.dev` to the project's allowed redirect URLs. The buttons will return a provider-configuration error until the corresponding OAuth client credentials and redirect settings are enabled.

### Provider key encryption

The Worker secret `APP_ENCRYPTION_KEY` is a randomly generated 256-bit AES-GCM key. Do not delete or rotate it while provider credentials are stored in D1; rotation requires decrypting and re-encrypting every stored provider key. Provider API keys are never returned to the browser.

### OAuth setup

GitHub and Google OAuth buttons require those providers to be enabled under Supabase Dashboard → Authentication → Providers, with the CodeForge Worker origin added to the allowed redirect URLs. Email/password sign-in does not depend on OAuth provider configuration.
