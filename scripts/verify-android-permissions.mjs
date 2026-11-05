import { readFileSync } from 'node:fs';

export const blockedAndroidPermissions = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
  'android.permission.ACCESS_LOCAL_NETWORK',
];

export const allowedAndroidPermissions = [
  'android.permission.INTERNET',
  'com.codeforge.ide.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
];

// React Native adds SYSTEM_ALERT_WINDOW to debug builds for its developer overlay.
// It remains blocked from the production APK.
export const allowedAndroidDebugPermissions = [
  ...allowedAndroidPermissions,
  'android.permission.SYSTEM_ALERT_WINDOW',
];

export function parseAndroidPermissions(badgingOutput) {
  const permissions = new Set();
  const pattern = /^\s*uses-permission(?:-[^:]+)?\s*:\s*name='([^']+)'/gm;
  for (const match of badgingOutput.matchAll(pattern)) {
    permissions.add(match[1]);
  }
  return [...permissions].sort();
}

export function validateAndroidPermissions(badgingOutput, source = 'APK', allowedPermissions = allowedAndroidPermissions) {
  const actual = parseAndroidPermissions(badgingOutput);
  const allowed = new Set(allowedPermissions);
  const required = new Set(['android.permission.INTERNET']);
  const missing = [...required].filter(permission => !actual.includes(permission));
  const unexpected = actual.filter(permission => !allowed.has(permission));

  if (actual.length === 0) {
    throw new Error(source + ': no Android uses-permission entries were found in aapt output.');
  }
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length ? 'missing required: ' + missing.join(', ') : '',
      unexpected.length ? 'unexpected: ' + unexpected.join(', ') : '',
    ].filter(Boolean).join('; ');
    throw new Error(source + ': Android permission policy failed (' + details + ').');
  }
  return actual;
}

export function verifyAndroidPermissionFiles(paths) {
  for (const path of paths) {
    const output = readFileSync(path, 'utf8');
    const allowedPermissions = /ANDROID-DEBUG-METADATA\\.txt$/i.test(path)
      ? allowedAndroidDebugPermissions
      : allowedAndroidPermissions;
    const permissions = validateAndroidPermissions(output, path, allowedPermissions);
    console.log(path + ': allowed permissions: ' + permissions.join(', '));
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-android-permissions.mjs')) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error('Usage: node scripts/verify-android-permissions.mjs <aapt-badging-file> [<aapt-badging-file> ...]');
    process.exitCode = 2;
  } else {
    try {
      verifyAndroidPermissionFiles(paths);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
