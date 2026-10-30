# ADR for Dummies: Exact-amount settlement and asset binding

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29
- **Technical ADR:** [ADR-2026-10-29-exact-amount-and-asset-binding](./ADR-2026-10-29-exact-amount-and-asset-binding.md)

## The idea

Today a crawler can pay a tiny fraction of a page's price and still get the page and a
signed receipt. This change makes Octroi accept only the exact price, in the right
currency, and makes the publisher's server double-check the receipt before it hands
over the page.

## What people see

1. A publisher prices an article at 0.0001 USDC (1000 base units).
2. A crawler asks for the article and gets a "payment required" answer with the price.
3. An honest crawler, using Octroi's SDK, pays exactly 0.0001 USDC and gets the article
   and a receipt. Nothing changes for it.
4. A cheating crawler tries to pay 0.0000001 USDC instead. The payment service refuses
   before any money moves, and the crawler gets "payment required" again with the
   reason `amount_mismatch`.
5. The publisher's sales report only ever shows what was actually paid.

## Important limitation

This closes the underpayment hole. It does not yet stop strangers from calling the
payment service directly, or tie a receipt to a specific publisher account. Those are
separate pieces of work already on the list.

## What changes

- Paying less than the price is refused (`amount_mismatch`). Paying more was already
  refused (`amount_exceeded`).
- A payment that names a different currency than the one the service is set up for is
  refused (`asset_mismatch`).
- The payment service will not start if its two currency settings disagree.
- The publisher's middleware checks the receipt's amount, recipient, page and currency,
  and refuses to serve the page if anything is off.
- The publisher's payment notifications report the amount on the receipt, not the
  listed price.

## What does not change

- Prices, receipts and the payment flow look the same to honest crawlers.
- No database or dashboard changes.
- The Go gateway is untouched.
