import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { SiteNav } from '@/components/ui/SiteNav';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { ButtonLink } from '@/components/ui/ButtonLink';

export const metadata: Metadata = {
  title: 'Why Stellar — CrawlPay',
  description:
    'Sub-cent payments need sub-cent settlement. Why native USDC on Stellar, sponsored fees, and MPP sessions are where pay-per-crawl economics work.',
};

const MATH = [
  { value: '$0.006', tone: 'success' as const, label: 'Revenue', sub: '60 fetches × $0.0001' },
  {
    value: '$6 to $60+',
    tone: 'error' as const,
    label: 'Ethereum gas',
    sub: '60 transactions, volatile ETH',
  },
  {
    value: '$0.30',
    tone: 'error' as const,
    label: 'Base gas',
    sub: '60 transactions, ~$0.005 each',
  },
  {
    value: '~$0',
    tone: 'win' as const,
    label: 'Stellar + MPP',
    sub: 'one batch tx · fees sponsored',
  },
];

const COMPARISON = [
  {
    chain: 'Ethereum',
    token: 'ETH (volatile)',
    gas: '$1 to $20',
    min: '~$5+',
    sub: { text: '✗', cls: 'text-clay' },
  },
  {
    chain: 'Base',
    token: 'ETH',
    gas: '~$0.005',
    min: '~$0.05+',
    sub: { text: 'borderline', cls: 'text-[color:var(--warning)]' },
  },
  {
    chain: 'Polygon',
    token: 'MATIC',
    gas: '~$0.001',
    min: '~$0.01',
    sub: { text: 'borderline', cls: 'text-[color:var(--warning)]' },
  },
  {
    chain: 'Stellar + MPP',
    token: 'USDC (fees sponsored)',
    gas: '~$0.00001 base',
    min: '$0.0000001',
    sub: { text: '✓', cls: 'text-sage font-semibold' },
    win: true,
  },
];

const FLOW = [
  {
    n: '01',
    t: 'Crawler signs',
    p: 'A Soroban authorization entry for the USDC SAC transfer. No gas, no on-chain write.',
  },
  {
    n: '02',
    t: 'Facilitator verifies',
    p: 'Signature + budget checks happen instantly, off-chain.',
  },
  {
    n: '03',
    t: 'MPP session debits',
    p: 'Per-request debits accrue against a pre-authorized session budget.',
  },
  {
    n: '04',
    t: 'Soroban settles',
    p: 'One transaction settles the session; the facilitator sponsors the fee.',
  },
  {
    n: '05',
    t: 'Receipts issued',
    p: 'Each payer gets a portable, independently verifiable receipt.',
  },
];

export default function WhyStellarPage() {
  return (
    <>
      <SiteNav />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden pt-20 pb-14">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 80% 90%, rgba(232,169,107,.08), transparent 55%)',
            }}
            aria-hidden
          />
          <div className="wrap relative z-10">
            <span className="eyebrow">The economics</span>
            <h1 className="h1 max-w-[18ch]">Why Stellar is where this works.</h1>
            <p className="lead mt-5 max-w-[54ch]">
              Sub-cent payments need sub-cent settlement. On Stellar the crawler holds only USDC,
              the facilitator sponsors the fee, and a batch of debits settles for almost nothing.
            </p>
          </div>
        </section>

        {/* THE MATH */}
        <section className="section pt-6">
          <div className="wrap">
            <span className="eyebrow">The math · 60 fetches</span>
            <h2 className="h2 mb-8">One crawl session, four chains.</h2>
            <div className="grid grid-cols-1 overflow-hidden rounded-modal border border-border-subtle sm:grid-cols-2 lg:grid-cols-4">
              {MATH.map((cell, i) => (
                <div
                  key={cell.label}
                  className={
                    'border-border-subtle p-8 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 ' +
                    (i < MATH.length - 1 ? 'sm:[&:nth-child(odd)]:border-r lg:[&]:border-r ' : '') +
                    (cell.tone === 'win' ? 'bg-[color:var(--accent-subtle)]' : '')
                  }
                >
                  <div
                    className={
                      'num-display text-[40px] md:text-[42px] ' +
                      (cell.tone === 'success'
                        ? 'text-sage'
                        : cell.tone === 'error'
                          ? 'text-clay'
                          : 'text-accent')
                    }
                  >
                    {cell.value}
                  </div>
                  <div className="mt-3 text-[13px] leading-[1.4] text-ink-secondary">
                    <span className="block font-medium text-ink-primary">{cell.label}</span>
                    {cell.sub}
                  </div>
                </div>
              ))}
            </div>
            <p className="lead mt-6 max-w-[60ch]">
              60 paid fetches at $0.0001 is $0.006 in revenue against a near-zero settlement cost
              with sponsored fees. On other chains the gas fee alone would exceed the payment.
            </p>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="section pt-0">
          <div className="wrap">
            <span className="eyebrow">Side by side</span>
            <h2 className="h2 mb-6">The settlement gap</h2>
            <div className="rounded-card border border-border-subtle bg-bg-surface px-2 pb-4 pt-2">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {[
                        'Chain',
                        'Fee token',
                        'Avg per-tx fee',
                        'Min viable payment',
                        'Sub-cent?',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 pb-3.5 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr
                        key={row.chain}
                        className={
                          row.win
                            ? 'bg-[color:var(--accent-subtle)] [&>td:first-child]:shadow-[inset_3px_0_0_var(--accent)] [&>td:first-child]:font-semibold [&>td:first-child]:text-accent'
                            : 'border-t border-border-subtle'
                        }
                      >
                        <td
                          className={
                            'p-4 text-sm ' + (row.win ? 'text-accent' : 'text-ink-primary')
                          }
                        >
                          {row.chain}
                        </td>
                        <td className="p-4 text-sm text-ink-secondary">{row.token}</td>
                        <td className="mono p-4 text-sm text-ink-secondary">{row.gas}</td>
                        <td className="mono p-4 text-sm text-ink-secondary">{row.min}</td>
                        <td className={'p-4 text-sm ' + row.sub.cls}>{row.sub.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* HOW SETTLEMENT WORKS */}
        <section className="section pt-0">
          <div className="wrap">
            <span className="eyebrow">Under the hood</span>
            <h2 className="h2 mb-2">How settlement works</h2>
            <p className="lead mb-8 max-w-[54ch]">
              MPP sessions are Stellar&rsquo;s native batching primitive: per-request debits accrue
              off-chain and settle as one sponsored transaction, so the cost is amortized to almost
              nothing.
            </p>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              {FLOW.map((node) => (
                <div
                  key={node.n}
                  className="rounded-card border border-border-subtle bg-bg-surface p-5"
                >
                  <span className="mono text-[11px] text-accent">{node.n}</span>
                  <h4 className="mt-1.5 text-[14.5px] font-semibold">{node.t}</h4>
                  <p className="mt-1 text-[12.5px] leading-[1.45] text-ink-secondary">{node.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY STELLAR, the edge */}
        <section className="section pt-0">
          <div className="wrap">
            <span className="eyebrow">The edge</span>
            <h2 className="h2 mb-6">Native USDC, no gas token, real off-ramp.</h2>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="rounded-card border border-border-subtle bg-bg-surface p-6">
                <h4 className="text-[15px] font-semibold">Native USDC, no bridge</h4>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-secondary">
                  USDC is issued natively on Stellar. Payments settle in the same asset publishers
                  hold, with no wrapped tokens and no bridge risk.
                </p>
              </div>
              <div className="rounded-card border border-border-subtle bg-bg-surface p-6">
                <h4 className="text-[15px] font-semibold">No gas token for the crawler</h4>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-secondary">
                  The crawler holds only USDC; the facilitator sponsors fees through the MPP server,
                  so the agent never has to hold a separate gas token.
                </p>
              </div>
              <div className="rounded-card border border-border-subtle bg-bg-surface p-6">
                <h4 className="text-[15px] font-semibold">Fiat off-ramp built in</h4>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-secondary">
                  Stellar&rsquo;s anchor network lets publishers cash out earnings to local
                  currency. The on-chain payment ends at a bank account, not a wallet.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA STRIP */}
        <section className="border-y border-border-subtle bg-bg-elevated py-20 text-center">
          <div className="wrap">
            <h2 className="h2 mb-6">The math checks out. Add it to your site.</h2>
            <ButtonLink href="https://github.com/StrimzLab/crawlpay" external size="lg">
              Add CrawlPay to your site
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <p className="mono mt-5 text-sm text-ink-secondary">
              Free during testnet · self-host anytime
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
