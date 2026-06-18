import type { Metadata } from 'next';
import { CrawlerDashboardClient } from '@/components/dashboard/CrawlerDashboardClient';

type RouteParams = { wallet: string };

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const short =
    params.wallet.length > 12
      ? `${params.wallet.slice(0, 6)}…${params.wallet.slice(-4)}`
      : params.wallet;
  return {
    title: `${short} — Octroi Crawler`,
    description: `Live spend, top publishers, and receipt feed for crawler ${short} on Stellar testnet.`,
  };
}

export default function CrawlerDashboardPage({ params }: { params: RouteParams }) {
  return <CrawlerDashboardClient wallet={params.wallet} />;
}
