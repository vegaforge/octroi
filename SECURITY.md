# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately through GitHub's [private vulnerability reporting](https://github.com/vegaforge/crawlpay/security/advisories/new) (the "Report a vulnerability" button under the repository's **Security** tab). We aim to acknowledge a report within 72 hours and to provide a remediation timeline after triage.

When reporting, please include:

- the affected component (facilitator, gateway, SDK, middleware, contracts),
- a description of the issue and its impact,
- steps to reproduce or a proof of concept, and
- any suggested mitigation.

## Scope

The areas where a vulnerability has the highest impact:

- **Receipt forgery**: producing a receipt that verifies without a matching settlement.
- **Settlement integrity**: redirecting USDC, bypassing the amount ceiling, or double-charging.
- **Replay**: reusing an authorization nonce or an MPP session debit.
- **Facilitator key handling**: exposure or misuse of the receipt-signing or fee-sponsor keys.
- **Auth**: bypassing the publisher API key on a protected route.

By design, no single party can both move funds and forge evidence of authorization (see [`docs/PRD.md` §17](./docs/PRD.md)). Reports that demonstrate a break in that invariant are the highest priority.

## Supported versions

CrawlPay is pre-1.0 and under active development. Security fixes are applied to `main`.
