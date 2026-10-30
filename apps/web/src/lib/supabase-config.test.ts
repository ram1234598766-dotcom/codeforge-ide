import { describe, expect, it } from 'vitest';
import { resolveSupabaseConfig } from './supabase-config';

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

  it('uses PKCE and detects the returned authorization code', () => {
    expect(getSupabaseAuthOptions()).toEqual({
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    });
  });
});
