import { describe, expect, it } from 'vitest';
import { createSupabaseStore } from '../../src/lib/store/supabase-store';

describe('supabase relational store mapping', () => {
  it('instantiates supabase store with valid structure and kind', () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
            order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          download: async () => ({ data: null, error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    } as any;

    const store = createSupabaseStore(mockClient);
    expect(store.kind).toBe('supabase');
    expect(typeof store.insertPayment).toBe('function');
    expect(typeof store.settlePayment).toBe('function');
    expect(typeof store.startAnalysis).toBe('function');
    expect(typeof store.claimTryon).toBe('function');
    expect(typeof store.savePhoto).toBe('function');
    expect(typeof store.activeProducts).toBe('function');
  });
});
