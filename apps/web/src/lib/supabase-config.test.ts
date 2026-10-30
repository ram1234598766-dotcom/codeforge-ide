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
