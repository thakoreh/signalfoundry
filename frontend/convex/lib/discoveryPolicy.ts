import type { WorkerAccount } from "../validators";

/** Commercial approval and spend limits are operator choices, never browser claims. */
export const MAX_DISCOVERY_TARGETS = 30;
export const MAX_DISCOVERY_BUDGET = 20_000_000;
export type DiscoveryStage = "discovery" | "contacts" | "verification";
export type DiscoveryPolicy = {
  jobBudget: number;
  monthlyBudget: number;
  workspaceMonthlyBudget: number;
};
const positive = (value: string | undefined, max: number) =>
  value &&
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= max
    ? Number(value)
    : null;
export function licensedDataAccessible(
  env: Record<string, string | undefined> = process.env,
) {
  return env.SIGNALFOUNDRY_LICENSED_DATA_ACCESS_APPROVED === "true";
}
export function discoveryPolicy(
  env: Record<string, string | undefined> = process.env,
): DiscoveryPolicy | null {
  const jobBudget = positive(
    env.SIGNALFOUNDRY_DISCOVERY_JOB_BUDGET_MICROUSD,
    MAX_DISCOVERY_BUDGET,
  );
  const monthlyBudget = positive(
    env.SIGNALFOUNDRY_DISCOVERY_MONTHLY_BUDGET_MICROUSD,
    1_000_000_000,
  );
  const workspaceMonthlyBudget = positive(
    env.SIGNALFOUNDRY_DISCOVERY_WORKSPACE_MONTHLY_BUDGET_MICROUSD,
    1_000_000_000,
  );
  if (
    env.SIGNALFOUNDRY_DISCOVERY_LAUNCH_APPROVED !== "true" ||
    env.SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED !== "true" ||
    env.SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED !== "true" ||
    !licensedDataAccessible(env) ||
    !jobBudget ||
    !monthlyBudget ||
    !workspaceMonthlyBudget ||
    workspaceMonthlyBudget > monthlyBudget ||
    jobBudget > workspaceMonthlyBudget
  )
    return null;
  return { jobBudget, monthlyBudget, workspaceMonthlyBudget };
}
export function dataVisible(
  data: { source_provider?: string | null; license_expires_at?: string | null },
  now = Date.now(),
) {
  if (!data.source_provider) return true;
  const providerAllowed =
    data.source_provider === "exa"
      ? process.env.SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED === "true"
      : data.source_provider === "peopledatalabs"
        ? process.env.SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED === "true"
        : false;
  return (
    licensedDataAccessible() &&
    providerAllowed &&
    !!data.license_expires_at &&
    Number.isFinite(Date.parse(data.license_expires_at)) &&
    Date.parse(data.license_expires_at) > now
  );
}

// Re-check saved checkpoints immediately before use. A company's permission never
// grants access to its independently licensed contacts, including malformed legacy
// contacts with missing provenance. This helper only removes data; it cannot extend
// a provider's rights or retention period.
export function filterAccessibleDiscoveryAccounts(
  accounts: WorkerAccount[],
  now = Date.now(),
): WorkerAccount[] {
  return accounts
    .filter(
      (account) =>
        account.source_provider === "exa" && dataVisible(account, now),
    )
    .map((account) => ({
      ...account,
      contacts: account.contacts.filter(
        (contact) =>
          contact.provider === "peopledatalabs" &&
          dataVisible(
            {
              source_provider: contact.provider,
              license_expires_at: contact.license_expires_at,
            },
            now,
          ),
      ),
    }));
}
