import { readFileSync } from 'node:fs';

function normalizeWindowsVersion(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+\.\d+\.\d+)(?:\.0)?$/);
  return match ? match[1] : null;
}

export function verifyWindowsInstallerVersion(metadata, expectedVersion) {
  const expected = normalizeWindowsVersion(expectedVersion);
  if (!expected || !/^1\.0\.\d+$/.test(expected)) {
    throw new Error('Expected Windows installer version must use the monotonic 1.0.<run-number> format.');
  }

  const productVersion = normalizeWindowsVersion(metadata?.ProductVersion);
  const fileVersion = normalizeWindowsVersion(metadata?.FileVersion);
  if (productVersion !== expected || fileVersion !== expected) {
    throw new Error('Windows installer ProductVersion and FileVersion must match expected version ' + expected + '.');
  }

  return { expectedVersion: expected, productVersion, fileVersion };
}

export function verifyWindowsInstallerVersionFile(path, expectedVersion) {
  const metadata = JSON.parse(readFileSync(path, 'utf8'));
  const verified = verifyWindowsInstallerVersion(metadata, expectedVersion);
  console.log(
    path + ': verified ProductVersion=' + verified.productVersion
    + ' FileVersion=' + verified.fileVersion,
  );
  return verified;
}

if (process.argv[1] && process.argv[1].endsWith('verify-windows-installer-version.mjs')) {
  const [path, expectedVersion] = process.argv.slice(2);
  if (!path || !expectedVersion) {
    console.error('Usage: node scripts/verify-windows-installer-version.mjs <version-info-json> <expected-version>');
    process.exitCode = 2;
  } else {
    try {
      verifyWindowsInstallerVersionFile(path, expectedVersion);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
