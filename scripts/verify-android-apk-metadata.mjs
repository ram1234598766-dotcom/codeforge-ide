import { readFileSync } from 'node:fs';

export const expectedAndroidApkContract = Object.freeze({
  packageName: 'com.codeforge.ide',
  applicationLabel: 'CodeForge',
  minSdkVersion: 24,
  targetSdkVersion: 36,
  abis: Object.freeze(['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']),
});

function requireMatch(output, pattern, label) {
  const match = output.match(pattern);
  if (!match) throw new Error('APK badging output is missing ' + label + '.');
  return match;
}

export function parseAndroidApkBadging(output) {
  if (typeof output !== 'string' || output.trim().length === 0) {
    throw new Error('APK badging output is empty.');
  }

  const pkg = requireMatch(
    output,
    /^package:\s+name='([^']+)'\s+versionCode='([^']+)'\s+versionName='([^']+)'/m,
    'package/version metadata',
  );
  const label = requireMatch(output, /^application-label:'([^']+)'/m, 'application label');
  const minSdk = requireMatch(output, /^sdkVersion:'([^']+)'/m, 'minimum SDK metadata');
  const targetSdk = requireMatch(output, /^targetSdkVersion:'([^']+)'/m, 'target SDK metadata');
  const abiLine = requireMatch(output, /^native-code:\s*(.+)$/m, 'native-code ABI metadata');
  const abis = [...abiLine[1].matchAll(/'([^']+)'/g)].map(match => match[1]).sort();

  const versionCode = Number(pkg[2]);
  const minSdkVersion = Number(minSdk[1]);
  const targetSdkVersion = Number(targetSdk[1]);
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0) {
    throw new Error('APK versionCode must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(minSdkVersion) || !Number.isSafeInteger(targetSdkVersion)) {
    throw new Error('APK SDK metadata must contain integer values.');
  }
  if (abis.length === 0) throw new Error('APK badging output contains no supported ABIs.');
  if (new Set(abis).size !== abis.length) throw new Error('APK badging output contains a duplicate ABI.');

  return {
    packageName: pkg[1],
    versionCode,
    versionName: pkg[3],
    applicationLabel: label[1],
    minSdkVersion,
    targetSdkVersion,
    abis,
  };
}

export function verifyAndroidApkMetadata(output, expectedVersionCode, expectedVersionName) {
  if (!Number.isSafeInteger(expectedVersionCode) || expectedVersionCode <= 0) {
    throw new Error('Expected Android versionCode must be a positive safe integer.');
  }
  if (typeof expectedVersionName !== 'string' || !/^1\.0\.[1-9][0-9]*$/.test(expectedVersionName)) {
    throw new Error('Expected Android versionName must use the monotonic 1.0.<run-number> format.');
  }

  const actual = parseAndroidApkBadging(output);
  const expected = expectedAndroidApkContract;
  if (actual.packageName !== expected.packageName) throw new Error('APK package ID mismatch: expected ' + expected.packageName + '.');
  if (actual.versionCode !== expectedVersionCode) throw new Error('APK versionCode mismatch: expected ' + expectedVersionCode + '.');
  if (actual.versionName !== expectedVersionName) throw new Error('APK versionName mismatch: expected ' + expectedVersionName + '.');
  if (actual.applicationLabel !== expected.applicationLabel) throw new Error('APK application label mismatch: expected ' + expected.applicationLabel + '.');
  if (actual.minSdkVersion !== expected.minSdkVersion) throw new Error('APK minSdkVersion mismatch: expected ' + expected.minSdkVersion + '.');
  if (actual.targetSdkVersion !== expected.targetSdkVersion) throw new Error('APK targetSdkVersion mismatch: expected ' + expected.targetSdkVersion + '.');
  if (JSON.stringify(actual.abis) !== JSON.stringify([...expected.abis].sort())) {
    throw new Error('APK supported ABIs mismatch: expected ' + [...expected.abis].sort().join(', ') + '.');
  }
  return actual;
}

export function verifyAndroidApkMetadataFile(path, expectedVersionCode, expectedVersionName) {
  const output = readFileSync(path, 'utf8');
  const metadata = verifyAndroidApkMetadata(output, expectedVersionCode, expectedVersionName);
  console.log(
    path + ': verified package=' + metadata.packageName
    + ' versionCode=' + metadata.versionCode
    + ' versionName=' + metadata.versionName
    + ' label=' + metadata.applicationLabel
    + ' minSdk=' + metadata.minSdkVersion
    + ' targetSdk=' + metadata.targetSdkVersion
    + ' ABIs=' + metadata.abis.join(','),
  );
  return metadata;
}

if (process.argv[1] && process.argv[1].endsWith('verify-android-apk-metadata.mjs')) {
  const [path, versionCodeText, versionName] = process.argv.slice(2);
  const versionCode = Number(versionCodeText);
  if (!path || !versionCodeText || !versionName) {
    console.error('Usage: node scripts/verify-android-apk-metadata.mjs <aapt-badging-file> <expected-version-code> <expected-version-name>');
    process.exitCode = 2;
  } else {
    try {
      verifyAndroidApkMetadataFile(path, versionCode, versionName);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
