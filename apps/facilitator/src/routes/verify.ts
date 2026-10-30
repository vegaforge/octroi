import type { FastifyInstance } from 'fastify';
import type { AssetId, Network, StellarAddress } from '@octroi/types';
import { NETWORKS } from '@octroi/types';
import type { FacilitatorService } from '../services/facilitator-service';
import { parsePaymentPayload } from './parse-payment';

interface VerifyBody {
  publisherId?: unknown;
  payTo?: unknown;
  resource?: unknown;
  network?: unknown;
  asset?: unknown;
  maxAmountRequired?: unknown;
  payment?: unknown;
}

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const ASSET_RE = /^[A-Za-z0-9]{1,12}:G[A-Z2-7]{55}$/;

export function verifyRoutes(app: FastifyInstance, service: FacilitatorService): void {
  app.post('/verify', async (req, reply) => {
    const body = (req.body ?? {}) as VerifyBody;

    if (typeof body.publisherId !== 'string' || body.publisherId.length === 0) {
      return reply.code(400).send({ error: 'publisherId required (non-empty string)' });
    }
    if (typeof body.payTo !== 'string' || !G_ADDRESS_RE.test(body.payTo)) {
      return reply.code(400).send({ error: 'payTo required (Stellar G-address)' });
    }
    if (typeof body.resource !== 'string' || body.resource.length === 0) {
      return reply.code(400).send({ error: 'resource required (non-empty string)' });
    }
    if (typeof body.network !== 'string' || !NETWORKS.includes(body.network as Network)) {
      return reply.code(400).send({ error: `network required (one of ${NETWORKS.join(', ')})` });
    }
    if (typeof body.asset !== 'string' || !ASSET_RE.test(body.asset)) {
      return reply.code(400).send({ error: 'asset required (CODE:ISSUER)' });
    }
    if (typeof body.maxAmountRequired !== 'string' || !/^\d+$/.test(body.maxAmountRequired)) {
      return reply.code(400).send({ error: 'maxAmountRequired required (atomic USDC string)' });
    }
    const payment = parsePaymentPayload(body.payment);
    if (!payment.ok) {
      return reply.code(400).send({ error: payment.error });
    }

    const result = await service.verify({
      publisherId: body.publisherId,
      payTo: body.payTo as StellarAddress,
      resource: body.resource,
      network: body.network as Network,
      asset: body.asset as AssetId,
      maxAmountRequired: body.maxAmountRequired,
      payment: payment.value,
    });

    if (!result.ok) {
      return reply.code(402).send(result);
    }
    return reply.code(200).send({ receipt: result.data.receipt });
  });
}
