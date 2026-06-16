import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiKeyAuth } from '../services/api-key-auth';

declare module 'fastify' {
  interface FastifyRequest {
    /** Id of the publisher whose API key authenticated this request. */
    authPublisherId?: string;
  }
}

/** preHandler that gates a route on a valid publisher API key (Authorization: Bearer). */
export function requireApiKey(auth: ApiKeyAuth) {
  return async function preHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const publisher = await auth.authenticate(req.headers.authorization);
    if (!publisher) {
      await reply.code(401).send({ error: 'invalid_api_key' });
      return;
    }
    req.authPublisherId = publisher.id;
  };
}
