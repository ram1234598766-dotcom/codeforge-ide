import { describe, expect, it } from 'vitest';
import { getHostedAppRedirectUrl, getSupabaseAuthOptions, getSupabaseRedirectUrl, isSupabasePublishableKey, resolveSupabaseConfig } from './supabase-config';

describe('resolveSupabaseConfig', () => {
  it('uses Worker runtime configuration when Vite build values are absent', () => {
    expect(resolveSupabaseConfig({}, {
      url: 'https://project.supabase.co/',
      publishableKey: 'sb_publishable_runtime-key',
    })).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_runtime-key',
      configured: true,
    });
  });

  it('prefers non-empty Vite build values over runtime values', () => {
    expect(resolveSupabaseConfig({
      url: 'https://build.supabase.co',
      publishableKey: 'sb_publishable_build-key',
    }, {
      url: 'https://runtime.supabase.co',
      publishableKey: 'sb_publishable_runtime-key',
    })).toEqual({
      url: 'https://build.supabase.co',
      publishableKey: 'sb_publishable_build-key',
      configured: true,
    });
  });

  it('falls back per field and trims empty values', () => {
    expect(resolveSupabaseConfig({
      url: '  ',
      publishableKey: '  sb_publishable_build-key  ',
    }, {
      url: ' https://runtime.supabase.co/ ',
      publishableKey: 'sb_publishable_runtime-key',
    })).toEqual({
      url: 'https://runtime.supabase.co',
      publishableKey: 'sb_publishable_build-key',
      configured: true,
    });
  });

  it('remains unconfigured when either required value is missing', () => {
    expect(resolveSupabaseConfig({ url: 'https://project.supabase.co' }, {})).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: '',
      configured: false,
    });
  });
});


describe('Supabase OAuth callback configuration', () => {
  it('uses the exact slash-terminated hosted URL to match Supabase URL Configuration entries', () => {
    expect(getSupabaseRedirectUrl()).toBe('https://codeforge-ide.vasudevaya.workers.dev/');
  });

  it('uses the same canonical callback for Google and GitHub', () => {
    const redirectTo = getSupabaseRedirectUrl();
    expect(['google', 'github'].map(() => redirectTo)).toEqual([
      'https://codeforge-ide.vasudevaya.workers.dev/',
      'https://codeforge-ide.vasudevaya.workers.dev/',
    ]);
  });

  it('uses PKCE and detects the returned authorization code', () => {
    expect(getSupabaseAuthOptions()).toEqual({
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    });
  });
});


describe('Supabase publishable key validation', () => {
  const legacyKey = (role: string) => {
    const payload = btoa(JSON.stringify({ iss: 'supabase', role }))
      .replace(/=/g, '')
      .replace(/=+$/g, '');
    return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
  };

  it('ignores the placeholder key from .env.example and falls back to Worker runtime config', () => {
    expect(resolveSupabaseConfig({
      url: 'https://project.supabase.co',
      publishableKey: 'your-supabase-publishable-key',
    }, {
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_runtime-key',
    })).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_runtime-key',
      configured: true,
    });
  });

  it('accepts modern publishable keys and legacy anon keys', () => {
    expect(isSupabasePublishableKey('sb_publishable_runtime-key')).toBe(true);
    expect(isSupabasePublishableKey(legacyKey('anon'))).toBe(true);
  });

  it('rejects service-role JWTs and arbitrary non-empty text', () => {
    expect(isSupabasePublishableKey(legacyKey('service_role'))).toBe(false);
    expect(isSupabasePublishableKey('your-supabase-publishable-key')).toBe(false);
  });
});


describe('hosted-only browser entrypoint', () => {
  it('moves localhost pages to production before authentication starts', () => {
    expect(getHostedAppRedirectUrl('http://localhost:3000/projects?tab=files#editor'))
      .toBe('https://codeforge-ide.vasudevaya.workers.dev/projects?tab=files#editor');
  });

  it('moves IPv4 and IPv6 loopback pages to production', () => {
    expect(getHostedAppRedirectUrl('http://127.0.0.1:3000/'))
      .toBe('https://codeforge-ide.vasudevaya.workers.dev/');
    expect(getHostedAppRedirectUrl('http://[::1]:3000/'))
      .toBe('https://codeforge-ide.vasudevaya.workers.dev/');
  });

  it('does not redirect an OAuth callback already holding a PKCE code', () => {
    expect(getHostedAppRedirectUrl('http://localhost:3000/?code=one-time-code'))
      .toBeNull();
  });

  it('does not redirect the canonical production host', () => {
    expect(getHostedAppRedirectUrl('https://codeforge-ide.vasudevaya.workers.dev/'))
      .toBeNull();
  });

  it('does not redirect other non-local development hosts', () => {
    expect(getHostedAppRedirectUrl('https://preview.example.com/'))
      .toBeNull();
  });
});
