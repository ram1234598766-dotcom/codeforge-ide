import { validateWorkspaceFilePath } from './routes';

export type ExecutionLanguage = 'javascript' | 'typescript' | 'react' | 'python' | 'html';
export type ExecutionFile = { path: string; content: string };
export type PreparedExecution = { files: ExecutionFile[]; error?: string };

const MAX_ENTRY_BYTES = 256 * 1024;
const MAX_WORKSPACE_BYTES = 1_500_000;
const MAX_WORKSPACE_FILES = 80;

const BLOCKED_DIRS = new Set([
  '.git', '.ssh', '.aws', '.azure', '.config', '.idea', '.vscode',
  'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt',
  '.venv', 'venv', '__pycache__', '.cache', '.turbo', 'vendor',
]);

const BLOCKED_FILE_NAMES = new Set([
  '.npmrc', '.pypirc', '.netrc', 'credentials', 'credentials.json',
  'service-account.json', 'id_rsa', 'id_ed25519', 'id_ecdsa',
]);

function normalizedPath(path: string): string {
  return path.trim().replace(/^\/+/, '').replace(/\\/g, '/');
}

function hasProtectedName(path: string): boolean {
  const normalized = normalizedPath(path);
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return true;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (BLOCKED_DIRS.has(lower) || BLOCKED_FILE_NAMES.has(lower)) return true;
    if (lower.startsWith('.env')) return true;
    if (/(^|\.)((pem|key|p12|pfx|keystore|jks|mobileprovision))$/i.test(lower)) return true;
    if (/(^|[-_.])(secret|secrets|credential|credentials|private[-_.]?key)([-_.]|$)/i.test(lower)) return true;
  }
  const lowerPath = normalized.toLowerCase();
  if (lowerPath.startsWith('certs/') || lowerPath.startsWith('certificates/')) return true;
  return false;
}

export function getExecutionLanguage(path: string): ExecutionLanguage | null {
  if (typeof path !== 'string' || validateWorkspaceFilePath(path) || hasProtectedName(path)) return null;
  const extension = normalizedPath(path).split('.').pop()?.toLowerCase();
  if (['js', 'mjs', 'cjs'].includes(extension || '')) return 'javascript';
  if (extension === 'ts') return 'typescript';
  if (extension === 'jsx' || extension === 'tsx') return 'react';
  if (extension === 'py') return 'python';
  if (extension === 'html' || extension === 'htm') return 'html';
  return null;
}

export function validateWorkspaceRunRequest(path: unknown, content: unknown): string | null {
  const pathError = validateWorkspaceFilePath(path);
  if (pathError) return pathError;
  if (typeof path !== 'string' || hasProtectedName(path)) return 'This file is protected and cannot be executed.';
  if (!getExecutionLanguage(path)) {
    return 'Unsupported file type. Run JavaScript, TypeScript, JSX, TSX, Python, or HTML files.';
  }
  if (typeof content !== 'string') return 'File content must be text.';
  if (new TextEncoder().encode(content).byteLength > MAX_ENTRY_BYTES) return 'Run file must be 256 KB or smaller.';
  return null;
}

export function isWorkspaceFileSafeForExecution(path: string): boolean {
  if (typeof path !== 'string' || validateWorkspaceFilePath(path)) return false;
  return !hasProtectedName(path);
}

export function prepareWorkspaceExecution(
  workspaceFiles: ExecutionFile[],
  entryPath: string,
  editorContent: string,
): PreparedExecution {
  const validation = validateWorkspaceRunRequest(entryPath, editorContent);
  if (validation) return { files: [], error: validation };

  const safeFiles = workspaceFiles.filter(file =>
    file && typeof file.path === 'string' &&
    typeof file.content === 'string' &&
    isWorkspaceFileSafeForExecution(file.path),
  );
  const selected = safeFiles.find(file => normalizedPath(file.path) === normalizedPath(entryPath));
  if (!selected) return { files: [], error: 'The selected file is not saved in this workspace yet.' };
  if (safeFiles.length > MAX_WORKSPACE_FILES) {
    return { files: [], error: 'This workspace has too many source files to run. Keep the runnable project under 80 files.' };
  }

  const files = safeFiles.map(file => ({
    path: normalizedPath(file.path),
    content: normalizedPath(file.path) === normalizedPath(entryPath) ? editorContent : file.content,
  }));
  const totalBytes = files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).byteLength, 0);
  if (totalBytes > MAX_WORKSPACE_BYTES) {
    return { files: [], error: 'Runnable workspace content must be 1.5 MB or smaller.' };
  }
  return { files };
}

function resolveLocalAsset(entryPath: string, assetPath: string): string | null {
  const raw = assetPath.trim();
  if (!raw || raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  let decoded = raw.split(/[?#]/, 1)[0];
  try { decoded = decodeURIComponent(decoded); } catch { return null; }
  if (decoded.startsWith('/')) return null;
  const base = normalizedPath(entryPath).split('/').slice(0, -1);
  for (const part of decoded.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!base.length) return null;
      base.pop();
    } else {
      base.push(part);
    }
  }
  const resolved = base.join('/');
  return resolved && isWorkspaceFileSafeForExecution(resolved) ? resolved : null;
}

function inlineLocalStyles(html: string, entryPath: string, files: ExecutionFile[]): string {
  return html.replace(/<link\b([^>]*?)>/gi, (tag, attributes: string) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(attributes)) return tag;
    const href = attributes.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const path = href ? resolveLocalAsset(entryPath, href) : null;
    const file = path ? files.find(item => item.path === path) : null;
    return file ? '<style>' + file.content.replace(/<\/style/gi, '<\\/style') + '</style>' : '';
  });
}

function inlineLocalScripts(html: string, entryPath: string, files: ExecutionFile[]): string {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (tag, attributes: string, inlineCode: string) => {
    const src = attributes.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) return tag;
    const path = resolveLocalAsset(entryPath, src);
    const file = path ? files.find(item => item.path === path) : null;
    if (!file) return '';
    const type = attributes.match(/type\s*=\s*["']([^"']+)["']/i)?.[1];
    const typeAttribute = type ? ' type="' + type.replace(/["<>]/g, '') + '"' : '';
    return '<script' + typeAttribute + '>' + file.content.replace(/<\/script/gi, '<\\/script') + '</script>';
  });
}

export function buildHtmlPreview(entryPath: string, html: string, files: ExecutionFile[]): string {
  const withStyles = inlineLocalStyles(html, entryPath, files);
  const withScripts = inlineLocalScripts(withStyles, entryPath, files);
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + policy + '">';
  if (/<head\b[^>]*>/i.test(withScripts)) return withScripts.replace(/<head\b[^>]*>/i, match => match + meta);
  return '<!doctype html><html><head>' + meta + '</head><body>' + withScripts + '</body></html>';
}
