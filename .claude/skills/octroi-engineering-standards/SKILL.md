---
name: octroi-engineering-standards
description: Engineering standards for Octroi, the pay-per-crawl stack on Stellar. Read before writing or reviewing any code, comment, test or document in this repository.
---

# Octroi Engineering Standards

These rules apply to every contributor, human or agent. They sit under
[`AGENTS.md`](../../../AGENTS.md), which holds the directives and the lifecycle.
[`CONTRIBUTING.md`](../../../CONTRIBUTING.md) and [`docs/PRD.md`](../../../docs/PRD.md)
are the background reading.

## Architecture

Octroi is a pnpm and Turbo monorepo with one Go service. The layers, bottom to top:

```
apps/        facilitator (Fastify)   web-dashboard (Next.js)   api-gateway (Go/Gin)
                 |        \                 |                        :
packages/    persistence   \           (HTTP to gateway)             : HTTP + shared
                 |      proxy-middleware   crawler-sdk               : Postgres schema
                 |              \           /                        :
             receipt-signer  <---+---------+
                 |
             types (@octroi/types: offers, payloads, receipts, AtomicUsdc, headers)
```

- `packages/types` is the bottom layer. It has no internal dependencies and defines the
  wire contract: the 402 offer, the `X-PAYMENT` payload, receipts, `AtomicUsdc`,
  network passphrases, header names and `OctroiErrorCode`.
- `packages/receipt-signer` depends only on `types`. It owns canonical JSON and Ed25519
  receipt signing and verification.
- `packages/proxy-middleware` (publisher side, Express today) and
  `packages/crawler-sdk` (crawler side) depend on `types` and `receipt-signer`. The
  middleware reaches the facilitator over HTTP (`POST /verify`), never by import.
- `packages/persistence` depends only on `types`. It owns the Postgres and Redis
  repositories and the SQL migrations.
- `apps/facilitator` depends on `types`, `receipt-signer` and `persistence`. It is the
  only component that submits Soroban transactions.
- `apps/web-dashboard` depends on `types` and calls the gateway over HTTP from
  `src/lib/api/`. Components never call `fetch` or hold a base URL directly.
- `apps/api-gateway` is a separate Go module. It never imports TypeScript code. It talks
  to the rest of the system over HTTP and reads the Postgres schema defined in
  `packages/persistence/migrations`. A change to that schema is a contract change for
  both languages.

Rules:

1. Imports point downward only. A package never imports an app, and a lower package
   never imports a higher one.
2. Apps never import each other.
3. Sibling packages on the same layer (`proxy-middleware`, `crawler-sdk`) never import
   each other. Shared code moves down into `types` or `receipt-signer`.
4. Inside the Go gateway, `internal/store` and `internal/config` are the bottom.
   Domain packages (`analytics`, `auth`, `reputation`, `receipt`, `probe`) may import
   `store` but not each other. `internal/server` composes them into Gin routes, and only
   `main.go` imports `server`. Handlers use the store interfaces, never pgx directly.
5. Network-specific code (Stellar SDK, Soroban RPC) stays in bounded modules behind thin
   adapters, as `docs/PRD.md` section 7 describes.

Nothing enforces these rules mechanically yet. Reviewers enforce them; an ESLint
boundaries rule can follow issue #38.

## Correctness

### All code

- Verify each step before moving to the next. Do not stack unverified work.
- Find the cause and fix it. Never patch the symptom.
- Handle an error where it happens and return it to the caller in a useful shape (an
  `OctroiErrorCode` and an HTTP status), never a bare 500 with internals in the body.
- Tests prove behaviour: the happy path, each validation failure, and the error path.

### TypeScript

- `strict` and `noUncheckedIndexedAccess` stay on (`tsconfig.base.json`).
- No `any`. Use `unknown` and narrow it.
- No `@ts-ignore` or `@ts-nocheck`. `@ts-expect-error` only with a linked issue.
- No floating promises: every promise is awaited, returned, or explicitly handled.
  Express and Fastify handlers must not let a rejection escape unhandled.
- No empty `catch`. A catch either handles the error or rethrows it with context.
- Money is `AtomicUsdc` (`bigint`). Never `number`, never `parseFloat`.

### Go

- Every returned `error` is checked. `_ = f()` needs a comment that says why the error
  cannot matter.
- No `panic` on a request path. `log.Fatal` is allowed only in `main` during startup.
- Wrap errors with context (`fmt.Errorf("load publisher %s: %w", id, err)`); compare with
  `errors.Is` and `errors.As`.
- Do not return `err.Error()` to HTTP clients. Log it and return a stable error code.
- Pass `context.Context` from the request into every store and outbound call.
- HTTP servers and clients set explicit timeouts.

## Payment-path defect checklist

Octroi settles USDC on Stellar. Check each item on any change to the middleware, the
SDK, the facilitator or the gateway.

1. **Boundary validation.** Validate every 402 offer, `X-PAYMENT` header, facilitator
   request and response, and receipt at the point it enters the process. Reject unknown
   schemes, networks and versions explicitly.
2. **Integer base units.** USDC has 7 decimals (`USDC_DECIMALS`). Amounts are integers in
   base units end to end: `bigint` in TypeScript, a decimal integer string on the wire,
   `int64` or `*big.Int` in Go.
3. **Exact amount.** For `scheme: "exact"`, the authorized amount equals the offered
   price. Less is underpayment, more is overcharging; both are rejected.
4. **Asset binding.** The asset in the payment is the configured USDC SAC: the
   contract id derived from the offered asset and network passphrase (as
   `deriveSacContractId` in `crawler-sdk` does) equals the facilitator's
   `OCTROI_USDC_SAC`. The SDK never signs for an asset the crawler did not configure.
5. **Recipient and resource binding.** The `to` address is the publisher's `payTo`, and
   the receipt's `resource` is the URL that was priced. The middleware checks the
   receipt before calling `next()`.
6. **Replay and nonce scope.** A nonce is unique per payer, so the key is
   `(from, nonce)`. Reserve it before money moves or a receipt is signed, and release
   or record it on every failure path.
7. **Signatures with pinned keys.** Verify receipts against the facilitator key the
   caller configured or fetched once and pinned (`expectedSigner`), never only against
   the key inside the receipt. For Web Bot Auth, verify the signature before recording
   any nonce.
8. **SSRF on outbound probes.** Any fetch of a publisher-supplied domain (the gateway
   probe, discovery) resolves the host first and refuses loopback, private, link-local
   and cloud metadata ranges. Set a timeout and a response size limit.
9. **Secrets.** Signing seeds and fee-sponsor keys come from the environment, are never
   logged, and never reach the dashboard bundle (`NEXT_PUBLIC_*` is public).
10. **Wiring tests.** Tests hit the real handler (supertest, Fastify `inject`,
    `httptest` for Gin) with a mocked network edge, not only the helper functions.
11. **Preflight.** `./scripts/preflight.sh` passed in full.

## Comments and naming

- Write every comment by hand, in plain English. Short, clear, specific.
- Default to no comment. A comment explains why, or a non-obvious what.
- No AI tone and no filler. Do not use em-dashes; use a comma, colon or period.
- Name things for what they are: `priceAtomic`, not `amount2`.

## Documentation

- Technically correct and unambiguous. Define jargon (SAC, x402, stroop) on first use.
- Every command in a doc is one you ran.
- ADRs follow `docs/adr/TEMPLATE.md`; release notes follow
  `docs/release-notes/TEMPLATE.md`.

## Git and review

- One issue, one branch, one pull request. Branch prefixes: `feat/`, `fix/`, `chore/`,
  `docs/`.
- Conventional Commits, enforced by commitlint: `type(scope): summary`.
- Never push to `main`. Squash merges only. Branches are deleted on merge.
- Never add AI co-author trailers or generated-by footers to commits or pull requests.
- Never commit or push on a contributor's behalf without being asked.
- Never commit secrets. `.env` stays out of git; `.env.example` is the template.

## Tooling

- pnpm only, at the version in `packageManager`. Node from `.nvmrc`. Go from
  `apps/api-gateway/go.mod`.
- Hooks are lefthook (`lefthook.yml`); `pnpm install` installs them.
- Turbo caches task output. Use `pnpm turbo run <task> --force` when you need a real run.
- Run `./scripts/preflight.sh` before opening a pull request. CI runs the same gates.
- When a task needs a library, read its current docs first. Do not code from memory.
