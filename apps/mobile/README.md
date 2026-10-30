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
