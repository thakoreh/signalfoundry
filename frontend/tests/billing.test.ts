import { test } from "node:test";
import assert from "node:assert/strict";
import { displayedEntitlement, billingOfferLabel } from "../lib/billing.ts";
test("cached billing entitlement is displayed active only before verified expiry", () => {
  const billing = {
    configured: true,
    entitled: true,
    current_period_end: 1000,
  };
  assert.equal(displayedEntitlement(billing, 999), true);
  assert.equal(displayedEntitlement(billing, 1000), false);
  assert.equal(displayedEntitlement(billing, 1001), false);
});
test("client time never grants access without configured verified entitlement and expiry", () => {
  assert.equal(displayedEntitlement(null, 0), false);
  for (const billing of [
    { configured: false, entitled: true, current_period_end: 1000 },
    { configured: true, entitled: false, current_period_end: 1000 },
    { configured: true, entitled: true, current_period_end: null },
    { configured: true, entitled: true, current_period_end: Number.NaN },
    {
      configured: true,
      entitled: true,
      current_period_end: Number.POSITIVE_INFINITY,
    },
  ])
    assert.equal(displayedEntitlement(billing, 0), false);
});

test("plan price displays authoritative currency, minor units and recurring interval", () => {
 assert.equal(billingOfferLabel({ amount: 2900, currency: "cad", interval: "month", interval_count: 1, mode: "test" }), "CAD 29.00 / month");
 assert.equal(billingOfferLabel({ amount: 9900, currency: "usd", interval: "month", interval_count: 3, mode: "live" }), "USD 99.00 / 3 months");
});
