import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const requiredVersions = Object.freeze({
  glob: '14.0.2',
  minimatch: '11.0.1',
});

export const requiredMobileDependencies = Object.freeze([
  'expo',
  'react',
  'react-native',
  'react-native-webview',
]);

export function collectDependencyVersions(tree) {
  const found = { glob: [], minimatch: [] };
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    for (const [name, dependency] of Object.entries(node.dependencies || {})) {
      if (Object.hasOwn(found, name) && typeof dependency?.version === 'string') {
        found[name].push(dependency.version);
      }
      visit(dependency);
    }
  };
  visit(tree);
  return found;
}

export function verifyDependencyTree(tree) {
  const rootDependencies = tree?.dependencies || {};
  for (const name of requiredMobileDependencies) {
    assert.ok(
      typeof rootDependencies[name]?.version === 'string',
      'Missing installed mobile dependency ' + name + '.',
    );
  }

  const found = collectDependencyVersions(tree);
  for (const name of Object.keys(requiredVersions)) {
    assert.ok(
      found[name].every(version => version === requiredVersions[name]),
      name + ' must resolve only to ' + requiredVersions[name] + '; found: '
        + (found[name].length ? found[name].join(', ') : 'no installed instances'),
    );
  }
  return found;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const output = execFileSync('npm', ['ls', '--workspace=@codeforge/mobile', '--all', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const found = verifyDependencyTree(JSON.parse(output));
  console.log('Verified mobile workspace dependency tree: '
    + 'glob=' + (found.glob.length ? [...new Set(found.glob)].join(',') : 'absent')
    + '; minimatch=' + (found.minimatch.length ? [...new Set(found.minimatch)].join(',') : 'absent'));
}
