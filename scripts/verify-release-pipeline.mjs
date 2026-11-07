import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestPublishedRunNumber, shouldPublishRelease, main as checkReleaseSequence } from './check-release-sequence.mjs';
import { blockedAndroidPermissions } from './verify-android-permissions.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const installers = read('../.github/workflows/production-installers.yml');
const native = read('../.github/workflows/native-shells-ci.yml');
const mobileConfig = JSON.parse(read('../apps/mobile/app.json'));
const workerCI = read('../.github/workflows/codeforge-worker-ci.yml');
const releasePolicy = read('../.github/workflows/release-policy.yml');
const androidPreview = read('../.github/workflows/android-apk.yml');
const androidSmoke = read('../scripts/android-install-smoke.sh');
const deploy = read('../.github/workflows/deploy-worker.yml');

const d1MigrationTest = read('../scripts/test-d1-migrations.py');

assert.ok(deploy.includes('\non:\n  workflow_dispatch:\n'), 'Production deployment must be manual-dispatch only.');
assert.ok(deploy.includes("if: ${{ github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' }}"), 'Production deployment must run from main only.');
assert.ok(deploy.includes('SOURCE_REF: ${{ github.ref }}'), 'Deployment must capture the selected source ref.');
assert.ok(deploy.includes('test "$SOURCE_REF" = "refs/heads/main"'), 'Deployment must reject non-main source refs.');
assert.ok(!deploy.includes('\n  push:') && !deploy.includes('\n  pull_request:'), 'Production deployment must not run on push or PR close.');
assert.ok(deploy.includes('confirm_production_deploy:') && deploy.includes('required: true'), 'Production deployment must require an explicit confirmation input.');
assert.ok(deploy.includes('test "$CONFIRM_PRODUCTION_DEPLOY" = "DEPLOY"'), 'Production deployment must reject an unconfirmed dispatch.');
assert.ok(deploy.includes('apply_d1_migrations:') && deploy.includes('default: "false"'), 'D1 migrations must default to disabled.');
assert.ok(deploy.includes('confirm_d1_migrations:') && deploy.includes('required: false'), 'D1 migration confirmation must be an explicit optional input.');
assert.ok(deploy.includes('test "$CONFIRM_D1_MIGRATIONS" = "APPLY D1 MIGRATIONS"'), 'D1 migrations must require separate confirmation.');
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
const desktopPreviewPublisher = read('../.github/workflows/publish-desktop-preview.yml');
const unsignedPublisher = read('../.github/workflows/publish-unsigned-release.yml');
const home = read('../apps/web/src/main.tsx');
const releaseSource = read('../apps/web/src/lib/release.ts');

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
assert.match(installers, /uses: actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
assert.match(installers, /actions: read/);
assert.match(installers, /GITHUB_REF -ne 'refs\/heads\/main'/);
assert.match(installers, /archive: false/);
assert.match(installers, /wait-for-completion: true/);
assert.match(installers, /skip-decompress: true/);
assert.match(installers, /SIGNPATH_SIGNING_REQUEST_ID\)\) \{/);
assert.match(installers, /timeout-minutes: 120/);
assert.match(installers, /Get-AuthenticodeSignature release\/CodeForge-Setup-Windows\.exe/);

assert.match(installers, /if \(\$signing -eq "SIGNING=unsigned"\)/, 'Unsigned Windows previews must independently verify that Authenticode reports NotSigned.');
assert.match(installers, /\$signature\.Status -ne "NotSigned"/, 'An unsigned preview must fail if the installer has any other Authenticode status.');

assert.match(installers, /SIGNING=unsigned/);
assert.doesNotMatch(installers, /WINDOWS_SIGNING_PFX_BASE64|New-SelfSignedCertificate/);
assert.match(installers, /ANDROID_KEYSTORE_BASE64/);
assert.match(installers, /id: android-signing-run/);
assert.match(installers, /continue-on-error: true/);
assert.match(installers, /steps\.android-signing-run\.outcome != 'success'/);
assert.match(installers, /ANDROID_KEYSTORE_BASE64 is not valid base64-encoded keystore data/);
assert.match(installers, /Decoded Android keystore size/);
assert.match(installers, /Android keystore opened successfully/);
assert.match(installers, /ANDROID_KEY_ALIAS was not found in it/);
assert.match(installers, /Safe keytool diagnostic/);
assert.match(installers, /Android keystore certificate SHA-256/);
assert.match(installers, /--key-pass env:ANDROID_KEY_PASSWORD/);
assert.match(installers, /--key-pass env:ANDROID_KEYSTORE_PASSWORD/);
assert.doesNotMatch(installers, /New-SelfSignedCertificate|keytool -genkeypair|codeforge-build-only|softprops\/action-gh-release/);
assert.match(installers, /SIGNING=unsigned/);
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

const diskCleanupStep = native.indexOf("name: Reclaim build-only disk space before emulator provisioning");
const emulatorSmokeStep = native.indexOf("name: Install and launch Android app in disposable emulator");
assert.ok(diskCleanupStep >= 0 && diskCleanupStep < emulatorSmokeStep, "Android build-only disk cleanup must run before emulator provisioning.");
assert.ok(native.includes('test -s release/CodeForge-debug.apk'), "The staged debug APK must survive emulator disk cleanup.");
assert.ok(native.includes('test -s release/CodeForge-unsigned.apk'), "The staged release APK must survive emulator disk cleanup.");
assert.ok(native.includes('rm -rf "$HOME/.gradle/caches"'), "Gradle caches must be removed after APK staging to free emulator disk space.");
assert.ok(native.includes('rm -rf "$ANDROID_HOME/build-tools" "$ANDROID_HOME/platforms" "$ANDROID_HOME/ndk" "$ANDROID_HOME/cmake" "$ANDROID_HOME/system-images" "$ANDROID_HOME/emulator"'), "Build-only Android SDK packages must be removed before the emulator action reinstalls its required packages.");
assert.ok(native.includes('AVAILABLE_KB') && native.includes('5242880'), "Android emulator provisioning must fail with a clear diagnostic when less than 5 GiB is available.");
assert.ok(native.includes('df -h /'), "Android emulator CI must report filesystem usage before and after cleanup.");
assert.ok(native.includes("script: bash scripts/android-install-smoke.sh release/CodeForge-debug.apk"));
assert.match(native, /Verify Android permission allowlist/);
assert.ok(native.includes("node scripts/verify-android-permissions.mjs release/ANDROID-RELEASE-METADATA.txt release/ANDROID-DEBUG-METADATA.txt"));
assert.ok(native.includes("node --test scripts/verify-android-permissions.test.mjs"));
assert.match(installers, /name: Verify Android permission allowlist/);
assert.ok(
  installers.includes("node scripts/verify-android-permissions.mjs release/APK-METADATA.txt"),
  "The production APK must pass the same fail-closed permission allowlist as CI before signing or unsigned staging.",
);
const productionApkMetadataStep = installers.indexOf("name: Align APK and record package metadata");
const productionPermissionGateStep = installers.indexOf("name: Verify Android permission allowlist");
const productionSigningStep = installers.indexOf("name: Sign APK with durable production keystore");
const productionUnsignedStageStep = installers.indexOf("name: Stage unsigned APK when durable signing is unavailable");
assert.ok(productionApkMetadataStep >= 0, "The production APK metadata must be extracted before permission validation.");
assert.ok(
  productionPermissionGateStep > productionApkMetadataStep
    && productionPermissionGateStep < productionSigningStep
    && productionPermissionGateStep < productionUnsignedStageStep,
  "The production APK permission gate must run before signing and before any unsigned fallback is staged.",
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
assert.match(publisher, /ANDROID_SIGNING.*!= "durable"/);
assert.doesNotMatch(publisher, /WINDOWS_SIGNING|osslsigncode|CodeForge-Setup-Windows/);
assert.match(publisher, /ANDROID_SIGNING_CERT_SHA256/);
assert.match(publisher, /sha256sum -c/);
assert.match(publisher, /apksigner.*verify/);
assert.match(publisher, /PACKAGE=com\.codeforge\.ide/);
assert.match(publisher, /workflow_run\.id/);
assert.match(publisher, /draft: true/);
assert.match(publisher, /make_latest: true/);
assert.match(publisher, /Prevent out-of-order release publication/);
assert.match(publisher, /check-release-sequence\.mjs/);
assert.match(publisher, /steps\.sequence\.outputs\.release_ready == 'true'/);
assert.match(publisher, /Verify published APK download/);
assert.doesNotMatch(publisher, /CodeForge-Setup-Windows\.exe/);

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
assert.ok(deploy.includes('$BASE_URL/api/health'));
assert.ok(deploy.includes('$BASE_URL/api/config'));
assert.ok(deploy.includes('$BASE_URL/api/workspaces'));
assert.match(deploy, /Probe production Worker and static assets/);

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
assert.match(releaseSource, /PUBLISHED_RELEASE_TAG:\s*string \| null = null/);
assert.match(releaseSource, /getReleaseDownloadUrl\(asset: string\)/);
assert.match(releaseSource, /if \(!tag \|\|/);
assert.doesNotMatch(releaseSource, /tag: string =/);
assert.match(unsignedPublisher, /SOURCE_RUN_ID: 42230415496/);
assert.match(unsignedPublisher, /SOURCE_SHA: f2e8d0d13467e765f29c2a8f5dcdb973ad39e58b/);
assert.match(unsignedPublisher, /RELEASE_TAG: v1\.0\.26/);
assert.match(unsignedPublisher, /SIGNING=unsigned/);
assert.match(unsignedPublisher, /SHA256-Android\.txt/);
assert.match(unsignedPublisher, /SHA256-Windows\.txt/);
assert.match(unsignedPublisher, /CodeForge\.apk/);
assert.match(unsignedPublisher, /CodeForge-Setup-Windows\.exe/);
assert.match(unsignedPublisher, /draft: false/);
assert.match(unsignedPublisher, /make_latest: true/);
assert.match(unsignedPublisher, /Verify public release assets and checksums/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates, exact-SHA checks, production probes, and sequence policy passed.');

assert.ok(desktopPreviewPublisher.includes('workflow_run:'), 'Desktop preview releases must be triggered by completed production installer runs.');
assert.ok(!desktopPreviewPublisher.includes('  push:'), 'Desktop preview publication must be tied to completed installer runs only.');
assert.match(installers, /^on:\s*push:\s*branches: \[main\]\s*workflow_dispatch:/m, 'Production installers must run on every main update so each update can produce a Windows preview.');
assert.ok(desktopPreviewPublisher.includes('workflows: ["CodeForge production installers"]'));
assert.ok(desktopPreviewPublisher.includes("github.event.workflow_run.conclusion == 'success'"));
assert.ok(desktopPreviewPublisher.includes("github.event.workflow_run.head_branch == 'main'"));
assert.ok(desktopPreviewPublisher.includes('.head_sha == $sha'), 'The upstream artifact run must match the exact source SHA.');
assert.ok(desktopPreviewPublisher.includes('COMMIT=$SOURCE_SHA'));
assert.ok(desktopPreviewPublisher.includes('WORKFLOW_RUN_ID=$UPSTREAM_RUN_ID'));
assert.ok(desktopPreviewPublisher.includes('SOURCE_SHA: ${{ github.event.workflow_run.head_sha }}'));
assert.ok(desktopPreviewPublisher.includes('UPSTREAM_RUN_ID: ${{ github.event.workflow_run.id }}'));
assert.ok(desktopPreviewPublisher.includes('jq -e'));
assert.ok(desktopPreviewPublisher.includes('--arg sha "$SOURCE_SHA"'));
assert.ok(!desktopPreviewPublisher.includes('EVENT_NAME'));
assert.ok(!desktopPreviewPublisher.includes('PUSH_BASE_SHA'));
assert.ok(desktopPreviewPublisher.includes('SIGNING=unsigned'));
assert.ok(desktopPreviewPublisher.includes('SIGNATURE_STATUS=not-signed'));
assert.ok(desktopPreviewPublisher.includes('sha256sum -c SHA256-Windows.txt'));
assert.ok(desktopPreviewPublisher.includes('prerelease: true'));
assert.ok(desktopPreviewPublisher.includes('make_latest: false'));
assert.ok(desktopPreviewPublisher.includes('desktop-preview'));
assert.ok(desktopPreviewPublisher.includes('UNSIGNED PREVIEW'));
assert.ok(desktopPreviewPublisher.includes('gh release download'));
assert.ok(desktopPreviewPublisher.includes('cmp release/windows/CodeForge-Setup-Windows.exe'));
assert.ok(desktopPreviewPublisher.includes('test "$ACTUAL" = "$EXPECTED"'));
assert.ok(desktopPreviewPublisher.includes('contents: write'));
