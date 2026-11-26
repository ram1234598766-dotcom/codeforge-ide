# CodeForge Mobile

Expo / React Native shell for the hosted CodeForge IDE.

- Android application ID: `com.codeforge.ide`
- Distribution: signed Android release APK
- Cloud account: shared Supabase identity and D1-backed workspace data
- Standalone use: launch and use the Android app without a desktop or browser session; cloud workspace and AI services require an internet connection.
- Cross-device use: sign in with the same CodeForge account on web, desktop, and Android to access the same cloud workspaces.

The mobile app embeds the responsive hosted IDE in a hardened WebView. It uses the same account and backend as desktop and web; devices do not need to be online at the same time. Changes sync through the cloud when a device is connected.

## Build

```sh
npm install --no-audit --no-fund
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew :app:assembleRelease
```

Production release signing uses the persistent Android keystore stored in GitHub Actions secrets. Never commit the keystore or its passwords. Android app updates must be signed with the same key.

## Node.js and Expo diagnostics

This project uses Expo SDK 58 and React Native 0.88. Use Node.js 22.13.x or newer on the 22.x line, Node.js 24.3.x or newer on the 24.x line, or Node.js 26 or newer. Odd-numbered Node.js major versions are not supported by Expo SDK 58.

Run `npx expo-doctor` from `apps/mobile` after changing Expo or React Native dependencies and before building the native app. The GitHub Actions native-shell workflow runs this diagnostic as part of Android validation.

## WebView readiness contract

The native shell reports CodeForge as ready only after the hosted `/app` React surface completes auth initialization, sets `data-codeforge-app-ready="true"`, and sends the `codeforge-ready` bridge message after visible auth/workspace content renders. HTTPS OAuth/provider pages remain usable in the WebView, but they are tracked as external pages and do not count as a mounted CodeForge app. Credential-bearing URLs are rejected; diagnostic route logging must never include query strings or credentials.

Run the navigation contract tests without installing additional packages:

```sh
node --test apps/mobile/webview-navigation.test.mjs
```

This contract test does not substitute for an Android emulator install/launch smoke test or a hosted production-route probe.
