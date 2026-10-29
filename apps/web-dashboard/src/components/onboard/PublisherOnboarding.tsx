'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Globe, KeyRound, Loader2 } from 'lucide-react';
import { isStellarAddress } from '@octroi/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useApiKey } from '@/hooks/useApiKey';
import { createPublisher, PublishersApiError, type PublisherRecord } from '@/lib/api/publishers';
import { SetupInstructions } from './SetupInstructions';

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

type Step = 'form' | 'setup';

const PRICE_TIERS = [
  { atomic: 1000, label: '$0.0001', hint: 'Default, a hundredth of a cent' },
  { atomic: 10000, label: '$0.001', hint: 'About 10× a basic API call' },
  { atomic: 100000, label: '$0.01', hint: 'Premium · curated research' },
] as const;

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] },
} as const;

export function PublisherOnboarding() {
  const { setApiKey } = useApiKey();
  const [step, setStep] = useState<Step>('form');
  const [domain, setDomain] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [priceAtomic, setPriceAtomic] = useState<number>(1000);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    publisher: PublisherRecord;
    apiKey: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!DOMAIN_RE.test(domain.trim())) {
      setError('Domain must look like example.com (no scheme, no path).');
      return;
    }
    if (!isStellarAddress(walletAddress.trim())) {
      setError('Payout address must be a valid Stellar G-address (56 chars, starts with G).');
      return;
    }
    setSubmitting(true);
    try {
      const { publisher, apiKey } = await createPublisher({
        domain: domain.trim().toLowerCase(),
        walletAddress: walletAddress.trim(),
        defaultPriceAtomic: priceAtomic,
        description: description.trim() || undefined,
      });

      setApiKey(apiKey);
      setCreated({ publisher, apiKey });
      setStep('setup');
    } catch (err) {
      if (err instanceof PublishersApiError) {
        if (err.code === 'already_exists') {
          setError(`A publisher already exists for "${domain.trim().toLowerCase()}".`);
        } else if (err.code === 'invalid_domain') {
          setError('Domain rejected by the server. Double-check the format.');
        } else if (err.code === 'invalid_wallet') {
          setError('Payout address rejected by the server. Double-check the G-address.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
      <StepperHeader currentStep={step} />

      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div key="form" {...fadeIn}>
            <FormStep
              domain={domain}
              setDomain={setDomain}
              walletAddress={walletAddress}
              setWalletAddress={setWalletAddress}
              priceAtomic={priceAtomic}
              setPriceAtomic={setPriceAtomic}
              description={description}
              setDescription={setDescription}
              submitting={submitting}
              error={error}
              onSubmit={(e) => void handleSubmit(e)}
            />
          </motion.div>
        )}

        {step === 'setup' && created && (
          <motion.div key="setup" {...fadeIn}>
            <SetupInstructions publisher={created.publisher} apiKey={created.apiKey} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepperHeader({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'form', label: 'Configure' },
    { key: 'setup', label: 'Install' },
  ];
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <ol className="mb-10 flex items-center gap-2 text-[12px] text-ink-tertiary">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                done && 'bg-sage text-bg-base',
                active && 'bg-accent text-[#0A0A0B]',
                !done && !active && 'border border-border-subtle text-ink-tertiary',
              )}
            >
              {i + 1}
            </span>
            <span className={cn('transition-colors', (done || active) && 'text-ink-primary')}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-2 h-px w-8 bg-border-subtle" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

type FormStepProps = {
  domain: string;
  setDomain: (s: string) => void;
  walletAddress: string;
  setWalletAddress: (s: string) => void;
  priceAtomic: number;
  setPriceAtomic: (n: number) => void;
  description: string;
  setDescription: (s: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
};

function FormStep(props: FormStepProps) {
  const {
    domain,
    setDomain,
    walletAddress,
    setWalletAddress,
    priceAtomic,
    setPriceAtomic,
    description,
    setDescription,
    submitting,
    error,
    onSubmit,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What are you monetizing?
        </h1>
        <p className="lead text-ink-secondary">
          Three quick fields and you&rsquo;re live on Stellar testnet.
        </p>
      </header>

      <Field label="Stellar payout address" required>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent"
            aria-hidden
          />
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="GABC…WXYZ"
            required
            autoComplete="off"
            spellCheck={false}
            className="mono w-full rounded-lg border border-border-subtle bg-bg-surface py-2.5 pl-9 pr-3 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <p className="mt-1 text-[12px] text-ink-tertiary">
          USDC settles here. We never custody funds.
        </p>
      </Field>

      <Field label="Domain you want to monetize" required>
        <div className="relative">
          <Globe
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
            aria-hidden
          />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="technotes.example.com"
            required
            autoComplete="off"
            spellCheck={false}
            className="mono w-full rounded-lg border border-border-subtle bg-bg-surface py-2.5 pl-9 pr-3 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <p className="mt-1 text-[12px] text-ink-tertiary">No scheme, no path, just the host.</p>
      </Field>

      <Field label="Default price per crawl" required>
        <div className="grid grid-cols-3 gap-2">
          {PRICE_TIERS.map((tier) => {
            const active = tier.atomic === priceAtomic;
            return (
              <button
                key={tier.atomic}
                type="button"
                onClick={() => setPriceAtomic(tier.atomic)}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-accent bg-[color:var(--accent-subtle)]'
                    : 'border-border-subtle bg-bg-surface hover:border-border-strong',
                )}
              >
                <div
                  className={cn('mono text-[14px]', active ? 'text-accent' : 'text-ink-primary')}
                >
                  {tier.label}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-tertiary">{tier.hint}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[12px] text-ink-tertiary">
          You can override per-path later with pricing rules.
        </p>
      </Field>

      <Field label="Description" optional>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short note about what you publish (shown on the public profile)"
          className="w-full resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2.5 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </Field>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-clay/40 bg-[color:rgba(136,69,79,0.06)] px-3 py-2 text-sm text-clay"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden />
          )}
          {submitting ? 'Creating…' : 'Create publisher'}
        </Button>
        <span className="text-xs text-ink-tertiary">
          We issue your API key on the next step. It&rsquo;s shown once.
        </span>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-medium text-ink-primary">
        {label}
        {required && <span className="text-accent">*</span>}
        {optional && <span className="text-[11px] font-normal text-ink-tertiary">(optional)</span>}
      </span>
      {children}
      {hint && <p className="text-[12px] text-ink-tertiary">{hint}</p>}
    </label>
  );
}
