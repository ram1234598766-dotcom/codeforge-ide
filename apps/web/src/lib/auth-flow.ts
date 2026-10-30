export interface AuthRedirectState {
  message: string | null;
  isPasswordRecovery: boolean;
  cleanUrl: string;
}

const AUTH_QUERY_KEYS = [
  'code', 'error', 'error_code', 'error_description', 'error_uri',
  'provider_token', 'type', 'access_token', 'refresh_token', 'expires_in', 'token_type',
] as const;

const AUTH_HASH_KEYS = new Set([
  'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type',
  'provider_token', 'error', 'error_code', 'error_description', 'code',
]);

export function readAuthRedirectState(currentHref: string): AuthRedirectState {
  try {
    const url = new URL(currentHref);
    const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const isPasswordRecovery =
      url.searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    const errorCode = url.searchParams.get('error') || url.searchParams.get('error_code') || hashParams.get('error');
    const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description') || '';
    const isCancelled =
      errorCode === 'access_denied' ||
      /user (?:denied|cancelled|canceled)|access denied/i.test(errorDescription);
    const message = errorCode
      ? (isCancelled
          ? 'Sign-in was cancelled. Choose a sign-in method to try again.'
          : getFriendlyAuthError({ message: errorDescription || errorCode }))
      : null;

    for (const key of AUTH_QUERY_KEYS) url.searchParams.delete(key);
    for (const key of AUTH_HASH_KEYS) hashParams.delete(key);

    if (url.hash.startsWith('#') && (url.hash.includes('=') || AUTH_HASH_KEYS.has(url.hash.slice(1)))) {
      const remainingHash = hashParams.toString();
      url.hash = remainingHash ? '#' + remainingHash : '';
    }

    const cleanUrl = url.pathname + url.search + url.hash;
    return { message, isPasswordRecovery, cleanUrl };
  } catch {
    return { message: null, isPasswordRecovery: false, cleanUrl: '/' };
  }
}

export function getFriendlyAuthError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : typeof error === 'string' ? error : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials') || normalized.includes('invalid_credentials')) {
    return 'Email or password is incorrect. Check your details and try again.';
  }
  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')) {
    return 'Confirm your email address before signing in. You can request a new confirmation email below.';
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('too many requests')
  ) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'An account with this email may already exist. Sign in or reset your password instead.';
  }
  if (normalized.includes('weak_password') || normalized.includes('password should be')) {
    return 'Choose a stronger password with at least 8 characters.';
  }
  if (
    normalized.includes('flow_state_not_found') ||
    normalized.includes('pkce') ||
    normalized.includes('expired') ||
    normalized.includes('invalid_grant')
  ) {
    return 'This sign-in link has expired or was already used. Start again and request a fresh link.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Could not reach the authentication service. Check your connection and try again.';
  }
  return 'Authentication could not be completed. Please try again or choose another sign-in method.';
}
