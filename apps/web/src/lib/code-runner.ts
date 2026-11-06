export type RunnableKind = 'html' | 'javascript';

const MAX_SOURCE_BYTES = 250_000;
const CONTENT_SECURITY_POLICY = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; worker-src blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none'";

export function getRunnableKind(path: string): RunnableKind | null {
  const extension = path.toLowerCase().split('.').pop();
  if (extension === 'html' || extension === 'htm') return 'html';
  if (extension === 'js' || extension === 'mjs') return 'javascript';
  return null;
}

function safeScriptLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function createJavaScriptBootstrap(runId: string, source: string): string {
  const workerCode = [
    'self.addEventListener(\'message\', event => {',
    '  const port = event.ports[0];',
    '  if (!port) return;',
    '  const send = MessagePort.prototype.postMessage.bind(port);',
    '  const source = ' + safeScriptLiteral(source) + ';',
    "  const emit = (level, args) => send({ type: 'console', level, text: Array.from(args).map(value => { try { return typeof value === 'string' ? value : JSON.stringify(value); } catch { return String(value); } }).join(' ').slice(0, 4000) });",
    "  const consoleApi = Object.fromEntries(['log','info','debug','warn','error'].map(level => [level, (...args) => emit(level, args)]));",
    '  try {',
    "    const execute = new Function('console', 'return (async () => {\\n' + source + '\\n})()');",
    "    Promise.resolve(execute(consoleApi)).then(value => { if (value !== undefined) emit('log', [value]); send({ type: 'done' }); }).catch(error => { send({ type: 'error', text: error?.stack || error?.message || String(error) }); });",
    "  } catch (error) { send({ type: 'error', text: error?.stack || error?.message || String(error) }); }",
    '}, { once: true });',
  ].join('\n');
  return `(() => {
    const runId = ${safeScriptLiteral(runId)};
    const emit = (level, args) => parent.postMessage({ __codeforgeRun: runId, level, text: Array.from(args).join(' ').slice(0, 4000) }, '*');
    const workerUrl = URL.createObjectURL(new Blob([${safeScriptLiteral(workerCode)}], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    const channel = new MessageChannel();
    const finish = () => { clearTimeout(timer); channel.port1.close(); worker.terminate(); URL.revokeObjectURL(workerUrl); };
    const timer = setTimeout(() => { finish(); emit('error', ['Execution stopped after 5 seconds.']); }, 5000);
    channel.port1.onmessage = event => {
      const message = event.data || {};
      if (message.type === 'done' || message.type === 'error') finish();
      if (message.type === 'error') emit('error', [message.text || 'Execution failed.']);
      else if (message.type === 'console') emit(message.level || 'log', [message.text || '']);
    };
    channel.port1.start();
    worker.onerror = event => { finish(); emit('error', [event.message || 'JavaScript worker failed.']); };
    document.getElementById('codeforge-run-status')?.remove();
    worker.postMessage({ type: 'start' }, [channel.port2]);
    addEventListener('pagehide', finish, { once: true });
  })();`;
}
function protectedHead(): string {
  const htmlPolicy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none'";
  return `<meta http-equiv="Content-Security-Policy" content="${htmlPolicy}">`;
}

export function buildBrowserRunDocument(path: string, source: string, runId: string): string {
  const kind = getRunnableKind(path);
  if (!kind) throw new Error('Run supports HTML and self-contained JavaScript files (.html, .htm, .js, .mjs).');
  if (!runId || !/^[a-zA-Z0-9-]{8,80}$/.test(runId)) throw new Error('A valid run identifier is required.');
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new Error('The selected source file exceeds the 250 KB browser-run limit.');

  if (kind === 'html') {
    const head = protectedHead();
    if (/<head(?:\s[^>]*)?>/i.test(source)) {
      return source.replace(/<head(?:\s[^>]*)?>/i, opening => opening + head);
    }
    if (/<html(?:\s[^>]*)?>/i.test(source)) {
      return source.replace(/<html(?:\s[^>]*)?>/i, opening => opening + '<head>' + head + '</head>');
    }
    return `<!doctype html><html><head>${head}</head><body>${source}</body></html>`;
  }

  const script = createJavaScriptBootstrap(runId, source);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}"><script>${script}</script></head><body><pre id="codeforge-run-status">Running JavaScript…</pre></body></html>`;
}
