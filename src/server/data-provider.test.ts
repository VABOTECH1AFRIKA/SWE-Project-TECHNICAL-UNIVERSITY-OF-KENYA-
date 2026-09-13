import { afterEach, describe, expect, it, vi } from 'vitest';

const originalProvider = process.env.DATABASE_PROVIDER;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  vi.resetModules();

  if (typeof originalProvider === 'string') {
    process.env.DATABASE_PROVIDER = originalProvider;
  } else {
    delete process.env.DATABASE_PROVIDER;
  }

  if (typeof originalSupabaseUrl === 'string') {
    process.env.SUPABASE_URL = originalSupabaseUrl;
  } else {
    delete process.env.SUPABASE_URL;
  }

  if (typeof originalSupabaseKey === 'string') {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
  } else {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

describe('data provider selection', () => {
  it('defaults to sqlite when no provider is configured', async () => {
    delete process.env.DATABASE_PROVIDER;

    const { databaseProvider, dataAccess } = await import('./data');

    expect(databaseProvider).toBe('sqlite');
    expect(dataAccess.courses.list).toBeTypeOf('function');
  });

  it('switches to the supabase provider when explicitly configured', async () => {
    process.env.DATABASE_PROVIDER = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const { databaseProvider, dataAccess } = await import('./data');

    expect(databaseProvider).toBe('supabase');
    expect(dataAccess.courses.list).toBeTypeOf('function');
  });
});
