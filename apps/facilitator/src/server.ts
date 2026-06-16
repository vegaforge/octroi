import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { FacilitatorService } from './services/facilitator-service';
import { healthRoutes } from './routes/health';
import { pubkeyRoutes } from './routes/pubkey';
import { verifyRoutes } from './routes/verify';
import { verifyReceiptRoutes } from './routes/verify-receipt';

export interface ServerOptions {
  service: FacilitatorService;
  network: string;
  logger?: FastifyServerOptions['logger'];
}

/** Build the Fastify app without starting it, so tests can inject directly. */
export function buildServer(opts: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });

  healthRoutes(app, opts.service, opts.network);
  pubkeyRoutes(app, opts.service);
  verifyRoutes(app, opts.service);
  verifyReceiptRoutes(app, opts.service);

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    reply.code(500).send({ error: 'internal_error', message: err.message });
  });

  return app;
}
