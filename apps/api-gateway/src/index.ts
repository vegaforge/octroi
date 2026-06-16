import './bigint-json'; // patches BigInt.prototype.toJSON
import { Pool } from 'pg';
import {
  MemoryPublisherRepository,
  MemoryReceiptRepository,
  PostgresPublisherRepository,
  PostgresReceiptRepository,
  type PublisherRepository,
  type ReceiptRepository,
} from '@crawlpay/persistence';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { buildServer } from './server';
import { RepositoryAnalyticsService } from './services/analytics-service';
import { PublisherApiKeyAuth } from './services/api-key-auth';
import { IntegrationProbeService } from './services/probe-service';
import { ProvisionalReputationService } from './services/reputation-service';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  let receipts: ReceiptRepository;
  let publishers: PublisherRepository;
  let storage: 'memory' | 'postgres';

  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    receipts = new PostgresReceiptRepository(pool);
    publishers = new PostgresPublisherRepository(pool);
    storage = 'postgres';
  } else {
    receipts = new MemoryReceiptRepository();
    publishers = new MemoryPublisherRepository();
    storage = 'memory';
    logger.warn('DATABASE_URL not set, using in-memory repositories. Demo only.');
  }

  const auth = new PublisherApiKeyAuth(publishers);
  const analytics = new RepositoryAnalyticsService(receipts);
  const probe = new IntegrationProbeService();
  const reputation = new ProvisionalReputationService(receipts);

  const server = buildServer({
    receipts,
    publishers,
    analytics,
    auth,
    probe,
    reputation,
    network: config.network,
    health: { network: config.network, storage },
    logger,
  });

  await server.listen({ port: config.port, host: '0.0.0.0' });
  logger.info(
    {
      port: config.port,
      network: config.network,
      storage,
      facilitatorUrl: config.facilitatorUrl,
    },
    'crawlpay-api-gateway listening',
  );
}

main().catch((err) => {
  console.error('Failed to start crawlpay-api-gateway:', err);
  process.exit(1);
});
