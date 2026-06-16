import { Info } from 'lucide-react';
import { DashNav } from './DashNav';
import { DashSidebar, type SidebarItem } from './DashSidebar';

type DashLayoutProps = {
  /** @deprecated kept for prop compatibility; nav now uses the API-key menu. */
  walletAddress?: string;
  /** @deprecated see walletAddress. */
  walletShort?: string;
  sidebarContext: string;
  sidebarItems: SidebarItem[];
  switchTo?: SidebarItem;
  children: React.ReactNode;
};

/** Shell for publisher/crawler dashboards: top nav, side rail, content slot. */
export function DashLayout({
  walletAddress: _walletAddress,
  walletShort: _walletShort,
  sidebarContext,
  sidebarItems,
  switchTo,
  children,
}: DashLayoutProps) {
  return (
    <>
      <DashNav />
      <div className="grid min-h-[calc(100vh-var(--nav-h))] grid-cols-1 md:grid-cols-[240px_1fr]">
        <DashSidebar contextLabel={sidebarContext} items={sidebarItems} switchTo={switchTo} />
        <main className="min-w-0 px-6 py-8 md:px-10 md:py-8 lg:pb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--accent-subtle)] px-3.5 py-2 text-[12.5px] text-accent md:hidden">
            <Info className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Best viewed on desktop
          </div>
          {children}
        </main>
      </div>
    </>
  );
}
