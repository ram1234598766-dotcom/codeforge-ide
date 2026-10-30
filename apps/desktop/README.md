# CodeForge Desktop

CodeForge Desktop is a Windows Tauri 2 application that opens the hosted CodeForge workspace in its own native window.

- Installer: Windows NSIS `.exe` (per-user installation)
- Identity: `com.codeforge.ide`
- Cloud account: shared Supabase identity and D1-backed workspace data
- Standalone use: the desktop client can be launched without opening a browser; cloud workspace and AI services require an internet connection.
- Cross-device use: sign in with the same CodeForge account on web, desktop, and Android to access the same cloud workspaces.

## Build

```sh
npm install --no-audit --no-fund
npx tauri icon src-tauri/icons/icon.png
npm run build
```

The production release workflow builds the Windows installer on a Windows runner and publishes it with the matching Android APK when a version tag is pushed. Native filesystem and operating-system shell access are intentionally not enabled in this hosted-shell release.
