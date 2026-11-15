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

  it('maps report expires_at correctly in analysisBySecretHash and toAnalysis', async () => {
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const mockClient = {
      from: (table: string) => {
        if (table === 'reports') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'rep-1',
                    token_id: 'tok-1',
                    secret_hash: val,
                    expires_at: expiresAt,
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'jobs') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'job-1',
                      token_id: 'tok-1',
                      type: 'analysis',
                      status: 'completed',
                      input: { facePhotoId: 'face-1', bodyPhotoId: 'body-1' },
                      result: {},
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'app_settings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        };
      },
    } as any;

    const store = createSupabaseStore(mockClient);
    const analysis = await store.analysisBySecretHash('some_hash');
    expect(analysis).not.toBeNull();
    expect(analysis?.reportExpiresAt).toBe(expiresAt);
  });

  it('updates tryon job using result JSONB without non-existent result_path column', async () => {
    let updatePayload: any = null;
    let updatedJobId: string | null = null;
    const mockClient = {
      from: (table: string) => {
        if (table === 'jobs') {
          return {
            update: (payload: any) => {
              updatePayload = payload;
              return {
                eq: (_col: string, val: string) => {
                  updatedJobId = val;
                  return {
                    select: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: val,
                          token_id: 'tok-1',
                          type: 'virtual_try_on',
                          status: payload.status,
                          result: payload.result,
                          attempt_count: 1,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        },
                      }),
                    }),
                  };
                },
              };
            },
          };
        }
        if (table === 'app_settings') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
            upsert: async () => ({ error: null }),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        };
      },
    } as any;

    const store = createSupabaseStore(mockClient);
    const updated = await store.updateTryonJob('00000000-0000-0000-0000-000000000001', {
      status: 'completed',
      resultPhotoId: 'pho_123',
    });

    expect(updatePayload).not.toBeNull();
    expect(updatePayload.result_path).toBeUndefined();
    expect(updatePayload.result).toEqual(expect.objectContaining({ resultPhotoId: 'pho_123' }));
    expect(updated?.resultPhotoId).toBe('pho_123');
  });

  it('ensures photoMeta returns valid id and maps vto_result to tryon', async () => {
    const mockClient = {
      from: (table: string) => {
        if (table === 'system_settings') {
          return {
            select: () => ({
              eq: (_col: string, key: string) => ({
                maybeSingle: async () => {
                  if (key === 'photo_meta:22222222-2222-4222-8222-222222222222') {
                    return {
                      data: {
                        value: {
                          rawId: 'pho_face_legacy',
                          kind: 'face',
                          mime: 'image/jpeg',
                        },
                      },
                    };
                  }
                  return { data: null };
                },
              }),
            }),
          };
        }
        if (table === 'photo_assets') {
          return {
            select: () => ({
              eq: (_col: string, id: string) => ({
                maybeSingle: async () => {
                  if (id === '33333333-3333-4333-8333-333333333333') {
                    return {
                      data: {
                        id: '33333333-3333-4333-8333-333333333333',
                        photo_kind: 'vto_result',
                        mime_type: 'image/jpeg',
                        created_at: new Date().toISOString(),
                        expires_at: new Date().toISOString(),
                      },
                    };
                  }
                  return { data: null };
                },
              }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        };
      },
    } as any;

    const store = createSupabaseStore(mockClient);
    const legacyMeta = await store.photoMeta('22222222-2222-4222-8222-222222222222');
    expect(legacyMeta).not.toBeNull();
    expect(legacyMeta?.id).toBe('pho_face_legacy');

    const vtoMeta = await store.photoMeta('33333333-3333-4333-8333-333333333333');
    expect(vtoMeta).not.toBeNull();
    expect(vtoMeta?.kind).toBe('tryon');
  });
});
