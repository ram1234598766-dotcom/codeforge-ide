# CodeForge Mobile

Expo SDK 58 / React Native 0.88 shell for the hosted CodeForge IDE.

## Development

```sh
pnpm --filter @codeforge/mobile start
```

Use Expo Go or a development build to open the app. Android and iOS native builds use:

```sh
pnpm --filter @codeforge/mobile android
pnpm --filter @codeforge/mobile ios
```

The current mobile app embeds the responsive hosted CodeForge website in a WebView and shares the website's Supabase authentication. It is a mobile shell, not yet a fully native editor. Offline workspaces, native file access, push notifications, native terminal, and store submission/signing remain future work.


## Android release APK

The `CodeForge Android APK` GitHub Actions workflow generates a reproducible Android release APK from this Expo project. It creates the native Android project with Expo Prebuild and assembles the Release variant with Gradle.

The workflow deliberately uploads an **unsigned build artifact**: this repository is public, so private release-signing material must never be generated in a public runner, committed, or published as an artifact. The final APK is signed outside the public CI environment using a private release keystore, then verified with Android SDK `apksigner`. Keep that keystore and its password backed up securely; Android updates must be signed by the same key.

The release package uses application ID `com.codeforge.ide` and version `1.0.0` (Android version code `1`). The current installed shell connects to the hosted CodeForge IDE and shares its Supabase login; it is not an offline-native IDE yet.
