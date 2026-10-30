# Octroi (Stellar): Product Requirements Document

**Version:** 1.0
**Author:** Emmanuel Omemgboji
**Studio:** Second Gate
**Product:** Octroi on Stellar
**Created:** June 2026
**Status:** Living document

**Scope.** This is the complete, standalone product requirements document for Octroi on Stellar. It covers the product end to end: the problem, the market, the distribution model, the system architecture, the wire protocol, the settlement models, identity and reputation, the on-chain contracts, the data model, the API surface, security, the trust model, operations, metrics, monetization, legal posture, go to market, risks, and the execution roadmap. It is written to be exhaustive enough to build from without external references.

---

## Table of Contents

1. Executive Summary
2. Problem Statement
3. Market Context
4. Why Stellar
5. Product Vision and Strategy
6. Target Users
7. Distribution and Adoption Model
8. System Architecture
9. Protocol Specification
10. Settlement and Payment Models
11. Identity, Authentication, and Reputation
12. Soroban Contracts
13. Data Model
14. Feature Specifications by Version
15. API Reference
16. Security Model
17. Trust Model
18. Non-Functional Requirements
19. Infrastructure and Deployment
20. Success Metrics
21. Competitive Analysis
22. Monetization Model
23. Legal and Compliance
24. Go-to-Market Strategy
25. Risks and Mitigations
26. Execution Roadmap
27. Open Questions

---

## 1. Executive Summary

Octroi is open-source pay-per-crawl infrastructure for the web. It lets any publisher charge AI crawlers per URL they fetch. Crawlers pay in USDC, automatically, in fractions of a cent, with no need to hold gas tokens. Every payment produces a cryptographically signed receipt that serves as portable proof of legitimate access.

Octroi is built on three things that are already live on Stellar mainnet as of mid-2026: x402 (HTTP-native per-request payment over Soroban authorization entries), the Machine Payments Protocol (MPP) (session-based streaming micropayments that pre-authorize a budget and settle in bulk via Soroban Stellar Asset Contract transfers), and USDC as a native Stellar asset, not a bridged or wrapped representation. Identity and reputation are provided by a Soroban-native agent registry that Octroi ships, designed to converge with the emerging agent-identity standards on the network.

Octroi is the open alternative to Cloudflare's Pay Per Crawl, available to the entire long tail of the web as a protocol anyone can self-host. It has three structural advantages: native USDC with no bridge, agent payments where the crawler never holds a gas token, and a fiat off-ramp through Stellar's anchor network so a publisher in Lagos or Manila can convert earnings to local currency through existing cash-out rails.

The distribution thesis is the spine of this document. Cloudflare's advantage is that it already sits in front of roughly a fifth of the web, so for its customers pay per crawl is a config toggle with no install. Octroi has no network, so it meets publishers where their requests already enter, through one enforcement core wrapped in thin adapters, led by a one-click CMS plugin rather than an SDK. The harder half of the market is the crawler side, which Octroi wins through interop rather than leverage: a crawler that already speaks x402 or already added Web Bot Auth for Cloudflare can pay Octroi with almost no new code.

---

## 2. Problem Statement

AI companies send billions of HTTP requests per month to sites they do not own, to train models and power retrieval and search products, usually without compensating publishers. Publishers have two bad options: block crawlers, which forgoes AI distribution and means an endless cat-and-mouse on IP addresses and user agents, or allow free crawling, which means losing control, earning nothing, and keeping no record. The missing third path is to charge per request.

Per-request pricing has not existed because the payment rails could not support it. At a $0.0001 price point, card fees, bank rails, and most on-chain gas costs each exceed the payment itself. Batch payouts reduce cost but break the per-request accountability publishers want, because a monthly lump sum is not evidence that a specific URL was paid for.

What is new in 2026 is that two payment protocols built specifically for machine-to-machine commerce went live on Stellar: x402 in March and MPP in April. Combined with Stellar's roughly $0.00001 base fee and native USDC, the economics of charging a crawler a hundredth of a cent per URL, with a signed receipt, finally close.

The legal context reinforces the need. The NYT v. OpenAI litigation, Reddit and Stack Overflow monetizing access, and a steady stream of publisher disputes all stem from the absence of a standardized, frictionless way for AI companies to pay for what they consume. A Octroi receipt is evidence of paid access, a material fact in any licensing or copyright dispute, and that evidentiary value is part of the product, not a side effect.

---

## 3. Market Context

### 3.1 The incumbent: Cloudflare Pay Per Crawl

Cloudflare launched Pay Per Crawl in 2025 with Stack Overflow, and the design is worth studying closely because Octroi both borrows from it and diverges from it deliberately.

How it works. Cloudflare revives HTTP 402 Payment Required as a negotiation signal. A crawler requesting a paid URL gets a 402 with a `crawler-price` header; it retries with a `crawler-exact-price` header to agree, and receives the content with a 200 and a `crawler-charged` header. A crawler can also be proactive, sending a `crawler-max-price` up front so that any resource priced at or below that ceiling is served immediately with no 402 round trip. Publishers choose one of three outcomes per crawler: allow (free), charge (priced), or block. Charging a crawler that has no billing relationship works as a soft block that still signals a possible future relationship. Pricing is a flat per-site price at launch, with in-band dynamic pricing where the origin sets the price per response. Crawler identity is established with Web Bot Auth: the crawler signs each request with an Ed25519 key using HTTP Message Signatures, so payment headers cannot be spoofed. Cloudflare is the Merchant of Record, settles in fiat through Stripe, and aggregates billing across its network. Enforcement runs only after the publisher's existing WAF and bot management.

Where it is strong, and where Octroi differs. Cloudflare's unbeatable advantage is distribution: it already sits in front of roughly a fifth of the web, so pay per crawl is a toggle with no install, and it can compel crawlers to pay because the alternative is being blocked across that whole footprint. Its limits are the opening for Octroi. It is restricted to sites already on Cloudflare, settles in fiat on aggregated batches rather than crypto-native per request, is proprietary and not self-hostable, and is enterprise-gated. The roughly 80 percent of the web not behind Cloudflare has no option. Octroi takes the parts of the design that are simply good engineering (the 402 negotiation, the proactive fast path, the allow, charge, or block model, Web Bot Auth identity) and rebuilds them as an open, self-hostable, crypto-native protocol for the long tail, with crawler payment in native USDC and a fiat off-ramp Cloudflare does not offer.

### 3.2 The Stellar agent economy in 2026

Stellar has become a serious venue for agentic payments. x402, the Coinbase-originated protocol that turns the dormant HTTP 402 status code into a real payment negotiation, went live on Stellar in March 2026 and works through Soroban authorization, so clients pay for API requests via signed authorization entries. MPP, co-developed by Stripe and Tempo, went live in April and introduced sessions: an agent pre-authorizes a spending limit, streams micro-payments within the session, and settles in bulk via Soroban Stellar Asset Contract transfers, with the SDK handling server-sponsored fees so the agent never holds a gas token. MPP launched with over a hundred integrated services including Stripe, Anthropic, OpenAI, Shopify, and Visa, and its core spec was submitted to the IETF. A recent Stellar Agents hackathon drew roughly 600 builders and over 260 projects on these primitives.

That is the market Octroi enters: an active, well-funded agent-payments wave on a network whose fees and stablecoin support make sub-cent settlement trivial, and whose foundation is actively prioritizing this category.

### 3.3 Market size

Cloudflare handles traffic for roughly a fifth of the web; the rest is Octroi's addressable market. Content-licensing precedents put the parametric value of AI crawler traffic to publishers in the low single-digit billions per year, and the broader per-request API monetization category that Octroi can expand into is larger still. One data point on the scale of demand: Cloudflare has reported customers already sending more than a billion 402 responses a day, before broad adoption.

### 3.4 Timing

Cloudflare will broaden Pay Per Crawl beyond enterprise at some point in 2026 to 2027. Whoever ships open-standard pay-per-crawl infrastructure across the long tail before then owns the ecosystem. Building on Stellar's live x402 and MPP rails is the fastest path to a working, economically viable version.

---

## 4. Why Stellar

Octroi is built on Stellar deliberately. For a product whose entire thesis is sub-cent machine payments to a globally distributed long tail of publishers who will want to cash out locally, Stellar has real, not cosmetic, advantages, alongside a few honest tradeoffs.

### 4.1 Advantages specific to pay-per-crawl

**Native USDC, no bridge.** USDC has existed as a first-class Stellar asset for years. There is no wrapped or bridged representation and no bridge risk in the settlement path. Publishers and crawlers transact in the same USDC that anchors and exchanges already support.

**The crawler never holds a gas token.** Under MPP, the SDK handles server-sponsored fees, so a crawler operator funds a USDC budget and nothing else. On most chains the paying party still has to reason about the gas asset. Removing that is a material reduction in operator friction, which matters when the operator is an autonomous agent.

**Sessions are a native primitive.** MPP sessions are a standardized, live batching primitive that settles via SAC transfers. Octroi does not need to build a proprietary aggregation layer; it composes a public protocol.

**Fiat off-ramp through the anchor network.** This is the sleeper advantage. A long-tail publisher in an emerging market can convert USDC earnings to local currency through Stellar's anchor and cash-out network (the same rails MoneyGram uses across Latin America and beyond). For Octroi's earliest and loudest adopters, indie and global-south publishers, "I earned $40 from AI crawlers and cashed it out at a corner agent" is a far stronger story than "I have USDC on an L1 I now have to bridge off."

**The fees genuinely disappear.** A roughly $0.00001 base fee means even per-request settlement, without batching, is economically sane. Batching via MPP then drives the marginal cost toward zero.

**The ecosystem is paying attention here now.** x402 and MPP are live, SDF is prioritizing agentic payments, the Stellar Community Fund and GrantFox are actively funding this category, and a 600-builder hackathon just validated demand. Octroi rides a wave rather than creating one.

### 4.2 Honest tradeoffs of building on Stellar

**Smart contracts are Rust and Wasm, not Solidity.** Soroban contracts are written in a constrained `no_std` Rust dialect compiled to Wasm. The Octroi contract surface (registry, reputation, pools) must be built with soroban-sdk, and the developer pool fluent in this is smaller than the EVM pool. For an open-source project seeking contributors this is a real consideration, mitigated by Soroban's tooling and by the fact that most of Octroi's code (core, facilitator, adapters, SDKs, dashboard) is off-chain TypeScript and Go.

**No deployed agent-identity standard.** Stellar has no deployed equivalent of the agent-identity and reputation standards emerging on EVM chains. Octroi must ship its own minimal Soroban identity and reputation registry, designed to converge with whatever standard the Stellar community settles on. This is more work, but it is also an opportunity: that registry is independently useful open-source infrastructure and doubles as the Web Bot Auth key directory described in Section 11.

**Smart-contract DeFi composability is younger.** Stellar's Soroban DeFi ecosystem is less mature than EVM's. Octroi does not need deep DeFi composability, so this barely bites, but it is honest to note.

**XLM is the fee asset.** Although server-sponsored fees and tiny costs largely hide this, the facilitator or a sponsoring account must hold XLM to sponsor fees. This is an operational detail, not a user-facing one, but it exists.

---

## 5. Product Vision and Strategy

### 5.1 Vision

Octroi makes every URL on the web economically addressable. Any publisher sets a price. Any crawler pays it automatically, in real money, with a cryptographic receipt. Humans visit for free. Machines pay to enter.

### 5.2 Strategic positioning

Octroi competes on openness, composability, distribution reach into the long tail, and crypto-native settlement, not on CDN features or bot-detection sophistication. It is an open protocol, not a closed product; stablecoin-native rather than card-native; agent-native in identity and reputation; and long-tail first. On Stellar specifically, it adds a fiat off-ramp story that no card-based or EVM-only competitor can match for global publishers.

### 5.3 Strategy by version

| Version | Core bet                                                                     | Key unlock on Stellar                                                                           |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| v0      | Prove the economics on testnet                                               | x402 over Soroban auth entries makes per-URL receipts viable at sub-cent cost                   |
| v1      | Frictionless publisher onboarding through the plugin wedge and edge adapters | One-click WordPress, Ghost, and Substack plugins, edge modules, plus anchor-based fiat cash-out |
| v2      | The reputation layer                                                         | A Soroban agent registry creates a two-sided trust market and doubles as the key directory      |
| v3      | Become the standard, add scale models                                        | MPP sessions and cross-chain payout via CCTP turn Octroi into protocol infrastructure           |

---

## 6. Target Users

### 6.1 Publishers

**Tier 1, technical indie publishers.** Run their own Node, Python, or Go backends, or static sites with an edge layer. They install the framework SDK or an edge module, value control and crypto-native payout, and are early adopters in v0 and v1.

**Tier 2, non-technical CMS publishers (WordPress, Ghost, Substack).** The v1 primary and the wedge target. They install a one-click plugin, set a price, and paste a payout address. This is the long tail Cloudflare cannot reach one-click, and the anchor cash-out story matters most here, especially for global-south creators.

**Tier 3, mid-size media with engineering and compliance needs.** Want per-path pricing, analytics, receipt exports for licensing and legal, and SSO. They arrive in v2 and may run the self-hosted facilitator for control.

**Tier 4, enterprises and data licensors.** Large publishers and rights-holders who want SLAs, a dedicated facilitator, HSM-held keys, and audit exports. They arrive in v3, and Octroi complements their direct licensing deals rather than replacing them.

### 6.2 Crawlers

**Tier 1, indie AI, RAG, and research-agent developers.** Build retrieval and research agents, want a simple SDK that pays automatically, and are cost-sensitive, so sub-cent pricing and the no-gas-token property matter. The v0 primary.

**Tier 2, AI startups with legal exposure.** Operate production crawlers and want receipts as proof of paid access to reduce legal risk. v0 to v1.

**Tier 3, major labs.** Operator-scale crawlers from the large model companies. They will not be first movers, but the market is being built for them, and interop with x402 and Web Bot Auth lowers their adoption cost when they arrive in v2 and beyond.

### 6.3 Ecosystem participants

**Validators.** Attest to publisher uptime and crawler behavior in the reputation registry, earn USDC per accepted attestation, and stake USDC in v3 with a slash condition. Introduced in v2.

**Integrators.** CDNs, hosting platforms, and AI infrastructure providers who embed Octroi and earn a revenue share. Introduced in v1 and later.

---

## 7. Distribution and Adoption Model

This is the most important strategic decision in the document. Pay per crawl is enforced server-side, in the request path between a crawler and the content. The actor paying is a headless crawler making server-to-server HTTP calls, not a human in a browser, so a browser extension is the wrong tool: it runs where there is no crawl traffic and cannot intercept it. Every viable option is a different answer to one question: where does the 402-and-verify logic sit in the publisher's request path, and how much work must the publisher do to put it there.

### 7.1 One core, many adapters

There is a single enforcement core, the engine that classifies a request, returns the 402 offer, verifies the payment, and issues the receipt. Every distribution surface is a thin adapter over that one core, with no forked logic. This keeps behavior identical everywhere and lets Octroi meet each kind of publisher where their requests already enter.

### 7.2 The wedge: a one-click CMS plugin, WordPress first

The lead distribution channel is a one-click plugin, starting with WordPress, then Ghost and Substack. WordPress is a large share of the web, and most of it is exactly the non-Cloudflare long tail that is Octroi's market. A plugin is one install, no code, no redeploy, and no DNS change: the publisher activates it, sets a price, and pastes a payout Stellar address. The plugin embeds the core engine. This is the channel that reaches the publishers Cloudflare structurally cannot make one-click, so if Octroi ships one thing first for non-technical publishers, it is this.

### 7.3 Edge middleware for platform publishers

For publishers who deploy on modern platforms, Octroi ships drop-in edge modules for the places they already run: Vercel middleware, a Cloudflare Worker, Netlify edge, Fastly Compute. The module sits exactly where requests enter, with no re-architecture.

### 7.4 Framework SDK (the power option)

The framework middleware (Express, Fastify, Next.js, Python, Go) is for developer-heavy publishers who want code-level control. It is a power option, not the headline, because asking a publisher to add and deploy code is higher friction than a plugin or an edge module.

### 7.5 Optional hosted reverse proxy (zero touch)

For non-technical publishers who want the closest thing to the Cloudflare experience, Octroi offers an optional hosted reverse proxy they point a CNAME at. It is the lowest-friction option for the publisher, but it makes Octroi operate infrastructure and asks the publisher to route traffic through it, so it is offered rather than led with. A self-hostable proxy image ships for publishers who prefer to run it themselves.

### 7.6 Discovery layer (no enforcement required)

Under every adapter, Octroi publishes a machine-readable price and policy declaration that well-behaved agents read before requesting: an extension to robots.txt and a `/.well-known/octroi` manifest that advertises per-path prices, the pay endpoint, supported settlement models, and the publisher's payout address. A polite agent can therefore learn the exact price out of band, using files it already fetches, and pay on its first request without a 402 round trip (see Section 9.9). Enforcement still happens at the adapter; discovery is the courteous front door and a real latency win.

### 7.7 The two-sided reality

Publisher install friction is the easier half of the problem. The binding constraint is crawler-side demand. Cloudflare gets crawlers to pay by holding a stick, namely the threat of being blocked across a fifth of the web; Octroi has no such stick. So Octroi's crawler-side strategy is interop, not leverage. The signature format is aligned to Web Bot Auth and the payment to x402, so a crawler that already integrated either, for Cloudflare or for another x402 service, reaches a Octroi 402 and pays with almost no new code (see Section 11). Adapters get publishers onto the network; interop gets crawlers to pay. Both are required, and the go-to-market in Section 24 runs them as parallel tracks from day one.

---

## 8. System Architecture

### 8.1 Three planes

Octroi has three logical planes: a data plane (crawler, publisher adapter, facilitator), a settlement plane (Stellar and Soroban), and a control plane (API gateway, dashboard, Soroban registries). The publisher adapter in the data plane is whichever surface from Section 7 the publisher chose; all of them call the same core and the same facilitator.

```
DATA PLANE
  Crawler + SDK  --HTTP GET-->  Publisher adapter (plugin / edge / SDK / proxy)  --POST /verify-->  Facilitator
  Crawler  <--402 + x402 offer--  Publisher        (reactive path)
  Crawler  --first request with X-PAYMENT-->  Publisher  (proactive path, price known from discovery)
  Crawler  --retry with X-PAYMENT (signed Soroban auth entry)-->  Publisher
  Publisher  <--200 + content + X-PAYMENT-RESPONSE--  Crawler

SETTLEMENT PLANE
  Facilitator  --submits auth entry / opens MPP session-->  Soroban
  x402 path:   per-request SAC transfer, server-sponsored fee
  MPP path:    session pre-auth, streamed micropayments, bulk SAC settlement
  Stellar mainnet (USDC as native asset, SAC interface for Soroban)

CONTROL PLANE
  API Gateway (catalog, receipts, analytics, webhooks)
  Web Dashboard (publishers + crawlers)
  Soroban registries (Identity + Reputation + key directory + optional Pools)
```

### 8.2 The two architectural choices that define the system

The first is the settlement primitive. Authorization is a signed Soroban authorization entry that authorizes a specific USDC SAC transfer up to the offered amount within a short window, and aggregation is provided by MPP sessions for high-volume crawlers or by direct per-request SAC settlement for the simple x402 path. The aggregation primitive is a public protocol rather than a proprietary service, and fee sponsorship is built in, so the crawler never needs the gas asset.

The second is the adapter model. The publisher-side integration is not one piece of middleware; it is one core engine behind several thin adapters (Section 7). The framework middleware is just one adapter among the plugin, the edge modules, and the hosted proxy. This is what turns the architecture from a developer tool into a distributable product.

### 8.3 Component inventory

| Component                      | Purpose                                                                                                                                 | Stack                                            | Introduced             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------- |
| `packages/core`                | The enforcement engine: classify, offer, verify, receipt. Shared by every adapter.                                                      | TypeScript                                       | v0                     |
| `apps/facilitator`             | Verifies signed Soroban auth entries, submits settlement (x402 per-request or MPP session), issues signed receipts. The hot path.       | TypeScript, Fastify, js-stellar-sdk, Soroban RPC | v0                     |
| `apps/api-gateway`             | REST API for receipts, analytics, catalog, webhooks                                                                                     | Go, Gin, Postgres                                | v0 minimal, v1 full    |
| `apps/web-dashboard`           | Publisher and crawler dashboards                                                                                                        | Next.js 15, TanStack Query, Tailwind             | v0                     |
| `packages/proxy-middleware`    | Framework adapter for Express, Fastify, Next.js                                                                                         | TypeScript                                       | v0                     |
| `adapters/wordpress`           | One-click WordPress plugin (the wedge)                                                                                                  | PHP plus core via HTTP to facilitator            | v1                     |
| `adapters/edge`                | Vercel, Cloudflare Worker, Netlify, Fastly edge modules                                                                                 | TypeScript                                       | v1                     |
| `adapters/proxy`               | Optional hosted and self-hostable reverse proxy                                                                                         | Go                                               | v1                     |
| `packages/crawler-sdk`         | Detects 402, reads discovery, signs Soroban auth entries, pays, stores receipts; manages MPP sessions; signs requests with Web Bot Auth | TypeScript                                       | v0                     |
| `packages/receipt-signer`      | Receipt signing and verification                                                                                                        | TypeScript                                       | v0                     |
| `packages/types`               | Shared types                                                                                                                            | TypeScript                                       | v0                     |
| `packages/crawler-sdk-python`  | Python crawler SDK                                                                                                                      | Python                                           | v1                     |
| `packages/proxy-middleware-go` | Go publisher middleware                                                                                                                 | Go                                               | v1                     |
| `contracts/registry`           | Soroban identity, reputation, and key directory                                                                                         | Rust, soroban-sdk                                | v0 read stubs, v2 full |
| `contracts/pools`              | Soroban publisher-pool contract                                                                                                         | Rust, soroban-sdk                                | v2                     |
| `infra/`                       | Docker Compose, Helm, RPC config                                                                                                        | YAML                                             | v0 Compose, v2 Helm    |
| `scripts/`                     | Demo runners, seed data, benchmarks                                                                                                     | TypeScript                                       | v0                     |

### 8.4 Key architectural decisions

**TypeScript and Go off-chain, Rust only on-chain.** The core, facilitator, adapters, SDK, and dashboard are TypeScript and Go. Only the registry and pool contracts are Soroban Rust. This keeps the contributor surface broad and confines Wasm work to a small, well-bounded area.

**Two settlement paths, one receipt format.** x402 per-request is the default and the accountability story (one receipt per URL). MPP sessions are the scale path. Both produce the same canonical signed receipt so downstream verification and legal use are identical.

**Hosted facilitator in v0, self-hostable from v1.** One hosted facilitator to start, with the signing key published, receipt verification possible without the facilitator, and a self-hostable Docker image shipped in v1.

**No custom settlement contract in v0.** v0 settles through the USDC SAC and the existing x402 and MPP rails. The Octroi Soroban registry is read-only in v0 and gains writes in v2.

**Postgres for persistence, Redis for replay state.** Postgres holds receipts, configs, profiles, analytics. Redis tracks auth-entry nonces, Web Bot Auth nonces, and session budgets for the hot path, mirrored asynchronously to Postgres.

---

## 9. Protocol Specification

### 9.1 Phases

A paid crawl proceeds in five phases: Discovery, Offer, Authorization, Verification, Delivery. The shape mirrors x402 generally; the Authorization and Verification phases are Stellar-specific, and a proactive path can skip the Offer round trip.

### 9.2 Discovery

The crawler can discover price in two ways. Out of band, it reads the publisher's robots.txt extension or `/.well-known/octroi` manifest (Section 7.6) and learns exact per-path prices before requesting. In band, it makes an ordinary request and learns the price from the 402 offer. Out-of-band discovery enables the proactive fast path in 9.9.

### 9.3 Offer (HTTP 402)

The adapter classifies the request (see 9.8) and applies the publisher's policy (see 9.10). If the outcome is charge and no valid payment is present, it returns an x402 offer. The offer mirrors the standard x402 shape with a Stellar network and asset and Octroi extensions:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "stellar-testnet",
      "maxAmountRequired": "100",
      "resource": "https://example-publisher.com/articles/how-soroban-works",
      "description": "Full article, 2,400 words",
      "mimeType": "text/html",
      "payTo": "GPUBLISHER...STELLARADDRESS",
      "asset": "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "maxTimeoutSeconds": 30,
      "extra": {
        "settlement": "x402",
        "mppSessionSupported": true,
        "octroi_publisher_id": "pub_abc123",
        "octroi_facilitator": "https://facilitator.octroi.xyz",
        "octroi_agent_id": "42",
        "octroi_reputation_score": "87",
        "octroi_catalog_url": "https://api.octroi.xyz/catalog/pub_abc123",
        "feeSponsored": true
      }
    }
  ]
}
```

Field notes specific to Stellar:

- `maxAmountRequired` is in atomic USDC units. USDC on Stellar uses 7 decimals in classic representation; the SAC interface and Octroi normalize to a documented atomic unit, a fixed tested constant, not a runtime variable.
- `asset` is the USDC asset identifier and, for Soroban settlement, its SAC contract address.
- `settlement` is `x402` for per-request or `mpp` when a session is in force.
- `mppSessionSupported` tells a high-volume crawler it may open an MPP session instead of paying per request.
- `feeSponsored` tells the crawler the facilitator sponsors the transaction fee, so the crawler needs only USDC, not XLM.

### 9.4 Authorization (Stellar-specific)

The SDK constructs and signs a Soroban authorization entry that authorizes the USDC SAC `transfer` from the crawler to the publisher for the offered amount, scoped to a short validity window and bound to a nonce.

```
authorizeInvocation:
  contract:  USDC SAC address
  function:  transfer
  args:      from = crawler G-address
             to   = publisher G-address (must equal payTo)
             amount = offered amount (must be <= maxAmountRequired)
  nonce:     random 64-bit nonce
  signatureExpirationLedger: current + N ledgers (~30s window)
signed by: crawler's key (Freighter, smart wallet, or server key)
```

The signed authorization entry is base64-encoded and sent in the request in the `X-PAYMENT` header, exactly as in x402. For the MPP path, the crawler instead presents an active session token and the per-request amount is debited from the pre-authorized session budget rather than signed individually.

### 9.5 Verification (Stellar-specific)

The adapter forwards the payment payload to the facilitator's `/verify`. The facilitator:

1. Validates the offer terms: amount within `maxAmountRequired`, `to` equals `payTo`, network and asset match, window not expired.
2. Checks the auth-entry nonce against Redis (replay protection) and any applicable MPP session budget.
3. Verifies the authorization entry's signature recovers to the crawler's declared address using the Stellar SDK.
4. Submits settlement: for x402, it assembles and submits the SAC `transfer` invocation with the crawler's signed auth entry, sponsoring the fee; for MPP, it records the debit against the open session for bulk settlement.
5. On success, computes the receipt (Section 13.2), signs it with the facilitator's key, and returns it.

### 9.6 Delivery

The adapter returns content with `X-PAYMENT-RESPONSE` carrying the signed receipt, exactly as in x402.

### 9.7 Error responses

Every error is a structured JSON body with a stable `code`, a human-readable `message`, and where relevant the offending field. The HTTP status and the SDK's expected reaction:

| Code                        | HTTP       | Meaning                                                                   | SDK action                                          |
| --------------------------- | ---------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `invalid_signature`         | 402        | The auth-entry signature does not recover to the declared crawler address | Re-sign and retry                                   |
| `invalid_request_signature` | 402 or 403 | Missing or invalid Web Bot Auth signature on a priced path                | Sign the request, retry                             |
| `amount_exceeded`           | 402        | Authorized amount exceeds `maxAmountRequired`                             | Rebuild with the offered amount                     |
| `amount_mismatch`           | 402        | Authorized amount is less than `maxAmountRequired` (`exact` scheme)       | Rebuild with the offered amount                     |
| `asset_mismatch`            | 402        | The offer's asset is not the USDC asset the facilitator settles           | Stop; the publisher or facilitator is misconfigured |
| `recipient_mismatch`        | 402        | `to` does not equal `payTo`                                               | Rebuild the auth entry                              |
| `replay`                    | 402        | The nonce has already been used                                           | New nonce, retry                                    |
| `expired`                   | 402        | `signatureExpirationLedger` passed or the window expired                  | Rebuild and retry                                   |
| `insufficient_balance`      | 402        | The crawler's USDC balance is too low                                     | Top up the budget                                   |
| `reputation_too_low`        | 403        | The crawler is below the publisher's `minReputationScore`                 | Build reputation or contact the publisher           |
| `offer_changed`             | 409        | The offer terms changed between fetch and pay                             | Re-fetch the offer                                  |
| `crawler_banned`            | 403        | The publisher has blocked this crawler                                    | Stop                                                |
| `rate_limited`              | 429        | Too many requests                                                         | Back off and retry later                            |
| `session_budget_exhausted`  | 402        | The MPP session budget is spent                                           | Open a new session or fall back to per-request x402 |
| `facilitator_error`         | 500        | Facilitator internal error                                                | Retry with backoff                                  |
| `facilitator_unavailable`   | 503        | Facilitator is down                                                       | Retry, or use a fallback facilitator                |

### 9.8 Bot classification

Signals, in rough order of strength: declared x402 support, a valid Web Bot Auth signature, known crawler user agents, reverse DNS that matches a declared operator, IP reputation, and request-pattern heuristics (rate, breadth, depth). Optional proof-of-personhood challenges for ambiguous traffic arrive in v1 and later. The default for ambiguous traffic is to treat it as human and serve free, because false negatives are cheaper than paywalling real humans.

### 9.9 Proactive payment (the fast path)

Adapted from Cloudflare's `crawler-max-price` idea, this removes the 402 round trip for the common case. The crawler reads the exact per-path price from discovery (9.2), checks it against its own configured maximum, and if the price is acceptable, signs an authorization entry for that exact amount and includes `X-PAYMENT` on its very first request. The adapter verifies and returns 200 with the receipt directly, no 402 exchanged. For sustained access to one publisher, an open MPP session removes even the per-request signing, since each URL simply debits the pre-authorized budget. The reactive 402 path in 9.3 remains the fallback whenever an out-of-band price was not available. Only one payment declaration applies per request.

### 9.10 Policy model: allow, charge, or block

Every request resolves to one of three outcomes, configurable per crawler and per path: allow (serve free), charge (require payment at the configured price), or block (deny). Charging a crawler that Octroi has never seen doubles as a soft block that still advertises a path in, because the x402 offer itself teaches any agent how to pay; for an open protocol this is self-bootstrapping demand. Publishers can allowlist specific crawlers for free access or to honor a partnership struck outside Octroi.

### 9.11 Pricing

Two modes. Static per-path pricing via glob patterns is the default and is what the discovery manifest publishes. Optional in-band dynamic pricing lets the origin or edge adapter compute a price per response, for example by content type, freshness, or the requesting crawler's reputation, which is how reputation-based discounts are applied. Dynamic prices are still expressed in the same offer and receipt format.

### 9.12 Enforcement ordering and fallbacks

Following Cloudflare's model, Octroi evaluates allow, charge, or block only after the publisher's existing WAF, bot management, and rate limiting, so it composes with the publisher's security posture rather than replacing it. For crawlers that ignore the protocol or spoof identity, the fallbacks are rate limiting, default-deny on priced paths without a valid Web Bot Auth signature, and an optional tarpit that serves a maze of low-value content to bots identified as ignoring the rules. Octroi enforces at the adapter it is deployed on; it does not have Cloudflare's network-wide vantage point, and enforcement strength scales with where the adapter sits.

---

## 10. Settlement and Payment Models

### 10.1 Model A: x402 per-request (default)

For the common case, a crawler fetching a moderate number of URLs across many publishers, each request is its own signed Soroban authorization entry, settled as an individual SAC transfer with a facilitator-sponsored fee. One request, one on-chain settlement, one receipt. This is the maximum-accountability model and the right default for the long tail. At a roughly $0.00001 base fee, even unbatched per-request settlement is economically sane for a $0.0001 payment, with the fee sponsored by the facilitator and recovered through the protocol fee.

### 10.2 Model B: MPP sessions (high volume)

For a crawler hitting one publisher or pool thousands of times an hour, per-request settlement is wasteful even at Stellar's fees. The crawler opens an MPP session, pre-authorizes a spending limit, streams micro-payments within the session, and the session settles in bulk via SAC transfers at the end. The agent never holds a gas token because the SDK handles server-sponsored fees. Octroi maps each paid URL onto an MPP debit, still emits a per-URL receipt for accountability, and lets the session's bulk settlement produce the on-chain record. Publishers get per-URL receipts; crawlers get per-session settlement.

### 10.3 Choosing between them

The SDK chooses automatically: per-request x402 by default, and an MPP session when it detects sustained high-frequency access to a single publisher or pool above a configurable threshold. Publishers signal MPP support via `mppSessionSupported`. The choice is transparent to the publisher, who receives the same receipts and the same USDC either way.

### 10.4 Receipts are settlement-model-agnostic

A receipt always carries the URL, amount, both parties, timestamp, and facilitator signature, plus either an x402 settlement transaction hash or an MPP session and sequence reference. Downstream verification and legal use do not care which path produced it.

---

## 11. Identity, Authentication, and Reputation

### 11.1 The decision

Stellar has no deployed agent-identity standard, so Octroi ships a minimal Soroban identity and reputation registry. It is deliberately small and designed to converge with whatever agent-identity standard the Stellar community settles on, so it can later defer to that standard rather than compete with it. The registry is independently useful open-source infrastructure, and shipping it inside Octroi both proves it and seeds it.

### 11.2 Crawler authentication: Web Bot Auth over the crawler's Stellar key

Octroi authenticates each crawler request with HTTP Message Signatures in the Web Bot Auth pattern: the crawler signs its request with an Ed25519 key and presents `signature-agent`, `signature-input`, and `signature` headers, with `created`, `expires`, and `nonce` fields for replay protection.

The insight that makes this elegant on Stellar is that a Stellar account is already an Ed25519 keypair. So the crawler's Stellar account can be its Web Bot Auth identity, its request-signing key, its payment account, and its reputation subject, all at once, with no separate identity system. One key does everything.

The `octroi_registry` doubles as the key directory: a `signature-agent` resolves to the registry entry that holds the crawler's Ed25519 public key, so signature verification and reputation lookup read from one source.

### 11.3 Interop is the crawler-side adoption strategy

Because the signature format is Web Bot Auth and the payment is x402, a crawler that already integrated either, whether for Cloudflare or another x402 service, can pay Octroi with almost no new code. This is the deliberate answer to the two-sided cold start in Section 7.7: Octroi cannot force crawlers to pay, so it makes paying nearly free to adopt.

### 11.4 v0: read-only reputation stub

In v0 there is no on-chain reputation yet. The SDK and dashboard display a reputation score from Octroi's own off-chain settlement history (a crawler that has paid reliably gets a provisional score). Publishers can gate on a `minReputationScore` against this provisional score. This is honest about being centralized in v0 and is replaced by the on-chain registry in v2.

### 11.5 v2: on-chain Soroban registry

Three logical parts, all Soroban contracts. Identity: publishers and crawlers register an entry (entity type, domain or bot user agent, Stellar address, Ed25519 public key, Octroi version). Reputation: scores accrue from verifiable signals, principally settlement history, plus robots.txt compliance and request-rate behavior. Attestation: third-party validators submit signed attestations and earn USDC per accepted attestation, staking USDC in v3 with a slash condition for provably false attestations. Because reputation is anchored to real settlement records already on-chain, the registry is harder to game than self-reported reputation.

---

## 12. Soroban Contracts

### 12.1 Contract surface

Octroi's on-chain footprint is intentionally minimal. It holds no custody of funds; USDC always moves directly from crawler to publisher through the SAC. The contracts are:

- `octroi_registry`: identity, reputation, and the Web Bot Auth key directory (identity to Ed25519 public key), plus the facilitator public-key registry and publisher domain-to-identity linkage. Emits events for new registrations.
- `octroi_pools` (v2): a publisher-pool contract that holds and distributes bundled access fees pro-rata to member publishers based on actual crawl volume.

### 12.2 Implementation notes

Written in the Soroban Rust dialect with soroban-sdk, `no_std`, compiled to Wasm. Storage uses the appropriate persistence tiers (instance storage for config, persistent storage for identity and reputation entries) with explicit TTL management, since Soroban ledger entries expire and must be bumped. State-archival handling is a first-class concern in the contract design and a known Soroban pitfall the contracts must handle correctly.

### 12.3 What is deliberately not on-chain

Pricing rules, bot classification, analytics, and receipts live off-chain. Putting them on-chain would add cost and rigidity without adding trust, because receipts are already cryptographically signed and independently verifiable.

---

## 13. Data Model

### 13.1 Postgres schema

The hosted facilitator and gateway persist the following core tables. All amounts are stored as strings in atomic USDC units to avoid floating-point error.

```sql
CREATE TABLE publishers (
  id                   TEXT PRIMARY KEY,
  domain               TEXT NOT NULL,
  payout_address       TEXT NOT NULL,            -- Stellar G-address
  default_price_atomic TEXT NOT NULL,
  network              TEXT NOT NULL,
  min_reputation       INTEGER NOT NULL DEFAULT 0,
  api_key_hash         TEXT NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crawlers (
  id              TEXT PRIMARY KEY,
  wallet          TEXT NOT NULL,                 -- Stellar G-address
  pubkey          TEXT NOT NULL,                 -- Ed25519 public key (Web Bot Auth + settlement)
  user_agent      TEXT,
  reputation      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_rules (
  id            TEXT PRIMARY KEY,
  publisher_id  TEXT REFERENCES publishers(id),
  path_glob     TEXT NOT NULL,                   -- e.g. /articles/*
  price_atomic  TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'static',  -- 'static' | 'dynamic'
  policy        TEXT NOT NULL DEFAULT 'charge',  -- 'allow' | 'charge' | 'block'
  crawler_scope TEXT,                            -- nullable: applies to a specific crawler id
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE receipts (
  id                  TEXT PRIMARY KEY,
  publisher_id        TEXT REFERENCES publishers(id),
  crawler_wallet      TEXT NOT NULL,
  resource            TEXT NOT NULL,
  amount_atomic       TEXT NOT NULL,
  asset               TEXT NOT NULL,
  network             TEXT NOT NULL,
  settlement          TEXT NOT NULL,             -- 'x402' | 'mpp'
  onchain_tx_hash     TEXT,                       -- x402 path
  mpp_session_id      TEXT,                       -- mpp path
  mpp_sequence        INTEGER,                    -- mpp path
  authorization_nonce TEXT UNIQUE,
  facilitator_pubkey  TEXT NOT NULL,
  signature           TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,              -- mpp session id
  crawler_wallet  TEXT NOT NULL,
  publisher_id    TEXT REFERENCES publishers(id),
  pool_id         TEXT,                          -- nullable, if session is against a pool
  budget_atomic   TEXT NOT NULL,
  spent_atomic    TEXT NOT NULL DEFAULT '0',
  opened_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  settled_at      TIMESTAMPTZ,
  settlement_tx   TEXT
);

CREATE TABLE analytics_events (
  id              BIGSERIAL PRIMARY KEY,
  publisher_id    TEXT,
  crawler_wallet  TEXT,
  resource        TEXT,
  event_type      TEXT,                          -- 'offer' | 'paid' | 'blocked' | 'allowed'
  amount_atomic   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhooks (
  id            TEXT PRIMARY KEY,
  publisher_id  TEXT REFERENCES publishers(id),
  url           TEXT NOT NULL,
  secret        TEXT NOT NULL,
  events        TEXT[] NOT NULL,                 -- e.g. {'receipt.created'}
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

Redis tracks hot-path state:

```
session:budget:{session_id}        -> spent_atomic   (TTL = session expiry)
nonce:{auth_entry_nonce}           -> "used"         (TTL = signatureExpiration + buffer)
botauth:nonce:{request_nonce}      -> "used"         (TTL = signature expires + buffer)
ratelimit:{crawler_wallet}         -> counter        (sliding window)
```

### 13.2 Receipt schema

The canonical signed receipt, returned in `X-PAYMENT-RESPONSE` and stored for legal use. It is settlement-model-agnostic and independently verifiable:

```json
{
  "version": "1",
  "resource": "https://example-publisher.com/articles/how-soroban-works",
  "amount": "100",
  "asset": "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  "network": "stellar-mainnet",
  "from": "GCRAWLER...ADDRESS",
  "to": "GPUBLISHER...ADDRESS",
  "nonce": "8f2a...c41d",
  "timestamp": "2026-06-16T12:00:00Z",
  "settlement": "x402",
  "onchainTxHash": "a1b2c3...",
  "mppSessionRef": null,
  "facilitatorPubkey": "GFACILITATOR...KEY",
  "signature": "base64-ed25519-signature-over-the-canonical-fields"
}
```

For the MPP path, `settlement` is `mpp`, `onchainTxHash` is null until bulk settlement, and `mppSessionRef` carries `{ "sessionId": "...", "sequence": 42 }`. The signature is computed over the canonical ordering of all non-signature fields.

---

## 14. Feature Specifications by Version

### v0 (testnet MVP)

Core engine; facilitator with `/verify`, `/health`, `/pubkey`, `/verify-receipt`; Express and Fastify adapter; TypeScript crawler SDK that signs Soroban auth entries, signs requests with Web Bot Auth, reads discovery, and stores receipts; Next.js dashboard with publisher, crawler, demo, and a "why Stellar" margin page; provisional off-chain reputation read; a demo script running 60-plus paid fetches across 5 seeded publishers on Stellar testnet, exercising the reactive 402 path, the proactive fast path, and at least one MPP session. The "why Stellar" page shows the math: 60 fetches at $0.0001 is $0.006 revenue against a near-zero settlement cost with sponsored fees, versus gas on chains where the fee exceeds the payment.

### v1 (public beta on mainnet)

Mainnet deployment; the one-click WordPress plugin wedge, then Ghost and Substack; the edge adapters (Vercel, Cloudflare Worker, Netlify, Fastly); the optional hosted and self-hostable proxy; the `/.well-known/octroi` discovery manifest and robots.txt extension; Python SDK; Go middleware; full Go API gateway with webhooks; self-hostable facilitator Docker image; per-path pricing via glob patterns and optional in-band dynamic pricing; the allow, charge, or block policy engine with allowlisting; receipt CSV and JSON export; and the Stellar-specific anchor-based fiat cash-out from the publisher dashboard.

### v2 (reputation and discovery)

The on-chain Soroban identity, reputation, and key-directory registry; a validator network earning USDC for attestations; a searchable publisher discovery catalog; publisher pools with MPP-session bundle purchasing; reputation-based pricing curves; and the `octroi_registry` and `octroi_pools` contracts.

### v3 (scale and enterprise)

Cross-chain payout via CCTP so a publisher can receive earnings on another chain while settlement stays on Stellar; deferred and subscription payment models on MPP sessions; enterprise features (SLA dashboard, audit exports, SSO, dedicated facilitator with HSM keys); Helm charts and Kubernetes deployment; stake-to-validate; and a protocol-fee treasury.

---

## 15. API Reference

### 15.1 Facilitator (the hot path)

| Method | Path                  | Description                                                             |
| ------ | --------------------- | ----------------------------------------------------------------------- |
| POST   | `/verify`             | Verify a payment payload, submit settlement, return a signed receipt    |
| GET    | `/health`             | Liveness and readiness                                                  |
| GET    | `/pubkey`             | The facilitator's current receipt-signing public key                    |
| POST   | `/verify-receipt`     | Verify a receipt's signature and on-chain reference for any third party |
| POST   | `/sessions`           | Open an MPP session for a crawler against a publisher or pool           |
| GET    | `/sessions/:id`       | Session status and remaining budget                                     |
| POST   | `/sessions/:id/close` | Close and settle a session early                                        |

### 15.2 API gateway (control plane)

| Method | Path                      | Description                                                      |
| ------ | ------------------------- | ---------------------------------------------------------------- |
| POST   | `/publishers`             | Register a publisher (domain, payout address, default price)     |
| GET    | `/publishers/:id`         | Publisher profile                                                |
| PATCH  | `/publishers/:id`         | Update profile, payout address, or minimum reputation            |
| GET    | `/publishers/:id/pricing` | List pricing and policy rules                                    |
| PUT    | `/publishers/:id/pricing` | Replace pricing and policy rules                                 |
| POST   | `/crawlers`               | Register a crawler (wallet, Ed25519 pubkey, user agent)          |
| GET    | `/crawlers/:id`           | Crawler profile and reputation                                   |
| GET    | `/receipts`               | List receipts, filterable by publisher, crawler, date, resource  |
| GET    | `/receipts/:id`           | A single receipt                                                 |
| GET    | `/receipts/export`        | Export receipts as CSV or JSON for accounting or legal use       |
| GET    | `/analytics/summary`      | Totals: revenue, paid fetches, unique crawlers, blocked requests |
| GET    | `/analytics/timeseries`   | Time-bucketed metrics for the dashboard                          |
| POST   | `/webhooks`               | Register a webhook for events such as `receipt.created`          |
| GET    | `/webhooks`               | List webhooks                                                    |
| DELETE | `/webhooks/:id`           | Remove a webhook                                                 |
| GET    | `/catalog`                | Public discovery catalog of participating publishers (v2)        |
| GET    | `/catalog/:publisherId`   | A publisher's public catalog entry (v2)                          |

Authentication is by API key for publisher and crawler accounts, passed as a bearer token. All endpoints are TLS-only and rate-limited per key.

---

## 16. Security Model

### 16.1 Replay protection

Independent barriers: the facilitator's Redis nonce check on the auth-entry nonce; the Postgres `authorization_nonce UNIQUE` constraint; Soroban's own enforcement that a given authorization-entry nonce cannot be reused; and, for request authentication, the Web Bot Auth `nonce` and `expires` fields checked in Redis. For MPP sessions, the session budget in Redis prevents over-spend, mirrored to Postgres.

### 16.2 Double-charging

A duplicate `/verify` for the same auth entry fails the Redis nonce check, and Soroban rejects the reused authorization on submission. For sessions, a duplicate debit is idempotent against the session sequence number.

### 16.3 Receipt integrity

Receipts are signed by the facilitator's key, the public key is published at `/pubkey` and in the `octroi_registry` contract, and any third party can verify a receipt independently using the Stellar SDK and a Soroban RPC endpoint. A tampered receipt fails verification.

### 16.4 Facilitator key compromise

A stolen facilitator key lets an attacker forge receipts but cannot move funds, because settlement authorizations route USDC directly to the publisher address in the offer and are signed by the crawler, not the facilitator. Keys can be rotated; old receipts remain valid under the key recorded in their `facilitatorPubkey` field; publishers can self-host to eliminate the risk.

### 16.5 Fee-sponsorship abuse

Because the facilitator sponsors transaction fees, a malicious crawler could try to make it sponsor fees for transactions that never result in a paid crawl. Mitigation: the facilitator only sponsors fees for settlements tied to a verified auth entry whose amount it recovers through the protocol fee, applies per-crawler rate limits, and requires a minimum reputation or a small refundable XLM deposit for unknown high-volume crawlers.

### 16.6 Honeypot and price-inflation protection

The facilitator validates that the authorized amount does not exceed the offered `maxAmountRequired`, stores the original offer alongside the receipt, and lets a publisher's reputation drop if it consistently inflates. Crawlers can verify the charged amount against the agreed amount in the receipt.

### 16.7 Crawler request authentication and spoof prevention

Priced content requires a valid Web Bot Auth signature from a registered crawler key; an unsigned or invalid-signature request to a priced path gets a 402, or a 403 under a block policy, never content. Because identity, request signature, and payment all derive from the crawler's one Stellar Ed25519 key, a forged identity cannot pay and a real payment cannot be attributed to a forged identity. Crawlers that ignore the protocol are handled by the fallbacks in 9.12.

---

## 17. Trust Model

| Component                   | Who you trust                                 | Can do                                                       | Cannot do                                                             |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Stellar consensus           | The Stellar validator set under SCP           | Order transactions; the set is known and diverse             | Reorg finalized ledgers                                               |
| USDC issuer (Circle)        | Circle Inc.                                   | Freeze or blacklist at the asset level                       | Redirect a settled SAC transfer                                       |
| MPP session settlement      | The MPP protocol and its facilitators         | Hold pre-authorized session budget during the session window | Move funds outside the authorized session scope                       |
| Octroi facilitator (hosted) | Second Gate                                   | Issue signed receipts; sponsor fees; submit settlements      | Move funds; forge crawler authorizations                              |
| Publisher adapter           | The publisher                                 | Classify traffic; forward to facilitator                     | Redirect USDC to an unauthorized address (checked by the facilitator) |
| `octroi_registry`           | Stellar validators plus the deployed contract | Store identity, reputation, and crawler public keys          | The data's truthfulness; that falls to validators and attestation     |

The design invariant: no single party can both steal funds and forge evidence of legitimate authorization. The one Stellar-specific trust note worth surfacing to users is that Stellar USDC is freezable at the issuer level, a property of the asset, not of Octroi, which institutional users often see as a feature and which Octroi documents plainly.

---

## 18. Non-Functional Requirements

**Performance.** Facilitator `/verify` p50 under 500ms in v0, trending to under 100ms in v3. A discovered-price proactive fetch completes in a single round trip. x402 settlement confirmation targets one ledger close; MPP session settlement completes within one ledger close after session close (currently around five seconds, trending toward 2.5 as the protocol roadmap lands).

**Availability.** Best-effort uptime in v0; 99.9 percent in v1; 99.99 percent on the enterprise tier in v3. The facilitator runs redundant instances from v1.

**Data retention.** Receipts are retained permanently as legal records. Analytics events roll on a 13-month window. Personally identifying data is minimized; the system stores wallet addresses and user agents, not end-user identities.

**Scalability.** The facilitator is stateless behind a load balancer, with all state in Redis and Postgres, so it scales horizontally. The hot path touches Redis only; Postgres writes are asynchronous where possible.

**Security and compliance.** TLS on every endpoint, signed receipts, scheduled key rotation, and per-key rate limiting. Secrets are held in a managed secret store, and the issuer signing path moves to HSM or KMS for enterprise deployments.

**Accessibility and internationalization.** The dashboard meets WCAG 2.1 AA from v1 and is localized for the priority publisher regions in v2.

---

## 19. Infrastructure and Deployment

v0 runs the facilitator on Railway or Fly, Postgres on Railway or Neon, Redis on Upstash, and the dashboard on Vercel, against Stellar testnet via a public Soroban RPC endpoint and the testnet USDC asset. v1 moves to mainnet with redundant facilitator instances, a Go gateway, Neon Postgres, Soroban RPC from a production provider, the edge adapters on their respective platforms, the hosted proxy, and a SEP-compatible anchor integration for fiat cash-out. v2 and later move to Kubernetes with Helm, Prometheus and Grafana, and PagerDuty. Environment variables include the Soroban RPC URL, network passphrase, USDC asset and SAC address, facilitator signing key, fee-sponsor account secret, and MPP facilitator endpoint.

---

## 20. Success Metrics

Hackathon or demo: at least 60 on-chain settlements on testnet across the reactive, proactive, and MPP paths, sub-cent per-action price, sub-two-second latency per paid fetch, the reputation read visible, and the "why Stellar" math shown. v1: measured on two curves, publisher installs (driven by the plugin wedge) and crawler integrations, with a target of 10 publishers and 5 crawler integrations in 30 days, 50 and 20 in 90 days, plus USDC settled, receipts issued, SDK and plugin downloads, and GitHub stars. v2: 500 catalog publishers, 50 active crawlers, $100k monthly settled, 10 validators, and on-chain reputation scores issued. The Stellar-specific metric to watch is fiat cash-outs through anchors, as proof the off-ramp story lands with global publishers.

---

## 21. Competitive Analysis

Against Cloudflare Pay Per Crawl, Octroi wins on openness, self-hostability, reach into the non-Cloudflare long tail, crypto-native per-request settlement, portable receipts, an SDK and plugin ecosystem, and a fiat off-ramp Cloudflare does not offer; Cloudflare wins on distribution and the ability to compel crawlers across a fifth of the web. Octroi deliberately matches Cloudflare on the parts that are just good design (the 402 negotiation, the proactive fast path, the allow, charge, or block model, and Web Bot Auth identity) so that a crawler integrated for one can pay the other. Against DIY one-off licensing deals, Octroi is the infrastructure layer that makes them unnecessary for the long tail and complementary for large publishers. Stripe metered billing remains out of category because its minimum fee cannot reach sub-cent pricing.

---

## 22. Monetization Model

A protocol fee, target 2.5 percent, tiered down for high volume and zero for self-hosted facilitators, charged at settlement time on settlements routed through the hosted facilitator. Enterprise add-ons in v3: a dedicated facilitator, an SLA, HSM-held keys, and priority support. Validators earn a portion of protocol fees as a pass-through, not Octroi revenue. The unit economics work because the fee scales with settled volume while infrastructure cost grows slowly, so margin improves with scale; the dominant variable cost is the sponsored XLM fee, which is negligible at Stellar's base fee and is recovered inside the protocol fee.

---

## 23. Legal and Compliance

Octroi is payment infrastructure: it facilitates payments, does not own content, does not represent that a receipt is a content license, and does not adjudicate disputes. A receipt is proof that a payment for access occurred, not a grant of any copyright or licensing right, and the terms of service state this plainly. Octroi respects and extends robots.txt rather than circumventing it, and the discovery manifest is additive to existing crawler norms. Under GDPR, Octroi acts as a data processor for the publisher, processes minimal data (wallet addresses, user agents, request metadata), and offers a data-processing agreement. Addresses are screened against OFAC and equivalent lists before settlement. Two Stellar-specific notes: USDC on Stellar is freezable at the issuer level, which Octroi documents for users; and money-transmission classification is an open question, since the facilitator touches signed messages and sponsored fees, not custody of the payment, which routes crawler-to-publisher directly. Legal counsel is engaged before mainnet.

---

## 24. Go-to-Market Strategy

The go-to-market runs two tracks in parallel from day one, because pay per crawl is a two-sided market and the binding constraint is crawler-side demand, not publisher install friction.

**Publisher track.** Lead with the wedge: the one-click WordPress plugin, then Ghost and Substack, then the edge adapters, with the framework SDK and hosted proxy as the options for teams that want them. The message to a publisher is "install a plugin, set a price, paste your payout address, and start earning from AI crawlers today, cashed out in your local currency." This reaches the long tail Cloudflare cannot make one-click. Distribution surfaces, in order of priority: the plugin directory listings (WordPress first), a Product Hunt and Show HN moment, and the Stellar ecosystem channels (GrantFox listing, SCF application, the developer Discord and agent-payments community).

**Crawler track.** This is the harder half. Octroi cannot force crawlers to pay, so it competes on near-zero integration cost through interop: a crawler that already implements x402 or Web Bot Auth pays Octroi with almost no new code. The work here is developer relations with indie AI and RAG builders, clear migration notes for crawlers already paying Cloudflare-style, and seeding the crawler SDK in the agent-payments community. The early proof point is a single crawler paying real USDC to a real long-tail publisher and cashing it out through an anchor.

The press angle leans on the open-alternative-to-Cloudflare framing and the global-builder story: AI crawlers paying creators in emerging markets, cashed out through existing rails, which is both true and distinctive. The GrantFox and SCF fit is strong: Octroi is open-source agentic-payments infrastructure on the exact rails the foundation is prioritizing, it decomposes into many discrete contributor issues (adapters, SDK languages, dashboard features, contract work), and it has a clear public-good character.

---

## 25. Risks and Mitigations

| Risk                                                            | Likelihood             | Impact                   | Mitigation                                                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawler-side demand does not materialize (two-sided cold start) | High                   | Existential              | The single biggest risk. Compete on interop not leverage; match x402 and Web Bot Auth so integration is near-free; seed with indie AI builders; prove one real paid crawl early |
| Publishers will not install anything                            | Medium                 | Slows adoption           | The plugin wedge and edge adapters exist precisely to minimize this; the hosted proxy is the zero-touch fallback                                                                |
| MPP or x402 spec changes on Stellar                             | Medium                 | Rework                   | Pin to documented spec versions; track the Stellar dev meetings; treat both as upstream dependencies                                                                            |
| Web Bot Auth is still an evolving draft                         | Medium                 | Rework on the auth layer | Track the draft; keep the signature layer thin and swappable; the crawler's Stellar key is stable regardless                                                                    |
| Soroban contract or RPC instability during a demo               | Medium                 | Demo-fatal               | Pre-record a backup; deploy facilitator in two regions; have a local fallback                                                                                                   |
| Cloudflare broadens Pay Per Crawl                               | High over 2026 to 2027 | Reduces TAM              | Open-standard complement; runs on any stack; the long tail, self-hosting, crypto-native receipts, and fiat off-ramp are differentiators Cloudflare will not match               |
| USDC freeze event touches a user                                | Low                    | Localized                | Document the issuer-freeze property; support EURC or other Stellar stablecoins as alternates                                                                                    |
| Fee-sponsorship abuse                                           | Medium                 | Cost leak                | Sponsor only fees tied to verified, recoverable settlements; rate limit; deposit or reputation gate unknown high-volume crawlers                                                |
| Scope creep before a milestone                                  | High                   | Nothing ships            | Hard gate: no later-ring feature starts until one end-to-end paid fetch works on the reactive, proactive, and MPP paths                                                         |

---

## 26. Execution Roadmap

**v0 (testnet, target a focused two-week build).**
Week 1: monorepo scaffold, shared types, the core engine, receipt signer; facilitator `/verify` with Soroban auth-entry verification; x402 per-request settlement through the USDC SAC with sponsored fees; Web Bot Auth request signing and verification; Redis nonce tracking. Week 2: Express and Fastify adapter; TypeScript crawler SDK signing auth entries and requests, reading discovery; the proactive fast path; one MPP session path; Next.js dashboard; seed five publishers; the 60-plus fetch demo across reactive, proactive, and MPP; the "why Stellar" margin page. Exit: reproducible demo, all receipts in Postgres, all three paths shown.

**v1 (mainnet beta, Q3 2026).**
Security review of the facilitator; mainnet deployment; the WordPress plugin wedge, then Ghost and Substack; the edge adapters; the hosted and self-hostable proxy; the discovery manifest and robots.txt extension; Python SDK; Go middleware; full Go gateway with webhooks; self-hostable facilitator image; anchor-based fiat cash-out; per-path and in-band dynamic pricing; the allow, charge, or block engine with allowlisting; receipt export. Crawler track: developer relations and migration notes for x402 and Web Bot Auth crawlers.

**v2 (reputation and discovery, Q4 2026 to Q1 2027).**
`octroi_registry` (identity, reputation, key directory) and `octroi_pools` contracts; validator network; discovery catalog; publisher pools with MPP bundle purchasing; reputation-based pricing.

**v3 (scale and enterprise, 2027).**
CCTP cross-chain payout; deferred and subscription models on MPP; enterprise features; Helm and Kubernetes; stake-to-validate; protocol-fee treasury.

---

## 27. Open Questions

1. What is the exact atomic-unit convention Octroi standardizes on for USDC on Stellar (7-decimal classic vs the SAC representation), documented as a fixed constant across SDK, facilitator, adapters, and contracts?
2. Which Stellar wallets support Soroban auth-entry signing today, and what is the minimum set the v0 SDK must support beyond Freighter?
3. What are the exact MPP session lifecycle semantics and limits (max budget, max duration, settlement guarantees) the facilitator must respect?
4. Does the production Soroban RPC provider rate-limit in a way that affects per-request x402 at scale, and does MPP fully remove that concern for high-volume crawlers?
5. What is the simplest SEP-compatible anchor integration for v1 fiat cash-out, and which regions does it cover at launch?
6. Should the `octroi_registry` aim to become a general agent-identity standard for Stellar, or strictly defer to an emerging community standard once one exists?
7. Is a money-transmission license required for the facilitator's fee-sponsoring, message-handling role under US rules, given it never custodies the payment?
8. What XLM balance must the fee-sponsor account maintain at target volume, and how is it topped up and accounted against the protocol fee?
9. How closely should the Web Bot Auth implementation track the evolving draft, and is the crawler's raw Stellar Ed25519 key sufficient or does the directory need a separate signing key per crawler?
10. Beyond WordPress, which CMS or platform plugin is the highest-leverage second build, and should Octroi operate the hosted proxy or stay a pure library-and-plugin play to avoid becoming infrastructure?

---

_End of document. Octroi on Stellar, Version 1.0. Maintained in `docs/PRD.md` in the Octroi monorepo._
