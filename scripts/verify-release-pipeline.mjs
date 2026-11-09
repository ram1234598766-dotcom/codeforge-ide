import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestPublishedRunNumber, shouldPublishRelease, main as checkReleaseSequence } from './check-release-sequence.mjs';
import { blockedAndroidPermissions } from './verify-android-permissions.mjs';
import { extractApksignerCertificateFingerprint } from './extract-apksigner-cert.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const installers = read('../.github/workflows/production-installers.yml');
const native = read('../.github/workflows/native-shells-ci.yml');
const mobileConfig = JSON.parse(read('../apps/mobile/app.json'));
const workerCI = read('../.github/workflows/codeforge-worker-ci.yml');
const releasePolicy = read('../.github/workflows/release-policy.yml');
const legacyUnsignedPublisher = read('../.github/workflows/publish-unsigned-release.yml');
const versionedReleasePublisher = read('../.github/workflows/publish-versioned-release.yml');
const androidPreview = read('../.github/workflows/android-apk.yml');
const androidSmoke = read('../scripts/android-install-smoke.sh');
const deploy = read('../.github/workflows/deploy-worker.yml');
const wrangler = read('../wrangler.toml');
const workerEntry = read('../apps/web/functions/index.ts');
const workerAssets = read('../apps/web/functions/assets.ts');

const d1MigrationTest = read('../scripts/test-d1-migrations.py');

assert.ok(deploy.includes('\non:\n  workflow_dispatch:\n'), 'Production deployment must be manual-dispatch only.');
assert.ok(deploy.includes("if: ${{ github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' }}"), 'Production deployment must run from main only.');
assert.ok(deploy.includes('SOURCE_REF: ${{ github.ref }}'), 'Deployment must capture the selected source ref.');
assert.ok(deploy.includes('test "$SOURCE_REF" = "refs/heads/main"'), 'Deployment must reject non-main source refs.');
assert.ok(!deploy.includes('\n  push:') && !deploy.includes('\n  pull_request:'), 'Production deployment must not run on push or PR close.');
assert.ok(deploy.includes('confirm_production_deploy:') && deploy.includes('required: true'), 'Production deployment must require an explicit confirmation input.');
assert.match(wrangler, /run_worker_first\s*=\s*\[[^\]]*\"\/app\"[^\]]*\"\/app\/\*\"/s, 'The /app SPA route must pass through the Worker so HTML cache headers are applied.');
assert.ok(workerEntry.includes('preventHtmlAssetCaching') && workerAssets.toLowerCase().includes('cache-control'), 'The Worker must apply non-cacheable headers to HTML responses.');
assert.ok(releasePolicy.includes('wrangler.toml'), 'Worker asset routing changes must trigger release-policy tests.');
assert.ok(deploy.includes('test "$CONFIRM_PRODUCTION_DEPLOY" = "DEPLOY"'), 'Production deployment must reject an unconfirmed dispatch.');
assert.ok(deploy.includes('apply_d1_migrations:') && deploy.includes('default: "false"'), 'D1 migrations must default to disabled.');
assert.ok(deploy.includes('confirm_d1_migrations:') && deploy.includes('required: false'), 'D1 migration confirmation must be an explicit optional input.');
assert.ok(deploy.includes('test "$CONFIRM_D1_MIGRATIONS" = "APPLY D1 MIGRATIONS"'), 'D1 migrations must require separate confirmation.');
assert.ok(deploy.includes('node scripts/verify-hosted-app.mjs'), 'Production deploy must verify the hosted SPA, APIs and assets after deployment.');
assert.ok(deploy.includes("if: ${{ inputs.apply_d1_migrations == 'true' }}"), 'D1 migration steps must be opt-in.');
assert.ok(!deploy.includes('wrangler@4 secret put'), 'Deployment workflow must not mutate Worker secrets.');
assert.ok(releasePolicy.includes('Test D1 migrations on a disposable SQLite fixture'), 'Release policy CI must execute the disposable D1 migration fixture tests.');
for (const migrationPath of [
  'migrations/0005_code_change_requests.sql',
  'migrations/0006_workspace_search_revisions.sql',
]) {
  assert.ok(releasePolicy.includes(migrationPath), 'D1 migration changes must trigger fixture tests: ' + migrationPath);
  assert.ok(d1MigrationTest.includes(migrationPath), 'Disposable D1 fixture must exercise ' + migrationPath);
}
assert.ok(releasePolicy.includes('scripts/test-d1-migrations.py'), 'Changes to the disposable D1 fixture must trigger migration safety tests.');
assert.ok(d1MigrationTest.includes('test_migrations_are_rerunnable_without_losing_existing_data_or_revision_progress'));
assert.ok(d1MigrationTest.includes('test_workspace_foreign_keys_cascade_only_the_selected_fixture_workspace'));

const publisher = read('../.github/workflows/publish-versioned-release.yml');
const androidMetadataVerifier = read('../scripts/verify-android-apk-metadata.mjs');
const androidMetadataTests = read('../scripts/verify-android-apk-metadata.test.mjs');
const desktopPreviewPublisher = read('../.github/workflows/publish-desktop-preview.yml');
const home = read('../apps/web/src/main.tsx');
const releaseSource = read('../apps/web/src/lib/release.ts');

const apksignerFixtureFingerprint = 'F96C203D70D2A90D853E35652D7C63758122F5C4B3EE674978F919C3F814F897';
assert.equal(
  extractApksignerCertificateFingerprint('Signer #1 certificate SHA-256 digest: ' + apksignerFixtureFingerprint.toLowerCase()),
  apksignerFixtureFingerprint,
  'The APK signer parser must accept the legacy apksigner output format.',
);
assert.equal(
  extractApksignerCertificateFingerprint('V3.0 Signer: certificate SHA-256 digest: ' + apksignerFixtureFingerprint.toLowerCase()),
  apksignerFixtureFingerprint,
  'The APK signer parser must accept current apksigner V3 output.',
);
assert.throws(() => extractApksignerCertificateFingerprint('Verified using v1 scheme: false'), /No supported signer certificate SHA-256 digest/);
assert.throws(() => extractApksignerCertificateFingerprint('V3.0 Signer: certificate SHA-256 digest: invalid'), /Invalid signer certificate SHA-256 digest/);

assert.match(installers, /SIGNPATH_API_TOKEN/);
for (const setting of [
  'SIGNPATH_ORGANIZATION_ID',
  'SIGNPATH_PROJECT_SLUG',
  'SIGNPATH_SIGNING_POLICY_SLUG',
  'SIGNPATH_ARTIFACT_CONFIGURATION_SLUG',
  'WINDOWS_SIGNING_CERT_THUMBPRINT',
]) {
  assert.ok(installers.includes(setting), 'Windows SignPath integration must require ' + setting + '.');
}
assert.match(installers, /signpath\/github-action-submit-signing-request@f6d04783b4569d051e0c80105fe66e82819d0092/);
assert.match(installers, /uses: actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/);
assert.match(installers, /actions: read/);
assert.match(installers, /GITHUB_REF -ne 'refs\/heads\/main'/);
assert.match(installers, /archive: false/);
assert.match(installers, /wait-for-completion: true/);
assert.match(installers, /skip-decompress: true/);
assert.match(installers, /SIGNPATH_SIGNING_REQUEST_ID\)\) \{/);
assert.match(installers, /timeout-minutes: 120/);
assert.match(installers, /Get-AuthenticodeSignature release\/CodeForge-Setup-Windows\.exe/);
assert.ok(installers.includes('TimeStamperCertificate'), 'Windows production signing must require an Authenticode timestamp certificate.');
assert.ok(publisher.includes('TimeStamperCertificate'), 'The paired publisher must independently verify the Authenticode timestamp certificate.');
assert.ok(installers.includes('TIMESTAMP_CERT_THUMBPRINT='), 'Windows signing metadata must bind the timestamp certificate identity.');
assert.ok(publisher.includes('TIMESTAMP_CERT_THUMBPRINT='), 'The Windows release verifier must compare the timestamp certificate identity.');
assert.ok(installers.includes('NOT-PRODUCTION-ELIGIBLE-DIAGNOSTIC-Windows-SignPath-Input'), 'Unsigned SignPath input must be clearly labeled as a non-production diagnostic artifact.');
assert.ok(installers.includes('NOT-PRODUCTION-ELIGIBLE-DIAGNOSTIC-Android-'), 'Android signing failures must retain only a clearly labeled diagnostic artifact.');
assert.ok(installers.includes("steps.android-signing-run.outcome == 'failure'"), 'Android diagnostic upload must be restricted to durable signing failures.');
assert.ok(installers.includes('INSTALLABLE_FOR_PRODUCTION=false'), 'Android diagnostic metadata must explicitly prohibit production installation.');
assert.ok(installers.includes('node scripts/verify-android-apk-metadata.mjs release/APK-METADATA.txt'), 'The pre-sign APK must have its actual badging metadata validated.');
assert.ok(installers.includes('node scripts/verify-android-apk-metadata.mjs release/APK-METADATA-FINAL.txt'), 'The final signed APK must be parsed and validated again.');
assert.ok(installers.includes('aapt" dump xmltree'), 'The merged Android manifest must be inspected before and after signing.');
assert.ok(publisher.includes('aapt" dump xmltree CodeForge.apk AndroidManifest.xml'), 'The paired publisher must independently inspect the final APK manifest.');
assert.ok(publisher.includes('APK_METADATA_SHA256') && publisher.includes('APK_MANIFEST_SHA256'), 'The publisher must bind parsed manifest hashes to the same APK build metadata.');
assert.ok(installers.includes('(cd release && sha256sum APK-METADATA.txt > APK-METADATA-SHA256.txt)'), 'The APK manifest checksum must use a portable artifact-relative path.');
assert.ok(installers.includes('(cd release && sha256sum APK-MERGED-MANIFEST-XMLTREE.txt > APK-MERGED-MANIFEST-SHA256.txt)'), 'The merged manifest checksum must use a portable artifact-relative path.');
assert.ok(publisher.includes('sha256sum -c APK-METADATA-SHA256.txt') && publisher.includes('sha256sum -c APK-MERGED-MANIFEST-SHA256.txt'), 'The paired publisher must verify both original manifest checksums.');
assert.ok(androidMetadataVerifier.includes('expectedAndroidApkContract'));
assert.ok(androidMetadataVerifier.includes('applicationLabel') && androidMetadataVerifier.includes('minSdkVersion') && androidMetadataVerifier.includes('targetSdkVersion'));
assert.ok(androidMetadataVerifier.includes('supported ABIs mismatch'));
assert.ok(androidMetadataTests.includes('rejects a mismatched package ID'));
assert.ok(androidMetadataTests.includes('rejects an unexpected application label or SDK contract'));
assert.ok(androidMetadataTests.includes('rejects missing, duplicate, or unexpected ABI declarations'));


assert.match(installers, /ANDROID_KEYSTORE_BASE64/);
assert.match(installers, /id: android-signing-run/);
assert.match(installers, /ANDROID_KEYSTORE_BASE64 is not valid base64-encoded keystore data/);
assert.match(installers, /Decoded Android keystore size/);
assert.match(installers, /Android keystore opened successfully/);
assert.match(installers, /ANDROID_KEY_ALIAS was not found in it/);
assert.match(installers, /Safe keytool diagnostic/);
assert.match(installers, /Android keystore certificate SHA-256/);
assert.match(installers, /--key-pass env:CODEFORGE_KEY_PASSWORD/);
assert.match(installers, /--key-pass env:CODEFORGE_STORE_PASSWORD/);
assert.match(native, /Build and install-smoke Windows NSIS installer/);
assert.match(native, /Get-AuthenticodeSignature/);
assert.match(native, /Silent NSIS install failed/);
assert.match(native, /Silent NSIS uninstall failed/);
assert.match(native, /Start-Process -FilePath \$installed\.FullName -PassThru/);
assert.match(native, /Windows application launch smoke test passed/);
assert.match(native, /Stop-Process -Id \$launch\.Id -Force/);
const windowsLaunchIndex = native.indexOf('Start-Process -FilePath $installed.FullName -PassThru');
const windowsUninstallIndex = native.indexOf('$uninstall = Start-Process');
assert.ok(windowsLaunchIndex >= 0 && windowsUninstallIndex > windowsLaunchIndex, 'Windows CI must launch the installed app before uninstalling it.');
assert.ok(native.includes('release/BUILD-METADATA-Windows.txt'));
assert.ok(native.includes('"TARGET_TRIPLE=x86_64-pc-windows-msvc"'));
assert.ok(native.includes('"SIGNING=unsigned"'));
assert.ok(native.includes('"AUTHENTICODE_STATUS=$($signature.Status)"'));
assert.ok(native.includes('"SHA256=$hash"'));
assert.ok(native.includes('"SIZE_BYTES=$installerSize"'));
assert.match(native, /android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
assert.ok(native.includes("codeforge-desktop.exe"));
assert.match(native, /Gradle native build attempt/);
assert.match(native, /Validate Android smoke script syntax/);
assert.ok(native.includes("bash -n scripts/android-install-smoke.sh"));
assert.ok(native.includes('BUNDLE_SHA_BEFORE') && native.includes('BUNDLE_SHA_AFTER'), "Android CI must verify the JS bundle survives disposable APK signing.");

const diskCleanupStep = native.indexOf("name: Reclaim build-only disk space before emulator provisioning");
const emulatorSmokeStep = native.indexOf("name: Install and launch Android app in disposable emulator");
assert.ok(diskCleanupStep >= 0 && diskCleanupStep < emulatorSmokeStep, "Android build-only disk cleanup must run before emulator provisioning.");
assert.ok(native.includes('test -s release/CodeForge-debug.apk'), "The staged debug APK must survive emulator disk cleanup.");
assert.ok(native.includes('test -s release/CodeForge-unsigned.apk'), "The staged release APK must survive emulator disk cleanup.");
assert.ok(native.includes('rm -rf "$HOME/.gradle/caches"'), "Gradle caches must be removed after APK staging to free emulator disk space.");
assert.ok(native.includes('rm -rf "$ANDROID_HOME/build-tools" "$ANDROID_HOME/platforms" "$ANDROID_HOME/ndk" "$ANDROID_HOME/cmake" "$ANDROID_HOME/system-images" "$ANDROID_HOME/emulator"'), "Build-only Android SDK packages must be removed before the emulator action reinstalls its required packages.");
assert.ok(native.includes('AVAILABLE_KB') && native.includes('5242880'), "Android emulator provisioning must fail with a clear diagnostic when less than 5 GiB is available.");
assert.ok(native.includes('df -h /'), "Android emulator CI must report filesystem usage before and after cleanup.");
assert.ok(native.includes('script: bash scripts/android-install-smoke.sh "$RUNNER_TEMP/CodeForge-smoke.apk"'), "Android WebView smoke must install the bundled release APK signed with a disposable CI-only key.");
assert.match(native, /Verify Android permission allowlist/);
assert.ok(native.includes("node scripts/verify-android-permissions.mjs release/ANDROID-RELEASE-METADATA.txt release/ANDROID-DEBUG-METADATA.txt"));
assert.ok(native.includes("node --test scripts/verify-android-permissions.test.mjs"));
assert.match(installers, /name: Verify Android permission allowlist/);
assert.ok(
  installers.includes("node scripts/verify-android-permissions.mjs release/APK-METADATA.txt"),
  "The production APK must pass the same fail-closed permission allowlist as CI before signing.",
);
const productionApkMetadataStep = installers.indexOf("name: Parse production APK manifest and align pre-sign APK");
const productionPermissionGateStep = installers.indexOf("name: Verify Android permission allowlist");
const productionSigningStep = installers.indexOf("name: Sign APK with durable production keystore");
assert.ok(productionApkMetadataStep >= 0, "The production APK metadata must be extracted before permission validation.");
assert.ok(
  productionPermissionGateStep > productionApkMetadataStep
    && productionPermissionGateStep < productionSigningStep,
  "The production APK permission gate must run before signing.",
);

for (const permission of blockedAndroidPermissions) {
  assert.ok(mobileConfig.expo.android.blockedPermissions.includes(permission), 'Android app config must block ' + permission + '.');
}
assert.ok(androidSmoke.includes("adb wait-for-device"));
assert.ok(androidSmoke.includes("adb install -r"));
assert.ok(androidSmoke.includes("adb shell monkey"));
assert.ok(androidSmoke.includes("pidof"));
assert.ok(androidSmoke.includes("FATAL EXCEPTION"));
assert.ok(androidSmoke.includes("adb uninstall"));
assert.ok(androidSmoke.includes("pm list packages"));
assert.match(native, /Enable KVM for hardware-accelerated Android emulator/);
assert.ok(native.includes("test -e /dev/kvm"), "Android emulator CI must fail clearly when KVM is unavailable.");
assert.match(native, /disable-linux-hw-accel: false/);
assert.ok(androidPreview.includes("-storetype JKS"), "Preview signing must use a keystore type that supports distinct key and store passwords.");
assert.ok(androidPreview.includes("EXPECTED_SHA: ${{ github.event.pull_request.head.sha || github.sha }}"));
assert.ok(androidPreview.includes('SOURCE_SHA="$(git rev-parse HEAD)"'));
assert.ok(androidPreview.includes('test "$SOURCE_SHA" = "$EXPECTED_SHA"'));
assert.ok(androidPreview.includes(String.raw`printf 'COMMIT=%s\n' "$SOURCE_SHA"`));
assert.ok(androidPreview.includes("CodeForge-Android-preview-${{ github.event.pull_request.head.sha || github.sha }}"));
assert.ok(androidPreview.includes("APK-METADATA.txt"));
assert.ok(androidPreview.includes("ANDROID-SIGNING-VERIFICATION.txt"));
assert.ok(!androidPreview.includes("GITHUB_SHA"));
assert.ok(!androidPreview.includes("CodeForge-signed-Android-APK"));
assert.ok(androidPreview.includes("-print -quit"));
assert.ok(androidPreview.includes("Required Android build tool is missing or not executable"));
assert.ok(androidPreview.includes("grep -q \"^package: name='com.codeforge.ide'\""));
assert.ok(androidPreview.includes("zipalign\" -c 4 release/CodeForge-aligned.apk"));
assert.ok(androidPreview.includes("--out release/CodeForge.apk release/CodeForge-aligned.apk"));
assert.ok(androidPreview.includes("verify --verbose --print-certs release/CodeForge.apk"));
assert.ok(androidPreview.includes("-alias codeforge-preview"));
assert.ok(androidPreview.includes("-validity 30"));
assert.ok(androidPreview.includes("SIGNING=ephemeral preview key valid for 30 days"));
assert.match(androidPreview, /trap 'rm -f "\$KEYSTORE_PATH" release\/CodeForge-aligned\.apk' EXIT/);
assert.doesNotMatch(androidPreview, /CodeForge-unaligned\\.apk|validity 10000/);
assert.match(native, /workflow-lint/);
assert.match(installers, /Gradle production build attempt/);
assert.match(publisher, /needs: \[verify-windows, verify-android\]/, 'A public release must wait for both signed-installer verification jobs.');
assert.match(publisher, /SIGNING_PROVIDER=SignPath Foundation/);
assert.match(publisher, /SIGNATURE_STATUS=Valid/);
assert.match(publisher, /WINDOWS_SIGNING_CERT_THUMBPRINT/);
assert.match(publisher, /ANDROID_SIGNING_CERT_SHA256/);
assert.match(publisher, /Get-AuthenticodeSignature release\/windows\/CodeForge-Setup-Windows\.exe/);
assert.match(publisher, /signtool\.FullName verify \/pa \/all \/v/);
assert.match(publisher, /sha256sum -c/);
assert.match(publisher, /apksigner.*verify/);
assert.match(publisher, /PACKAGE=com\.codeforge\.ide/);
assert.match(publisher, /workflow_run\.id/);
assert.match(publisher, /draft: true/);
assert.match(publisher, /make_latest: true/);
assert.match(publisher, /Prevent out-of-order release publication/);
assert.match(publisher, /check-release-sequence\.mjs/);
assert.match(publisher, /steps\.sequence\.outputs\.release_ready == 'true'/);
assert.match(publisher, /Verify public paired release downloads/);
assert.match(publisher, /CodeForge-Setup-Windows\.exe/);
assert.match(publisher, /CodeForge\.apk/);
assert.match(publisher, /android-actions\/setup-android@v4/, 'The release publisher must independently re-parse the Android APK.');
assert.match(publisher, /aapt" dump badging CodeForge\.apk/, 'The release publisher must parse the actual signed APK manifest/package.');
assert.ok(publisher.includes('node ../../scripts/verify-android-apk-metadata.mjs APK-METADATA-REVALIDATED.txt "$RUN_NUMBER" "1.0.$RUN_NUMBER"'), 'The release publisher must validate actual APK versionCode and versionName against the upstream run.');
assert.match(publisher, /zipalign" -c 4 CodeForge\.apk/, 'The final signed APK must pass ZIP alignment verification after signing.');
assert.match(publisher, /verify-android-permissions\.mjs/, 'The release publisher must re-run the Android permission allowlist against parsed APK metadata.');
assert.match(publisher, /apksigner" verify --verbose --Werr --print-certs CodeForge\.apk/, 'The release publisher must independently verify the APK signature and signer certificate.');
assert.match(installers, /zipalign" -c 4 release\/CodeForge\.apk/, 'Production APK must remain aligned after it is signed.');
assert.match(installers, /apksigner" verify --verbose --Werr --print-certs release\/CodeForge\.apk/, 'Production APK must pass strict apksigner verification.');
assert.match(installers, /name: Install and launch production-signed APK in disposable emulator/, 'The actual production-signed APK must install and launch before it can be uploaded.');
assert.match(installers, /reactivecircus\/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
assert.ok(installers.includes('script: bash scripts/android-install-smoke.sh release/CodeForge.apk'), 'The final signed Android APK must pass the hosted WebView readiness smoke test.');
assert.match(installers, /on:\s*push:\s*branches: \[main\]/, 'Every update pushed to main must trigger the paired installer build pipeline.');

const expectedPrRef = 'ref: ${{ github.event.pull_request.head.sha || github.sha }}';
for (const [name, workflow] of [
  ['Worker CI', workerCI],
  ['Native shells CI', native],
  ['Release policy', releasePolicy],
  ['Android preview', androidPreview],
]) {
  assert.ok(workflow.includes(expectedPrRef), name + ' must check out the exact PR head SHA.');
  assert.match(workflow, /Verify exact source revision/, name + ' must assert the checked-out SHA.');
  assert.ok(workflow.includes('shell: bash'), name + ' must use a portable shell for SHA verification.');
}
assert.equal((native.match(/Verify exact source revision/g) || []).length, 4);
assert.ok((native.match(/shell: bash/g) || []).length >= 4);
assert.ok(workerCI.includes('EXPECTED_SHA: ${{ github.event.pull_request.head.sha || github.sha }}'));
assert.ok(workerCI.includes('wrangler@4 deploy --dry-run --message "CodeForge commit $EXPECTED_SHA"'));
assert.ok(deploy.includes('EXPECTED_SHA: ${{ github.sha }}'));
assert.ok(installers.includes('EXPECTED_SHA: ${{ github.sha }}'));
assert.ok(publisher.includes('EXPECTED_SHA: ${{ github.event.workflow_run.head_sha }}'));
assert.ok(deploy.includes('wrangler@4 deploy --dry-run --message "CodeForge commit $SOURCE_SHA"'));
assert.ok(deploy.includes('wrangler@4 deploy --message "CodeForge commit $SOURCE_SHA"'));
assert.ok(deploy.includes('SOURCE_SHA: ${{ github.sha }}'));

const releaseSequenceFixtures = [
  { tag_name: 'v1.0.3', draft: false },
  { tag_name: 'v1.0.12', draft: false },
  { tag_name: 'v1.0.99', draft: true },
  { tag_name: 'v2.0.0', draft: false },
  { tag_name: 'latest', draft: false },
];
assert.equal(latestPublishedRunNumber(releaseSequenceFixtures), 12);
assert.equal(shouldPublishRelease(13, releaseSequenceFixtures), true);
assert.equal(shouldPublishRelease(12, releaseSequenceFixtures), false);
assert.equal(shouldPublishRelease(11, releaseSequenceFixtures), false);
assert.equal(shouldPublishRelease(1, []), true);
assert.throws(() => shouldPublishRelease(0, releaseSequenceFixtures), /positive safe integer/);

const testDirectory = mkdtempSync(join(tmpdir(), 'codeforge-release-sequence-'));
try {
  const makeEnv = (candidate, label) => ({
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_API_URL: 'https://api.github.com',
    GH_TOKEN: 'test-token',
    CANDIDATE_RUN_NUMBER: String(candidate),
    GITHUB_OUTPUT: join(testDirectory, label + '.out'),
    GITHUB_STEP_SUMMARY: join(testDirectory, label + '.summary'),
  });
  const fixtureFetch = async (url, options) => {
    assert.match(url, /\/repos\/owner\/repo\/releases\?per_page=100&page=1$/);
    assert.equal(options.headers.authorization, 'Bearer test-token');
    return new Response(JSON.stringify(releaseSequenceFixtures), { status: 200 });
  };
  const allowedDecision = await checkReleaseSequence(makeEnv(13, 'allowed'), fixtureFetch);
  assert.deepEqual(allowedDecision, { ready: true, latest: 12 });
  assert.match(readFileSync(join(testDirectory, 'allowed.out'), 'utf8'), /release_ready=true/);

  const blockedDecision = await checkReleaseSequence(makeEnv(12, 'blocked'), fixtureFetch);
  assert.deepEqual(blockedDecision, { ready: false, latest: 12 });
  assert.match(readFileSync(join(testDirectory, 'blocked.out'), 'utf8'), /release_ready=false/);

  let pageCalls = 0;
  const paginatedFetch = async () => {
    pageCalls += 1;
    const page = pageCalls === 1
      ? Array.from({ length: 100 }, (_, index) => ({ tag_name: 'preview-' + index, draft: true }))
      : [{ tag_name: 'v1.0.15', draft: false }];
    return new Response(JSON.stringify(page), { status: 200 });
  };
  const paginatedDecision = await checkReleaseSequence(makeEnv(16, 'paginated'), paginatedFetch);
  assert.deepEqual(paginatedDecision, { ready: true, latest: 15 });
  assert.equal(pageCalls, 2);

  await assert.rejects(
    checkReleaseSequence(makeEnv(20, 'api-failure'), async () => new Response('unavailable', { status: 503 })),
    /HTTP 503/,
  );
} finally {
  rmSync(testDirectory, { recursive: true, force: true });
}

assert.match(publisher, /gh release download/);
assert.ok(releaseSource.includes('PUBLISHED_RELEASE_TAG: string | null = null'));
assert.ok(releaseSource.includes('getReleaseDownloadUrl(asset: string)'));
assert.ok(releaseSource.includes('if (!tag ||'));
assert.ok(!releaseSource.includes('tag: string ='));
assert.ok(home.includes("getReleaseDownloadUrl('CodeForge-Setup-Windows.exe')"));
assert.ok(home.includes("getReleaseDownloadUrl('CodeForge.apk')"));


const androidSigningStep = installers.slice(
  installers.indexOf("name: Sign APK with durable production keystore"),
  installers.indexOf("name: Record Android build metadata and checksum"),
);
assert.ok(androidSigningStep.includes("for candidate_type in JKS PKCS12"), "Android signing must validate supported JKS and PKCS12 keystore formats.");
assert.ok(androidSigningStep.includes("-storetype"), "Android signing must use the detected keystore format.");
assert.ok(androidSigningStep.includes("--ks-type"), "apksigner must use the detected keystore type.");
assert.ok(androidSigningStep.includes("trap 'rm -f"), "Temporary release keystore files must be deleted on every exit.");
assert.ok(androidSigningStep.includes('apksigner" verify --verbose --Werr --print-certs'), "The final APK must pass strict signature verification.");
assert.ok(androidSigningStep.includes('zipalign" -c 4 release/CodeForge.apk'), "The final signed APK must remain zip-aligned.");
assert.ok(androidSigningStep.includes('extract-apksigner-cert.mjs release/ANDROID-SIGNING-VERIFICATION.txt'), 'The production build must parse both legacy and current apksigner signer lines.');
assert.doesNotMatch(androidSigningStep, /Signer #1 certificate SHA-256 digest/);
assert.doesNotMatch(androidSigningStep, /continue-on-error: true/);
assert.doesNotMatch(installers, /name: Stage unsigned APK when durable signing is unavailable/);
assert.ok(installers.includes("The Android production signing secrets are required"));
assert.ok(installers.includes("ANDROID_KEYSTORE_BASE64") && installers.includes("ANDROID_SIGNING_CERT_SHA256"));

const windowsSigningGate = installers.slice(
  installers.indexOf("name: Detect SignPath Foundation signing configuration"),
  installers.indexOf("name: Upload unsigned installer to GitHub for SignPath"),
);
assert.ok(windowsSigningGate.includes("SIGNPATH_API_TOKEN"));
assert.ok(windowsSigningGate.includes("Refusing to build or stage a Windows production installer without durable SignPath signing."), "Windows production signing must fail closed when SignPath is missing.");
assert.doesNotMatch(installers, /New-SelfSignedCertificate|SIGNING=self-signed/, "Production Windows installers must not fall back to self-signed certificates.");
assert.ok(installers.includes("SIGNING_PROVIDER=SignPath Foundation"));
assert.ok(installers.includes("SIGNATURE_STATUS=Valid"));
assert.ok(installers.includes("CERT_FILE_SHA256=$certificateFileHash"), "Windows signing metadata must bind the public SignPath certificate file hash.");
assert.ok(installers.includes("signtool") && installers.includes("verify /pa /all /v"));
assert.ok(legacyUnsignedPublisher.includes("if: ${{ false }}"), "The legacy unsigned release publisher must be disabled.");
assert.ok(legacyUnsignedPublisher.includes("contents: read") && !legacyUnsignedPublisher.includes("contents: write"));
assert.ok(versionedReleasePublisher.includes("SIGNING=durable"), "The public paired publisher must require durable signing.");
assert.ok(versionedReleasePublisher.includes("SIGNING_PROVIDER=SignPath Foundation"), "The paired publisher must verify the Windows signing provider.");
assert.ok(versionedReleasePublisher.includes("ANDROID_SIGNING_CERT_SHA256"), "The paired publisher must verify the Android signer fingerprint.");
assert.ok(desktopPreviewPublisher.includes("if: ${{ false }}"), "Standalone Windows preview release publication must be disabled.");
assert.ok(!desktopPreviewPublisher.includes("contents: write") && !desktopPreviewPublisher.includes("workflow_run:"), "The retired Windows preview workflow must not publish standalone EXE releases.");


const mobileApp = read("../apps/mobile/App.tsx");
assert.ok(mobileApp.includes("onHttpError"), "Android WebView must surface main-frame HTTP errors.");
assert.ok(mobileApp.includes("onRenderProcessGone"), "Android WebView renderer termination must be recoverable.");
assert.ok(mobileApp.includes("Linking.openURL"), "Android must provide an external-browser fallback.");
assert.ok(mobileApp.includes("onMessage"), "Android must wait for the hosted CodeForge app-ready handshake.");
assert.ok(mobileApp.includes("data-codeforge-app-ready"), "The WebView must wait for the actual mounted CodeForge application.");
assert.ok(home.includes("data-codeforge-app-ready"), "The hosted IDE must mark readiness only after React mounts.");
assert.ok(androidSmoke.includes("uiautomator dump") && androidSmoke.includes("CodeForge app ready"), "Android emulator smoke must wait for hosted-app readiness.");
assert.ok(androidSmoke.includes("svc wifi enable") && androidSmoke.includes("svc data enable"), "Android emulator smoke must enable Wi-Fi and data before hosted WebView verification.");
assert.ok(androidSmoke.includes("VALIDATED"), "Android emulator smoke must distinguish missing emulator internet from an app startup failure.");
assert.ok(native.includes("emulator-options: -no-window -gpu swiftshader_indirect -no-snapshot -noaudio -no-boot-anim -netdelay none -netspeed full"), "Android emulator must boot with explicit network settings for hosted WebView verification.");

const hostedSmoke = read("../scripts/verify-hosted-app.mjs");
const hostedSmokeTests = read("../scripts/verify-hosted-app.test.mjs");
assert.ok(hostedSmoke.includes("/api/health") && hostedSmoke.includes("/api/config"));
assert.ok(hostedSmoke.includes("/api/workspaces") && hostedSmoke.includes("Authentication required"));
assert.ok(hostedSmoke.includes("requireNoStoreHeaders"), "Production deploy must enforce no-store HTML headers.");
assert.ok(hostedSmokeTests.includes("requires no-store HTML when validating a completed production deployment"));
assert.ok(deploy.includes("REQUIRE_NO_STORE_HEADERS: 'true'"));
assert.ok(hostedSmoke.includes("/app") && hostedSmoke.includes("text/html"));
assert.ok(hostedSmoke.includes("text/css") && hostedSmoke.includes("javascript"));
assert.ok(hostedSmokeTests.includes("rejects a missing SPA asset"));
assert.ok(hostedSmokeTests.includes("rejects a Worker health response with a disconnected database"));
assert.ok(deploy.includes("verify-hosted-app.mjs"), "Production deploy must exercise the hosted mobile entry routes.");
assert.ok(native.includes("verify-hosted-app.mjs"), "Native-shell CI must validate the hosted app routes.");
assert.ok(native.includes("verify-android-webview.mjs"), "Native-shell CI must run the Android WebView readiness contract.");
assert.ok(releasePolicy.includes("verify-android-webview.mjs"), "Release-policy CI must run the Android WebView readiness contract.");
assert.ok(releasePolicy.includes("verify-hosted-app.test.mjs"), "Release-policy CI must run hosted-route regression tests.");
assert.ok(!read("../apps/web/src/styles.css").includes("fonts.googleapis.com"), "The Android-critical stylesheet must not block on Google Fonts.");
assert.match(home, /VERIFIED SIGNED RELEASE PENDING/);
assert.ok(!home.includes('releases/latest/download') && !home.includes('Self-signed installer'));
assert.ok(home.includes('PUBLISHED_RELEASE_TAG ? <a'), 'The website must link only to a verified release tag.');
assert.ok(home.includes('/releases/tag/${PUBLISHED_RELEASE_TAG}'), 'The website release link must target the verified tag only.');
assert.ok(!home.includes('View release history'), 'The website must not link users to historical unsigned release assets.');



assert.match(installers, /^on:\s*push:\s*branches: \[main\]\s*workflow_dispatch:/m, 'Production installers must run on main and manual dispatch only.');
assert.ok(publisher.includes('workflows: ["CodeForge production installers"]'));
assert.ok(publisher.includes('needs: [verify-windows, verify-android]'), 'The public release must depend on both signer-verification jobs.');
assert.ok(publisher.includes('github.event.workflow_run.head_sha'), 'The paired release must bind to the exact upstream source SHA.');
assert.ok(publisher.includes('CodeForge-Setup-Windows.exe') && publisher.includes('CodeForge.apk'), 'The public release must contain both installer formats.');
assert.ok(publisher.includes('cmp release/windows/CodeForge-Setup-Windows.exe'));
assert.ok(publisher.includes('cmp release/android/CodeForge.apk'));
assert.ok(publisher.includes('test "$ACTUAL_WINDOWS" = "$EXPECTED_WINDOWS"'));
assert.ok(publisher.includes('test "$ACTUAL_ANDROID" = "$EXPECTED_ANDROID"'));
assert.ok(publisher.includes('extract-apksigner-cert.mjs ANDROID-SIGNING-VERIFICATION-RELEASE.txt'), 'The independent release verifier must use the shared apksigner parser.');
assert.doesNotMatch(publisher, /Signer #1 certificate SHA-256 digest/);
assert.ok(desktopPreviewPublisher.includes('if: ${{ false }}'), 'Standalone self-signed Windows preview releases must be disabled.');
assert.ok(!desktopPreviewPublisher.includes('workflow_run:') && !desktopPreviewPublisher.includes('contents: write'), 'The retired Windows preview workflow must have no publication trigger or write permission.');

console.log('Release signing gates, exact-SHA checks, production probes, and sequence policy passed.');
