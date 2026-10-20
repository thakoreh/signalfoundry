import type { Account } from "../lib/types.ts";
import { normalizeBusinessWebsite } from "../lib/business-intake.ts";

/** Display-only review of existing research; never rewrites the saved run. */
export function qualifiedCustomerAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      !account.is_demo &&
      account.score_breakdown.some(
        (part) => part.label === "Customer-type language" && part.points >= 60,
      ) &&
      !account.score_breakdown.some(
        (part) => part.label === "Exclusion penalty",
      ) &&
      account.evidence.some(
        (item) =>
          !item.is_demo &&
          ["company", "fit"].includes(item.kind) &&
          Boolean(normalizeBusinessWebsite(item.url)),
      ),
  );
}

export function groundedCustomerReason(account: Account): string {
  const observation = account.score_breakdown
    .find(
      (part) => part.label === "Customer-type language" && part.points >= 60,
    )
    ?.reason?.trim();
  if (
    observation &&
    !/retrieved|fetched|supplied target|provided target|target profile|not a confirmed|does not establish/i.test(
      observation,
    )
  )
    return observation;
  const reason = account.why_fit.find(
    (item) =>
      item.trim() &&
      !/retrieved|fetched|supplied target|provided target|customer profile|target profile|not a confirmed|does not establish/i.test(
        item,
      ),
  );
  if (reason) return reason;
  const excerpt = account.evidence.find(
    (item) => item.kind === "fit" && !item.is_demo && item.excerpt.trim(),
  )?.excerpt;
  return excerpt
    ? `Website mentions: “${excerpt.slice(0, 200)}”`
    : "Its public website describes the customer type you’re looking for.";
}

export type CustomerMessageDraft = {
  subject: string;
  body: string;
  evidence_ids: string[];
  warnings: string[];
  generation_engine: "deepseek";
  created_at: string;
};

/** A template or malformed response must never acquire the AI draft label. */
export function isCustomerMessageDraft(
  value: unknown,
): value is CustomerMessageDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<CustomerMessageDraft>;
  return (
    draft.generation_engine === "deepseek" &&
    typeof draft.subject === "string" &&
    Boolean(draft.subject.trim()) &&
    typeof draft.body === "string" &&
    Boolean(draft.body.trim()) &&
    Array.isArray(draft.evidence_ids) &&
    draft.evidence_ids.length > 0 &&
    draft.evidence_ids.every((id) => typeof id === "string") &&
    Array.isArray(draft.warnings) &&
    draft.warnings.every((warning) => typeof warning === "string") &&
    typeof draft.created_at === "string"
  );
}
