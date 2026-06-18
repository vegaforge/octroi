import type { FastifyInstance } from 'fastify';
import type { OctroiReceipt, StellarAddress } from '@octroi/types';
import type { FacilitatorService } from '../services/facilitator-service';

interface VerifyReceiptBody {
  receipt?: unknown;
  expectedSigner?: unknown;
}

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

function isStellarAddress(v: unknown): v is StellarAddress {
  return typeof v === 'string' && G_ADDRESS_RE.test(v);
}

export function verifyReceiptRoutes(app: FastifyInstance, service: FacilitatorService): void {
  app.post('/verify-receipt', async (req, reply) => {
    const body = (req.body ?? {}) as VerifyReceiptBody;
    if (!body.receipt || typeof body.receipt !== 'object') {
      return reply.code(400).send({ error: 'receipt required (object)' });
    }
    const expectedSigner = isStellarAddress(body.expectedSigner) ? body.expectedSigner : undefined;
    const result = await service.verifyReceiptSignature(
      body.receipt as OctroiReceipt,
      expectedSigner,
    );
    return reply.code(200).send(result);
  });
}
