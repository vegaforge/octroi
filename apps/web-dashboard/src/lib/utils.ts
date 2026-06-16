import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes, deduping conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Truncate a Stellar G-address: GABC…WXYZ (first 5 / last 4). */
export function formatAddress(addr: string, head = 5, tail = 4): string {
  if (!addr) return '';
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Format atomic USDC (string or bigint, 7 decimals) into a `$X.XXXX` string. */
export function formatUsdc(atomic: string | bigint | number, decimals = 4): string {
  const value = typeof atomic === 'bigint' ? atomic : BigInt(atomic);
  const whole = value / 10_000_000n;
  const fraction = value % 10_000_000n;
  if (fraction === 0n) {
    return `${whole.toString()}.${'0'.repeat(decimals)}`;
  }
  const padded = fraction.toString().padStart(7, '0');
  const trimmed = decimals < 7 ? padded.slice(0, decimals) : padded;
  return `${whole.toString()}.${trimmed}`;
}
