import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyWorkerRoutingMetadata } from './verify-worker-routing-metadata.mjs';

const accountId = 'account-test';
const apiToken = 'not-a-real-token';
const expectedSourceSha = 'a'.repeat(40);
const workerName = 'codeforge-ide';
const requiredRoutes = ['/api/*', '/', '/index.html', '/app', '/app/*'];
const versionId = 'version-active';
const expectedMessage = 'CodeForge commit ' + expectedSourceSha;

function makeVersion({ userWorker = requiredRoutes, rawRunWorkerFirst = requiredRoutes, message = expectedMessage } = {}) {
  return {
    id: versionId,
    number: 218,
    annotations: { 'workers/message': message },
    resources: {
      script_runtime: {
        assets: {
          static_routing: { user_worker: userWorker },
          raw_run_worker_first: rawRunWorkerFirst,
        },
      },
    },
  };
}

function buildFetch({
  deployments = [{
    id: 'deployment-active',
    created_on: '2026-11-24T04:00:00.000Z',
    annotations: { 'workers/message': expectedMessage },
    versions: [{ version_id: versionId, percentage: 100 }],
  }],
  version = makeVersion(),
  responses = {},
} = {}) {
  const requests = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });

    if (responses[url.pathname]) return responses[url.pathname].clone();
    if (url.pathname.endsWith('/deployments')) {
      return Response.json({ success: true, result: { deployments } });
    }
    if (url.pathname.endsWith('/versions/' + versionId)) {
      return Response.json({ success: true, result: version });
    }

    return Response.json({ success: false, errors: [{ message: 'unexpected path' }] }, { status: 404 });
  };

  return { fetchImpl, requests };
}

test('verifies the active 100% Worker version, source SHA, and both routing metadata arrays', async () => {
  const { fetchImpl, requests } = buildFetch({
    deployments: [
      {
        id: 'older-deployment',
        created_on: '2026-11-23T04:00:00.000Z',
        annotations: { 'workers/message': 'CodeForge commit ' + 'b'.repeat(40) },
        versions: [{ version_id: 'older-version', percentage: 100 }],
      },
      {
        id: 'deployment-active',
        created_on: '2026-11-24T04:00:00.000Z',
        annotations: { 'workers/message': expectedMessage },
        versions: [{ version_id: versionId, percentage: 100 }],
      },
    ],
  });

  const result = await verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl });

  assert.equal(result.deploymentId, 'deployment-active');
  assert.equal(result.versionId, versionId);
  assert.equal(result.versionNumber, 218);
  assert.equal(result.sourceSha, expectedSourceSha);
  assert.equal(result.verified, true);
  assert.deepEqual(result.requiredRoutes, requiredRoutes);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.init.headers.authorization === 'Bearer ' + apiToken));
});

test('fails when /app is missing from static_routing.user_worker', async () => {
  const { fetchImpl } = buildFetch({
    version: makeVersion({ userWorker: requiredRoutes.filter((route) => route !== '/app') }),
  });

  await assert.rejects(
    verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl }),
    /static_routing\.user_worker is missing required routes: \/app/,
  );
});

test('fails when /app/* is missing from raw_run_worker_first', async () => {
  const { fetchImpl } = buildFetch({
    version: makeVersion({ rawRunWorkerFirst: requiredRoutes.filter((route) => route !== '/app/*') }),
  });

  await assert.rejects(
    verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl }),
    /raw_run_worker_first is missing required routes: \/app\/\*/,
  );
});

test('fails when the active deployment source SHA differs from the expected main SHA', async () => {
  const { fetchImpl } = buildFetch({
    deployments: [{
      id: 'deployment-wrong-source',
      created_on: '2026-11-24T04:00:00.000Z',
      annotations: { 'workers/message': 'CodeForge commit ' + 'b'.repeat(40) },
      versions: [{ version_id: versionId, percentage: 100 }],
    }],
    version: makeVersion({ message: 'CodeForge commit ' + 'b'.repeat(40) }),
  });

  await assert.rejects(
    verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl }),
    /does not identify the expected source commit/,
  );
});

test('fails closed when the latest deployment is split across versions', async () => {
  const { fetchImpl } = buildFetch({
    deployments: [{
      id: 'canary-deployment',
      created_on: '2026-11-24T04:00:00.000Z',
      annotations: { 'workers/message': expectedMessage },
      versions: [
        { version_id: versionId, percentage: 90 },
        { version_id: 'version-canary', percentage: 10 },
      ],
    }],
  });

  await assert.rejects(
    verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl }),
    /not a single-version 100% rollout/,
  );
});

test('fails when Cloudflare has no Worker deployments', async () => {
  const { fetchImpl } = buildFetch({ deployments: [] });

  await assert.rejects(
    verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl }),
    /returned no deployments/,
  );
});

test('does not disclose the API token when Cloudflare rejects a request', async () => {
  const { fetchImpl } = buildFetch({
    responses: {
      '/client/v4/accounts/account-test/workers/scripts/codeforge-ide/deployments': new Response(
        JSON.stringify({ success: false, errors: [{ message: 'permission denied' }] }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    },
  });

  await assert.rejects(
    verifyWorkerRoutingMetadata({ accountId, apiToken, expectedSourceSha, workerName, fetchImpl }),
    (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.ok(!error.message.includes(apiToken));
      return true;
    },
  );
});

test('requires account, API token, and a full source SHA without making requests', async () => {
  const { fetchImpl, requests } = buildFetch();

  await assert.rejects(verifyWorkerRoutingMetadata({ apiToken, expectedSourceSha, fetchImpl }), /CLOUDFLARE_ACCOUNT_ID is required/);
  await assert.rejects(verifyWorkerRoutingMetadata({ accountId, expectedSourceSha, fetchImpl }), /CLOUDFLARE_API_TOKEN is required/);
  await assert.rejects(verifyWorkerRoutingMetadata({ accountId, apiToken, fetchImpl }), /EXPECTED_SOURCE_SHA must be a full 40-character Git commit SHA/);
  assert.equal(requests.length, 0);
});
