import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allowedAndroidPermissions,
  blockedAndroidPermissions,
  parseAndroidPermissions,
  validateAndroidPermissions,
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

test('requires INTERNET and rejects unrecognized permissions', () => {
  assert.throws(() => validateAndroidPermissions("uses-permission: name='android.permission.VIBRATE'"), /missing required/);
  assert.throws(
    () => validateAndroidPermissions(minimalManifest + "\nuses-permission: name='android.permission.CAMERA'"),
    /unexpected: android\.permission\.CAMERA/,
  );
});
