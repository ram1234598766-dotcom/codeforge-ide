# CodeForge compatibility and performance record

Last reviewed: 2026-11-09

This document records the repository's declared runtime configuration and the evidence currently available. It is not a promise that every operating-system or device version is supported. A platform is only promoted to a supported-version claim after repeatable install, launch, authentication, workspace, and update tests on that platform.

## Current verification snapshot — 2026-11-09

This section supersedes any conflicting historical statements later in this document. All builds below ran on GitHub-hosted runners; the user's local desktop was not available, and no build files were copied to it.

### Exact main revision and CI evidence

- Main SHA: `ec86277761a45e9fdba09b5a19dbe446b38e12aa` (2026-11-08 11:50:05 UTC).
- [Worker CI run 42477473303](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/42477473303): 13 test files, 104 tests passed; web `npm audit` reported 0 vulnerabilities; TypeScript check, Vite production build, and Wrangler 4.158.0 dry-run passed.
- [Release-policy run 42477473294](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/42477473294): workflow YAML validation, seven policy tests, three disposable D1 migration tests, Android WebView readiness tests, hosted-route regression tests, APK metadata policy tests, and durable-signing/release-gate tests passed.
- [Native shells CI run 42477473243](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/42477473243): Windows NSIS build/install/launch/uninstall and Android API 35 x86_64 emulator smoke completed successfully. The Android WebView rendered the hosted `/app` sign-in UI; the workspace view was not tested with a signed-in account.
- [Production installers run 42477473293](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/42477473293): Android production APK signing and install smoke passed. Windows NSIS compilation succeeded, but SignPath rejected the GitHub.com trusted build system before signing; the Windows artifact is diagnostic only.
- [Paired release publisher run 42478335795](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/42478335795): Windows verification, Android verification, and paired publication were all skipped because the upstream installer workflow failed. No new release was published.

### Android production APK evidence

- Artifact: [Android production Actions artifact, run 42477473293](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/42477473293/artifacts/13616560928).
- Build metadata: package `com.codeforge.ide`, label `CodeForge`, version `1.0.38`, versionCode `38`, minSdk `24`, targetSdk `36`, ABIs `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`.
- The final APK was parsed with `aapt dump badging`; pre/post-signing badging and merged-manifest snapshots were byte-identical. `zipalign -c 4`, `apksigner verify --verbose --Werr --print-certs`, package/permission checks, signer fingerprint comparison, and SHA-256 checks passed.
- Durable signer certificate SHA-256: `F96C203D70D2A90D853E35652D7C63758122F5C4B3EE674978F919C3F814F897`. APK SHA-256: `ae829fae972bd998a0b2044a3b7c2a7f82ff1dd0d8be6163a9e3b48961571fda`.
- The production-signed APK installed and launched in the disposable emulator, rendered the hosted `/app` authentication screen with both native readiness and visible-content signals, remained stable during the smoke window, emitted no detected crash, and was uninstalled. The user was not signed in, so workspace rendering is not claimed.
- The final parsed manifest contained `android.permission.INTERNET` and the package-scoped `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`; the previously recorded unexplained storage/overlay/local-network permissions were not present in this APK.
- Android Chrome/mobile-browser verification on a separate emulator was NOT VERIFIED: Limrun emulator provisioning was blocked by provider credits. This is not inferred from desktop HTTP checks.

### Live Worker and website

- The public root and `/app` returned the SPA document; `/api/health` returned `ok=true` and `database=connected`; `/api/config` returned its public configuration; an unauthenticated workspace API request returned 401.
- The hosted JS asset returned 200 with JavaScript MIME and the CSS asset returned 200 with CSS MIME. The route probe did not record their cache headers; do not claim those headers were verified.
- The live `/app` HTML cache header was `public, max-age=0, must-revalidate`, not `no-store`. Main contains the no-store route behavior, but that revision has not been deployed.
- Cloudflare reports Worker version 217 at 100% traffic, deployed 2026-11-07 04:46 UTC. The deployment has no source-SHA annotation, so it is not proven to match current main. D1, KV, Workers AI, and ASSETS bindings are present. No production deployment was performed.
- Supabase project `codeforge-ide` reports `ACTIVE_HEALTHY` on PostgreSQL 17.11.0.003. Two migrations are recorded; all six public tables have RLS enabled. Health advisors returned no findings. Security advisors reported one warning: leaked-password protection is disabled. Performance advisors reported nine unused indexes (informational; do not drop them based on this short observation window). The last 24-hour log aggregate returned 72 pgbouncer and 9 postgres events; no auth/edge log source was returned in that query.

### Current compatibility boundaries

- Android manifest minimum SDK is 24 and target SDK is 36; the tested emulator is API 35 x86_64. Four ABIs are packaged. This is not a certification of every Android device or WebView version.
- Windows NSIS install/launch/uninstall was exercised on a GitHub-hosted Windows runner; no minimum Windows release or physical-device matrix is certified.
- Web CI uses Node.js 22; the Worker compatibility date is 2026-10-30. No browser-version matrix or authenticated browser end-to-end suite is certified.
- The mobile package has no committed lockfile; the production workflow currently installs with `--package-lock=false`. Dependency reproducibility remains a gap.
- No comparable before/after RAM, CPU, startup, or network measurements were collected. Performance remains NOT MEASURED.

## Compatibility inventory

| Surface | Current implementation/configuration | Current automated evidence | Known boundary |
| --- | --- | --- | --- |
| Web IDE | Vite/React application served as Cloudflare Worker static assets; Node.js 22 in CI; Worker compatibility date 2026-10-30 | Unit/regression tests, TypeScript check, clean Vite build, Wrangler dry-run in Worker CI | The web package currently uses floating latest ranges for Vite, React, React DOM, and the Vite React plugin. This is not a fully pinned dependency baseline. |
| Cloud API | Cloudflare Worker; Supabase identity; D1 binding CODEFORGE_DB; KV binding CODEFORGE_KV; Workers AI binding AI | Worker unit tests and dry-run; production bindings inspected read-only | Cloud workspace and AI features require network access. No production D1/KV writes are part of this record. |
| Windows desktop | Tauri 2 shell; application ID com.codeforge.ide; NSIS per-user installer | Native shells CI builds, installs, launches, verifies, and uninstalls the installer on a disposable GitHub-hosted Windows runner | The shell loads the hosted IDE and requires network access. Native filesystem and OS-shell permissions are intentionally not enabled. Production distribution remains blocked until a trusted durable Authenticode signature is verified. No minimum Windows version is certified. |
| Android | Expo SDK ~58.0.0; React Native 0.88.1; WebView 14.0.1; application ID com.codeforge.ide; minSdk 24; targetSdk 36 | Main CI API 35 x86_64 emulator smoke and production-signed APK install/launch/WebView readiness passed on 2026-11-08 | The 1.0.38 production APK contains INTERNET and the package-scoped dynamic receiver permission. Four ABIs are packaged. Production updates require the same durable Android signing key for every version. API 35 x86_64 is a CI target, not a universal device-support claim. |
| Android CI target | Java 17; Android SDK platform 36 and build-tools 36.0.0; emulator API 35, x86_64 | Defined in .github/workflows/native-shells-ci.yml | CI target is not a minimum supported Android OS version. |

### Compatibility claims

- The APK declares minSdk 24, but no minimum supported Android device/API matrix has been certified. No minimum Windows release, browser-version matrix, or device-performance tier is currently certified by this document.
- CI runner success proves that the configured build and smoke-test workload completed; it does not prove compatibility with every end-user device.
- Web, Windows, and Android clients use the same hosted account/workspace service. Offline workspace editing is not claimed.
- The web package has unit/regression tests, type-checking, dependency audit, and a production build in CI. It currently has no dedicated lint script or browser end-to-end authentication/workspace suite.

## Historical verification evidence reviewed 2026-11-05 (superseded where it conflicts with the 2026-11-09 snapshot above)

Evidence below is tied to exact source revisions. Preview-branch evidence is explicitly not attributed to main.

| Scope | Exact source SHA | Evidence | Result and boundary |
| --- | --- | --- | --- |
| Web and Worker CI on main | 44c374ff8dc7245b71007ee4d434e5d21a1ab67a | [Worker CI run 41696969477](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/41696969477) | 93 unit/regression tests passed; type-check, high-severity npm audit, production build, and Wrangler dry-run passed. No browser E2E suite or web lint job is configured. |
| Native shells on main | 44c374ff8dc7245b71007ee4d434e5d21a1ab67a | [Native shells CI run 41696969462](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/41696969462) | Windows x64 NSIS installer build, checksum, silent install, and uninstall passed. The installer was unsigned and the installed Windows app was not launched. Android release/debug APK assembly, package/alignment checks, debug APK signature verification, and API 35 x86_64 emulator install/launch/process-stability/crash-log/uninstall smoke passed. The release APK was unsigned. |
| Android runner-capacity remediation (open PR, not main) | 459a42ec9b7c688247690c9c7544c47bafd0d3ac | [PR #49 Native shells CI run 41775344618](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/41775344618) | The previous run [41769546173](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/41769546173) failed with ENOSPC while sdkmanager installed the API 35 Google APIs x86_64 emulator image. PR #49 adds a build-only cleanup after APK staging, rechecks that both staged APKs remain, records filesystem usage, and requires at least 5 GiB free before emulator provisioning. The updated Android emulator smoke passed. This evidence is for the open PR head only; it is not a main-branch result. |
| Production native installer attempt | 96860ddd59a60919fef746b8ef2a5afa07c4fb56 | [Production installers run 41692905974](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/41692905974) and [release publisher run 41694737088](https://github.com/ram1234598766-dotcom/codeforge-ide/actions/runs/41694737088) | Windows build succeeded but SignPath configuration was unavailable, so the installer remained unsigned. Android build succeeded but keystore preflight could not open the configured keystore/alias; the APK was retained as unsigned. The publisher skipped signer verification and all release-creation/publication steps. No public release was produced. |

The current Cloudflare Worker deployment metadata reports version 217 at 100% traffic (2026-11-07 04:46 UTC) and contains no source-SHA annotation. D1/KV/Workers AI/ASSETS bindings were inspected read-only. The 2026-11-09 live route probes are summarized in the current snapshot above; the /app HTML is still cacheable and the deployed revision is not proven to match current main.

As of 2026-11-09, the main web npm audit reported zero vulnerabilities and the Android/desktop dependency-audit steps completed successfully. The mobile package still has no committed lockfile, so repeatable dependency resolution remains an outstanding risk.

### Historical Android permission review (2026-11-05; superseded by the current production APK evidence above)

Read-only inspection of the current main CI artifact (run 41696969462, SHA 44c374ff8dc7245b71007ee4d434e5d21a1ab67a) and the latest production-installer artifact (run 41692905974, SHA 96860ddd59a60919fef746b8ef2a5afa07c4fb56) found these permissions in the release APKs:

- android.permission.INTERNET
- android.permission.READ_EXTERNAL_STORAGE (maxSdkVersion 32)
- android.permission.WRITE_EXTERNAL_STORAGE (maxSdkVersion 32)
- android.permission.SYSTEM_ALERT_WINDOW
- android.permission.VIBRATE
- com.codeforge.ide.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION

The main CI debug APK also contains android.permission.ACCESS_LOCAL_NETWORK. The tracked app config declares only INTERNET, and the repository does not declare native storage, overlay, vibration, or local-network features. The artifact does not include the manifest-merger source report, so the transitive manifest that introduced each permission has not yet been identified.

Open PR [#51](https://github.com/ram1234598766-dotcom/codeforge-ide/pull/51) adds Expo android.blockedPermissions, parser regression tests, and a CI allowlist check for both release and debug APKs. Its Android build and manifest check are still pending; do not claim the final APK permission surface is minimal until that exact PR head passes. Expo documents android.blockedPermissions as the mechanism for removing permissions contributed by merged package manifests: https://docs.expo.dev/guides/permissions/.

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
5. Record peak memory using platform-native process metrics (Android PSS via dumpsys meminfo; Windows working set/private bytes; browser tab/process memory). Sample CPU over the same fixed workload and interval.
6. Record transferred bytes and request counts from browser/network tooling or an equivalent platform trace. Separate cached and uncached runs.
7. Preserve raw logs, device/OS/workload details, test commands, SHA-256 hashes, and any exclusions. State confidence and explain variance.
8. Do not publish a before/after claim unless both revisions completed the same workload successfully and the measurements are comparable.

## Release and verification boundary

A successful single CI run is not a ten-pass qualification. Production deployment and public release remain blocked until the required independent full-verification ledger is complete, all external signing prerequisites are satisfied, and the exact SHA has passed the applicable platform and deployed-behavior checks.
