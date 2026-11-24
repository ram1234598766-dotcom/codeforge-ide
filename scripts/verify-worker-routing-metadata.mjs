import { pathToFileURL } from 'node:url';

const API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_WORKER_NAME = 'codeforge-ide';
const REQUIRED_ROUTES = Object.freeze(['/api/*', '/', '/index.html', '/app', '/app/*']);

async function readCloudflareResult(fetchImpl, apiToken, path) {
  const response = await fetchImpl(API_BASE_URL + path, {
    headers: {
      accept: 'application/json',
      authorization: 'Bearer ' + apiToken,
    },
  });

  if (!response.ok) {
    throw new Error('Cloudflare API ' + path + ' returned HTTP ' + response.status + '.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Cloudflare API ' + path + ' returned invalid JSON.');
  }

  if (payload?.success !== true) {
    throw new Error('Cloudflare API ' + path + ' returned an unsuccessful response.');
  }

  return payload.result;
}

function requireRoutes(routes, field) {
  if (!Array.isArray(routes)) {
    throw new Error('The active Worker version is missing ' + field + '.');
  }

  const missing = REQUIRED_ROUTES.filter((route) => !routes.includes(route));
  if (missing.length > 0) {
    throw new Error('The active Worker ' + field + ' is missing required routes: ' + missing.join(', ') + '.');
  }
}

export async function verifyWorkerRoutingMetadata({
  accountId,
  apiToken,
  workerName = DEFAULT_WORKER_NAME,
  fetchImpl = fetch,
} = {}) {
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is required.');
  }
  if (typeof apiToken !== 'string' || apiToken.trim() === '') {
    throw new Error('CLOUDFLARE_API_TOKEN is required.');
  }
  if (typeof workerName !== 'string' || workerName.trim() === '') {
    throw new Error('CLOUDFLARE_WORKER_NAME is required.');
  }

  const account = encodeURIComponent(accountId.trim());
  const script = encodeURIComponent(workerName.trim());
  const basePath = '/accounts/' + account + '/workers/scripts/' + script;
  const deploymentsResult = await readCloudflareResult(
    fetchImpl,
    apiToken,
    basePath + '/deployments?per_page=10',
  );
  const deployments = deploymentsResult?.deployments;

  if (!Array.isArray(deployments) || deployments.length === 0) {
    throw new Error('Cloudflare returned no deployments for the CodeForge Worker.');
  }

  const latestDeployment = [...deployments].sort((left, right) => {
    const leftTime = Date.parse(left.created_on ?? '');
    const rightTime = Date.parse(right.created_on ?? '');
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  })[0];

  if (!latestDeployment?.id || !Array.isArray(latestDeployment.versions)) {
    throw new Error('The latest Cloudflare Worker deployment is missing version metadata.');
  }

  const trafficVersions = latestDeployment.versions.filter((version) => Number(version.percentage) > 0);
  if (trafficVersions.length !== 1 || Number(trafficVersions[0].percentage) !== 100) {
    throw new Error('The latest Cloudflare Worker deployment is not a single-version 100% rollout.');
  }

  const versionId = trafficVersions[0].version_id;
  if (typeof versionId !== 'string' || versionId.trim() === '') {
    throw new Error('The latest Cloudflare Worker deployment is missing its active version ID.');
  }

  const versionResult = await readCloudflareResult(
    fetchImpl,
    apiToken,
    basePath + '/versions/' + encodeURIComponent(versionId),
  );
  if (versionResult?.id !== versionId) {
    throw new Error('Cloudflare returned a Worker version different from the active deployment.');
  }

  const assets = versionResult.resources?.script_runtime?.assets;
  if (!assets) {
    throw new Error('The active Cloudflare Worker version has no static asset routing metadata.');
  }

  requireRoutes(
    assets.static_routing?.user_worker,
    'script_runtime.assets.static_routing.user_worker',
  );
  requireRoutes(
    assets.raw_run_worker_first,
    'script_runtime.assets.raw_run_worker_first',
  );

  return {
    deploymentId: latestDeployment.id,
    versionId,
    versionNumber: versionResult.number,
    createdOn: latestDeployment.created_on,
    requiredRoutes: [...REQUIRED_ROUTES],
    verified: true,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  verifyWorkerRoutingMetadata({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    workerName: process.env.CLOUDFLARE_WORKER_NAME || DEFAULT_WORKER_NAME,
  })
    .then((result) => {
      console.log('Deployed CodeForge Worker routing metadata verified.');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Cloudflare Worker routing verification failed.');
      process.exitCode = 1;
    });
}
