import Link from 'next/link';
import { Logo } from '@/components/brand';
import { Chip } from './Chip';

const GITHUB_URL = 'https://github.com/StrimzLab/octroi';

/** Site footer. Holds the resource links the nav doesn't carry. */
export function SiteFooter() {
  return (
    <footer className=" border-t border-border-subtle">
      <div className="mx-auto max-w-content px-6 py-16 md:px-8 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr] lg:gap-10">
          <div>
            <Link href="/" className="inline-block text-ink-secondary hover:text-ink-primary">
              <Logo variant="lockup" className="h-6 w-auto" />
            </Link>
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-ink-tertiary">
              Open-source pay-per-crawl infrastructure for the open web.
            </p>
          </div>

          <FooterCol heading="Product">
            <FooterLink href="/why-stellar">Why Stellar</FooterLink>
            <FooterLink href="/demo">Demo</FooterLink>
          </FooterCol>

          <FooterCol heading="Resources">
            <FooterLink href={GITHUB_URL} external>
              GitHub
            </FooterLink>
            <FooterLink href="https://www.npmjs.com/package/@octroi/crawler-sdk" external>
              npm
            </FooterLink>
            <FooterLink href="https://x402.org" external>
              Protocol spec
            </FooterLink>
          </FooterCol>

          <FooterCol heading="Built on">
            <div className="flex flex-wrap gap-2">
              <Chip>Stellar</Chip>
              <Chip>Soroban</Chip>
              <Chip>USDC</Chip>
              <Chip>x402</Chip>
              <Chip>MPP</Chip>
            </div>
          </FooterCol>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-6 text-[13px] text-ink-tertiary">
          <span>© 2026 Octroi · Open source on GitHub</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
        {heading}
      </h5>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const classes = 'text-sm text-ink-secondary transition-colors hover:text-ink-primary';
  if (external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className={classes}>
        {children}
      </Link>
    </li>
  );
}
