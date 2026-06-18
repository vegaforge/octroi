import type { Metadata } from 'next';
import { PublisherDashboardClient } from '@/components/dashboard/PublisherDashboardClient';

type RouteParams = { id: string };

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  return {
    title: `${params.id} — Octroi Publisher`,
    description: `Live earnings, top crawlers, and receipt feed for publisher ${params.id} on Stellar testnet.`,
  };
}

export default function PublisherDashboardPage({ params }: { params: RouteParams }) {
  return <PublisherDashboardClient publisherId={params.id} />;
}
