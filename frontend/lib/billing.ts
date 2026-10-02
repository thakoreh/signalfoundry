/** Display only. The server independently authorizes every paid operation.
 * A local clock can narrow a cached entitlement, never create an entitlement. */
export function displayedEntitlement(
  billing: {
    configured: boolean;
    entitled: boolean;
    current_period_end: number | null;
  } | null,
  now: number,
): boolean {
  return (
    !!billing?.configured &&
    billing.entitled &&
    typeof billing.current_period_end === "number" &&
    Number.isFinite(billing.current_period_end) &&
    billing.current_period_end > now
  );
}

export type BillingOffer = { amount: number; currency: string; interval: string; interval_count: number; mode: "test" | "live" };
export function billingOfferLabel(offer: BillingOffer): string {
 const amount = new Intl.NumberFormat("en-CA", { style: "currency", currency: offer.currency.toUpperCase(), currencyDisplay: "code" }).format(offer.amount / 100).replaceAll("\u00a0", " ");
 return `${amount} / ${offer.interval_count === 1 ? offer.interval : `${offer.interval_count} ${offer.interval}s`}`;
}
