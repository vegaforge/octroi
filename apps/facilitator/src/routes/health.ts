import type { FastifyInstance } from 'fastify';
import type { FacilitatorService } from '../services/facilitator-service';

export function healthRoutes(
  app: FastifyInstance,
  service: FacilitatorService,
  network: string,
): void {
  app.get('/health', () => ({
    ok: true,
    service: 'octroi-facilitator',
    version: '0.0.1',
    network,
    facilitatorPublicKey: service.signerPublicKey,
  }));
}
