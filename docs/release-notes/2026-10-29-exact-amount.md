---
date: 2026-10-29
feature: Payments settle only for the exact offered amount and the configured USDC asset
scope: fix
issue: 37
scenario-impact: needs_automation
---

# Exact-amount settlement and asset binding

**Publishers.** A crawler can no longer pay less than your price. Before this fix, a
crawler could sign a transfer for 1 base unit (0.0000001 USDC) on a page priced at 1000
units, get the page and a signed receipt, and your `onPayment` hook would report 1000.
Now the facilitator refuses that payment before any money moves, and the crawler gets a
402 with `amount_mismatch`. The middleware also checks the receipt the facilitator
returns (amount, recipient, URL, asset and network) and answers 502 instead of serving
the page if any of them differ from the offer. `onPayment` reports the amount on the
receipt.

**Crawler operators.** Nothing changes if you use the Octroi SDK: it already signs the
full price. A client that authorizes less than `maxAmountRequired` now gets
`amount_mismatch`; one that sends a scheme other than `exact`, or a malformed `payment`
object, gets a 400 from `/verify`.

**Facilitator operators.** The facilitator now refuses to start unless
`OCTROI_USDC_SAC` is the Stellar Asset Contract (SAC) of `OCTROI_USDC_ASSET` on
`OCTROI_NETWORK`. The error names both values and the contract id it expected. A
`/verify` request for any other asset gets `asset_mismatch` and nothing is settled.

Technical shape, per
[ADR-2026-10-29-exact-amount-and-asset-binding](../adr/ADR-2026-10-29-exact-amount-and-asset-binding.md):

- `@octroi/types`: new error codes `amount_mismatch` and `asset_mismatch`, also listed in
  `docs/PRD.md` section 9.7. The wire field `maxAmountRequired` keeps its name; for the
  `exact` scheme it is the amount, not a ceiling.
- `apps/facilitator`: `validateTransferAuth` takes `requiredAmount` and accepts only an
  equal amount. `/verify` parses `payment` into a typed payload and rejects non-`exact`
  schemes. `FacilitatorService` takes `usdcAsset` and checks it before settling.
  `loadConfig` derives the SAC id with `Asset.contractId` and compares.
- `packages/proxy-middleware`: the Express middleware compares the receipt with the offer
  before calling `next()`.

Scenario: the manual Stellar testnet check in the ADR's Verification section (a
hand-built 1-unit `X-PAYMENT` against a 1000-unit price returns 402 `amount_mismatch`
and submits no transaction) is not automated yet.
