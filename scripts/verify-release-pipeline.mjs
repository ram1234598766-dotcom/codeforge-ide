import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const installers = read('../.github/workflows/production-installers.yml');
const release = read('../.github/workflows/publish-versioned-release.yml');
const home = read('../apps/web/src/main.tsx');
const releaseSource = read('../apps/web/src/lib/release.ts');

assert.match(installers, /WINDOWS_SIGNING_PFX_BASE64/);
assert.match(installers, /ANDROID_KEYSTORE_BASE64/);
assert.doesNotMatch(installers, /New-SelfSignedCertificate|keytool -genkeypair|codeforge-build-only|softprops\\/action-gh-release/);
assert.match(installers, /SIGNING=unsigned/);
assert.match(release, /SIGNING=durable/);
assert.match(release, /sha256sum -c/);
assert.match(release, /osslsigncode verify/);
assert.match(release, /apksigner.*verify/);
assert.match(release, /draft: true/);
assert.match(release, /make_latest: true/);
assert.match(release, /gh release download/);
assert.match(releaseSource, /VERIFIED_RELEASE_TAG: string \\| null = null/);
assert.match(home, /getReleaseDownloadUrl\\('CodeForge-Setup-Windows\\.exe'\\)/);
assert.match(home, /getReleaseDownloadUrl\\('CodeForge\\.apk'\\)/);
assert.doesNotMatch(home, /releases\\/latest\\/download|Self-signed installer/);

console.log('Release signing gates and public download state are fail-closed.');
