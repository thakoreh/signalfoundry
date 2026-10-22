import type { Account } from "../lib/types.ts";
import { csvCell } from "../lib/account-export.ts";
import { isSharedInbox } from "../lib/customer-search.ts";

/** One row per contact, retaining unknown contact fields and source provenance. */
export function customerCsv(accounts: Account[]): string {
  const rows: unknown[][] = [
    [
      "company",
      "website",
      "description",
      "website_match_score",
      "confidence",
      "why_fit",
      "source_urls",
      "contact_name",
      "contact_role",
      "email",
      "email_status",
      "inbox_type",
      "contact_source",
      "verification_note",
      "unknowns",
      "researched_at",
    ],
  ];
  for (const account of accounts) {
    for (const contact of account.contacts.length ? account.contacts : [null]) {
      rows.push([
        account.name,
        `https://${account.domain}`,
        account.description,
        account.score,
        account.confidence,
        account.why_fit.join(" | "),
        [...new Set(account.evidence.map((item) => item.url))].join(" | "),
        contact?.name || "",
        contact?.role || "",
        contact?.email || "",
        contact?.verification_status || "not_available",
        contact?.email ? isSharedInbox(contact.email) ? "shared_inbox" : "business_address" : "unknown",
        contact?.source_url || "",
        contact?.note || "",
        account.unknowns.join(" | "),
        account.researched_at,
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
