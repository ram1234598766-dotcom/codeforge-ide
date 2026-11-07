import { describe, expect, it } from 'vitest';
import { getReleaseDownloadUrl, PUBLISHED_RELEASE_TAG } from './release';

describe('verified native release downloads', () => {
  it('keeps both installer links disabled until a paired signed release is approved', () => {
    expect(PUBLISHED_RELEASE_TAG).toBeNull();
    expect(getReleaseDownloadUrl('CodeForge-Setup-Windows.exe')).toBeNull();
    expect(getReleaseDownloadUrl('CodeForge.apk')).toBeNull();
  });

  it('rejects unapproved assets while native release publication is blocked', () => {
    for (const asset of [
      'CodeForge-SelfSigned.cer',
      '../.env',
      '../../etc/passwd',
      'CodeForge.apk?download=1',
      'https://example.com/payload.exe',
    ]) {
      expect(getReleaseDownloadUrl(asset)).toBeNull();
    }
  });
});
