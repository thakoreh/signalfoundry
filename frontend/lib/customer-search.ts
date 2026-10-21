import type { Account } from "./types.ts";

export type CustomerEngine = {
  monetary?: { status: "blocked" | "admission_required"; detail: string; historical_usage_known: boolean };
  discovery: {
    provider: string;
    status: "ready" | "unconfigured" | "unavailable";
    detail: string;
  };
  contacts: {
    provider: string;
    status: "ready" | "unconfigured" | "unavailable";
    detail: string;
  };
  max_results: number;
};
export type CustomerSearchRun = {
  id: string;
  status: "queued" | "running" | "complete" | "partial" | "failed";
  stage: string;
  query: string;
  accounts: Account[];
  errors: string[];
  created_at: string;
  updated_at: string;
};
export type CustomerSort = "contacts" | "score" | "name";
export const validCustomerSearchId = (value: string) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const customerSearchPath = (id: string) =>
  `/workspace/customers/${encodeURIComponent(id)}`;
export const searchInProgress = (search: CustomerSearchRun | null) =>
  Boolean(search && ["queued", "running"].includes(search.status));
export const hasContactEmail = (account: Account) =>
  account.contacts.some((contact) => Boolean(contact.email?.trim()));
export const customerContactRank = (account: Account) =>
  account.contacts.some(
    (contact) =>
      contact.email?.trim() && contact.verification_status === "verified",
  )
    ? 2
    : hasContactEmail(account)
      ? 1
      : 0;

/** Verified, published unverified, and absent emails stay distinct; no status is upgraded. */
export function orderCustomerAccounts(
  accounts: Account[],
  sort: CustomerSort = "contacts",
): Account[] {
  return accounts
    .map((account, index) => ({ account, index }))
    .sort((left, right) => {
      let difference = 0;
      if (sort === "contacts")
        difference =
          customerContactRank(right.account) -
            customerContactRank(left.account) ||
          right.account.score - left.account.score;
      if (sort === "score")
        difference = right.account.score - left.account.score;
      if (sort === "name")
        difference = left.account.name.localeCompare(right.account.name, "en", {
          sensitivity: "base",
        });
      return (
        difference ||
        left.account.name.localeCompare(right.account.name, "en", {
          sensitivity: "base",
        }) ||
        left.account.id.localeCompare(right.account.id, "en") ||
        left.index - right.index
      );
    })
    .map(({ account }) => account);
}

export function selectedCustomerAccounts(
  accounts: Account[],
  selection: ReadonlySet<string>,
  sort: CustomerSort,
): Account[] {
  return orderCustomerAccounts(accounts, sort).filter((account) =>
    selection.has(account.id),
  );
}

export function customerResearchDetails(errors: string[]): string[] {
  return [
    ...new Set(
      errors.map((error) => {
        if (/403|forbidden|blocked|access denied/i.test(error))
          return "A company website limited automated access, so some public facts could not be checked.";
        if (/timeout|timed out/i.test(error))
          return "A research source took too long to respond.";
        if (/contact|email|hunter/i.test(error))
          return "Some contact details could not be looked up or verified.";
        return "A research source was unavailable. The available company research is still shown.";
      }),
    ),
  ];
}

export function publicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
