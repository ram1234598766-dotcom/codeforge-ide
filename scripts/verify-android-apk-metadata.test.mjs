import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAndroidApkBadging,
  verifyAndroidApkMetadata,
} from './verify-android-apk-metadata.mjs';

const fixture = `package: name='com.codeforge.ide' versionCode='36' versionName='1.0.36' platformBuildVersionName='16'
application-label:'CodeForge'
application-label-en:'CodeForge'
sdkVersion:'24'
targetSdkVersion:'36'
native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'
uses-permission: name='android.permission.INTERNET'
`;

test('parses actual aapt badging fields required for CodeForge APKs', () => {
  assert.deepEqual(parseAndroidApkBadging(fixture), {
    packageName: 'com.codeforge.ide',
    versionCode: 36,
    versionName: '1.0.36',
    applicationLabel: 'CodeForge',
    minSdkVersion: 24,
    targetSdkVersion: 36,
    abis: ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'],
  });
});

test('accepts the exact monotonic CodeForge production package version', () => {
  assert.equal(verifyAndroidApkMetadata(fixture, 36, '1.0.36').versionCode, 36);
});

test('rejects a mismatched package ID', () => {
  assert.throws(
    () => verifyAndroidApkMetadata(fixture.replace('com.codeforge.ide', 'com.example.other'), 36, '1.0.36'),
    /package ID mismatch/,
  );
});

test('rejects a mismatched version code or version name', () => {
  assert.throws(() => verifyAndroidApkMetadata(fixture, 35, '1.0.36'), /versionCode mismatch/);
  assert.throws(() => verifyAndroidApkMetadata(fixture, 36, '1.0.35'), /versionName mismatch/);
});

test('rejects an unexpected application label or SDK contract', () => {
  assert.throws(() => verifyAndroidApkMetadata(fixture.replace("application-label:'CodeForge'", "application-label:'Other'"), 36, '1.0.36'), /application label mismatch/);
  assert.throws(() => verifyAndroidApkMetadata(fixture.replace("sdkVersion:'24'", "sdkVersion:'23'"), 36, '1.0.36'), /minSdkVersion mismatch/);
  assert.throws(() => verifyAndroidApkMetadata(fixture.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'"), 36, '1.0.36'), /targetSdkVersion mismatch/);
});

test('rejects missing, duplicate, or unexpected ABI declarations', () => {
  assert.throws(() => verifyAndroidApkMetadata(fixture.replace(/^native-code:.*\n/m, ''), 36, '1.0.36'), /native-code ABI metadata/);
  assert.throws(() => verifyAndroidApkMetadata(fixture.replace("'x86_64'", "'x86_64' 'x86_64'"), 36, '1.0.36'), /duplicate ABI/);
  assert.throws(() => verifyAndroidApkMetadata(fixture.replace("'x86_64'", "'riscv64'"), 36, '1.0.36'), /supported ABIs mismatch/);
});
