import type { Metadata } from 'next';
import { LayoutGrid, Receipt, Settings } from 'lucide-react';
import { DashLayout } from '@/components/dashboard/DashLayout';
import { ReceiptsTable } from '@/components/dashboard/ReceiptsTable';

type RouteParams = { wallet: string };

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const short =
    params.wallet.length > 12
      ? `${params.wallet.slice(0, 6)}…${params.wallet.slice(-4)}`
      : params.wallet;
  return { title: `Receipts — ${short} — Octroi` };
}

export default function CrawlerReceiptsPage({ params }: { params: RouteParams }) {
  return (
    <DashLayout
      sidebarContext="Crawler"
      sidebarItems={[
        { label: 'Overview', icon: LayoutGrid, href: `/crawler/${params.wallet}` },
        {
          label: 'Receipts',
          icon: Receipt,
          href: `/crawler/${params.wallet}/receipts`,
          active: true,
        },
        { label: 'Budgets', icon: Settings, disabled: true, soon: true },
      ]}
    >
      <ReceiptsTable
        mode="crawler"
        crawlerWallet={params.wallet}
        title="Receipts"
        subtitle={
          <>
            Full history for <span className="mono">{params.wallet}</span>
          </>
        }
      />
    </DashLayout>
  );
}
