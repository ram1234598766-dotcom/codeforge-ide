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
const publisher = read('../.github/workflows/publish-versioned-release.yml');
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
assert.match(installers, /SIGNING=unsigned/);
assert.doesNotMatch(installers, /WINDOWS_SIGNING_PFX_BASE64|New-SelfSignedCertificate/);
assert.match(installers, /ANDROID_KEYSTORE_BASE64/);
assert.match(installers, /id: android-signing-run/);
assert.match(installers, /continue-on-error: true/);
assert.match(installers, /steps\.android-signing-run\.outcome != 'success'/);
assert.match(installers, /Android keystore certificate SHA-256/);
assert.match(installers, /--key-pass env:ANDROID_KEY_PASSWORD/);
assert.match(installers, /--key-pass env:ANDROID_KEYSTORE_PASSWORD/);
assert.doesNotMatch(installers, /New-SelfSignedCertificate|keytool -genkeypair|codeforge-build-only|softprops\/action-gh-release/);
assert.match(installers, /SIGNING=unsigned/);
assert.match(native, /Build and install-smoke Windows NSIS installer/);
assert.match(native, /Get-AuthenticodeSignature/);
assert.match(native, /Silent NSIS install failed/);
assert.match(native, /Silent NSIS uninstall failed/);
assert.match(native, /android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
assert.ok(native.includes("codeforge-desktop.exe"));
assert.match(native, /Gradle native build attempt/);
assert.match(native, /Validate Android smoke script syntax/);
assert.ok(native.includes("bash -n scripts/android-install-smoke.sh"));
assert.ok(native.includes("script: bash scripts/android-install-smoke.sh release/CodeForge-debug.apk"));
assert.match(native, /Verify Android permission allowlist/);
assert.ok(native.includes("node scripts/verify-android-permissions.mjs release/ANDROID-RELEASE-METADATA.txt release/ANDROID-DEBUG-METADATA.txt"));
assert.ok(native.includes("node --test scripts/verify-android-permissions.test.mjs"));
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
assert.ok(androidPreview.includes("--out release/CodeForge.apk release/CodeForge-unaligned.apk"));
assert.ok(androidPreview.includes("verify --verbose --print-certs release/CodeForge.apk"));
assert.match(androidPreview, /trap 'rm -f "\$KEYSTORE_PATH" release\/CodeForge-unaligned\.apk' EXIT/);
assert.doesNotMatch(androidPreview, /CodeForge-preview\\.apk/);
assert.match(native, /workflow-lint/);
assert.match(installers, /Gradle production build attempt/);
assert.match(publisher, /WINDOWS_SIGNING.*!= "durable"/);
assert.match(publisher, /ANDROID_SIGNING.*!= "durable"/);
assert.match(publisher, /sha256sum -c/);
assert.match(publisher, /osslsigncode verify/);
assert.match(publisher, /apksigner.*verify/);
assert.match(publisher, /draft: true/);
assert.match(publisher, /make_latest: true/);
assert.match(publisher, /Prevent out-of-order release publication/);
assert.match(publisher, /check-release-sequence\.mjs/);
assert.match(publisher, /steps\.sequence\.outputs\.release_ready == 'true'/);

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
assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \| null = null/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates, exact-SHA checks, production probes, and sequence policy passed.');
