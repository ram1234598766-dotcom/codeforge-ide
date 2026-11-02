import { describe, expect, it } from 'vitest';
import { getReleaseDownloadUrl, VERIFIED_RELEASE_TAG } from './release';

describe('verified release downloads', () => {
  it('keeps downloads disabled until a verified release tag is pinned', () => {
    expect(VERIFIED_RELEASE_TAG).toBeNull();
    expect(getReleaseDownloadUrl('CodeForge-Setup-Windows.exe')).toBeNull();
    expect(getReleaseDownloadUrl('CodeForge.apk')).toBeNull();
  });

  it('pins each allowed asset to the exact verified release tag', () => {
    expect(getReleaseDownloadUrl('CodeForge.apk', 'v1.0.42')).toBe(
      'https://github.com/ram1234598766-dotcom/codeforge-ide/releases/download/v1.0.42/CodeForge.apk',
    );
  });

  it('rejects unverified aliases and arbitrary asset paths', () => {
    expect(getReleaseDownloadUrl('CodeForge.apk', 'latest')).toBeNull();
    expect(getReleaseDownloadUrl('../.env', 'v1.0.42')).toBeNull();
  });
});
