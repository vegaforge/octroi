'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type AddressChipProps = {
  /** Full Stellar G-address. */
  address: string;
  /** Optional shortened display string. Falls back to first/last truncation. */
  display?: string;
  className?: string;
};

/** Copyable monospace pill for wallet addresses. No-ops if clipboard is denied. */
export function AddressChip({ address, display, className }: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard requires a secure context; ignore failures
    }
  };

  const label = display ?? truncate(address);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied' : 'Copy address'}
      className={cn(
        'mono inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-[13px] text-ink-secondary',
        'cursor-pointer transition-colors hover:border-border-strong hover:text-ink-primary',
        className,
      )}
    >
      <span>{label}</span>
      {copied ? (
        <Check className="h-3 w-3 text-accent" strokeWidth={2} aria-hidden />
      ) : (
        <Copy className="h-3 w-3" strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}

function truncate(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}
