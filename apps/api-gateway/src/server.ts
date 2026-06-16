import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Network } from '@crawlpay/types';
import type { PublisherRepository, ReceiptRepository } from '@crawlpay/persistence';
import { healthRoutes, type HealthInfo } from './routes/health';
import { receiptsRoutes } from './routes/receipts';
import { publishersRoutes } from './routes/publishers';
import { crawlersRoutes } from './routes/crawlers';
import { analyticsRoutes } from './routes/analytics';
import { reputationRoutes } from './routes/reputation';
import type { AnalyticsService } from './services/analytics-service';
import type { ApiKeyAuth } from './services/api-key-auth';
import type { ProbeService } from './services/probe-service';
import type { ReputationService } from './services/reputation-service';

export interface ServerDeps {
  receipts: ReceiptRepository;
  publishers: PublisherRepository;
  analytics: AnalyticsService;
  auth: ApiKeyAuth;
  probe: ProbeService;
  reputation: ReputationService;
  network: Network;
  health: HealthInfo;
  logger?: FastifyServerOptions['logger'];
}

/** Builds the Fastify app without starting it, so tests can inject() the same config. */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });

  healthRoutes(app, deps.health);
  receiptsRoutes(app, deps.receipts);
  publishersRoutes(app, {
    publishers: deps.publishers,
    receipts: deps.receipts,
    auth: deps.auth,
    probe: deps.probe,
    network: deps.network,
  });
  crawlersRoutes(app, deps.receipts);
  analyticsRoutes(app, deps.analytics);
  reputationRoutes(app, deps.reputation);

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    reply.code(500).send({ error: 'internal_error', message: err.message });
  });

  return app;
}
