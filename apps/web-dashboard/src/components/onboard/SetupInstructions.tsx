'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, Copy, Loader2, Play, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import {
  probePublisher,
  PublishersApiError,
  type ProbeResult,
  type PublisherRecord,
} from '@/lib/api/publishers';

type SetupInstructionsProps = {
  publisher: PublisherRecord;
  /** API key returned once by POST /publishers. Never shown again. */
  apiKey: string;
};

/** Final onboarding step: one-time API key reveal, prefilled middleware/.env snippets, domain probe. */
export function SetupInstructions({ publisher, apiKey }: SetupInstructionsProps) {
  const installCmd = 'pnpm add @octroi/proxy-middleware @octroi/types';

  const expressCode = `import express from 'express';
import { octroi } from '@octroi/proxy-middleware';
import { dollarsToAtomic } from '@octroi/types';

const app = express();

app.use(octroi({
  publisherId: '${publisher.id}',
  payToAddress: '${publisher.walletAddress}',
  network: '${publisher.network}',
  defaultPrice: ${publisher.defaultPriceAtomic}n,
  apiKey: process.env.OCTROI_API_KEY,
}));

app.get('/articles/:slug', (req, res) => {
  res.send('<article>…</article>');
});

app.listen(3000);
`;

  const envBlock = `# Octroi API key
# Save this. We don't store it, and there's no "show again" button.
OCTROI_API_KEY=${apiKey}
`;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Chip variant="accent" dot="success">
          Publisher created · {publisher.id}
        </Chip>
        <h2 className="text-2xl font-semibold tracking-tight">
          You&rsquo;re three minutes from your first paid crawl.
        </h2>
        <p className="text-ink-secondary">
          Copy the API key below, paste the middleware into your Express app, then probe your
          domain. We&rsquo;ll watch the receipts roll in.
        </p>
      </header>

      <ApiKeyReveal apiKey={apiKey} />

      <Section index="1" title="Install the SDK">
        <CodeBlock code={installCmd} language="bash" />
      </Section>

      <Section index="2" title="Add the middleware">
        <CodeBlock code={expressCode} language="ts" />
      </Section>

      <Section index="3" title="Configure your .env">
        <CodeBlock code={envBlock} language="bash" />
      </Section>

      <ProbeSection publisherId={publisher.id} domain={publisher.domain} />

      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Link href={`/publisher/${publisher.id}`} prefetch={false}>
          <Button size="lg">
            Open dashboard
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
        <span className="text-sm text-ink-tertiary">
          You can come back anytime. Your API key is the way in.
        </span>
      </div>
    </div>
  );
}

function ApiKeyReveal({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    const ok = await copyText(apiKey);
    setCopied(ok);
    // The key is shown only once, so say so when the browser refuses the copy.
    setCopyFailed(!ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-card border border-clay/40 bg-[color:rgba(136,69,79,0.06)] p-5">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-clay" strokeWidth={1.75} aria-hidden />
        <span className="text-sm font-semibold text-clay">
          Copy and store this. It won&rsquo;t be shown again
        </span>
      </div>
      <p className="mb-4 text-sm leading-[1.6] text-ink-secondary">
        The middleware sends this key to the facilitator as a Bearer token. Lose it and you&rsquo;ll
        have to rotate it from the dashboard.
      </p>
      <div className="mono break-all rounded-lg border border-border-subtle bg-bg-base px-4 py-3 text-[13px] text-ink-primary">
        {apiKey}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-[12px] text-ink-tertiary">
        {copyFailed ? (
          <span role="status" className="text-clay">
            Copy failed. Select the key above and copy it by hand.
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
            copied
              ? 'border-sage/40 text-sage'
              : 'border-border-subtle text-ink-secondary hover:border-border-strong hover:text-ink-primary',
          )}
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Copy className="h-3 w-3" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy key'}
        </button>
      </div>
    </div>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="mono text-[11px] text-ink-tertiary">{index}</span>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ code, language }: { code: string; language: 'bash' | 'ts' }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="group relative">
      <pre
        className="mono overflow-x-auto rounded-card border border-border-subtle bg-[#0B1015] px-4 py-3.5 text-[12.5px] leading-[1.65] text-ink-secondary"
        aria-label={`Code block (${language})`}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          'absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-all',
          'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          copied
            ? 'border-sage/40 text-sage'
            : 'border-border-subtle bg-bg-surface text-ink-secondary hover:text-ink-primary',
        )}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        {copied ? (
          <Check className="h-3 w-3" aria-hidden />
        ) : (
          <Copy className="h-3 w-3" aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function ProbeSection({ publisherId, domain }: { publisherId: string; domain: string }) {
  const [probing, setProbing] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runProbe() {
    setProbing(true);
    setError(null);
    setResult(null);
    try {
      const r = await probePublisher(publisherId);
      setResult(r);
    } catch (err) {
      if (err instanceof PublishersApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbing(false);
    }
  }

  return (
    <section className="space-y-3 rounded-card border border-border-subtle bg-bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="mono text-[11px] text-ink-tertiary">4</span>
        <h3 className="text-[15px] font-semibold tracking-tight">Test the middleware</h3>
      </div>
      <p className="text-sm leading-[1.55] text-ink-secondary">
        We&rsquo;ll hit <code className="mono text-accent">https://{domain}/__octroi-probe-…</code>{' '}
        and check for a 402 with the <code className="mono text-accent">X-PAYMENT</code> offer.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void runProbe()} disabled={probing} variant="secondary">
          {probing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {probing ? 'Probing…' : 'Run probe'}
        </Button>
        {result && (
          <Chip dot={result.ok ? 'success' : 'warning'}>
            {result.ok ? 'Integration looks good' : `Status ${result.status}`}
          </Chip>
        )}
      </div>
      {result && (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            result.ok
              ? 'border-sage/30 bg-[color:rgba(126,166,109,0.06)] text-sage'
              : 'border-amber-500/30 bg-[color:rgba(232,169,107,0.06)] text-ink-secondary',
          )}
        >
          {result.detail}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-clay/40 bg-[color:rgba(136,69,79,0.06)] px-3 py-2 text-sm text-clay"
        >
          <AlertTriangle className="mt-[2px] h-4 w-4" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}
