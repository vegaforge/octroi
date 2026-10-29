# Soroban contracts

Octroi's on-chain footprint is intentionally minimal. It holds no custody of
funds: USDC always moves directly from crawler to publisher through the USDC
Stellar Asset Contract.

Planned contracts (see [`docs/PRD.md` §12](../docs/PRD.md)):

- **`octroi_registry`**: identity, reputation, and the Web Bot Auth key
  directory (identity to Ed25519 public key), plus the facilitator public-key
  registry and publisher domain-to-identity linkage. Read-only stubs in v0,
  full writes in v2.
- **`octroi_pools`** (v2): a publisher-pool contract that distributes bundled
  access fees pro-rata to member publishers based on actual crawl volume.

Written in the Soroban `no_std` Rust dialect with `soroban-sdk`, compiled to
Wasm. State-archival (ledger entry TTL) handling is a first-class concern.

These contracts are not yet implemented; they are tracked in the v2 milestone.
