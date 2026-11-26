import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { parseWranglerTables, verifyPreviewIsolation } from './verify-cloudflare-preview-isolation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const tables = parseWranglerTables(wrangler);
const productionD1Id = tables.get('d1_databases')?.[0]?.database_id;
const previewD1Id = tables.get('previews.d1_databases')?.[0]?.database_id;
const productionKvId = tables.get('kv_namespaces')?.[0]?.id;
const previewKvId = tables.get('previews.kv_namespaces')?.[0]?.id;

function replaceOnce(source, from, to) {
  assert.ok(source.includes(from), 'Expected fixture fragment not found: ' + from);
  return source.replace(from, to);
}

test('current Wrangler config isolates preview D1 and KV from production', () => {
  assert.deepEqual(verifyPreviewIsolation(wrangler), []);
  assert.notEqual(productionD1Id, previewD1Id);
  assert.notEqual(productionKvId, previewKvId);
});

test('allows unrelated D1 and KV bindings while preserving CodeForge isolation', () => {
  const fixture = wrangler
    + '\n[[d1_databases]]\nbinding = "ANALYTICS_DB"\ndatabase_name = "analytics"\ndatabase_id = "fixture-analytics-db"\n'
    + '\n[[kv_namespaces]]\nbinding = "CACHE_KV"\nid = "fixture-cache-kv"\n';
  assert.deepEqual(verifyPreviewIsolation(fixture), []);
});

test('rejects preview D1 pointing at the production database', () => {
  const fixture = replaceOnce(wrangler, 'database_id = "' + previewD1Id + '"', 'database_id = "' + productionD1Id + '"');
  assert.match(verifyPreviewIsolation(fixture).join('\n'), /Preview D1 must not reuse the production database ID/);
});

test('rejects preview KV pointing at the production namespace', () => {
  const fixture = replaceOnce(wrangler, 'id = "' + previewKvId + '"', 'id = "' + productionKvId + '"');
  assert.match(verifyPreviewIsolation(fixture).join('\n'), /Preview KV must not reuse the production namespace ID/);
});

test('rejects missing preview D1 or KV bindings', () => {
  const missingD1 = replaceOnce(wrangler, '[previews.d1_databases]', '');
  const missingKv = replaceOnce(wrangler, '[previews.kv_namespaces]', '');
  assert.match(verifyPreviewIsolation(missingD1).join('\n'), /Preview D1 must declare exactly one/);
  assert.match(verifyPreviewIsolation(missingKv).join('\n'), /Preview KV must declare exactly one/);
});

test('rejects secrets placed in plaintext Wrangler variables', () => {
  const fixture = replaceOnce(wrangler, '[previews.vars]\n', '[previews.vars]\nAPP_ENCRYPTION_KEY = "fixture-only-not-a-secret"\n');
  assert.match(verifyPreviewIsolation(fixture).join('\n'), /APP_ENCRYPTION_KEY must remain a managed secret/);
});
