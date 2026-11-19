import assert from 'node:assert/strict';
import test from 'node:test';
import { formatConnectivitySummary, parseConnectivityDump } from './verify-android-connectivity.mjs';

function agent({ id, state = 'CONNECTED/CONNECTED', transport = 'WIFI', capabilities = 'INTERNET&NOT_RESTRICTED&TRUSTED&VALIDATED' }) {
  return 'NetworkAgentInfo{ ni{[type: ' + transport + '[], state: ' + state
    + ', reason: (unspecified)]} network{' + id + '} handle{1234} nc{[ Transports: '
    + transport + ' Capabilities: ' + capabilities + ' ]} Score{60} }';
}

test('accepts a connected, validated active default network', () => {
  const dump = 'Active default network: 104\nCurrent Networks:\n' + agent({ id: 104 }) + '\n';
  const result = parseConnectivityDump(dump);
  assert.equal(result.ok, true);
  assert.equal(result.networkId, '104');
  assert.equal(result.transport, 'WIFI');
  assert.equal(result.reason, 'validated');
});

test('does not accept a validated secondary network when the active default is not validated', () => {
  const dump = [
    'Active default network: 104',
    'Current Networks:',
    agent({ id: 104, capabilities: 'INTERNET&NOT_RESTRICTED&TRUSTED' }),
    agent({ id: 105, transport: 'CELLULAR', capabilities: 'INTERNET&NOT_RESTRICTED&TRUSTED&VALIDATED' }),
  ].join('\n');
  const result = parseConnectivityDump(dump);
  assert.equal(result.ok, false);
  assert.equal(result.networkId, '104');
  assert.equal(result.reason, 'active-default-network-not-validated');
});

test('rejects a dump without an active default network', () => {
  const result = parseConnectivityDump('Current Networks:\n' + agent({ id: 104 }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-active-default-network');
});

test('rejects an active default network that is not present in Current Networks', () => {
  const result = parseConnectivityDump('Active default network: 104\nCurrent Networks:\n');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'active-default-network-not-listed');
});

test('rejects a disconnected active default network even if it advertises internet capabilities', () => {
  const dump = 'Active default network: 104\nCurrent Networks:\n'
    + agent({ id: 104, state: 'DISCONNECTED/DISCONNECTED' });
  const result = parseConnectivityDump(dump);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'active-default-network-not-connected');
});

test('rejects captive-portal networks', () => {
  const dump = 'Active default network: 104\nCurrent Networks:\n'
    + agent({ id: 104, capabilities: 'INTERNET&CAPTIVE_PORTAL' });
  const result = parseConnectivityDump(dump);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'active-default-network-captive-portal');
});

test('fails closed when the active default network has no NetworkCapabilities block', () => {
  const dump = 'Active default network: 104\nNetworkAgentInfo{ network{104} ni{state: CONNECTED/CONNECTED} }';
  const result = parseConnectivityDump(dump);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'active-default-network-no-internet');
});

test('summary contains only sanitized network readiness fields', () => {
  const result = parseConnectivityDump('Active default network: 104\n' + agent({ id: 104 }));
  const summary = formatConnectivitySummary(result);
  assert.match(summary, /ACTIVE_DEFAULT_NETWORK_ID=104/);
  assert.doesNotMatch(summary, /1234|SSID|DnsAddresses|192\.168\./);
});
