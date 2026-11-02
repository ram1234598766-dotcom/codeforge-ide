# CodeForge compatibility and performance record

Last reviewed: 2026-11-02

This document records the repository's declared runtime configuration and the evidence currently available. It is not a promise that every operating-system or device version is supported. A platform is only promoted to a supported-version claim after repeatable install, launch, authentication, workspace, and update tests on that platform.

## Compatibility inventory

| Surface | Current implementation/configuration | Current automated evidence | Known boundary |
| --- | --- | --- | --- |
| Web IDE | Vite/React application served as Cloudflare Worker static assets; Node.js 22 in CI; Worker compatibility date `2026-10-30` | Unit/regression tests, TypeScript check, clean Vite build, Wrangler dry-run in Worker CI | The web package currently uses floating `latest` ranges for Vite, React, React DOM, and the Vite React plugin. This is not a fully pinned dependency baseline. |
| Cloud API | Cloudflare Worker; Supabase identity; D1 binding `CODEFORGE_DB`; KV binding `CODEFORGE_KV`; Workers AI binding `AI` | Worker unit tests and dry-run; production bindings inspected read-only | Cloud workspace and AI features require network access. No production D1/KV writes are part of this record. |
| Windows desktop | Tauri 2 shell; application ID `com.codeforge.ide`; NSIS per-user installer | Windows runner builds the installer and performs install/uninstall smoke checks in Native shells CI | The shell loads the hosted IDE and requires network access. Native filesystem and OS-shell permissions are intentionally not enabled. Production distribution requires the durable Authenticode identity configured in Actions. |
| Android | Expo SDK `~58.0.0`; React Native `0.88.1`; WebView `14.0.1`; application ID `com.codeforge.ide`; INTERNET permission only; backup disabled | Native shells CI generates the native project, assembles release/debug APKs, checks package/alignment/signature, and installs the debug APK in a disposable emulator | The shell loads the hosted IDE and requires network access. Production updates require the same durable Android signing key for every version. |
| Android CI target | Java 17; Android SDK platform 36 and build-tools 36.0.0; emulator API 35, x86_64 | Defined in `.github/workflows/native-shells-ci.yml` | CI target is not a minimum supported Android OS version. |

### Compatibility claims

- No minimum Windows release, minimum Android API level, browser-version matrix, or device-performance tier is currently certified by this document.
- CI runner success proves that the configured build and smoke-test workload completed; it does not prove compatibility with every end-user device.
- Web, Windows, and Android clients use the same hosted account/workspace service. Offline workspace editing is not claimed.

## Performance and resource measurements

No comparable before/after RAM, CPU, startup, or network measurements have been collected and reviewed yet. Therefore this document intentionally publishes no performance improvement or resource-consumption numbers.

| Revision | Client/device | OS and build | Workload | Startup median / p95 | Peak RAM | CPU | Network bytes | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Not measured | Web | Device/browser not recorded | Not run | — | — | — | — | No baseline |
| Not measured | Windows | Device/Windows build not recorded | Not run | — | — | — | — | No baseline |
| Not measured | Android | Device/API level not recorded | Not run | — | — | — | — | No baseline |

### Measurement protocol

For any future before/after claim:

1. Pin both builds to exact Git SHAs and retain artifact checksums.
2. Use the same physical device or VM, OS build, browser/runtime version, power mode, and network path for both revisions.
3. Use disposable test accounts and workspace fixtures; do not benchmark with production user content or mutate production D1/KV data.
4. Record at least 10 cold starts and 10 warm starts. Define startup as process launch to the first usable, interactive workspace view. Report median and p95, not a single best run.
5. Record peak memory using platform-native process metrics (Android PSS via `dumpsys meminfo`; Windows working set/private bytes; browser tab/process memory). Sample CPU over the same fixed workload and interval.
6. Record transferred bytes and request counts from browser/network tooling or an equivalent platform trace. Separate cached and uncached runs.
7. Preserve raw logs, device/OS/workload details, test commands, SHA-256 hashes, and any exclusions. State confidence and explain variance.
8. Do not publish a before/after claim unless both revisions completed the same workload successfully and the measurements are comparable.

## Release and verification boundary

A successful single CI run is not a ten-pass qualification. Production deployment and public release remain blocked until the required independent full-verification ledger is complete, all external signing prerequisites are satisfied, and the exact SHA has passed the applicable platform and deployed-behavior checks.
