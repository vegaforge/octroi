import * as React from 'react';
import Link, { type LinkProps } from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type ButtonLinkProps = LinkProps & {
  variant?: Variant;
  size?: Size;
  className?: string;
  external?: boolean;
  children: React.ReactNode;
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'rounded-lg border border-transparent cursor-pointer ' +
  'transition-[background-color,border-color,color,transform] duration-150 ease-smooth ' +
  'active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-[#0A0A0B] font-semibold hover:bg-accent-hover',
  secondary: 'bg-bg-surface text-ink-primary border-border-strong hover:bg-bg-elevated',
  ghost: 'text-ink-secondary hover:text-ink-primary',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

/** Anchor variant of Button. next/link for internal routes, raw <a> for external. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  external = false,
  children,
  href,
  ...rest
}: ButtonLinkProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (external) {
    return (
      <a
        href={typeof href === 'string' ? href : '#'}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
