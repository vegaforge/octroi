/**
 * Display formatters for atomic USDC, addresses, and timestamps.
 * Atomic USDC is 7-decimal (1000 = $0.0001). Use atomicToUsd, never .toFixed() on raw atomic.
 */

import { atomicToDollars, atomicUsdc, type Network } from '@crawlpay/types';

/** Convert atomic USDC (7 decimals) to a display string like "$0.0001". */
export function atomicToUsd(atomic: string | bigint | number): string {
  const dollars = Number(atomicToDollars(atomicUsdc(toBigInt(atomic))));
  if (dollars >= 1000) return `$${dollars.toFixed(0)}`;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(4)}`;
}

/** Like atomicToUsd but always 4 decimals, for chart axis labels. */
export function atomicToUsdShort(atomic: string | bigint | number): string {
  const dollars = Number(atomicToDollars(atomicUsdc(toBigInt(atomic))));
  return `$${dollars.toFixed(4)}`;
}

/** Convert atomic USDC to a plain number of dollars. Used by chart values. */
export function atomicToDollarsNumber(atomic: string | bigint | number): number {
  return Number(atomicToDollars(atomicUsdc(toBigInt(atomic))));
}

function toBigInt(value: string | bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

/** Parse an ISO 8601 timestamp into unix seconds. Receipts carry ISO strings. */
export function isoToUnix(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

/** "2m ago" etc. Falls back to a locale date for older entries. */
export function timeAgo(unixSeconds: number, now: number = Math.floor(Date.now() / 1000)): string {
  const diff = Math.max(0, now - unixSeconds);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

/** Short "2m" / "3h" with no "ago", for compact tables. */
export function timeAgoShort(
  unixSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): string {
  const diff = Math.max(0, now - unixSeconds);
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

/** Truncate a 56-char Stellar G-address to first 5 / last 4 (GABC…WXYZ). */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 11) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

/** stellar.expert account URL for a G-address on the receipt's network. */
export function explorerAccountUrl(address: string, network: Network = 'stellar-testnet'): string {
  return `${explorerBase(network)}/account/${address}`;
}

/** stellar.expert transaction URL for a settlement hash. */
export function explorerTxUrl(hash: string, network: Network = 'stellar-testnet'): string {
  return `${explorerBase(network)}/tx/${hash}`;
}

function explorerBase(network: Network): string {
  const segment = network === 'stellar-mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${segment}`;
}

/** Daily date to day-of-week chart label, e.g. 2026-06-04 to "Thu". */
export function isoDateToDow(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] ?? iso;
}

/** YYYY-MM-DD to "Jun 4" for monthly view. */
export function isoDateToShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
