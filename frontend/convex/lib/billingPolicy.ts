/** No commercial plan is invented: missing operator choices disable paid research. */
export type BillingPolicy = {
  priceId: string;
  monthlyResearchLimit: number;
  domainsPerCampaignLimit: number;
};

export function billingPolicy(
  env: Record<string, string | undefined> = process.env,
): BillingPolicy | null {
  const priceId = env.STRIPE_PRICE_ID;
  const monthly = env.SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT;
  const domains = env.SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT;
  if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId) || !monthly || !domains)
    return null;
  if (!/^\d+$/.test(monthly) || !/^\d+$/.test(domains)) return null;
  const monthlyResearchLimit = Number(monthly);
  const domainsPerCampaignLimit = Number(domains);
  if (
    !Number.isSafeInteger(monthlyResearchLimit) ||
    monthlyResearchLimit < 1 ||
    monthlyResearchLimit > 100_000 ||
    !Number.isSafeInteger(domainsPerCampaignLimit) ||
    domainsPerCampaignLimit < 1 ||
    domainsPerCampaignLimit > 10
  )
    return null;
  return { priceId, monthlyResearchLimit, domainsPerCampaignLimit };
}

export function isEntitled(
  account: {
    status: string;
    priceId?: string;
    currentPeriodEnd?: number;
  } | null,
  policy: BillingPolicy | null,
  timestamp = Date.now(),
): boolean {
  return !!(
    account &&
    policy &&
    account.status === "active" &&
    account.priceId === policy.priceId &&
    Number.isFinite(account.currentPeriodEnd) &&
    account.currentPeriodEnd! > timestamp
  );
}

export function billingOrigin(value = process.env.APP_URL): string {
  if (!value) throw new Error("Billing is not configured");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.origin !== value ||
    url.hostname === "localhost"
  )
    throw new Error("Billing requires an exact HTTPS APP_URL");
  return url.origin;
}

export function billingConfigured(): boolean {
  try {
    billingOrigin();
    return !!(
      billingPolicy() &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return false;
  }
}
