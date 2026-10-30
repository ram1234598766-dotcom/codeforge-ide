# CodeForge

CodeForge is an interactive AI-native development environment for web, desktop, and mobile.

## Repository

- GitHub: https://github.com/ram1234598766-dotcom/codeforge-ide
- Supabase: https://rbgnjcquiqszkeiumueo.supabase.co
- Cloudflare URL: https://codeforge-ide.vasudevaya.workers.dev/

## Web app

The web app is in `apps/web` and is built with Vite, React, TypeScript, and Lucide.

The root `build` script intentionally uses npm inside `apps/web` so Cloudflare projects configured with `npm run build` can build this monorepo without requiring a committed pnpm lockfile.

## Local development

```bash
npm --prefix apps/web install
cp apps/web/.env.example apps/web/.env.local
npm --prefix apps/web run dev
```

## Supabase variables

Set these as build-time variables in the deployment provider:

```text
VITE_SUPABASE_URL=https://rbgnjcquiqszkeiumueo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never commit service-role keys or other private credentials.
