'use client';

import React, { useMemo, useState } from 'react';
import styles from '../admin.module.css';
import { formatDateTime, formatIdr } from '../admin-formatters';
import type {
  AdminJobItem,
  AdminTokenItem,
  AdminTransactionItem,
} from '@/server/admin/admin.service';

export interface AdminTransactionsSectionProps {
  transactions: AdminTransactionItem[];
  tokens: AdminTokenItem[];
}

export interface AdminJobsSectionProps {
  jobs: AdminJobItem[];
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'active':
    case 'consumed':
      return styles.badgeSuccess;
    case 'pending':
    case 'processing':
      return styles.badgeWarning;
    case 'failed':
    case 'expired':
    case 'paused':
      return styles.badgeDanger;
    case 'available':
    case 'reserved':
      return styles.badgeInfo;
    default:
      return '';
  }
}

function formatDurationMs(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

// ==========================================================================
// 1. AdminTransactionsSection
// ==========================================================================
export function AdminTransactionsSection({
  transactions,
  tokens,
}: AdminTransactionsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'transactions' | 'tokens'>('all');

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status.toLowerCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${tx.providerReference} ${tx.paymentId} ${tx.status} ${
        tx.token?.id ?? ''
      } ${tx.token?.status ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [transactions, searchTerm, statusFilter]);

  const filteredTokens = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tokens.filter((tok) => {
      if (!q) return true;
      const haystack = `${tok.id} ${tok.status} ${tok.paymentId ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [tokens, searchTerm]);

  return (
    <section aria-label="Transactions and Tokens Management">
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Cari Order Ref, Payment ID, atau Token ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            spellCheck={false}
            aria-label="Cari transaksi dan token"
          />

          <div className={styles.chipGroup} role="group" aria-label="Filter status transaksi">
            {(
              [
                { key: 'all', label: 'Semua Status' },
                { key: 'paid', label: 'Paid' },
                { key: 'pending', label: 'Pending' },
                { key: 'failed', label: 'Failed' },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={statusFilter === s.key}
                className={`${styles.chip} ${
                  statusFilter === s.key ? styles.chipActive : ''
                }`}
                onClick={() => setStatusFilter(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className={styles.chipGroup} role="group" aria-label="Filter tampilan tabel">
            {(
              [
                { key: 'all', label: 'Semua Tabel' },
                { key: 'transactions', label: 'Transaksi Pembayaran' },
                { key: 'tokens', label: 'Token Akses' },
              ] as const
            ).map((vm) => (
              <button
                key={vm.key}
                type="button"
                aria-pressed={viewMode === vm.key}
                className={`${styles.chip} ${
                  viewMode === vm.key ? styles.chipActive : ''
                }`}
                onClick={() => setViewMode(vm.key)}
              >
                {vm.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Transactions Table */}
      {viewMode === 'all' || viewMode === 'transactions' ? (
        <div className={styles.card} style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Payment Transactions</h3>
              <p className={styles.cardSubtitle}>
                Daftar pesanan Midtrans Snap QRIS / GoPay dan korelasi token analisis
              </p>
            </div>
            <span className={styles.badge}>
              {filteredTransactions.length} Transaksi
            </span>
          </div>

          <table className={styles.dataTable} aria-label="Tabel Transaksi Pembayaran">
            <thead>
              <tr>
                <th scope="col" className={styles.tableHeaderCell}>Order Reference</th>
                <th scope="col" className={styles.tableHeaderCell}>Payment ID</th>
                <th scope="col" className={styles.tableHeaderCell}>Jumlah</th>
                <th scope="col" className={styles.tableHeaderCell}>Status Bayar</th>
                <th scope="col" className={styles.tableHeaderCell}>Waktu Bayar</th>
                <th scope="col" className={styles.tableHeaderCell}>Token Terkait</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.paymentId}>
                    <td className={styles.tableCell}>
                      <strong
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          color: 'var(--admin-ink)',
                        }}
                      >
                        {tx.providerReference}
                      </strong>
                    </td>
                    <td
                      className={styles.tableCell}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.8rem',
                        color: '#415A77',
                      }}
                    >
                      {tx.paymentId}
                    </td>
                    <td
                      className={`${styles.tableCell} ${styles.tabularNums}`}
                      style={{ fontWeight: 600 }}
                    >
                      {formatIdr(tx.amount)}
                    </td>
                    <td className={styles.tableCell}>
                      <span
                        className={`${styles.badge} ${getStatusBadgeClass(
                          tx.status,
                        )}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      {tx.paidAt ? formatDateTime(tx.paidAt) : '—'}
                    </td>
                    <td className={styles.tableCell}>
                      {tx.token ? (
                        <span
                          className={`${styles.badge} ${getStatusBadgeClass(
                            tx.token.status,
                          )}`}
                        >
                          {tx.token.status}
                        </span>
                      ) : (
                        <span style={{ color: '#7D8FA5' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.tableCell}
                    style={{ textAlign: 'center', color: '#415A77', padding: '2rem 1rem' }}
                  >
                    Tidak ada transaksi yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Issued Tokens Table */}
      {viewMode === 'all' || viewMode === 'tokens' ? (
        <div className={styles.card} style={{ overflowX: 'auto' }}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Issued Access Tokens</h3>
              <p className={styles.cardSubtitle}>
                Status siklus hidup token (available, reserved, consumed, expired)
              </p>
            </div>
            <span className={styles.badge}>{filteredTokens.length} Token</span>
          </div>

          <table className={styles.dataTable} aria-label="Tabel Token Akses">
            <thead>
              <tr>
                <th scope="col" className={styles.tableHeaderCell}>Token ID</th>
                <th scope="col" className={styles.tableHeaderCell}>Status</th>
                <th scope="col" className={styles.tableHeaderCell}>Payment ID</th>
                <th scope="col" className={styles.tableHeaderCell}>Reserved At</th>
                <th scope="col" className={styles.tableHeaderCell}>Consumed At</th>
                <th scope="col" className={styles.tableHeaderCell}>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.length > 0 ? (
                filteredTokens.map((tok) => (
                  <tr key={tok.id}>
                    <td
                      className={styles.tableCell}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                      }}
                    >
                      {tok.id}
                    </td>
                    <td className={styles.tableCell}>
                      <span
                        className={`${styles.badge} ${getStatusBadgeClass(
                          tok.status,
                        )}`}
                      >
                        {tok.status}
                      </span>
                    </td>
                    <td
                      className={styles.tableCell}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.8rem',
                        color: '#415A77',
                      }}
                    >
                      {tok.paymentId ?? '—'}
                    </td>
                    <td className={styles.tableCell}>
                      {tok.reservedAt ? formatDateTime(tok.reservedAt) : '—'}
                    </td>
                    <td className={styles.tableCell}>
                      {tok.consumedAt ? formatDateTime(tok.consumedAt) : '—'}
                    </td>
                    <td className={styles.tableCell}>
                      {formatDateTime(tok.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.tableCell}
                    style={{ textAlign: 'center', color: '#415A77', padding: '2rem 1rem' }}
                  >
                    Tidak ada data token yang sesuai dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

// ==========================================================================
// 2. AdminJobsSection
// ==========================================================================
interface DisplayJobRow {
  rowKey: string;
  jobId: string;
  orderReference: string | null;
  dateStr: string;
  jobType: string;
  provider: string;
  providerRef: string | null;
  status: string;
  attemptCount: number;
  tokenRecovery: string;
  durationMs: number | null | undefined;
  details: string;
  isError: boolean;
  rowSpan?: number;
  isGroupFirst?: boolean;
}

export function AdminJobsSection({ jobs }: AdminJobsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'gemini' | 'fashn'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'processing'>('all');

  const processedRows = useMemo(() => {
    // 1. Expand analysis jobs with Gemini breakdown if available
    type ExpandedItem = {
      orderRef: string;
      jobId: string;
      createdAt: string;
      typeLabel: string;
      provider: string;
      providerRef: string | null;
      status: string;
      attemptCount: number;
      tokenRecovery: string;
      durationMs: number | null | undefined;
      details: string;
      isError: boolean;
    };

    const expandedList: ExpandedItem[] = [];

    for (const job of jobs) {
      const orderRef = job.orderReference || 'Tanpa Order Ref';
      if (job.type === 'analysis' && job.analysisDetails) {
        // If Gemini analysis details exist, render breakdown rows
        if (job.analysisDetails.personalColor) {
          expandedList.push({
            orderRef,
            jobId: job.id,
            createdAt: job.createdAt,
            typeLabel: 'Color Tone (Wajah)',
            provider: job.provider,
            providerRef: job.providerReference,
            status: job.status,
            attemptCount: job.attemptCount,
            tokenRecovery: job.tokenRecoveryStatus,
            durationMs: job.durationMs,
            details: `Season: ${job.analysisDetails.personalColor.season}${
              job.analysisDetails.personalColor.subSeason
                ? ` (${job.analysisDetails.personalColor.subSeason})`
                : ''
            }${
              job.analysisDetails.personalColor.confidence
                ? ` • Conf: ${job.analysisDetails.personalColor.confidence}`
                : ''
            }`,
            isError: false,
          });
        }
        if (job.analysisDetails.bodyShape) {
          expandedList.push({
            orderRef,
            jobId: job.id,
            createdAt: job.createdAt,
            typeLabel: 'Body Shape (Tubuh)',
            provider: job.provider,
            providerRef: job.providerReference,
            status: job.status,
            attemptCount: job.attemptCount,
            tokenRecovery: job.tokenRecoveryStatus,
            durationMs: job.durationMs,
            details: `Shape: ${job.analysisDetails.bodyShape.category}${
              job.analysisDetails.bodyShape.confidence
                ? ` • Conf: ${job.analysisDetails.bodyShape.confidence}`
                : ''
            }`,
            isError: false,
          });
        }
        // If neither was populated (edge case)
        if (!job.analysisDetails.personalColor && !job.analysisDetails.bodyShape) {
          expandedList.push({
            orderRef,
            jobId: job.id,
            createdAt: job.createdAt,
            typeLabel: 'Gemini Analysis',
            provider: job.provider,
            providerRef: job.providerReference,
            status: job.status,
            attemptCount: job.attemptCount,
            tokenRecovery: job.tokenRecoveryStatus,
            durationMs: job.durationMs,
            details: job.error ?? '—',
            isError: Boolean(job.error),
          });
        }
      } else {
        // VTO or regular analysis without details
        const typeLabel =
          job.type === 'virtual_try_on'
            ? 'Virtual Try-On'
            : 'Analisis Multimodal';
        expandedList.push({
          orderRef,
          jobId: job.id,
          createdAt: job.createdAt,
          typeLabel,
          provider: job.provider,
          providerRef: job.providerReference,
          status: job.status,
          attemptCount: job.attemptCount,
          tokenRecovery: job.tokenRecoveryStatus,
          durationMs: job.durationMs,
          details: job.error ?? '—',
          isError: Boolean(job.error),
        });
      }
    }

    // 2. Filter by search, provider, and status
    const q = searchTerm.trim().toLowerCase();
    const filtered = expandedList.filter((item) => {
      if (
        providerFilter !== 'all' &&
        item.provider.toLowerCase() !== providerFilter
      ) {
        return false;
      }
      if (statusFilter !== 'all' && item.status.toLowerCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.orderRef} ${item.jobId} ${item.typeLabel} ${
        item.provider
      } ${item.providerRef ?? ''} ${item.status} ${item.details}`.toLowerCase();
      return haystack.includes(q);
    });

    // 3. Group by orderRef to compute rowSpan for merging order reference cells
    const groups = new Map<string, ExpandedItem[]>();
    for (const item of filtered) {
      if (!groups.has(item.orderRef)) {
        groups.set(item.orderRef, []);
      }
      groups.get(item.orderRef)!.push(item);
    }

    const rows: DisplayJobRow[] = [];
    for (const [orderRef, items] of groups.entries()) {
      items.forEach((item, index) => {
        rows.push({
          rowKey: `${item.jobId}-${item.typeLabel}-${index}`,
          jobId: item.jobId,
          orderReference: orderRef === 'Tanpa Order Ref' ? null : orderRef,
          dateStr: item.createdAt,
          jobType: item.typeLabel,
          provider: item.provider,
          providerRef: item.providerRef,
          status: item.status,
          attemptCount: item.attemptCount,
          tokenRecovery: item.tokenRecovery,
          durationMs: item.durationMs,
          details: item.details,
          isError: item.isError,
          rowSpan: index === 0 ? items.length : undefined,
          isGroupFirst: index === 0,
        });
      });
    }

    return rows;
  }, [jobs, searchTerm, providerFilter, statusFilter]);

  return (
    <section aria-label="AI and VTO Jobs Monitoring">
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Cari Job ID, Provider Ref, Token ID, atau Error…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            spellCheck={false}
            aria-label="Cari AI dan VTO jobs"
          />

          <div className={styles.chipGroup} role="group" aria-label="Filter provider AI">
            {(
              [
                { key: 'all', label: 'Semua Provider' },
                { key: 'gemini', label: 'Gemini' },
                { key: 'fashn', label: 'FASHN' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={providerFilter === p.key}
                className={`${styles.chip} ${
                  providerFilter === p.key ? styles.chipActive : ''
                }`}
                onClick={() => setProviderFilter(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={styles.chipGroup} role="group" aria-label="Filter status job">
            {(
              [
                { key: 'all', label: 'Semua Status' },
                { key: 'completed', label: 'Completed' },
                { key: 'failed', label: 'Failed' },
                { key: 'processing', label: 'Processing' },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={statusFilter === s.key}
                className={`${styles.chip} ${
                  statusFilter === s.key ? styles.chipActive : ''
                }`}
                onClick={() => setStatusFilter(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className={styles.card} style={{ overflowX: 'auto' }}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>AI &amp; VTO Jobs</h3>
            <p className={styles.cardSubtitle}>
              Pemantauan performa inferensi Gemini dan generasi visual FASHN
            </p>
          </div>
          <span className={styles.badge}>{processedRows.length} Entri Analisis</span>
        </div>

        <table className={styles.dataTable} aria-label="Tabel Job Monitoring">
          <thead>
            <tr>
              <th scope="col" className={styles.tableHeaderCell}>Order Reference</th>
              <th scope="col" className={styles.tableHeaderCell}>Tanggal</th>
              <th scope="col" className={styles.tableHeaderCell}>Komponen / Provider</th>
              <th scope="col" className={styles.tableHeaderCell}>Job / Provider Ref</th>
              <th scope="col" className={styles.tableHeaderCell}>Status</th>
              <th scope="col" className={styles.tableHeaderCell}>Percobaan</th>
              <th scope="col" className={styles.tableHeaderCell}>Token Recovery</th>
              <th scope="col" className={styles.tableHeaderCell}>Durasi</th>
              <th scope="col" className={styles.tableHeaderCell}>Hasil / Info</th>
            </tr>
          </thead>
          <tbody>
            {processedRows.length > 0 ? (
              processedRows.map((row) => (
                <tr key={row.rowKey}>
                  {row.isGroupFirst ? (
                    <td
                      rowSpan={row.rowSpan}
                      className={styles.tableCell}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 700,
                        backgroundColor: 'var(--admin-bg-base, rgba(255,255,255,0.02))',
                        borderRight: '1px solid var(--admin-border-subtle)',
                        verticalAlign: 'top',
                      }}
                    >
                      {row.orderReference ? (
                        <span style={{ color: 'var(--admin-accent-primary, #415A77)' }}>
                          {row.orderReference}
                        </span>
                      ) : (
                        <span style={{ color: '#7D8FA5', fontStyle: 'italic' }}>
                          Tanpa Order
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className={styles.tableCell} style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {formatDateTime(row.dateStr)}
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ fontWeight: 600 }}>{row.jobType}</div>
                    <div style={{ fontSize: '0.75rem', color: '#7D8FA5' }}>{row.provider}</div>
                  </td>
                  <td
                    className={styles.tableCell}
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.8rem',
                      color: '#415A77',
                    }}
                  >
                    <div>#{row.jobId.length > 10 ? row.jobId.slice(0, 10) : row.jobId}</div>
                    {row.providerRef ? <div>{row.providerRef}</div> : null}
                  </td>
                  <td className={styles.tableCell}>
                    <span
                      className={`${styles.badge} ${getStatusBadgeClass(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td
                    className={`${styles.tableCell} ${styles.tabularNums}`}
                    style={{ textAlign: 'center' }}
                  >
                    {row.attemptCount}
                  </td>
                  <td className={styles.tableCell}>
                    <span
                      className={`${styles.badge} ${
                        row.tokenRecovery === 'recovered'
                          ? styles.badgeSuccess
                          : styles.badgeInfo
                      }`}
                    >
                      {row.tokenRecovery}
                    </span>
                  </td>
                  <td className={`${styles.tableCell} ${styles.tabularNums}`}>
                    {formatDurationMs(row.durationMs)}
                  </td>
                  <td
                    className={styles.tableCell}
                    style={{
                      maxWidth: '280px',
                      color: row.isError ? 'var(--admin-danger)' : '#E2D8C6',
                      fontSize: '0.8rem',
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.details}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className={styles.tableCell}
                  style={{ textAlign: 'center', color: '#415A77', padding: '2rem 1rem' }}
                >
                  Tidak ada job yang sesuai dengan kriteria filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
