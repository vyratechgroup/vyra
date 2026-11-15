import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config } from '../../src/lib/config';
import {
  submitTryon,
  getTryonStatus,
  downloadResult,
  dataUrlToImage,
} from '../../src/lib/ai/fashn';

describe('src/lib/ai/fashn (Zero Public Footprint & base64 return)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits job to FASHN with return_base64: true to prevent hosting on FASHN CDN', async () => {
    vi.spyOn(config.fashn, 'mode', 'get').mockReturnValue('live');
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'fashn-test-456' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const jobId = await submitTryon({
      person: { bytes: new Uint8Array([1, 2, 3]), mime: 'image/jpeg' },
      garment: { bytes: new Uint8Array([4, 5, 6]), mime: 'image/jpeg' },
      category: 'tops',
    });

    expect(jobId).toBe('fashn-test-456');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(call[1].body as string);
    expect(sentBody.return_base64).toBe(true);
    expect(sentBody.output_format).toBe('jpeg');
    expect(sentBody.mode).toBe('quality');
    expect(sentBody.inputs.return_base64).toBe(true);
    expect(sentBody.inputs.output_format).toBe('jpeg');
    expect(sentBody.inputs.mode).toBe('quality');
    expect(sentBody.inputs.category).toBe('tops');
  });

  it('returns dataUrl kind when FASHN status returns base64 output', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'fashn-test-456',
          status: 'completed',
          output: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const status = await getTryonStatus('fashn-test-456');
    expect(status.state).toBe('completed');
    if (status.state === 'completed') {
      expect(status.output).toEqual({
        kind: 'dataUrl',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      });
    }
  });

  it('decodes base64 dataUrl directly without making HTTP fetch request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const rawDataUrl = 'data:image/jpeg;base64,' + Buffer.from('test-image-bytes').toString('base64');
    const result = await downloadResult(rawDataUrl);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mime).toBe('image/jpeg');
    expect(Buffer.from(result.bytes).toString()).toBe('test-image-bytes');
  });
});
