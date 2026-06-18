'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, Download, Filter, Loader2, Search } from 'lucide-react';
import type { OctroiReceipt } from '@octroi/types';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ReceiptModal } from './ReceiptModal';
import {
  getCrawlerReceipts,
  getPublisherReceipts,
  type CrawlerReceiptsResponse,
  type PublisherReceiptsResponse,
  type ReceiptListPagination,
} from '@/lib/api/receipts';

type ReceiptsResponse = PublisherReceiptsResponse | CrawlerReceiptsResponse;
import { atomicToUsd, isoToUnix, timeAgoShort, truncateAddress } from '@/lib/format';
import { cn } from '@/lib/utils';

const PER_PAGE = 25;

type ReceiptsTableProps =
  | {
      mode: 'publisher';
      publisherId: string;
      title: string;
      subtitle?: React.ReactNode;
    }
  | {
      mode: 'crawler';
      crawlerWallet: string;
      title: string;
      subtitle?: React.ReactNode;
    };

/** Server-paginated receipts table. Counterparty/URL filtering is client-side over the current page. */
export function ReceiptsTable(props: ReceiptsTableProps) {
  const [page, setPage] = useState(0);
  const [counterpartyQuery, setCounterpartyQuery] = useState('');
  const [urlQuery, setUrlQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<OctroiReceipt | null>(null);

  const queryKey = useMemo(
    () =>
      props.mode === 'publisher'
        ? (['receipts', 'publisher', props.publisherId, page] as const)
        : (['receipts', 'crawler', props.crawlerWallet, page] as const),
    // union narrowing makes this safe even though both arms are in the deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode, props.mode === 'publisher' ? props.publisherId : props.crawlerWallet, page],
  );

  const { data, isLoading, error } = useQuery<ReceiptsResponse>({
    queryKey,
    queryFn: async (): Promise<ReceiptsResponse> => {
      if (props.mode === 'publisher') {
        return getPublisherReceipts(props.publisherId, {
          limit: PER_PAGE,
          offset: page * PER_PAGE,
        });
      }
      return getCrawlerReceipts(props.crawlerWallet, {
        limit: PER_PAGE,
        offset: page * PER_PAGE,
      });
    },
    placeholderData: (prev: ReceiptsResponse | undefined) => prev,
    staleTime: 15_000,
  });

  const receipts = data?.receipts ?? [];
  const pagination: ReceiptListPagination = data?.pagination ?? {
    total: 0,
    limit: PER_PAGE,
    offset: 0,
  };

  const filtered = useMemo(() => {
    const cq = counterpartyQuery.toLowerCase();
    const uq = urlQuery.toLowerCase().replace(/\*/g, '');
    return receipts.filter((r) => {
      const counterparty = props.mode === 'publisher' ? r.from : r.to;
      if (cq && !counterparty.toLowerCase().includes(cq)) return false;
      if (uq && !r.resource.toLowerCase().includes(uq)) return false;
      if (status) {
        const st = receiptStatus(r);
        if (st !== status) return false;
      }
      return true;
    });
  }, [receipts, counterpartyQuery, urlQuery, status, props.mode]);

  function resetPaging<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  function downloadCsv() {
    const header = 'time,resource,counterparty,amount_usdc,status,tx,nonce\n';
    const rows = filtered
      .map((r) => {
        const counterparty = props.mode === 'publisher' ? r.from : r.to;
        return [
          r.timestamp,
          r.resource,
          counterparty,
          atomicToUsd(r.amount).replace('$', ''),
          receiptStatus(r),
          r.onchainTxHash ?? '',
          r.nonce,
        ].join(',');
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'octroi-receipts.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const counterpartyHeader = props.mode === 'publisher' ? 'Crawler' : 'Publisher';
  const start = pagination.offset + 1;
  const end = pagination.offset + receipts.length;
  const hasNext = pagination.offset + receipts.length < pagination.total;
  const hasPrev = page > 0;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">{props.title}</h1>
          {props.subtitle && (
            <div className="mt-1 text-[14px] text-ink-tertiary">{props.subtitle}</div>
          )}
        </div>
        <Button variant="secondary" onClick={downloadCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          Export CSV
        </Button>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <FilterInput
          icon={<Search />}
          value={counterpartyQuery}
          onChange={resetPaging(setCounterpartyQuery)}
          placeholder={props.mode === 'publisher' ? 'Crawler wallet' : 'Publisher id'}
        />
        <FilterInput
          icon={<Search />}
          value={urlQuery}
          onChange={resetPaging(setUrlQuery)}
          placeholder="URL pattern, e.g. /research/**"
          grow
        />
        <FilterSelect
          icon={<Filter />}
          value={status}
          onChange={resetPaging(setStatus)}
          options={[
            { value: '', label: 'All status' },
            { value: 'Settled', label: 'Settled' },
            { value: 'Pending', label: 'Pending' },
          ]}
        />
        <div className="hidden items-center gap-1 text-[12px] text-ink-tertiary sm:inline-flex">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          <span>Window: all time (server-driven)</span>
        </div>
      </div>

      <section className="rounded-card border border-border-subtle bg-bg-surface p-5 px-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>URL</Th>
                <Th>{counterpartyHeader}</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th align="right">Receipt</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && receipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-ink-tertiary">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-clay">
                      <AlertCircle className="h-4 w-4" aria-hidden />
                      Failed to load receipts.{' '}
                      {error instanceof Error ? error.message : String(error)}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-ink-tertiary">
                    {receipts.length === 0
                      ? 'No receipts yet. Run a crawl through the demo to see one here.'
                      : 'No receipts match these filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const counterparty = props.mode === 'publisher' ? r.from : r.to;
                  return (
                    <tr
                      key={r.nonce}
                      className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-bg-elevated"
                    >
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm text-ink-tertiary">
                        {timeAgoShort(isoToUnix(r.timestamp))} ago
                      </td>
                      <td className="px-3 py-3.5 text-sm">
                        <div className="mono max-w-[280px] truncate" title={r.resource}>
                          {r.resource}
                        </div>
                      </td>
                      <td className="mono px-3 py-3.5 text-[13px] text-ink-secondary">
                        {truncateAddress(counterparty)}
                      </td>
                      <td className="mono px-3 py-3.5 text-right text-sm text-accent">
                        {atomicToUsd(r.amount)}
                      </td>
                      <td className="px-3 py-3.5 text-sm">
                        <StatusChip status={receiptStatus(r)} />
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(r)}
                          className="cursor-pointer rounded-md border border-border-subtle bg-bg-elevated px-2.5 py-1 text-[12.5px] text-ink-secondary transition-all hover:border-border-strong hover:text-ink-primary"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-4 text-[13px] text-ink-tertiary">
          <span>
            {pagination.total ? `${start}–${end} of ${pagination.total} receipts` : '0 receipts'}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!hasPrev}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <ReceiptModal
        receipt={
          selected
            ? {
                resource: selected.resource,
                amount: atomicToUsd(selected.amount),
                canonical: selected as unknown as Record<string, unknown>,
                fullReceipt: selected,
              }
            : null
        }
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function receiptStatus(r: OctroiReceipt): 'Settled' | 'Pending' {
  return r.onchainTxHash ? 'Settled' : 'Pending';
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={cn(
        'border-b border-border-subtle px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

function StatusChip({ status }: { status: 'Settled' | 'Pending' }) {
  if (status === 'Settled') return <Chip variant="accent">Settled</Chip>;
  return <Chip dot="warning">Pending</Chip>;
}

function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3 transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_2px_var(--accent-subtle)]">
      <span className="text-ink-tertiary [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer border-none bg-transparent text-[13px] text-ink-secondary outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-elevated">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  icon,
  value,
  onChange,
  placeholder,
  grow,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  grow?: boolean;
}) {
  return (
    <label
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3 transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_2px_var(--accent-subtle)]',
        grow && 'flex-1 min-w-[200px]',
      )}
    >
      <span className="text-ink-tertiary [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'mono border-none bg-transparent text-[13px] text-ink-primary outline-none placeholder:text-ink-tertiary',
          grow ? 'w-full' : 'w-44',
        )}
      />
    </label>
  );
}
