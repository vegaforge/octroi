import type { FastifyInstance } from 'fastify';
import type { StellarAddress } from '@crawlpay/types';
import type { ReputationService } from '../services/reputation-service';

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

// public read-only reputation lookup, no auth. v0 score is provisional, derived
// off-chain from settlement history (PRD 11.4).
export function reputationRoutes(app: FastifyInstance, reputation: ReputationService): void {
  app.get<{ Params: { address: string } }>('/reputation/:address', async (req, reply) => {
    if (!G_ADDRESS_RE.test(req.params.address)) {
      return reply.code(400).send({ error: 'address must be a Stellar G-address' });
    }
    const summary = await reputation.getReputation(req.params.address as StellarAddress);
    return reply.send({ reputation: summary });
  });
}
