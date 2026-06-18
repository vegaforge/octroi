import type { Metadata } from 'next';
import { SiteNav } from '@/components/ui/SiteNav';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { DemoRunner } from '@/components/demo/DemoRunner';

export const metadata: Metadata = {
  title: 'Live demo — Octroi',
  description:
    'Watch Octroi settle 60 real Stellar testnet payments in under two minutes. Streaming receipts, verifiable on-chain.',
};

export default function DemoPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1024px] px-6 py-14 md:px-8 md:py-16">
        <DemoRunner />
      </main>
      <SiteFooter />
    </>
  );
}
