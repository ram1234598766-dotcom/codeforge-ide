import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const configuration = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');

assert.match(configuration, /^version:\s*2\s*$/m, 'Dependabot configuration must use schema version 2.');

const requiredUpdates = [
  ['npm', '/apps/web'],
  ['npm', '/apps/mobile'],
  ['npm', '/apps/desktop'],
  ['cargo', '/apps/desktop/src-tauri'],
  ['github-actions', '/'],
];

for (const [ecosystem, directory] of requiredUpdates) {
  assert.ok(
    configuration.includes('package-ecosystem: ' + ecosystem + '\n    directory: ' + directory),
    'Missing ' + ecosystem + ' dependency coverage for ' + directory,
  );
}

assert.equal(
  (configuration.match(/^\s+interval:\s*weekly\s*$/gm) || []).length,
  requiredUpdates.length,
  'Every configured dependency ecosystem must use a weekly schedule.',
);

console.log('Dependabot coverage includes web, Android, Windows desktop, Rust, and GitHub Actions.');
