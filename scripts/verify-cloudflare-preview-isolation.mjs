export function parseWranglerTables(source) {
  const tables = new Map();
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const arrayHeader = line.match(/^\[\[([A-Za-z0-9_.-]+)\]\]$/);
    if (arrayHeader) {
      const entries = tables.get(arrayHeader[1]) ?? [];
      current = {};
      entries.push(current);
      tables.set(arrayHeader[1], entries);
      continue;
    }

    const tableHeader = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (tableHeader) {
      const entries = tables.get(tableHeader[1]) ?? [];
      current = entries[0] ?? {};
      if (entries.length === 0) entries.push(current);
      tables.set(tableHeader[1], entries);
      continue;
    }

    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!current || !assignment) continue;

    const key = assignment[1];
    let value = assignment[2].trim();
    try {
      value = JSON.parse(value);
    } catch {
      // Unsupported TOML values remain strings; the checked fields are scalar strings.
    }
    current[key] = value;
  }

  return tables;
}

export function verifyPreviewIsolation(source) {
  const tables = parseWranglerTables(source);
  const errors = [];
  const oneBinding = (tableName, bindingName, label) => {
    const entries = tables.get(tableName) ?? [];
    const matches = entries.filter((entry) => entry.binding === bindingName);
    if (matches.length !== 1) {
      errors.push(label + ' must declare exactly one ' + bindingName + ' binding.');
      return null;
    }
    return matches[0];
  };

  const productionD1 = oneBinding('d1_databases', 'CODEFORGE_DB', 'Production D1');
  const previewD1 = oneBinding('previews.d1_databases', 'CODEFORGE_DB', 'Preview D1');
  const productionKv = oneBinding('kv_namespaces', 'CODEFORGE_KV', 'Production KV');
  const previewKv = oneBinding('previews.kv_namespaces', 'CODEFORGE_KV', 'Preview KV');

  if (productionD1 && productionD1.binding !== 'CODEFORGE_DB') {
    errors.push('Production D1 must retain the CODEFORGE_DB binding name.');
  }
  if (previewD1 && previewD1.binding !== 'CODEFORGE_DB') {
    errors.push('Preview D1 must retain the CODEFORGE_DB binding name.');
  }
  if (productionD1 && previewD1) {
    if (!productionD1.database_id || !previewD1.database_id) {
      errors.push('Production and preview D1 database IDs must both be configured.');
    } else if (productionD1.database_id === previewD1.database_id) {
      errors.push('Preview D1 must not reuse the production database ID.');
    }
    if (!/preview/i.test(String(previewD1.database_name ?? ''))) {
      errors.push('Preview D1 database_name must be clearly marked as preview.');
    }
  }

  if (productionKv && productionKv.binding !== 'CODEFORGE_KV') {
    errors.push('Production KV must retain the CODEFORGE_KV binding name.');
  }
  if (previewKv && previewKv.binding !== 'CODEFORGE_KV') {
    errors.push('Preview KV must retain the CODEFORGE_KV binding name.');
  }
  if (productionKv && previewKv) {
    if (!productionKv.id || !previewKv.id) {
      errors.push('Production and preview KV namespace IDs must both be configured.');
    } else if (productionKv.id === previewKv.id) {
      errors.push('Preview KV must not reuse the production namespace ID.');
    }
  }

  const sensitiveVariableName = /(?:^|_)(?:TOKEN|API_KEY|ACCESS_KEY(?:_ID)?|ACCESS_TOKEN|SECRET(?:_ACCESS)?(?:_KEY)?|SERVICE_ROLE_KEY|PRIVATE_KEY|PASSWORD|KEYSTORE(?:_BASE64)?|DATABASE_URL|ENCRYPTION_KEY)$/i;
  const allowedPublicVariableNames = new Set([
    'SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  ]);
  for (const sectionName of ['vars', 'previews.vars']) {
    const variables = tables.get(sectionName)?.[0] ?? {};
    for (const name of Object.keys(variables)) {
      if (!allowedPublicVariableNames.has(name) && sensitiveVariableName.test(name)) {
        errors.push(name + ' must remain a managed secret, not a plaintext ' + sectionName + ' variable.');
      }
    }
  }

  return errors;
}
