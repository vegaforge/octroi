# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches 1.0.

## [Unreleased]

### Changed

- Migrated the project from the Arc testnet (EVM) to **Stellar**. The shared
  protocol types, the receipt signer/verifier, the publisher middleware, the
  crawler SDK, the facilitator, and the API gateway were converted to Stellar:
  - Settlement model is x402 over Soroban authorization entries plus MPP
    sessions, replacing EIP-3009 / Circle Gateway batching.
  - Receipts are signed with Ed25519 over a canonical JSON form, replacing
    keccak256 + ECDSA.
  - USDC uses Stellar's 7-decimal atomic representation; addresses are Stellar
    G-addresses; assets are `CODE:ISSUER` identifiers.
  - API-gateway authentication is an API-key bearer token, replacing SIWE.
  - Reputation is provisional and computed off-chain from settlement history.

### Removed

- All Arc/EVM artifacts: EIP-3009 types, the Circle Gateway facilitator,
  viem/Privy/SIWE, ERC-8004 reputation reads, and the Gateway smoke tests.

### Added

- The crawler SDK signs Soroban authorization entries for a USDC SAC `transfer`
  ([#1](https://github.com/vegaforge/octroi/issues/1), PR #26) and reads the
  crawler's USDC balance from the SAC ([#3](https://github.com/vegaforge/octroi/issues/3), PR #28).
- The facilitator verifies the signed authorization entry and settles the USDC
  transfer on-chain through Soroban RPC, with a fee sponsor paying the network
  fee ([#2](https://github.com/vegaforge/octroi/issues/2), PR #27).

### Changed

- The API gateway is now a Go/Gin service instead of TypeScript
  ([#18](https://github.com/vegaforge/octroi/issues/18), PR #29).
- The project is renamed to Octroi
  ([#30](https://github.com/vegaforge/octroi/issues/30), PR #31).

### Not yet implemented

- MPP sessions ([#7](https://github.com/vegaforge/octroi/issues/7)). The
  facilitator rejects an MPP payload with `facilitator_error` until then.
- Web Bot Auth request signing and verification
  ([#4](https://github.com/vegaforge/octroi/issues/4)).
