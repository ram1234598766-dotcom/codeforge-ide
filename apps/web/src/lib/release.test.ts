import { describe, expect, it } from 'vitest';
import { getReleaseDownloadUrl, PUBLISHED_RELEASE_TAG } from './release';

const releaseBase = 'https://github.com/ram1234598766-dotcom/codeforge-ide/releases/download';

describe('published unsigned native release downloads', () => {
  it('pins downloads to the explicitly published versioned release', () => {
    expect(PUBLISHED_RELEASE_TAG).toBe('v1.0.26');
    expect(getReleaseDownloadUrl('CodeForge-Setup-Windows.exe')).toBe(
      releaseBase + '/v1.0.26/CodeForge-Setup-Windows.exe',
    );
    expect(getReleaseDownloadUrl('CodeForge.apk')).toBe(
      releaseBase + '/v1.0.26/CodeForge.apk',
    );
  });

  it('builds immutable URLs for explicitly supplied version tags', () => {
    expect(getReleaseDownloadUrl('CodeForge-Setup-Windows.exe', 'v1.0.42')).toBe(
      releaseBase + '/v1.0.42/CodeForge-Setup-Windows.exe',
    );
    expect(getReleaseDownloadUrl('CodeForge.apk', 'v1.0.42')).toBe(
      releaseBase + '/v1.0.42/CodeForge.apk',
    );
  });

  it('rejects moving aliases, malformed versions, and prerelease tags', () => {
    for (const tag of ['latest', 'main', 'v1', 'v1.0', 'v1.0.42-rc.1', '../v1.0.42', 'v1.0.42/other']) {
      expect(getReleaseDownloadUrl('CodeForge.apk', tag), tag).toBeNull();
    }
  });

  it('rejects unapproved assets and path or query injection', () => {
    for (const asset of [
      'CodeForge-SelfSigned.cer',
      '../.env',
      '../../etc/passwd',
      'CodeForge.apk?download=1',
      'https://example.com/payload.exe',
    ]) {
      expect(getReleaseDownloadUrl(asset, 'v1.0.42'), asset).toBeNull();
    }
  });
});
