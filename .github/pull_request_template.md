<!--
  Every PR resolves a tracked issue. Link it below.
  Keep the change focused: one issue, one logical change.
  Read AGENTS.md and CONTRIBUTING.md before opening a PR.
-->

## Summary

<!-- What does this change do, and why? Which package or app does it touch? -->

Closes #

## Changes

<!-- Bullet the notable changes. -->

-

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Security fix
- [ ] Refactor / chore
- [ ] Docs

## Scenario impact and release note

- [ ] **scenario-impact**: `updated` | `needs_automation` | `none`
- [ ] Release note added in `docs/release-notes/<YYYY-MM-DD>-<feature>.md` (required when code under `apps/` or `packages/` changes; CI enforces it)

## Governance and pre-review checklist

- [ ] **Worktree isolation**: the work was done on its own branch, cut from `main`.
- [ ] **Human approval**: the ADR pair under `docs/adr/` was approved by a maintainer (non-trivial changes only).
- [ ] **Boundary validation**: every 402 offer, `X-PAYMENT` payload, receipt and facilitator request or response is validated and mapped to a type from `@octroi/types` before use.
- [ ] **Amounts**: USDC amounts stay in integer base units (`bigint` in TypeScript, `int64` or `big.Int` in Go) and are only formatted at the display edge.
- [ ] **Exact amount and asset**: a payment is accepted only for the exact offered amount, the offered asset (SAC) and the offered `payTo`.
- [ ] **Replay**: nonces are scoped to the payer and reserved before any side effect that cannot be undone.
- [ ] **Signatures**: receipts and request signatures are verified against a pinned or configured key, never only the key the message carries.
- [ ] **Outbound requests**: any server-side fetch of a user-supplied URL blocks private and loopback addresses.
- [ ] **Wiring tests**: tests exercise the real Express/Fastify handlers or Gin routes, not only helpers.
- [ ] **Test-first fix**: a bug fix was preceded by a failing regression test that is kept.
- [ ] **Layering**: imports point downward only; apps do not import each other; the Go gateway talks to the TypeScript side over HTTP only.
- [ ] **Preflight**: `./scripts/preflight.sh` passed in full with zero errors.

## How this was verified

<!-- The commands you ran and what they printed. For payment paths, say which
     flow you completed and on which network (testnet only). -->

## Notes

<!-- Anything reviewers should know: trade-offs, follow-ups, screenshots. -->
