# CodeForge

A powerful, customizable AI-native development environment for web, desktop, and mobile.

## Live services

- Web: https://codeforge-ide-b05.pages.dev
- GitHub: https://github.com/ram1234598766-dotcom/codeforge-ide
- Supabase: https://rbgnjcquiqszkeiumueo.supabase.co

## Apps

- `apps/web` — Cloudflare Pages-ready web IDE shell with Supabase workspace connectivity
- `apps/desktop` — Tauri 2 desktop client foundation
- `apps/mobile` — Expo mobile companion foundation

## Backend

The Supabase project contains profiles, workspaces, workspace members, files, agent runs, and audit events with Row Level Security enabled.

## Development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web
```
