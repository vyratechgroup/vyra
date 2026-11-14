import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import type { Analysis, Payment, Photo, Product, Token, TryonJob, UsageEvent } from '@/types/domain';
import { rowToProduct } from './product-mapper';
import type { PhotoMeta, Store, NewAnalysis } from './types';

// Supabase-backed relational store. Server-only: uses service role key.
// Directly mapped to relational schema:
// - payments (provider: 'midtrans', amount: 19000)
// - tokens (payment_id, status: available -> reserved -> consumed)
// - jobs (type: 'analysis' | 'virtual_try_on')
// - photo_assets (flicks-private-photos bucket)
// - reports (token_id, secret_hash)
// - products (is_active catalog)
// - usage_events (audit & cost logging)
// - system_settings (session hash mapping & metadata cache)

const BUCKET = 'flicks-private-photos';

type Row = Record<string, unknown>;

function toUuid(id: string): string {
  if (!id) return randomUUID();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return id.toLowerCase();
  }
  const hash = createHash('sha256').update(id).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    'a' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

async function getSetting<T>(db: SupabaseClient, key: string): Promise<T | null> {
  try {
    const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
    return (data?.value as T) ?? null;
  } catch {
    return null;
  }
}

async function setSetting(db: SupabaseClient, key: string, value: unknown): Promise<void> {
  try {
    await db.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  } catch {
    // Non-fatal
  }
}

function toPayment(r: Row, meta?: any): Payment {
  return {
    id: meta?.rawId || (r.id as string),
    provider: (r.provider as Payment['provider']) || 'midtrans',
    providerReference: (r.provider_reference as string) || (r.id as string),
    sessionHash: meta?.sessionHash || (r.session_hash as string) || '',
    amount: Number(r.amount ?? 19000),
    currency: 'IDR',
    status: (r.status as Payment['status']) || 'pending',
    paymentUrl: meta?.paymentUrl ?? (r.qris_url as string) ?? null,
    qrString: meta?.qrString ?? (r.qris_url as string) ?? null,
    expiresAt: meta?.expiresAt ?? (r.expires_at as string) ?? null,
    createdAt: (r.created_at as string) || new Date().toISOString(),
    paidAt: (r.paid_at as string) ?? null,
  };
}

function toToken(r: Row, meta?: any): Token {
  return {
    id: meta?.rawId || (r.id as string),
    paymentId: meta?.rawPaymentId || (r.payment_id as string),
    status: (r.status as Token['status']) || 'available',
    analysisAttempts: Number(r.analysis_attempts ?? 0),
    reservedAt: (r.reserved_at as string) ?? null,
    consumedAt: (r.consumed_at as string) ?? null,
    createdAt: (r.created_at as string) || new Date().toISOString(),
  };
}

function toAnalysis(r: Row, meta?: any): Analysis {
  const input = (r.input as Record<string, unknown>) ?? {};
  const res = (r.result as Record<string, unknown>) ?? {};
  return {
    id: meta?.rawId || (r.id as string),
    tokenId: meta?.rawTokenId || (r.token_id as string),
    sessionHash: meta?.sessionHash || (input.sessionHash as string) || '',
    idempotencyKey: (input.idempotencyKey as string) || '',
    status: (r.status as Analysis['status']) || 'queued',
    facePhotoId: (input.facePhotoId as string) || '',
    bodyPhotoId: (input.bodyPhotoId as string) || '',
    personalColor: (res.personalColor as Analysis['personalColor']) || (r.personal_color_result as Analysis['personalColor']) || null,
    bodyShape: (res.bodyShape as Analysis['bodyShape']) || (r.body_shape_result as Analysis['bodyShape']) || null,
    modelMetadata: (r.model_metadata as Analysis['modelMetadata']) ?? null,
    error: (r.error as string) ?? null,
    reportSecretHash: meta?.reportSecretHash || (input.reportSecretHash as string) || (r.report_secret_hash as string) || '',
    reportExpiresAt: (r.report_expires_at as string) ?? null,
    createdAt: (r.created_at as string) || new Date().toISOString(),
    completedAt: r.status === 'completed' ? (r.updated_at as string) : null,
  };
}

function toJob(r: Row, meta?: any): TryonJob {
  const input = (r.input as Record<string, unknown>) ?? {};
  return {
    id: meta?.rawId || (r.id as string),
    analysisId: meta?.rawAnalysisId || (input.analysisId as string) || '',
    productId: (input.productId as string) || (r.product_id as string) || '',
    idempotencyKey: (input.idempotencyKey as string) || (r.idempotency_key as string) || '',
    provider: (r.provider as TryonJob['provider']) || 'fashn',
    providerJobId: (r.provider_reference as string) || null,
    status: (r.status as TryonJob['status']) || 'queued',
    resultPhotoId: (r.result_path as string) || null,
    attempts: Number(r.attempt_count ?? 1),
    error: (r.error as string) ?? null,
    createdAt: (r.created_at as string) || new Date().toISOString(),
    completedAt: r.status === 'completed' ? (r.updated_at as string) : null,
  };
}

export function createSupabaseStore(urlOrClient: string | SupabaseClient, secretKey?: string): Store {
  const db: SupabaseClient =
    typeof urlOrClient === 'string'
      ? createClient(urlOrClient, secretKey!, { auth: { persistSession: false, autoRefreshToken: false } })
      : urlOrClient;

  return {
    kind: 'supabase',

    async insertPayment(p) {
      const uuid = toUuid(p.id);
      const now = new Date().toISOString();
      await db.from('payments').upsert({
        id: uuid,
        provider: 'midtrans',
        provider_reference: p.providerReference || p.id,
        amount: 19000,
        currency: 'IDR',
        status: p.status === 'paid' ? 'paid' : p.status === 'failed' ? 'failed' : p.status === 'expired' ? 'expired' : 'pending',
        qris_url: p.paymentUrl || p.qrString || null,
        paid_at: p.status === 'paid' ? p.paidAt || now : null,
        created_at: p.createdAt || now,
        updated_at: now,
      });

      await Promise.all([
        setSetting(db, `payment_meta:${uuid}`, {
          rawId: p.id,
          sessionHash: p.sessionHash,
          paymentUrl: p.paymentUrl,
          qrString: p.qrString,
          expiresAt: p.expiresAt,
        }),
        p.sessionHash ? setSetting(db, `session_payment:${p.sessionHash}`, { paymentId: uuid, rawId: p.id }) : Promise.resolve(),
      ]);
      return p;
    },

    async paymentByReference(ref) {
      const { data: row } = await db.from('payments').select().eq('provider_reference', ref).maybeSingle();
      if (!row) return null;
      const meta = await getSetting(db, `payment_meta:${row.id}`);
      return toPayment(row, meta);
    },

    async latestPaymentForSession(sessionHash) {
      const sessionData = await getSetting<{ paymentId: string }>(db, `session_payment:${sessionHash}`);
      if (sessionData?.paymentId) {
        const { data: row } = await db.from('payments').select().eq('id', sessionData.paymentId).maybeSingle();
        if (row) {
          const meta = await getSetting(db, `payment_meta:${row.id}`);
          return toPayment(row, meta);
        }
      }
      return null;
    },

    async settlePayment(paymentId, tokenId) {
      const payUuid = toUuid(paymentId);
      const tokenUuid = toUuid(tokenId);
      const now = new Date().toISOString();

      const { data: existing } = await db.from('payments').select('status').eq('id', payUuid).maybeSingle();
      if (existing && existing.status === 'paid') {
        return false;
      }

      await db.from('payments').update({
        status: 'paid',
        paid_at: now,
        updated_at: now,
      }).eq('id', payUuid);

      const tokenHash = createHash('sha256').update(tokenId).digest('hex');
      await db.from('tokens').upsert({
        id: tokenUuid,
        payment_id: payUuid,
        secret_hash: tokenHash,
        status: 'available',
        created_at: now,
      });

      await setSetting(db, `token_meta:${tokenUuid}`, { rawId: tokenId, rawPaymentId: paymentId });
      return true;
    },

    async setPaymentStatus(paymentId, status) {
      const payUuid = toUuid(paymentId);
      await db.from('payments').update({
        status,
        updated_at: new Date().toISOString(),
      }).eq('id', payUuid).eq('status', 'pending');
    },

    async tokenForPayment(paymentId) {
      const payUuid = toUuid(paymentId);
      const { data: row } = await db.from('tokens').select().eq('payment_id', payUuid).maybeSingle();
      if (!row) return null;
      const meta = await getSetting<{ rawId: string; rawPaymentId: string }>(db, `token_meta:${row.id}`);
      return toToken(row, meta);
    },

    async token(id) {
      const tokenUuid = toUuid(id);
      const { data: row } = await db.from('tokens').select().eq('id', tokenUuid).maybeSingle();
      if (!row) return null;
      const meta = await getSetting<{ rawId: string; rawPaymentId: string }>(db, `token_meta:${row.id}`);
      return toToken(row, meta);
    },

    async releaseToken(id) {
      const tokenUuid = toUuid(id);
      await db.from('tokens').update({
        status: 'available',
        reserved_at: null,
      }).eq('id', tokenUuid).eq('status', 'reserved');
    },

    async consumeToken(id) {
      const tokenUuid = toUuid(id);
      const now = new Date().toISOString();
      const { data } = await db.from('tokens').update({
        status: 'consumed',
        consumed_at: now,
      }).eq('id', tokenUuid).eq('status', 'reserved').select('id');
      return (data ?? []).length === 1;
    },

    async startAnalysis(a, maxAttempts) {
      const sessionData = await getSetting<{ paymentId: string }>(db, `session_payment:${a.sessionHash}`);
      let tokenRow: Row | null = null;
      if (sessionData?.paymentId) {
        const { data } = await db.from('tokens').select().eq('payment_id', sessionData.paymentId).maybeSingle();
        tokenRow = data;
      }
      if (!tokenRow) {
        const { data } = await db.from('tokens').select().order('created_at', { ascending: false }).limit(1).maybeSingle();
        tokenRow = data;
      }
      if (!tokenRow) {
        return { kind: 'rejected', reason: 'no_token' };
      }
      if (tokenRow.status === 'consumed') {
        return { kind: 'rejected', reason: 'consumed' };
      }

      const tokenUuid = tokenRow.id as string;
      const analysisUuid = toUuid(a.id);
      const now = new Date().toISOString();

      const { data: existingJob } = await db.from('jobs').select().eq('token_id', tokenUuid).eq('type', 'analysis').maybeSingle();

      if (existingJob) {
        const input = (existingJob.input as Record<string, unknown>) ?? {};
        if (input.idempotencyKey === a.idempotencyKey) {
          const meta = await getSetting(db, `analysis_meta:${existingJob.id}`);
          return { kind: 'existing', analysis: toAnalysis(existingJob, meta) };
        }
        const attempts = Number(existingJob.attempt_count ?? 1);
        if (attempts >= maxAttempts) {
          return { kind: 'rejected', reason: 'attempts_exhausted' };
        }
        if (existingJob.status === 'processing') {
          return { kind: 'rejected', reason: 'busy' };
        }

        await db.from('tokens').update({ status: 'reserved', reserved_at: now }).eq('id', tokenUuid);
        const { data: updated } = await db.from('jobs').update({
          status: 'queued',
          attempt_count: attempts + 1,
          input: { ...input, ...a, attempts: attempts + 1 },
          updated_at: now,
        }).eq('id', existingJob.id).select().single();

        const reportUuid = toUuid(randomUUID());
        await db.from('reports').upsert({
          id: reportUuid,
          token_id: tokenUuid,
          secret_hash: a.reportSecretHash,
          created_at: now,
          expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        });

        await setSetting(db, `analysis_meta:${existingJob.id}`, { rawId: a.id, rawTokenId: tokenRow.id, reportSecretHash: a.reportSecretHash });
        return { kind: 'created', analysis: toAnalysis(updated || existingJob, { rawId: a.id, rawTokenId: tokenRow.id, reportSecretHash: a.reportSecretHash }) };
      }

      await db.from('tokens').update({ status: 'reserved', reserved_at: now }).eq('id', tokenUuid);

      const reportUuid = toUuid(randomUUID());
      await db.from('reports').upsert({
        id: reportUuid,
        token_id: tokenUuid,
        secret_hash: a.reportSecretHash,
        created_at: now,
        expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      });

      const { data: newJob } = await db.from('jobs').insert({
        id: analysisUuid,
        token_id: tokenUuid,
        type: 'analysis',
        status: 'queued',
        provider: 'openrouter',
        attempt_count: 1,
        input: { ...a, attempts: 1 },
        created_at: now,
        updated_at: now,
      }).select().single();

      await setSetting(db, `analysis_meta:${analysisUuid}`, {
        rawId: a.id,
        rawTokenId: tokenRow.id,
        sessionHash: a.sessionHash,
        reportSecretHash: a.reportSecretHash,
      });

      return {
        kind: 'created',
        analysis: toAnalysis(newJob || { id: analysisUuid, token_id: tokenUuid, status: 'queued', input: a, created_at: now }, {
          rawId: a.id,
          rawTokenId: tokenRow.id,
          sessionHash: a.sessionHash,
          reportSecretHash: a.reportSecretHash,
        }),
      };
    },

    async analysis(id) {
      const uuid = toUuid(id);
      const { data: row } = await db.from('jobs').select().eq('id', uuid).eq('type', 'analysis').maybeSingle();
      if (!row) return null;
      const meta = await getSetting(db, `analysis_meta:${row.id}`);
      return toAnalysis(row, meta);
    },

    async analysisBySecretHash(hash) {
      const { data: report } = await db.from('reports').select().eq('secret_hash', hash).maybeSingle();
      if (report) {
        const { data: row } = await db.from('jobs').select().eq('token_id', report.token_id).eq('type', 'analysis').maybeSingle();
        if (row) {
          const meta = await getSetting(db, `analysis_meta:${row.id}`);
          return toAnalysis(row, meta);
        }
      }
      return null;
    },

    async latestAnalysisForToken(tokenId) {
      const tokenUuid = toUuid(tokenId);
      const { data: row } = await db.from('jobs').select().eq('token_id', tokenUuid).eq('type', 'analysis').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row) return null;
      const meta = await getSetting(db, `analysis_meta:${row.id}`);
      return toAnalysis(row, meta);
    },

    async updateAnalysis(id, patch) {
      const uuid = toUuid(id);
      const now = new Date().toISOString();
      const dbPatch: Record<string, unknown> = { updated_at: now };

      if (patch.status) dbPatch.status = patch.status === 'needs_retake' ? 'failed' : patch.status;
      if (patch.error !== undefined) dbPatch.error = patch.error;
      if (patch.modelMetadata !== undefined) dbPatch.model_metadata = patch.modelMetadata;

      if (patch.personalColor !== undefined || patch.bodyShape !== undefined) {
        const { data: current } = await db.from('jobs').select('result').eq('id', uuid).maybeSingle();
        const currRes = (current?.result as Record<string, unknown>) ?? {};
        dbPatch.result = {
          ...currRes,
          ...(patch.personalColor !== undefined ? { personalColor: patch.personalColor } : {}),
          ...(patch.bodyShape !== undefined ? { bodyShape: patch.bodyShape } : {}),
        };
      }

      const { data: updated } = await db.from('jobs').update(dbPatch).eq('id', uuid).select().maybeSingle();
      if (!updated) return null;
      const meta = await getSetting(db, `analysis_meta:${updated.id}`);
      return toAnalysis(updated, meta);
    },

    async claimTryon(job, maxAttempts) {
      const analysisUuid = toUuid(job.analysisId);
      const { data: anaRow } = await db.from('jobs').select('token_id').eq('id', analysisUuid).maybeSingle();
      if (!anaRow?.token_id) {
        return { kind: 'rejected', reason: 'attempts_exhausted' };
      }
      const tokenUuid = anaRow.token_id as string;
      const now = new Date().toISOString();

      const { data: existingJob } = await db.from('jobs').select().eq('token_id', tokenUuid).eq('type', 'virtual_try_on').maybeSingle();

      if (existingJob) {
        const input = (existingJob.input as Record<string, unknown>) ?? {};
        if (input.idempotencyKey === job.idempotencyKey && existingJob.status !== 'failed') {
          const meta = await getSetting(db, `tryon_meta:${existingJob.id}`);
          return { kind: 'existing', job: toJob(existingJob, meta) };
        }
        const attempts = Number(existingJob.attempt_count ?? 1);
        if (attempts >= maxAttempts) {
          return { kind: 'rejected', reason: 'attempts_exhausted' };
        }
        const { data: updated } = await db.from('jobs').update({
          status: 'queued',
          attempt_count: attempts + 1,
          input: { ...input, ...job, attempts: attempts + 1 },
          provider: job.provider || 'fashn',
          updated_at: now,
        }).eq('id', existingJob.id).select().single();

        const meta = await getSetting(db, `tryon_meta:${existingJob.id}`);
        return { kind: 'retry', job: toJob(updated || existingJob, meta) };
      }

      const jobUuid = toUuid(job.id);
      const { data: newJob } = await db.from('jobs').insert({
        id: jobUuid,
        token_id: tokenUuid,
        type: 'virtual_try_on',
        status: 'queued',
        provider: job.provider || 'fashn',
        attempt_count: 1,
        input: { ...job, attempts: 1 },
        created_at: now,
        updated_at: now,
      }).select().single();

      await setSetting(db, `tryon_meta:${jobUuid}`, { rawId: job.id, rawAnalysisId: job.analysisId });
      return {
        kind: 'created',
        job: toJob(newJob || { id: jobUuid, token_id: tokenUuid, status: 'queued', input: job, created_at: now }, {
          rawId: job.id,
          rawAnalysisId: job.analysisId,
        }),
      };
    },

    async tryonJob(id) {
      const uuid = toUuid(id);
      const { data: row } = await db.from('jobs').select().eq('id', uuid).eq('type', 'virtual_try_on').maybeSingle();
      if (!row) return null;
      const meta = await getSetting(db, `tryon_meta:${row.id}`);
      return toJob(row, meta);
    },

    async tryonJobForAnalysis(analysisId) {
      const analysisUuid = toUuid(analysisId);
      const { data: anaRow } = await db.from('jobs').select('token_id').eq('id', analysisUuid).maybeSingle();
      if (!anaRow?.token_id) return null;
      const { data: row } = await db.from('jobs').select().eq('token_id', anaRow.token_id).eq('type', 'virtual_try_on').maybeSingle();
      if (!row) return null;
      const meta = await getSetting(db, `tryon_meta:${row.id}`);
      return toJob(row, meta);
    },

    async updateTryonJob(id, patch) {
      const uuid = toUuid(id);
      const now = new Date().toISOString();
      const dbPatch: Record<string, unknown> = { updated_at: now };

      if (patch.status) dbPatch.status = patch.status;
      if (patch.providerJobId !== undefined) dbPatch.provider_reference = patch.providerJobId;
      if (patch.resultPhotoId !== undefined) dbPatch.result_path = patch.resultPhotoId;
      if (patch.error !== undefined) dbPatch.error = patch.error;
      if (patch.attempts !== undefined) dbPatch.attempt_count = patch.attempts;

      const { data: updated } = await db.from('jobs').update(dbPatch).eq('id', uuid).select().maybeSingle();
      if (!updated) return null;
      const meta = await getSetting(db, `tryon_meta:${updated.id}`);
      return toJob(updated, meta);
    },

    async savePhoto(p) {
      const uuid = toUuid(p.id);
      const photoKind = p.kind === 'body' ? 'full_body' : p.kind === 'tryon' ? 'vto_result' : 'face';
      const objectPath = `photos/${uuid}.jpg`;

      await db.storage.from(BUCKET).upload(objectPath, p.bytes, {
        contentType: p.mime || 'image/jpeg',
        upsert: true,
      });

      const now = new Date().toISOString();
      await db.from('photo_assets').upsert({
        id: uuid,
        photo_kind: photoKind,
        object_path: objectPath,
        mime_type: p.mime || 'image/jpeg',
        size_bytes: p.bytes.length,
        width: Math.max(512, p.width || 512),
        height: Math.max(512, p.height || 512),
        created_at: p.createdAt || now,
        expires_at: p.expiresAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });

      await setSetting(db, `photo_meta:${uuid}`, {
        rawId: p.id,
        kind: p.kind,
        mime: p.mime,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
      });

      return {
        id: p.id,
        kind: p.kind,
        mime: p.mime,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
      };
    },

    async photoMeta(id) {
      const uuid = toUuid(id);
      const meta = await getSetting<PhotoMeta>(db, `photo_meta:${uuid}`);
      if (meta) return meta;

      const { data: row } = await db.from('photo_assets').select().eq('id', uuid).maybeSingle();
      if (!row) return null;
      return {
        id,
        kind: row.photo_kind === 'full_body' ? 'body' : 'face',
        mime: (row.mime_type as string) || 'image/jpeg',
        width: Number(row.width ?? 512),
        height: Number(row.height ?? 512),
        createdAt: (row.created_at as string) || new Date().toISOString(),
        expiresAt: (row.expires_at as string) || new Date().toISOString(),
      };
    },

    async photo(id) {
      const meta = await this.photoMeta(id);
      if (!meta) return null;
      const uuid = toUuid(id);
      const { data: row } = await db.from('photo_assets').select('object_path').eq('id', uuid).maybeSingle();
      const path = (row?.object_path as string) || `photos/${uuid}.jpg`;

      const { data: file, error } = await db.storage.from(BUCKET).download(path);
      if (error || !file) return null;
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { ...meta, bytes };
    },

    async deletePhotos(ids) {
      if (ids.length === 0) return;
      const uuids = ids.map(toUuid);
      const paths = uuids.map((u) => `photos/${u}.jpg`);
      await Promise.allSettled([
        db.storage.from(BUCKET).remove(paths),
        db.from('photo_assets').delete().in('id', uuids),
      ]);
    },

    async purgeExpiredPhotos() {
      const cutoff = new Date().toISOString();
      const { data: rows } = await db.from('photo_assets').select('id').lt('expires_at', cutoff).limit(50);
      if (rows && rows.length > 0) {
        await this.deletePhotos(rows.map((r) => r.id as string));
      }
    },

    async activeProducts() {
      const { data: rows } = await db.from('products').select().eq('is_active', true).order('created_at');
      return (rows ?? []).map((r) => rowToProduct(r));
    },

    async product(id) {
      const { data: row } = await db.from('products').select().eq('id', id).maybeSingle();
      if (row) return rowToProduct(row);
      const { data: rowByUuid } = await db.from('products').select().eq('id', toUuid(id)).maybeSingle();
      return rowByUuid ? rowToProduct(rowByUuid) : null;
    },

    async logUsage(e) {
      const uuid = toUuid(e.id);
      const now = new Date().toISOString();
      await db.from('usage_events').insert({
        id: uuid,
        job_id: e.jobId ? toUuid(e.jobId) : null,
        provider: e.provider || 'openrouter',
        feature: e.feature,
        estimated_cost_idr: e.estimatedCostIdr,
        status: e.status,
        created_at: e.timestamp || now,
      });
    },
  };
}
