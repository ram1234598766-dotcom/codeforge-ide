import { describe, expect, it } from 'vitest';
import { getSupabaseAuthOptions, getSupabaseRedirectUrl, isSupabasePublishableKey, resolveSupabaseConfig } from './supabase-config';

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
  it('uses only the current origin for callbacks, dropping query and hash fragments', () => {
    expect(getSupabaseRedirectUrl('https://codeforge-ide.vasudevaya.workers.dev/?next=%2Fsettings#old-token'))
      .toBe('https://codeforge-ide.vasudevaya.workers.dev');
  });

  it('keeps localhost callbacks local during development', () => {
    expect(getSupabaseRedirectUrl('http://localhost:3000/#access_token=untrusted'))
      .toBe('http://localhost:3000');
  });

  it('rejects non-HTTP callback URLs', () => {
    expect(() => getSupabaseRedirectUrl('javascript:alert(1)')).toThrow('HTTP(S)');
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
      .replace(/\\+/g, '-')
      .replace(/\\//g, '_');
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
