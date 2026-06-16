import type { FastifyInstance } from 'fastify';
import type { Network, StellarAddress } from '@crawlpay/types';
import { atomicUsdc } from '@crawlpay/types';
import {
  PublisherAlreadyExistsError,
  type CreatePublisherInput,
  type PublisherRecord,
  type PublisherRepository,
  type ReceiptRepository,
} from '@crawlpay/persistence';
import type { ApiKeyAuth } from '../services/api-key-auth';
import { generateApiKey } from '../services/api-key-auth';
import type { ProbeService } from '../services/probe-service';
import { requireApiKey } from '../middleware/require-auth';

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

interface ListQuery {
  active?: string;
  network?: string;
  limit?: string;
  offset?: string;
}

interface CreateBody {
  id?: unknown;
  domain?: unknown;
  /** Stellar payout G-address the publisher is paid at. */
  walletAddress?: unknown;
  network?: unknown;
  defaultPriceAtomic?: unknown;
  description?: unknown;
}

export interface PublishersRoutesDeps {
  publishers: PublisherRepository;
  receipts: ReceiptRepository;
  auth: ApiKeyAuth;
  probe: ProbeService;
  network: Network;
}

function isStellarAddress(v: unknown): v is StellarAddress {
  return typeof v === 'string' && G_ADDRESS_RE.test(v);
}

function asPositiveInt(s: string | undefined, fallback: number, max?: number): number | null {
  if (s === undefined) return fallback;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return null;
  if (max !== undefined && n > max) return null;
  return n;
}

// domain to stable publisher id: strip www, take leading label, camelCase hyphens.
// e.g. technotes.example.com -> pub_technotes, foo-bar.io -> pub_fooBar
function makePublisherId(domain: string): string {
  const main =
    domain
      .toLowerCase()
      .replace(/^www\./, '')
      .split('.')[0] ?? 'site';
  const parts = main.split(/[-_]/).filter(Boolean);
  const camel = parts
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
  const clean = camel.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'site';
  return `pub_${clean}`;
}

/** Strip secrets before returning a publisher over the API. */
function publicView(p: PublisherRecord): Omit<PublisherRecord, 'apiKeyHash'> {
  const { apiKeyHash: _apiKeyHash, ...rest } = p;
  return rest;
}

export function publishersRoutes(app: FastifyInstance, deps: PublishersRoutesDeps): void {
  const { publishers, receipts, auth, probe, network } = deps;

  app.get<{ Querystring: ListQuery }>('/publishers', async (req, reply) => {
    const filter: Parameters<PublisherRepository['list']>[0] = {};
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true' || req.query.active === '1';
    }
    if (req.query.network !== undefined) filter.network = req.query.network as Network;

    const limit = asPositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    if (limit === null)
      return reply.code(400).send({ error: `limit must be in [0, ${MAX_LIMIT}]` });
    const offset = asPositiveInt(req.query.offset, 0);
    if (offset === null) return reply.code(400).send({ error: 'invalid offset' });
    filter.limit = limit;
    filter.offset = offset;

    const [items, total] = await Promise.all([
      publishers.list(filter),
      publishers.count({ ...filter, limit: undefined, offset: undefined }),
    ]);
    return reply.send({
      publishers: items.map(publicView),
      pagination: { total, limit, offset },
    });
  });

  // register a publisher. returns the API key once (only its hash is stored), caller must keep it.
  app.post('/publishers', async (req, reply) => {
    const body = (req.body ?? {}) as CreateBody;

    if (typeof body.domain !== 'string' || !DOMAIN_RE.test(body.domain.trim())) {
      return reply.code(400).send({ error: 'invalid_domain', detail: 'expected e.g. example.com' });
    }
    if (!isStellarAddress(body.walletAddress)) {
      return reply
        .code(400)
        .send({ error: 'invalid_wallet_address', detail: 'expected a Stellar G-address' });
    }

    const domain = body.domain.trim().toLowerCase();
    const id =
      typeof body.id === 'string' && body.id.length > 0 ? body.id : makePublisherId(domain);
    const apiKey = generateApiKey();

    const input: CreatePublisherInput = {
      id,
      domain,
      walletAddress: body.walletAddress,
      network,
      apiKeyHash: apiKey.hash,
    };

    if (
      typeof body.defaultPriceAtomic === 'string' ||
      typeof body.defaultPriceAtomic === 'number'
    ) {
      try {
        input.defaultPriceAtomic = atomicUsdc(BigInt(body.defaultPriceAtomic));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: 'invalid_default_price', detail: (err as Error).message });
      }
    }
    if (typeof body.description === 'string') input.description = body.description;

    try {
      const created = await publishers.create(input);
      return reply.code(201).send({ publisher: publicView(created), apiKey: apiKey.key });
    } catch (err) {
      if (err instanceof PublisherAlreadyExistsError) {
        return reply
          .code(409)
          .send({ error: 'already_exists', field: err.field, value: err.value });
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>('/publishers/:id', async (req, reply) => {
    const publisher = await publishers.get(req.params.id);
    if (!publisher) return reply.code(404).send({ error: 'publisher not found' });
    return reply.send({ publisher: publicView(publisher) });
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/publishers/:id/receipts',
    async (req, reply) => {
      const limit = asPositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
      if (limit === null)
        return reply.code(400).send({ error: `limit must be in [0, ${MAX_LIMIT}]` });
      const offset = asPositiveInt(req.query.offset, 0);
      if (offset === null) return reply.code(400).send({ error: 'invalid offset' });

      const publisher = await publishers.get(req.params.id);
      if (!publisher) return reply.code(404).send({ error: 'publisher not found' });

      const [items, total] = await Promise.all([
        receipts.list({ publisherId: req.params.id, limit, offset }),
        receipts.count({ publisherId: req.params.id }),
      ]);
      return reply.send({
        publisher: { id: publisher.id, domain: publisher.domain },
        receipts: items,
        pagination: { total, limit, offset },
      });
    },
  );

  // integration probe. key must belong to the publisher being probed.
  app.post<{ Params: { id: string } }>(
    '/publishers/:id/probe',
    { preHandler: requireApiKey(auth) },
    async (req, reply) => {
      const publisher = await publishers.get(req.params.id);
      if (!publisher) return reply.code(404).send({ error: 'publisher not found' });
      if (publisher.id !== req.authPublisherId) {
        return reply.code(403).send({ error: 'not_owner' });
      }
      const result = await probe.probePublisher(publisher.domain);
      return reply.send(result);
    },
  );
}
