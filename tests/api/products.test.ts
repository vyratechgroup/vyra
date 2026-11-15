import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET } from '@/app/api/products/route';
import { getStore } from '@/lib/store';
import type { Product } from '@/types/domain';

describe('GET /api/products - Filter by Body Shape and Color Tone', () => {
  beforeEach(async () => {
    // Reset or prepare store
    const store = getStore();
    // activeProducts uses in-memory or mock
  });

  it('returns all active products when no filters are provided', async () => {
    const req = new Request('http://localhost:3000/api/products');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(4);
  });

  it('filters strictly by body_shape and color_tone when provided', async () => {
    // Knit top matches hourglass and autumn; Linen shirt matches rectangle and summer/spring
    const req = new Request(
      'http://localhost:3000/api/products?body_shape=hourglass&color_tone=warm_autumn',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const ids = data.map((d: { id: string }) => d.id);
    expect(ids).toContain('prd_knit_top');
    expect(ids).not.toContain('prd_linen_shirt');
  });

  it('does not return mismatched products (strict filtering)', async () => {
    // Querying an impossible / nonexistent combo should return empty array, never fallback to all products
    const req = new Request(
      'http://localhost:3000/api/products?body_shape=nonexistent_shape&color_tone=neon_purple_nonexistent',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it('selects by body shape in stage 1, then selects by color tone in stage 2 with Indonesian synonyms', async () => {
    // "jam pasir" should normalize to hourglass
    // "warm autumn" should normalize to autumn
    const req = new Request(
      'http://localhost:3000/api/products?body_shape=jam%20pasir&color_tone=warm%20autumn',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const ids = data.map((d: { id: string }) => d.id);
    // Knit top is hourglass & autumn
    expect(ids).toContain('prd_knit_top');
    // Linen shirt is rectangle (eliminated in stage 1)
    expect(ids).not.toContain('prd_linen_shirt');
    // Basic tee is cool/summer/winter (eliminated in stage 2)
    expect(ids).not.toContain('prd_basic_tee');
  });

  it('eliminates products in stage 1 if body shape does not match, even if color tone matches', async () => {
    // Linen shirt has summer/spring color tone, but rectangle shape.
    // If user has hourglass shape and summer tone, linen shirt must be eliminated in stage 1.
    const req = new Request(
      'http://localhost:3000/api/products?body_shape=hourglass&color_tone=summer',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const ids = data.map((d: { id: string }) => d.id);
    expect(ids).not.toContain('prd_linen_shirt');
  });
});
