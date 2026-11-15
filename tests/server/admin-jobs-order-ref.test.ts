import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAdminService,
  createInMemoryAdminDataRepository,
} from '@/server/admin/admin.service';
import { getLocalDevMemoryState, resetLocalDevMemoryState } from '@/server/dev/local-memory-store';

describe('Admin Jobs Order Reference and Gemini Analysis Breakdown', () => {
  beforeEach(() => {
    resetLocalDevMemoryState();
  });

  it('resolves orderReference and extracts personalColor and bodyShape analysis details', async () => {
    const state = getLocalDevMemoryState();

    // 1. Setup payment with providerReference (Order Reference)
    state.paymentsById.set('pay-order-1', {
      id: 'pay-order-1',
      providerReference: 'FLK-1741368921-9923',
      amount: 19000,
      currency: 'IDR',
      status: 'paid',
      paidAt: '2026-10-26T10:00:00.000Z',
      createdAt: '2026-10-26T09:55:00.000Z',
    });

    // 2. Setup token linked to payment
    state.tokensByHash.set('tok-hash-1', {
      id: 'tok-1',
      hash: 'tok-hash-1',
      paymentId: 'pay-order-1',
      status: 'consumed',
      consumedAt: '2026-10-26T10:05:00.000Z',
      reservedAt: '2026-10-26T10:01:00.000Z',
      createdAt: '2026-10-26T10:00:00.000Z',
      expiresAt: '2026-10-29T10:00:00.000Z',
    });

    // 3. Setup analysis job with Gemini breakdown in result
    state.analysisJobsById.set('job-ana-1', {
      id: 'job-ana-1',
      tokenId: 'tok-1',
      type: 'analysis',
      status: 'completed',
      provider: 'gemini',
      providerReference: null,
      attemptCount: 1,
      tokenRecoveryStatus: 'none',
      error: null,
      createdAt: '2026-10-26T10:01:00.000Z',
      updatedAt: '2026-10-26T10:02:15.000Z',
      result: {
        personal_color: {
          primary_season: 'autumn',
          sub_season: 'warm_autumn',
          confidence_level: 'high',
        },
        body_shape: {
          category: 'hourglass',
          confidence_level: 'medium',
        },
      },
    });

    // 4. Setup VTO job linked to same token
    state.vtoJobsById.set('job-vto-1', {
      id: 'job-vto-1',
      tokenId: 'tok-1',
      type: 'virtual_try_on',
      status: 'completed',
      provider: 'fashn',
      providerReference: 'fashn-pred-999',
      attemptCount: 1,
      tokenRecoveryStatus: 'none',
      error: null,
      createdAt: '2026-10-26T10:03:00.000Z',
      updatedAt: '2026-10-26T10:04:30.000Z',
    });

    const repo = createInMemoryAdminDataRepository();
    const service = createAdminService(repo);

    const jobs = await service.getJobs();
    expect(jobs.length).toBe(2);

    const analysisJob = jobs.find((j) => j.id === 'job-ana-1');
    expect(analysisJob).toBeDefined();
    expect(analysisJob?.orderReference).toBe('FLK-1741368921-9923');
    expect(analysisJob?.analysisDetails?.personalColor?.season).toBe('autumn');
    expect(analysisJob?.analysisDetails?.personalColor?.subSeason).toBe('warm_autumn');
    expect(analysisJob?.analysisDetails?.bodyShape?.category).toBe('hourglass');

    const vtoJob = jobs.find((j) => j.id === 'job-vto-1');
    expect(vtoJob).toBeDefined();
    expect(vtoJob?.orderReference).toBe('FLK-1741368921-9923');
  });
});
