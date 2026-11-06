export const PUBLISHED_RELEASE_TAG = 'v1.0.26' as const;

const RELEASE_BASE_URL = 'https://github.com/ram1234598766-dotcom/codeforge-ide/releases/download';
const ALLOWED_RELEASE_ASSETS = new Set(['CodeForge-Setup-Windows.exe', 'CodeForge.apk']);

export function getReleaseDownloadUrl(asset: string, tag: string = PUBLISHED_RELEASE_TAG): string | null {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || !ALLOWED_RELEASE_ASSETS.has(asset)) return null;
  return RELEASE_BASE_URL + '/' + tag + '/' + asset;
}
