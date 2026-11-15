import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReport } from '@/services/report.service';
import { getStore } from '@/lib/store';
import type { Analysis, Store } from '@/types/domain';
import { sha256 } from '@/lib/security';

describe('Report Service Expiry and Photo Retention (Issues #2 & #3)', () => {
  const secret = 'a'.repeat(43);
  const secretHash = sha256(secret);

  it('does NOT mark a fresh report as expired or delete photos when reportExpiresAt is missing or null', async () => {
    const store = getStore();
    const deletedPhotoIds: string[] = [];

    // Mock store methods to simulate a newly completed analysis with reportExpiresAt: null
    const mockAnalysis: Analysis = {
      id: 'ana_fresh_test',
      tokenId: 'tok_test',
      sessionHash: 'sess_hash',
      idempotencyKey: 'idem_key',
      status: 'completed',
      facePhotoId: 'photo_face_123',
      bodyPhotoId: 'photo_body_123',
      personalColor: {
        analysis_type: 'personal_color',
        status: 'completed',
        primary_season: 'autumn',
        sub_season: 'warm_autumn' as any,
        alternative_candidates: [],
        confidence_level: 'high',
        traits: { undertone: 'warm', depth: 'medium', contrast: 'medium' },
        photo_quality: { lighting: 'good', image_clarity: 'good', issues: [] },
        styling: {
          recommended_colors: [],
          colors_to_test: [],
          colors_to_avoid: [],
        },
        summary: 'Warm autumn cocok untukmu.',
        disclaimer: 'AI disclaimer',
      },
      bodyShape: {
        analysis_type: 'body_shape',
        status: 'completed',
        shape: 'hourglass',
        alternative_candidates: [],
        confidence_level: 'high',
        photo_quality: { full_body_visible: true, pose: 'good', clothing_fit: 'fitted', issues: [] },
        styling: {
          silhouettes_to_try: [],
          fits_to_try: [],
          things_to_consider: [],
        },
        summary: 'Bentuk tubuh jam pasir.',
        disclaimer: 'AI disclaimer',
      },
      modelMetadata: null,
      error: null,
      reportSecretHash: secretHash,
      reportExpiresAt: null, // Simulate missing reportExpiresAt from DB
      createdAt: new Date().toISOString(), // Created right now
      completedAt: new Date().toISOString(),
    };

    vi.spyOn(store, 'analysisBySecretHash').mockResolvedValue(mockAnalysis);
    vi.spyOn(store, 'deletePhotos').mockImplementation(async (ids) => {
      deletedPhotoIds.push(...ids);
      return ids.length;
    });
    vi.spyOn(store, 'tryonJobForAnalysis').mockResolvedValue(null);
    vi.spyOn(store, 'photoMeta').mockResolvedValue({
      id: 'photo_face_123',
      storagePath: 'flicks-private-photos/face.jpg',
      contentType: 'image/jpeg',
      byteSize: 1000,
      sha256: 'hash',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });

    const report = await getReport(secret);

    // Photos must NOT be deleted!
    expect(deletedPhotoIds).toHaveLength(0);
    // Report must be ready, not expired!
    expect(report.state).toBe('ready');
    if (report.state === 'ready') {
      expect(report.expiresAt).toBeDefined();
      expect(Date.parse(report.expiresAt)).toBeGreaterThan(Date.now());
    }
  });

  it('marks report as expired and deletes photos ONLY when 72 hours have actually elapsed', async () => {
    const store = getStore();
    const deletedPhotoIds: string[] = [];

    const pastDate = new Date(Date.now() - 73 * 3600 * 1000).toISOString();
    const mockExpiredAnalysis: Analysis = {
      id: 'ana_expired_test',
      tokenId: 'tok_test',
      sessionHash: 'sess_hash',
      idempotencyKey: 'idem_key',
      status: 'completed',
      facePhotoId: 'photo_face_old',
      bodyPhotoId: 'photo_body_old',
      personalColor: {
        analysis_type: 'personal_color',
        status: 'completed',
        primary_season: 'autumn',
        sub_season: null,
        alternative_candidates: [],
        confidence_level: 'high',
        traits: { undertone: 'warm', depth: 'medium', contrast: 'medium' },
        photo_quality: { lighting: 'good', image_clarity: 'good', issues: [] },
        styling: { recommended_colors: [], colors_to_test: [], colors_to_avoid: [] },
        summary: 'Ringkasan',
        disclaimer: 'Disclaimer',
      },
      bodyShape: {
        analysis_type: 'body_shape',
        status: 'completed',
        shape: 'hourglass',
        alternative_candidates: [],
        confidence_level: 'high',
        photo_quality: { full_body_visible: true, pose: 'good', clothing_fit: 'fitted', issues: [] },
        styling: { silhouettes_to_try: [], fits_to_try: [], things_to_consider: [] },
        summary: 'Ringkasan',
        disclaimer: 'Disclaimer',
      },
      modelMetadata: null,
      error: null,
      reportSecretHash: secretHash,
      reportExpiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1s ago
      createdAt: pastDate,
      completedAt: pastDate,
    };

    vi.spyOn(store, 'analysisBySecretHash').mockResolvedValue(mockExpiredAnalysis);
    vi.spyOn(store, 'deletePhotos').mockImplementation(async (ids) => {
      deletedPhotoIds.push(...ids);
      return ids.length;
    });

    const report = await getReport(secret);

    expect(report.state).toBe('expired');
    expect(deletedPhotoIds).toEqual(['photo_face_old', 'photo_body_old']);
  });

  it('safely resolves facePhotoUrl and tryon imageUrl with fallback photo IDs without undefined in URL', async () => {
    const store = getStore();
    const mockAnalysis: Analysis = {
      id: 'ana_url_fallback',
      tokenId: 'tok_url_fallback',
      sessionHash: 'sess_hash',
      idempotencyKey: 'idem_key',
      status: 'completed',
      facePhotoId: 'pho_face_fallback_123',
      bodyPhotoId: 'pho_body_fallback_123',
      personalColor: {
        analysis_type: 'personal_color',
        status: 'completed',
        primary_season: 'autumn',
        sub_season: null,
        alternative_candidates: [],
        confidence_level: 'high',
        traits: { undertone: 'warm', depth: 'medium', contrast: 'medium' },
        photo_quality: { lighting: 'good', image_clarity: 'good', issues: [] },
        styling: { recommended_colors: [], colors_to_test: [], colors_to_avoid: [] },
        summary: 'Ringkasan',
        disclaimer: 'Disclaimer',
      },
      bodyShape: {
        analysis_type: 'body_shape',
        status: 'completed',
        shape: 'hourglass',
        alternative_candidates: [],
        confidence_level: 'high',
        photo_quality: { full_body_visible: true, pose: 'good', clothing_fit: 'fitted', issues: [] },
        styling: { silhouettes_to_try: [], fits_to_try: [], things_to_consider: [] },
        summary: 'Ringkasan',
        disclaimer: 'Disclaimer',
      },
      modelMetadata: null,
      error: null,
      reportSecretHash: secretHash,
      reportExpiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    vi.spyOn(store, 'analysisBySecretHash').mockResolvedValue(mockAnalysis);
    vi.spyOn(store, 'tryonJobForAnalysis').mockResolvedValue({
      id: 'try_job_1',
      analysisId: 'ana_url_fallback',
      productId: 'prod_1',
      idempotencyKey: 'idem_try',
      provider: 'fashn',
      providerJobId: 'fashn_1',
      status: 'completed',
      resultPhotoId: 'pho_tryon_fallback_456',
      attempts: 1,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    vi.spyOn(store, 'product').mockResolvedValue({
      id: 'prod_1',
      name: 'Dress A',
      category: 'dresses',
      imagePath: '/images/dress-a.jpg',
      description: 'Test Dress',
      personalColorTone: 'warm',
      bodyShapeCategory: 'hourglass',
    });
    // photoMeta returns object with missing id (simulating legacy/partial record)
    vi.spyOn(store, 'photoMeta').mockImplementation(async (id: string) => {
      return {
        id: undefined as any,
        kind: 'face',
        mime: 'image/jpeg',
        width: 512,
        height: 512,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      };
    });

    const report = await getReport(secret);
    expect(report.state).toBe('ready');
    if (report.state === 'ready') {
      expect(report.facePhotoUrl).not.toBeNull();
      expect(report.facePhotoUrl).toContain('pho_face_fallback_123');
      expect(report.facePhotoUrl).not.toContain('undefined');

      expect(report.tryon).not.toBeNull();
      if (report.tryon && report.tryon.status === 'completed') {
        expect(report.tryon.imageUrl).not.toBeNull();
        expect(report.tryon.imageUrl).toContain('pho_tryon_fallback_456');
        expect(report.tryon.imageUrl).not.toContain('undefined');
      }
    }
  });
});
