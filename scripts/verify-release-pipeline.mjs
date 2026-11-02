import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestPublishedRunNumber, shouldPublishRelease, main as checkReleaseSequence } from './check-release-sequence.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const installers = read('../.github/workflows/production-installers.yml');
const native = read('../.github/workflows/native-shells-ci.yml');
const workerCI = read('../.github/workflows/codeforge-worker-ci.yml');
const releasePolicy = read('../.github/workflows/release-policy.yml');
const androidPreview = read('../.github/workflows/android-apk.yml');
const deploy = read('../.github/workflows/deploy-worker.yml');
const installersWorkflow = read('../.github/workflows/production-installers.yml');
const release = read('../.github/workflows/publish-versioned-release.yml');
const home = read('../apps/web/src/main.tsx');
const releaseSource = read('../apps/web/src/lib/release.ts');

assert.match(installers, /WINDOWS_SIGNING_PFX_BASE64/);
assert.match(installers, /ANDROID_KEYSTORE_BASE64/);
assert.doesNotMatch(installers, /New-SelfSignedCertificate|keytool -genkeypair|codeforge-build-only|softprops\/action-gh-release/);
assert.match(installers, /SIGNING=unsigned/);
assert.match(native, /Build and install-smoke Windows NSIS installer/);
assert.match(native, /Get-AuthenticodeSignature/);
assert.match(native, /Silent NSIS install failed/);
assert.match(native, /Silent NSIS uninstall failed/);
assert.match(native, /android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
assert.match(native, /adb install -r release\/CodeForge-debug\.apk/);
assert.ok(native.includes("adb shell pm list packages | grep -q"));
assert.ok(native.includes("codeforge-desktop.exe"));
assert.ok(native.includes("adb uninstall com.codeforge.ide"));
assert.match(native, /Gradle native build attempt/);
assert.match(native, /workflow-lint/);
assert.match(installers, /Gradle production build attempt/);
assert.match(release, /WINDOWS_SIGNING.*!= "durable"/);
assert.match(release, /ANDROID_SIGNING.*!= "durable"/);
assert.match(release, /sha256sum -c/);
assert.match(release, /osslsigncode verify/);
assert.match(release, /apksigner.*verify/);
assert.match(release, /draft: true/);
assert.match(release, /make_latest: true/);
assert.match(release, /Prevent out-of-order release publication/);
assert.match(release, /check-release-sequence\.mjs/);
assert.match(release, /steps\.sequence\.outputs\.release_ready == 'true'/);
assert.match(release, /actions\/checkout@v4/);

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

assert.match(release, /gh release download/);
const exactPrRef = /ref: ${'\\
assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \| null = null/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates and public download state are fail-closed.');
}\\{\\{ github\\.event\\.pull_request\\.head\\.sha \\|\\| github\\.sha \\}\\}/;
for (const [name, workflow] of [
  ['Worker CI', workerCI],
  ['Native shells CI', native],
  ['Release policy', releasePolicy],
  ['Android preview', androidPreview],
]) {
  assert.match(workflow, exactPrRef, name + ' must check out the exact PR head SHA.');
  assert.match(workflow, /Verify exact source revision/, name + ' must assert the checked-out SHA.');
}
assert.equal((native.match(/Verify exact source revision/g) || []).length, 4);
assert.match(deploy, /EXPECTED_SHA: ${'\\
assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \| null = null/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates and public download state are fail-closed.');
}\\{\\{ github\\.sha \\}\\}/);
assert.match(installersWorkflow, /EXPECTED_SHA: ${'\\
assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \| null = null/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates and public download state are fail-closed.');
}\\{\\{ github\\.sha \\}\\}/);
assert.match(release, /EXPECTED_SHA: ${'\\
assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \| null = null/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates and public download state are fail-closed.');
}\\{\\{ github\\.event\\.workflow_run\\.head_sha \\}\\}/);
assert.match(deploy, /wrangler@4 deploy --dry-run/);
assert.match(deploy, /api\\/health/);
assert.match(deploy, /api\\/config/);
assert.match(deploy, /api\\/workspaces/);
assert.match(deploy, /production Worker and static assets/);

assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \| null = null/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge-Setup-Windows\.exe'\)/);
assert.match(home, /getReleaseDownloadUrl\('CodeForge\.apk'\)/);
assert.doesNotMatch(home, /releases\/latest\/download|Self-signed installer/);

console.log('Release signing gates and public download state are fail-closed.');
