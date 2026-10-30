import { describe, expect, it } from 'vitest';
import { getPublicSupabaseConfig, isPublishableSupabaseKey } from '../config';

function legacyKey(role: string): string {
  const encode = (value: string) => btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(JSON.stringify({ role }))}.signature`;
}

describe('isPublishableSupabaseKey', () => {
  it('accepts modern Supabase publishable keys', () => {
    expect(isPublishableSupabaseKey('sb_publishable_example-key')).toBe(true);
  });

  it('accepts legacy anon JWT keys', () => {
    expect(isPublishableSupabaseKey(legacyKey('anon'))).toBe(true);
  });

  it('rejects service role, secret, and malformed keys', () => {
    expect(isPublishableSupabaseKey(legacyKey('service_role'))).toBe(false);
    expect(isPublishableSupabaseKey('sb_secret_example-key')).toBe(false);
    expect(isPublishableSupabaseKey('not-a-key')).toBe(false);
    expect(isPublishableSupabaseKey('')).toBe(false);
  });
});

describe('getPublicSupabaseConfig', () => {
  it('returns the configured project URL and a publishable key', () => {
    expect(getPublicSupabaseConfig({
      SUPABASE_URL: ' https://project.supabase.co/ ',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example-key',
    })).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example-key',
    });
  });

  it('falls back to the Vite URL binding when SUPABASE_URL is absent', () => {
    expect(getPublicSupabaseConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example-key',
    })).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example-key',
    });
  });

  it('does not return a missing or privileged key to the browser', () => {
    expect(getPublicSupabaseConfig({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: legacyKey('service_role'),
    })).toBeNull();
    expect(getPublicSupabaseConfig({
      SUPABASE_URL: 'https://project.supabase.co',
    })).toBeNull();
  });
});
