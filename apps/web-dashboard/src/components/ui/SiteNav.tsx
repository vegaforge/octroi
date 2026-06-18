import Link from 'next/link';
import { Github } from 'lucide-react';
import { Logo } from '@/components/brand';
import { ApiKeyMenu } from '@/components/auth/ApiKeyMenu';
import { ButtonLink } from './ButtonLink';

const GITHUB_URL = 'https://github.com/StrimzLab/octroi';

/** Top nav for marketing routes. Links go to real pages only, no in-page anchors. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 h-[var(--nav-h)] border-b border-border-subtle bg-[color:var(--bg-overlay)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-content items-center justify-between gap-6 px-6 md:px-8">
        <Link
          href="/"
          aria-label="Octroi home"
          className="text-accent transition-colors hover:text-accent-hover"
        >
          <Logo variant="lockup" className="h-7 w-auto" />
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/why-stellar">Why Stellar</NavLink>
          <NavLink href="/demo">Demo</NavLink>
          <NavLink href={GITHUB_URL} external>
            <Github className="h-[14px] w-[14px]" aria-hidden />
            <span>GitHub</span>
          </NavLink>
          <ButtonLink href="/onboard/publisher" size="sm" className="ml-2">
            Get started
          </ButtonLink>
          <span className="ml-2">
            <ApiKeyMenu />
          </span>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const classes =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink-primary';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
