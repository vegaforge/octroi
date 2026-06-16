import Link from 'next/link';
import type { ComponentType } from 'react';
import { LayoutGrid, Receipt, Settings, Bot, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  label: string;
  href?: string;
  icon: ComponentType<LucideProps>;
  active?: boolean;
  disabled?: boolean;
  soon?: boolean;
}

type DashSidebarProps = {
  /** Heading shown above the primary nav items (e.g. "technotes", "Crawler"). */
  contextLabel: string;
  /** Primary nav items. */
  items: SidebarItem[];
  /** Switch-view item (renders at the bottom under a "Switch" label). */
  switchTo?: SidebarItem;
};

export function DashSidebar({ contextLabel, items, switchTo }: DashSidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col gap-1 border-r border-border-subtle p-4 md:p-6',
        // mobile: horizontal scroll row across the top
        'md:gap-1 md:[--rail-pad:24px]',
        'max-md:flex-row max-md:overflow-x-auto max-md:border-b max-md:border-r-0 max-md:py-3',
      )}
      aria-label="Dashboard navigation"
    >
      <SectionLabel className="md:block">{contextLabel}</SectionLabel>
      {items.map((item) => (
        <SidebarLink key={item.label} item={item} />
      ))}
      {switchTo && (
        <>
          <div className="hidden md:mt-auto md:block" />
          <SectionLabel className="hidden md:block">Switch</SectionLabel>
          <SidebarLink item={switchTo} />
        </>
      )}
    </aside>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'mt-2 hidden whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-tertiary md:inline-block',
        className,
      )}
    >
      {children}
    </span>
  );
}

function SidebarLink({ item }: { item: SidebarItem }) {
  const Icon = item.icon;
  const base =
    'flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors';
  const visual = item.disabled
    ? 'text-ink-disabled cursor-not-allowed'
    : item.active
      ? 'bg-[color:var(--accent-subtle)] text-accent'
      : 'text-ink-secondary hover:bg-bg-surface hover:text-ink-primary';
  const content = (
    <>
      <Icon className="h-4 w-4 flex-none" strokeWidth={1.5} aria-hidden />
      <span>{item.label}</span>
      {item.soon && (
        <span className="ml-auto rounded-md border border-border-subtle bg-bg-elevated px-1.5 py-0.5 text-[10px] text-ink-tertiary">
          Soon
        </span>
      )}
    </>
  );
  if (item.disabled || !item.href) {
    return (
      <span className={cn(base, visual)} aria-disabled={item.disabled}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={cn(base, visual)}
      aria-current={item.active ? 'page' : undefined}
    >
      {content}
    </Link>
  );
}

// Re-exported so page routes can grab these icons from one place.
export { LayoutGrid, Receipt, Settings, Bot };
