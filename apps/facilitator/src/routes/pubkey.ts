import type { FastifyInstance } from 'fastify';
import type { FacilitatorService } from '../services/facilitator-service';

/** Exposes the receipt-signing public key so anyone can verify receipts independently. */
export function pubkeyRoutes(app: FastifyInstance, service: FacilitatorService): void {
  app.get('/pubkey', () => ({
    publicKey: service.signerPublicKey,
    version: '1',
  }));
}
