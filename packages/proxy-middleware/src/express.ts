import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { type PaymentPayload, type PaymentRequiredResponse, X402_HEADERS } from '@octroi/types';
import { DefaultBotClassifier } from './classifier';
import { HttpFacilitatorClient, type FacilitatorClient } from './facilitator';
import { GlobPricingResolver, type PricingResolver } from './pricing';
import { encodeReceiptHeader } from './receipts';
import type { OctroiMiddlewareConfig, ErrorEvent } from './types';

/** Offer validity window (seconds). Kept short: the crawler's Soroban auth entry must settle within it. */
const OFFER_VALIDITY_WINDOW_SECONDS = 60;

const PAYMENT_HEADER = X402_HEADERS.payment.toLowerCase();

/**
 * Publisher middleware: classify, price, facilitator verify, receipt header, next().
 * Each step is pluggable via config. The facilitator owns settlement and signing;
 * the middleware just relays payment and returns the signed receipt.
 */
export function octroi(config: OctroiMiddlewareConfig): RequestHandler {
  const classifier = config.botClassifier ?? new DefaultBotClassifier();
  const pricingResolver: PricingResolver =
    config.pricingResolver ??
    new GlobPricingResolver(config.pricingRules ?? [], config.defaultPrice);
  const facilitator: FacilitatorClient =
    config.facilitator ?? new HttpFacilitatorClient(config.facilitatorUrl);

  const handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fullUrl = `${req.protocol}://${req.get('host') ?? 'localhost'}${req.originalUrl}`;
    const startedAt = Date.now();

    let classification;
    try {
      classification = classifier.classify({
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        ip: req.ip,
      });
    } catch (err) {
      await emitError(config, fullUrl, err, 'classify');
      return next(err);
    }

    if (!classification.isCrawler) {
      await config.onSkip?.({ url: fullUrl, reason: 'human', classification });
      return next();
    }

    const pricing = pricingResolver.resolve(req.originalUrl, req.method);
    if (!pricing || pricing.priceAtomic === 0n) {
      await config.onSkip?.({ url: fullUrl, reason: 'free-path', classification });
      return next();
    }

    const paymentHeaderRaw = req.headers[PAYMENT_HEADER];
    const paymentHeader = Array.isArray(paymentHeaderRaw) ? paymentHeaderRaw[0] : paymentHeaderRaw;

    // no payment yet, emit a 402 offer
    if (!paymentHeader) {
      res.status(402).json(buildOffer(config, fullUrl, pricing.priceAtomic.toString()));
      return;
    }

    let payload: PaymentPayload;
    try {
      payload = decodePaymentPayload(paymentHeader);
    } catch {
      res.status(402).json({ x402Version: 1, error: 'invalid_payload' });
      return;
    }

    let result;
    try {
      result = await facilitator.verify({
        publisherId: config.publisherId,
        payTo: config.publisherWallet,
        resource: fullUrl,
        network: config.network,
        asset: config.asset,
        maxAmountRequired: pricing.priceAtomic.toString(),
        payment: payload,
      });
    } catch (err) {
      await emitError(config, fullUrl, err, 'verify');
      return next(err);
    }

    if (!result.ok) {
      res.status(402).json({ x402Version: 1, error: result.error.code });
      return;
    }

    // return the signed receipt to the crawler and downstream handlers
    const { receipt } = result;
    res.setHeader(X402_HEADERS.response, encodeReceiptHeader(receipt));
    res.locals.octroiReceipt = receipt;

    await config.onPayment?.({
      url: fullUrl,
      from: receipt.from,
      amount: pricing.priceAtomic,
      receipt,
      settlementRef: receipt.onchainTxHash ?? receipt.mppSessionRef?.sessionId ?? '',
      durationMs: Date.now() - startedAt,
    });

    return next();
  };

  // Express 4 ignores the promise a handler returns, so a rejection inside `handle` (a
  // throwing onSkip or onPayment hook, for example) would go unhandled and leave the request
  // hanging. Route it to Express's error handling instead.
  const middleware: RequestHandler = (req, res, next) => {
    handle(req, res, next).catch(next);
  };

  return middleware;
}

function buildOffer(
  config: OctroiMiddlewareConfig,
  resource: string,
  maxAmountRequired: string,
): PaymentRequiredResponse {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: config.network,
        maxAmountRequired,
        resource,
        description: config.description,
        payTo: config.publisherWallet,
        asset: config.asset,
        maxTimeoutSeconds: OFFER_VALIDITY_WINDOW_SECONDS,
        extra: {
          settlement: 'x402',
          feeSponsored: true,
          octroi_publisher_id: config.publisherId,
          octroi_facilitator: config.facilitatorUrl,
          ...(config.octroiAgentId ? { octroi_agent_id: config.octroiAgentId } : {}),
        },
      },
    ],
  };
}

function decodePaymentPayload(headerValue: string): PaymentPayload {
  const json = Buffer.from(headerValue, 'base64').toString('utf-8');
  return JSON.parse(json) as PaymentPayload;
}

async function emitError(
  config: OctroiMiddlewareConfig,
  url: string,
  err: unknown,
  phase: ErrorEvent['phase'],
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  try {
    await config.onError?.({ url, error, phase });
  } catch {
    // don't compound errors thrown by the user's handler
  }
}
