# CodeForge Desktop

Tauri 2 desktop shell for the hosted CodeForge IDE.

## Development

```sh
pnpm --filter @codeforge/desktop dev
```

## Build

```sh
pnpm --filter @codeforge/desktop build
```

The shell loads the authenticated CodeForge Worker website directly. It does not yet provide offline mode, local filesystem workspace access, a native terminal, auto-update, or signed installers. No Tauri filesystem or shell permissions are enabled.
