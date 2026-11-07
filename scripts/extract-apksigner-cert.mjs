import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const signerFingerprintLine = /^(?:Signer #\d+|V\d+(?:\.\d+)* Signer):?\s+certificate SHA-256 digest:\s*([0-9a-f]{64})\s*$/i;

export function extractApksignerCertificateFingerprint(output) {
  const lines = String(output).split(/\r?\n/);
  for (const line of lines) {
    const match = line.trim().match(signerFingerprintLine);
    if (match) return match[1].toUpperCase();
  }

  if (lines.some(line => /certificate SHA-256 digest:/i.test(line))) {
    throw new Error('Invalid signer certificate SHA-256 digest in apksigner output.');
  }
  throw new Error('No supported signer certificate SHA-256 digest was found in apksigner output.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: node extract-apksigner-cert.mjs <apksigner-verification-output>');
  const output = readFileSync(resolve(filePath), 'utf8');
  process.stdout.write(extractApksignerCertificateFingerprint(output) + '\n');
}
