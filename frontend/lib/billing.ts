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
