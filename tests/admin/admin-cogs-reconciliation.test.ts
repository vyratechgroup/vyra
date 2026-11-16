import { describe, expect, it } from 'vitest';
import {
  buildFinancialLedgerEntries,
  computeFinancialKpis,
} from '../../src/app/admin/admin-formatters';
import {
  reconcileUsageCosts,
  type AdminJobItem,
  type AdminTransactionItem,
  type AdminUsageCostItem,
} from '../../src/server/admin/admin.service';

describe('Admin COGS & Financials Synchronization (TDD)', () => {
  it('reconciles completed jobs when usage_events are missing in database', () => {
    const rawJobs: AdminJobItem[] = [
      {
        id: 'vto-1',
        tokenId: 'tok-1',
        type: 'virtual_try_on',
        status: 'completed',
        provider: 'fashn',
        providerReference: 'pred-1',
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 8000,
        error: null,
        metadata: { isDualGarment: true },
        createdAt: '2026-11-14T10:00:00.000Z',
        updatedAt: '2026-11-14T10:00:08.000Z',
      },
      {
        id: 'vto-2',
        tokenId: 'tok-2',
        type: 'virtual_try_on',
        status: 'completed',
        provider: 'fashn',
        providerReference: 'pred-2',
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 8000,
        error: null,
        metadata: { isDualGarment: false },
        createdAt: '2026-11-14T11:00:00.000Z',
        updatedAt: '2026-11-14T11:00:08.000Z',
      },
      {
        id: 'vto-3',
        tokenId: 'tok-3',
        type: 'virtual_try_on',
        status: 'completed',
        provider: 'fashn',
        providerReference: 'pred-3',
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 8000,
        error: null,
        metadata: { isDualGarment: false },
        createdAt: '2026-11-14T12:00:00.000Z',
        updatedAt: '2026-11-14T12:00:08.000Z',
      },
      {
        id: 'vto-4',
        tokenId: 'tok-4',
        type: 'virtual_try_on',
        status: 'completed',
        provider: 'fashn',
        providerReference: 'pred-4',
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 8000,
        error: null,
        metadata: { isDualGarment: true },
        createdAt: '2026-11-14T13:00:00.000Z',
        updatedAt: '2026-11-14T13:00:08.000Z',
      },
      {
        id: 'analysis-1',
        tokenId: 'tok-1',
        type: 'analysis',
        status: 'completed',
        provider: 'gemini',
        providerReference: null,
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 3000,
        error: null,
        createdAt: '2026-11-14T09:55:00.000Z',
        updatedAt: '2026-11-14T09:55:03.000Z',
      },
      {
        id: 'analysis-2',
        tokenId: 'tok-2',
        type: 'analysis',
        status: 'completed',
        provider: 'gemini',
        providerReference: null,
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 3000,
        error: null,
        createdAt: '2026-11-14T10:55:00.000Z',
        updatedAt: '2026-11-14T10:55:03.000Z',
      },
    ];

    // Only vto-1 is logged in usageEvents (2846 IDR)
    const existingEvents: AdminUsageCostItem[] = [
      {
        id: 'ue-vto-1',
        jobId: 'vto-1',
        provider: 'fashn',
        feature: 'virtual_try_on',
        model: 'tryon-v1.6',
        costType: 'actual',
        amountIdr: 2846,
        inputTokens: null,
        outputTokens: null,
        status: 'completed',
        errorCode: null,
        createdAt: '2026-11-14T10:00:08.000Z',
      },
      {
        id: 'ue-ana-1',
        jobId: 'analysis-1',
        provider: 'gemini',
        feature: 'personal_color',
        model: 'gemini-2.5-flash',
        costType: 'estimated',
        amountIdr: 14,
        inputTokens: 100,
        outputTokens: 50,
        status: 'completed',
        errorCode: null,
        createdAt: '2026-11-14T09:55:03.000Z',
      },
      {
        id: 'ue-ana-2',
        jobId: 'analysis-1',
        provider: 'gemini',
        feature: 'body_shape',
        model: 'gemini-2.5-flash',
        costType: 'estimated',
        amountIdr: 14,
        inputTokens: 100,
        outputTokens: 50,
        status: 'completed',
        errorCode: null,
        createdAt: '2026-11-14T09:55:03.000Z',
      },
    ];

    const { fashnActualCostIdr, geminiEstimatedCostIdr, allUsageEvents } =
      reconcileUsageCosts(rawJobs, existingEvents);

    // vto-1 (2846) + vto-2 (1423) + vto-3 (1423) + vto-4 (2846) = 8538
    expect(fashnActualCostIdr).toBe(8538);
    // analysis-1 (28) + analysis-2 (reconciled 28) = 56
    expect(geminiEstimatedCostIdr).toBe(56);
    expect(allUsageEvents.length).toBeGreaterThanOrEqual(6);
  });
  it('correctly calculates FASHN and Gemini costs per transaction based on actual completed jobs', () => {
    const transactions: AdminTransactionItem[] = [
      {
        paymentId: 'pay-vto-single',
        providerReference: 'ORDER-VTO-1',
        amount: 19000,
        currency: 'IDR',
        status: 'paid',
        paidAt: '2026-11-14T10:00:00.000Z',
        createdAt: '2026-11-14T09:50:00.000Z',
        token: {
          id: 'tok-1',
          status: 'consumed',
          reservedAt: '2026-11-14T09:51:00.000Z',
          consumedAt: '2026-11-14T10:00:00.000Z',
        },
      },
      {
        paymentId: 'pay-vto-dual',
        providerReference: 'ORDER-VTO-2',
        amount: 19000,
        currency: 'IDR',
        status: 'paid',
        paidAt: '2026-11-15T10:00:00.000Z',
        createdAt: '2026-11-15T09:50:00.000Z',
        token: {
          id: 'tok-2',
          status: 'consumed',
          reservedAt: '2026-11-15T09:51:00.000Z',
          consumedAt: '2026-11-15T10:00:00.000Z',
        },
      },
      {
        paymentId: 'pay-analysis-only',
        providerReference: 'ORDER-ANALYSIS-ONLY',
        amount: 19000,
        currency: 'IDR',
        status: 'paid',
        paidAt: '2026-11-16T10:00:00.000Z',
        createdAt: '2026-11-16T09:50:00.000Z',
        token: {
          id: 'tok-3',
          status: 'reserved',
          reservedAt: '2026-11-16T09:51:00.000Z',
          consumedAt: null,
        },
      },
    ];

    const jobs: (AdminJobItem & { metadata?: Record<string, unknown> })[] = [
      {
        id: 'job-analysis-1',
        tokenId: 'tok-1',
        type: 'analysis',
        status: 'completed',
        provider: 'gemini',
        providerReference: null,
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 3000,
        error: null,
        createdAt: '2026-11-14T09:51:00.000Z',
        updatedAt: '2026-11-14T09:51:03.000Z',
      },
      {
        id: 'job-vto-single',
        tokenId: 'tok-1',
        type: 'virtual_try_on',
        status: 'completed',
        provider: 'fashn',
        providerReference: 'fashn-1',
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 8000,
        error: null,
        createdAt: '2026-11-14T09:52:00.000Z',
        updatedAt: '2026-11-14T09:52:08.000Z',
        metadata: { isDualGarment: false },
      },
      {
        id: 'job-analysis-2',
        tokenId: 'tok-2',
        type: 'analysis',
        status: 'completed',
        provider: 'gemini',
        providerReference: null,
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 3100,
        error: null,
        createdAt: '2026-11-15T09:51:00.000Z',
        updatedAt: '2026-11-15T09:51:03.100Z',
      },
      {
        id: 'job-vto-dual',
        tokenId: 'tok-2',
        type: 'virtual_try_on',
        status: 'completed',
        provider: 'fashn',
        providerReference: 'fashn-2',
        attemptCount: 1,
        tokenRecoveryStatus: 'consumed',
        durationMs: 15000,
        error: null,
        createdAt: '2026-11-15T09:52:00.000Z',
        updatedAt: '2026-11-15T09:52:15.000Z',
        metadata: { isDualGarment: true },
      },
      {
        id: 'job-analysis-3',
        tokenId: 'tok-3',
        type: 'analysis',
        status: 'completed',
        provider: 'gemini',
        providerReference: null,
        attemptCount: 1,
        tokenRecoveryStatus: 'reserved',
        durationMs: 2900,
        error: null,
        createdAt: '2026-11-16T09:51:00.000Z',
        updatedAt: '2026-11-16T09:51:02.900Z',
      },
    ];

    // Only job-vto-dual has an event in usageEvents table
    const costEvents: AdminUsageCostItem[] = [
      {
        id: 'ue-1',
        jobId: 'job-vto-dual',
        provider: 'fashn',
        feature: 'virtual_try_on',
        model: 'tryon-v1.6',
        costType: 'actual',
        amountIdr: 2846,
        inputTokens: null,
        outputTokens: null,
        status: 'completed',
        errorCode: null,
        createdAt: '2026-11-15T09:52:15.000Z',
      },
    ];

    const entries = buildFinancialLedgerEntries(transactions, jobs, costEvents);
    expect(entries).toHaveLength(3);

    // Entry 1: single garment VTO (unrecorded in costEvents) should be 1 credit = 1423 IDR, Gemini = 28 IDR
    const entry1 = entries.find((e) => e.paymentId === 'pay-vto-single');
    expect(entry1).toBeDefined();
    expect(entry1?.revenueIdr).toBe(19000);
    expect(entry1?.midtransFeeIdr).toBe(133); // 19000 * 0.007
    expect(entry1?.fashnCostIdr).toBe(1423); // exactly 1 credit
    expect(entry1?.geminiCostIdr).toBe(28); // exactly analysis cost (~28 IDR, not 500 IDR)
    expect(entry1?.totalCogsIdr).toBe(133 + 1423 + 28); // 1584 IDR

    // Entry 2: dual garment VTO (recorded in costEvents) should be 2846 IDR, Gemini = 28 IDR
    const entry2 = entries.find((e) => e.paymentId === 'pay-vto-dual');
    expect(entry2).toBeDefined();
    expect(entry2?.fashnCostIdr).toBe(2846); // 2 credits
    expect(entry2?.geminiCostIdr).toBe(28);

    // Entry 3: analysis only (no VTO job). FASHN cost MUST be 0 (NOT 1350 IDR)!
    const entry3 = entries.find((e) => e.paymentId === 'pay-analysis-only');
    expect(entry3).toBeDefined();
    expect(entry3?.fashnCostIdr).toBe(0);
    expect(entry3?.geminiCostIdr).toBe(28);

    const kpis = computeFinancialKpis(entries);
    expect(kpis.grossRevenueIdr).toBe(57000);
    expect(kpis.midtransFeeIdr).toBe(399); // 133 * 3
    expect(kpis.fashnCostIdr).toBe(1423 + 2846); // 4269 IDR
    expect(kpis.geminiCostIdr).toBe(28 * 3); // 84 IDR
    expect(kpis.totalCogsIdr).toBe(399 + 4269 + 84); // 4752 IDR
    expect(kpis.grossProfitIdr).toBe(57000 - 4752); // 52248 IDR
  });
});
