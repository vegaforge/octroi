-- Octroi initial schema (v0, Stellar).
--
-- Tables: publishers, pricing_rules, crawlers, access_rules, receipts,
-- sessions, analytics_daily. Webhooks are deferred to v1.
--
-- All USDC amounts are stored as BIGINT atomic units in Stellar's 7-decimal
-- representation, so 10_000_000 = $1.00 and 1_000 = $0.0001. Stellar addresses,
-- assets, and signatures are stored as TEXT.

CREATE TABLE publishers (
  id                    TEXT PRIMARY KEY,
  domain                TEXT NOT NULL UNIQUE,
  wallet_address        TEXT NOT NULL,            -- Stellar payout G-address
  octroi_agent_id     TEXT,                     -- octroi_registry agent id
  api_key_hash          TEXT,                     -- sha256 of the publisher's API key
  default_price_atomic  BIGINT NOT NULL DEFAULT 1000,
  network               TEXT NOT NULL,
  min_reputation_score  INTEGER DEFAULT 0,
  robots_txt_aware      BOOLEAN NOT NULL DEFAULT TRUE,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pricing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id  TEXT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  url_pattern   TEXT NOT NULL,
  price_atomic  BIGINT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'static',   -- 'static' | 'dynamic'
  policy        TEXT NOT NULL DEFAULT 'charge',    -- 'allow' | 'charge' | 'block'
  crawler_scope TEXT,                              -- restrict to one crawler G-address
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pricing_rules_publisher_idx ON pricing_rules(publisher_id, position);

CREATE TABLE crawlers (
  wallet_address    TEXT PRIMARY KEY,             -- Stellar G-address (also the Ed25519 pubkey)
  octroi_agent_id TEXT,
  user_agent        TEXT,
  max_per_request   BIGINT NOT NULL DEFAULT 10000,
  daily_budget      BIGINT,
  reputation        INTEGER NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE access_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id    TEXT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  crawler_wallet  TEXT,
  rule_type       TEXT NOT NULL CHECK (rule_type IN ('allow', 'block', 'discount')),
  discount_bps    INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX access_rules_publisher_idx ON access_rules(publisher_id);

-- Every paid crawl produces one receipt row. `nonce` is the primary key —
-- single-use per authorization and UNIQUE in our store, which is the second of
-- three replay barriers (Redis is first, Soroban's own nonce enforcement third).
-- The row holds every field of the canonical signed receipt so the signature is
-- independently verifiable from storage alone.
CREATE TABLE receipts (
  nonce               TEXT PRIMARY KEY,
  publisher_id        TEXT NOT NULL,
  from_wallet         TEXT NOT NULL,              -- crawler G-address
  to_wallet           TEXT NOT NULL,              -- publisher payout G-address
  resource            TEXT NOT NULL,
  amount_atomic       BIGINT NOT NULL,
  asset               TEXT NOT NULL,
  network             TEXT NOT NULL,
  settlement          TEXT NOT NULL CHECK (settlement IN ('x402', 'mpp')),
  onchain_tx_hash     TEXT,                       -- set for x402; backfilled for mpp
  mpp_session_id      TEXT,
  mpp_sequence        INTEGER,
  facilitator_pubkey  TEXT NOT NULL,
  signature           TEXT NOT NULL,
  issued_at           TIMESTAMPTZ NOT NULL,       -- receipt `timestamp`
  inserted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX receipts_publisher_ts_idx ON receipts(publisher_id, issued_at DESC);
CREATE INDEX receipts_from_ts_idx      ON receipts(from_wallet, issued_at DESC);
CREATE INDEX receipts_ts_idx           ON receipts(issued_at DESC);

-- MPP sessions: a crawler pre-authorizes a budget against a publisher (or pool)
-- and streams per-URL debits that settle in bulk when the session closes.
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,
  crawler_wallet  TEXT NOT NULL,
  publisher_id    TEXT,
  pool_id         TEXT,
  budget_atomic   BIGINT NOT NULL,
  spent_atomic    BIGINT NOT NULL DEFAULT 0,
  network         TEXT NOT NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  settled_at      TIMESTAMPTZ,
  settlement_tx   TEXT
);
CREATE INDEX sessions_crawler_idx ON sessions(crawler_wallet);

CREATE TABLE analytics_daily (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           TEXT NOT NULL CHECK (entity_type IN ('publisher', 'crawler')),
  entity_id             TEXT NOT NULL,
  date                  DATE NOT NULL,
  total_revenue_atomic  BIGINT,
  total_spend_atomic    BIGINT,
  request_count         INTEGER,
  unique_counterparties INTEGER,
  UNIQUE (entity_type, entity_id, date)
);
