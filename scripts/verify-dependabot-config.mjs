import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const configuration = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');

assert.match(configuration, /^version:\s*2\s*$/m, 'Dependabot configuration must use schema version 2.');

const requiredUpdates = [
  { ecosystem: 'npm', directory: '/apps/web' },
  { ecosystem: 'npm', directory: '/apps/mobile' },
  { ecosystem: 'npm', directory: '/apps/desktop' },
  { ecosystem: 'cargo', directory: '/apps/desktop/src-tauri' },
  { ecosystem: 'github-actions', directory: '/' },
];

const starts = [...configuration.matchAll(/^  - package-ecosystem:.*$/gm)].map(match => match.index);
assert.equal(
  starts.length,
  requiredUpdates.length,
  'Dependabot must define exactly one update job for each supported ecosystem/directory pair.',
);

const entries = starts.map((start, index) =>
  configuration.slice(start, starts[index + 1] ?? configuration.length),
);
const readField = (entry, name, indentation = 4) => {
  const expression = new RegExp('^' + ' '.repeat(indentation) + name + ':\\s*(.*?)\\s*$', 'm');
  const match = expression.exec(entry);
  assert.ok(match, 'Missing Dependabot field: ' + name);
  return match[1].replace(/^["']|["']$/g, '');
};

for (const expected of requiredUpdates) {
  const matching = entries.filter(entry =>
    readField(entry, '- package-ecosystem', 2) === expected.ecosystem
      && readField(entry, 'directory') === expected.directory,
  );
  assert.equal(
    matching.length,
    1,
    'Expected exactly one ' + expected.ecosystem + ' update for ' + expected.directory,
  );

  const [entry] = matching;
  assert.equal(readField(entry, 'target-branch'), 'main', 'Updates must target main.');
  assert.equal(readField(entry, 'open-pull-requests-limit'), '5', 'Each ecosystem must cap open update PRs at five.');
  assert.equal(readField(entry, 'interval', 6), 'weekly', 'Every ecosystem must update weekly.');
  assert.equal(readField(entry, 'day', 6), 'wednesday', 'Every ecosystem must run on Wednesday.');
  assert.equal(readField(entry, 'time', 6), '04:00', 'Every ecosystem must use the 04:00 delivery window.');
  assert.equal(readField(entry, 'timezone', 6), 'Asia/Kolkata', 'Every ecosystem must use the India timezone.');
}

console.log('Dependabot schedule verified: web, Android, desktop, Cargo, and GitHub Actions; Wednesday 04:00 Asia/Kolkata; main target; five open PRs per ecosystem.');
