import { pathToFileURL } from 'node:url';

function networkAgentBlocks(dump) {
  const starts = [...dump.matchAll(/NetworkAgentInfo\s*\{/g)].map((match) => match.index);
  return starts.map((start, index) => dump.slice(start, starts[index + 1] ?? dump.length));
}

export function parseConnectivityDump(dump) {
  if (typeof dump !== 'string' || dump.trim().length === 0) {
    return {
      ok: false,
      networkId: 'none',
      state: 'unknown',
      transport: 'unknown',
      hasInternet: false,
      validated: false,
      captivePortal: false,
      reason: 'empty-connectivity-dump',
    };
  }

  const defaultNetworkMatch = dump.match(/^\s*Active default network:\s*(\d+)\b/m);
  if (!defaultNetworkMatch) {
    return {
      ok: false,
      networkId: 'none',
      state: 'unknown',
      transport: 'unknown',
      hasInternet: false,
      validated: false,
      captivePortal: false,
      reason: 'no-active-default-network',
    };
  }

  const networkId = defaultNetworkMatch[1];
  const networkBlock = networkAgentBlocks(dump).find((block) =>
    new RegExp('\\bnetwork\\{\\s*' + networkId + '\\s*\\}').test(block),
  );

  if (!networkBlock) {
    return {
      ok: false,
      networkId,
      state: 'unknown',
      transport: 'unknown',
      hasInternet: false,
      validated: false,
      captivePortal: false,
      reason: 'active-default-network-not-listed',
    };
  }

  const stateMatch = networkBlock.match(/\bstate:\s*([A-Z_]+\/[A-Z_]+)/i)
    ?? networkBlock.match(/\b([A-Z_]+\/[A-Z_]+)\b/);
  const state = stateMatch?.[1]?.toUpperCase() ?? 'unknown';
  const connected = state === 'CONNECTED/CONNECTED';
  const capabilitiesStart = networkBlock.indexOf('nc{');
  const capabilitiesEnd = capabilitiesStart >= 0
    ? networkBlock.indexOf('}', capabilitiesStart + 3)
    : -1;
  const capabilities = capabilitiesStart >= 0 && capabilitiesEnd > capabilitiesStart
    ? networkBlock.slice(capabilitiesStart + 3, capabilitiesEnd)
    : '';
  const hasInternet = /\bINTERNET\b/.test(capabilities);
  const validated = /\bVALIDATED\b/.test(capabilities);
  const captivePortal = /\bCAPTIVE_PORTAL\b/.test(capabilities);
  const transport = capabilities.match(/\bTransports:\s*([A-Z_|]+)/i)?.[1]?.toUpperCase()
    ?? networkBlock.match(/\btype:\s*([A-Z]+)/i)?.[1]?.toUpperCase()
    ?? 'unknown';

  // Some current Android emulator images omit NetworkInfo.state from the
  // active NetworkAgentInfo dump. In that case, accept the active default
  // network only when Android itself marks that same network INTERNET and
  // VALIDATED, and it is not a captive portal. The later WebView smoke still
  // proves the hosted CodeForge route is actually reachable.
  const stateUnknown = state === 'unknown';
  let reason = 'validated';
  if (!connected && !stateUnknown) reason = 'active-default-network-not-connected';
  else if (!hasInternet) reason = 'active-default-network-no-internet';
  else if (captivePortal) reason = 'active-default-network-captive-portal';
  else if (!validated) reason = 'active-default-network-not-validated';

  const connectionEvidence = connected
    ? 'network-info-connected-state'
    : reason === 'validated'
      ? 'validated-active-default-network-capabilities'
      : 'unverified';

  return {
    ok: reason === 'validated',
    networkId,
    state,
    transport,
    hasInternet,
    validated,
    captivePortal,
    connectionEvidence,
    reason,
  };
}

export function formatConnectivitySummary(result) {
  return [
    'ACTIVE_DEFAULT_NETWORK_ID=' + result.networkId,
    'ACTIVE_NETWORK_STATE=' + result.state,
    'ACTIVE_NETWORK_TRANSPORT=' + result.transport,
    'ACTIVE_NETWORK_HAS_INTERNET=' + result.hasInternet,
    'ACTIVE_NETWORK_VALIDATED=' + result.validated,
    'ACTIVE_NETWORK_CAPTIVE_PORTAL=' + result.captivePortal,
    'VALIDATED_NETWORK=' + result.ok,
    'NETWORK_REASON=' + result.reason,
  ].join('\n') + '\n';
}

async function main() {
  let dump = '';
  for await (const chunk of process.stdin) dump += chunk;
  const result = parseConnectivityDump(dump);
  process.stdout.write(formatConnectivitySummary(result));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
