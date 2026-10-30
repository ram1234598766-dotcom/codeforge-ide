export function normalizeSupabaseUrl(value: string | undefined): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  return trimmed.replace(/\/rest\/v1$/i, '');
}
