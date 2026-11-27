import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { requiredVersions, verifyDependencyTree } from './verify-mobile-dependency-tree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackage = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const mobilePackage = JSON.parse(readFileSync(path.join(root, 'apps/mobile/package.json'), 'utf8'));
const nativeWorkflow = readFileSync(path.join(root, '.github/workflows/native-shells-ci.yml'), 'utf8');
const releaseWorkflow = readFileSync(path.join(root, '.github/workflows/release-policy.yml'), 'utf8');

const patchedTree = {
  dependencies: {
    expo: {
      version: '58.0.0',
      dependencies: {
        glob: { version: requiredVersions.glob, dependencies: { minimatch: { version: requiredVersions.minimatch } } },
      },
    },
  },
};

const noAffectedPackagesTree = { dependencies: { expo: { version: '58.0.0' } } };
const globOnlyTree = {
  dependencies: {
    expo: {
      version: '58.0.0',
      dependencies: { glob: { version: requiredVersions.glob } },
    },
  },
};
const minimatchOnlyTree = {
  dependencies: {
    expo: {
      version: '58.0.0',
      dependencies: { minimatch: { version: requiredVersions.minimatch } },
    },
  },
};

test('root workspace pins patched glob and minimatch versions', () => {
  assert.equal(rootPackage.overrides?.glob, requiredVersions.glob);
  assert.equal(rootPackage.overrides?.minimatch, requiredVersions.minimatch);
});

test('Expo SDK and React Native compatibility versions remain unchanged', () => {
  assert.equal(mobilePackage.dependencies.expo, '~58.0.0');
  assert.equal(mobilePackage.dependencies['react-native'], '0.88.1');
  assert.equal(mobilePackage.dependencies.react, '19.3.0');
});

test('dependency verifier accepts a fully patched nested tree', () => {
  assert.doesNotThrow(() => verifyDependencyTree(patchedTree));
});

test('dependency verifier accepts a tree where neither audited transitive package is installed', () => {
  assert.deepEqual(verifyDependencyTree(noAffectedPackagesTree), { glob: [], minimatch: [] });
});

test('dependency verifier accepts glob when optional minimatch is absent', () => {
  assert.deepEqual(verifyDependencyTree(globOnlyTree), { glob: [requiredVersions.glob], minimatch: [] });
});

test('dependency verifier accepts minimatch when optional glob is absent', () => {
  assert.deepEqual(verifyDependencyTree(minimatchOnlyTree), { glob: [], minimatch: [requiredVersions.minimatch] });
});

test('dependency verifier rejects vulnerable glob versions', () => {
  const tree = structuredClone(patchedTree);
  tree.dependencies.expo.dependencies.glob.version = '14.0.1';
  assert.throws(() => verifyDependencyTree(tree), /glob must resolve only to 14\.0\.2/);
});

test('dependency verifier rejects minimatch versions below the current security pin', () => {
  const tree = structuredClone(patchedTree);
  tree.dependencies.expo.dependencies.glob.dependencies.minimatch.version = '11.0.6';
  assert.throws(() => verifyDependencyTree(tree), /minimatch must resolve only to 11\.0\.8/);
});

test('Android CI enforces the moderate audit threshold and inspects the resolved tree', () => {
  assert.match(nativeWorkflow, /npm audit --audit-level=moderate/);
  assert.match(nativeWorkflow, /verify-mobile-dependency-tree\.mjs/);
});

test('release-policy CI runs this dependency regression suite', () => {
  assert.match(releaseWorkflow, /verify-mobile-dependency-tree\.test\.mjs/);
});
