'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import type { OctroiReceipt } from '@octroi/types';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { verifyReceipt, type VerifyReceiptResponse } from '@/lib/api/receipts';

const easeSmooth = [0.32, 0.72, 0, 1] as const;

export interface ReceiptModalReceipt {
  /** Header subtitle: the resource URL. */
  resource: string;
  /** Header subtitle: formatted amount, e.g. "$0.0001". */
  amount: string;
  /** Object dumped as JSON inside the modal. */
  canonical: Record<string, unknown>;
  /** Full receipt payload, used by the Verify button to call /receipts/verify. */
  fullReceipt?: OctroiReceipt;
}

type ReceiptModalProps = {
  receipt: ReceiptModalReceipt | null;
  onClose: () => void;
};

/**
 * Modal showing a receipt's canonical JSON plus a verify action. Closes on ESC, backdrop, or Close.
 * Verify POSTs to /receipts/verify; the gateway checks the Ed25519 signature against facilitatorPubkey.
 */
export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyReceiptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = receipt !== null;

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setVerifying(false);
    }
  }, [open, receipt]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function runVerify() {
    if (!receipt?.fullReceipt) {
      setError('No full receipt payload available to verify.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const r = await verifyReceipt(receipt.fullReceipt);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AnimatePresence>
      {open && receipt && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: easeSmooth }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            className="relative w-full max-w-[560px] rounded-modal border border-border-strong bg-bg-elevated p-7 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: easeSmooth }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-2 flex items-start justify-between gap-4">
              <div>
                <h3 id="receipt-modal-title" className="text-lg font-semibold">
                  Receipt
                </h3>
                <div className="mt-1 break-all text-[13px] text-ink-secondary">
                  {receipt.resource} · <span className="mono text-accent">{receipt.amount}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-ink-tertiary transition-colors hover:text-ink-primary"
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
            </header>

            <pre className="mono mt-4 max-h-[320px] overflow-auto rounded-lg border border-border-subtle bg-[#0B1015] p-4 text-[12px] leading-[1.7] text-ink-secondary">
              {JSON.stringify(receipt.canonical, null, 2)}
            </pre>

            {result?.signerPubkey && (
              <div className="mt-3 text-[12px] text-ink-tertiary">
                Signer: <span className="mono text-ink-secondary">{result.signerPubkey}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-md border border-clay/40 bg-[color:rgba(136,69,79,0.06)] px-3 py-2 text-sm text-clay"
              >
                <AlertTriangle className="mt-[2px] h-4 w-4" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              {result?.valid ? (
                <Chip variant="success" dot="success">
                  <Check className="h-3 w-3" aria-hidden />
                  Signature verified
                </Chip>
              ) : result && !result.valid ? (
                <Chip dot="warning">
                  Verification failed{result.reason ? `: ${result.reason}` : ''}
                </Chip>
              ) : (
                <Button
                  onClick={() => void runVerify()}
                  disabled={verifying || !receipt.fullReceipt}
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {verifying ? 'Verifying…' : 'Verify signature'}
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
