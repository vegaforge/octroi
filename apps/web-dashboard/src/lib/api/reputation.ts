/**
 * Client for the api-gateway's /reputation/* endpoints.
 * Gateway reads the crawlpay_registry Soroban contract, caches, returns a chip-sized summary.
 */

const BASE = '/api';

export interface ReputationSummary {
  /** Stellar G-address this reputation belongs to. */
  address: string;
  /** True while the agent has fewer settled interactions than the scoring floor. */
  provisional: boolean;
  /** Count of settled receipts backing the score. */
  settledCount: number;
  /** Reputation score (0 to 100), null when not yet computable. */
  score: number | null;
}

export async function getReputation(address: string): Promise<ReputationSummary> {
  const res = await fetch(`${BASE}/reputation/${address}`);
  if (!res.ok) throw new Error(`/reputation/${address} ${res.status}`);
  const data = (await res.json()) as { reputation: ReputationSummary };
  return data.reputation;
}
