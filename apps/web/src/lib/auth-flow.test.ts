import { describe, expect, it } from 'vitest';
import { getFriendlyAuthError, readAuthRedirectState } from './auth-flow';

describe('readAuthRedirectState', () => {
  it('turns provider cancellation into a safe message and removes callback errors', () => {
    const state = readAuthRedirectState('https://codeforge-ide.vasudevaya.workers.dev/?error=access_denied&error_description=The%20user%20denied%20access&invite=keep-me');
    expect(state.message).toBe('Sign-in was cancelled. Choose a sign-in method to try again.');
    expect(state.isPasswordRecovery).toBe(false);
    expect(state.cleanUrl).toBe('/?invite=keep-me');
  });
  it('removes one-time authorization codes while preserving ordinary app query values', () => {
    const state = readAuthRedirectState('https://codeforge-ide.vasudevaya.workers.dev/projects?code=one-time-code&tab=files#editor');
    expect(state.message).toBeNull();
    expect(state.cleanUrl).toBe('/projects?tab=files#editor');
  });
  it('recognizes password recovery before removing callback parameters', () => {
    const state = readAuthRedirectState('https://codeforge-ide.vasudevaya.workers.dev/?code=one-time-code&type=recovery');
    expect(state.isPasswordRecovery).toBe(true);
    expect(state.cleanUrl).toBe('/');
  });
  it('removes token-like hash fragments without disturbing ordinary anchors', () => {
    const state = readAuthRedirectState('https://codeforge-ide.vasudevaya.workers.dev/#access_token=secret&refresh_token=secret&state=editor');
    expect(state.cleanUrl).toBe('/#state=editor');
  });
});

describe('getFriendlyAuthError', () => {
  it('does not reveal whether an email exists when credentials are invalid', () => {
    expect(getFriendlyAuthError({ message: 'Invalid login credentials' })).toBe('Email or password is incorrect. Check your details and try again.');
  });
  it('explains how to recover an unconfirmed account', () => {
    expect(getFriendlyAuthError({ message: 'Email not confirmed' })).toBe('Confirm your email address before signing in. You can request a new confirmation email below.');
  });
  it('handles rate limits without exposing provider internals', () => {
    expect(getFriendlyAuthError({ message: 'over_email_send_rate_limit' })).toBe('Too many attempts. Please wait a moment before trying again.');
  });
  it('uses a safe fallback for unknown provider errors', () => {
    expect(getFriendlyAuthError(new Error('internal upstream diagnostic'))).toBe('Authentication could not be completed. Please try again or choose another sign-in method.');
  });
});
