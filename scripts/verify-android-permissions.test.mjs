import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  allowedAndroidDebugPermissions,
  allowedAndroidPermissions,
  blockedAndroidPermissions,
  parseAndroidPermissions,
  validateAndroidPermissions,
  verifyAndroidPermissionFiles,
} from './verify-android-permissions.mjs';

const minimalManifest = [
  "package: name='com.codeforge.ide'",
  "uses-permission: name='android.permission.INTERNET'",
  "uses-permission: name='com.codeforge.ide.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'",
].join('\n');

test('parses and sorts Android uses-permission entries', () => {
  assert.deepEqual(parseAndroidPermissions(minimalManifest), [...allowedAndroidPermissions].sort());
});

test('accepts the network-only CodeForge permission surface', () => {
  assert.deepEqual(
    validateAndroidPermissions(minimalManifest, 'fixture APK'),
    [...allowedAndroidPermissions].sort(),
  );
});

test('rejects storage, overlay, vibration, and local-network permissions', () => {
  for (const permission of blockedAndroidPermissions) {
    const output = minimalManifest + "\nuses-permission: name='" + permission + "'";
    assert.throws(
      () => validateAndroidPermissions(output, 'fixture APK'),
      error => error instanceof Error && error.message.includes(permission),
    );
  }
});

test('allows the React Native debug overlay permission only in the debug APK', () => {
  const debugManifest = minimalManifest + "\nuses-permission: name='android.permission.SYSTEM_ALERT_WINDOW'";
  assert.deepEqual(
    validateAndroidPermissions(debugManifest, 'debug APK', allowedAndroidDebugPermissions),
    [...allowedAndroidDebugPermissions].sort(),
  );
  assert.throws(
    () => validateAndroidPermissions(debugManifest, 'release APK'),
    /unexpected: android\.permission\.SYSTEM_ALERT_WINDOW/,
  );
  for (const permission of blockedAndroidPermissions.filter(value => value !== 'android.permission.SYSTEM_ALERT_WINDOW')) {
    assert.throws(
      () => validateAndroidPermissions(debugManifest + "\nuses-permission: name='" + permission + "'", 'debug APK', allowedAndroidDebugPermissions),
      error => error instanceof Error && error.message.includes(permission),
    );
  }
});

test('selects the debug-only allowlist from the metadata filename', () => {
  const directory = mkdtempSync(join(tmpdir(), 'codeforge-android-permissions-'));
  const debugPath = join(directory, 'ANDROID-DEBUG-METADATA.txt');
  const releasePath = join(directory, 'ANDROID-RELEASE-METADATA.txt');
  const debugManifest = minimalManifest + "\nuses-permission: name='android.permission.SYSTEM_ALERT_WINDOW'";
  try {
    writeFileSync(debugPath, debugManifest);
    writeFileSync(releasePath, minimalManifest);
    assert.doesNotThrow(() => verifyAndroidPermissionFiles([debugPath, releasePath]));
    writeFileSync(releasePath, debugManifest);
    assert.throws(() => verifyAndroidPermissionFiles([releasePath]), /SYSTEM_ALERT_WINDOW/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires INTERNET and rejects unrecognized permissions', () => {
  assert.throws(() => validateAndroidPermissions("uses-permission: name='android.permission.VIBRATE'"), /missing required/);
  assert.throws(
    () => validateAndroidPermissions(minimalManifest + "\nuses-permission: name='android.permission.CAMERA'"),
    /unexpected: android\.permission\.CAMERA/,
  );
});
