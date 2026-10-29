import type { Metadata } from 'next';
import { LayoutGrid, Receipt, Settings } from 'lucide-react';
import { DashLayout } from '@/components/dashboard/DashLayout';
import { ReceiptsTable } from '@/components/dashboard/ReceiptsTable';

type RouteParams = { id: string };

export function generateMetadata({ params }: { params: RouteParams }): Metadata {
  return { title: `Receipts — ${params.id} — Octroi` };
}

export default function PublisherReceiptsPage({ params }: { params: RouteParams }) {
  return (
    <DashLayout
      sidebarContext={params.id}
      sidebarItems={[
        { label: 'Overview', icon: LayoutGrid, href: `/publisher/${params.id}` },
        {
          label: 'Receipts',
          icon: Receipt,
          href: `/publisher/${params.id}/receipts`,
          active: true,
        },
        { label: 'Settings', icon: Settings, disabled: true, soon: true },
      ]}
    >
      <ReceiptsTable
        mode="publisher"
        publisherId={params.id}
        title="Receipts"
        subtitle={
          <>
            Full history for <span className="mono">{params.id}</span>
          </>
        }
      />
    </DashLayout>
  );
}
