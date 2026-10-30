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

Run `pnpm --filter @codeforge/mobile doctor` to check Expo dependency alignment before building. SDK 58 requires Node.js 22.13.x or newer.
