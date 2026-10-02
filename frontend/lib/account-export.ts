import type { Account } from "./types";

export const ACCOUNT_CSV_FIELDS = [
  "name",
  "domain",
  "score",
  "confidence",
  "status",
  "industry",
  "employee_range",
  "location",
  "description",
  "why_fit",
  "why_now",
  "unknowns",
  "score_breakdown",
  "evidence_urls",
  "evidence_snippets",
  "evidence_dates",
  "researched_at",
  "decision_engine",
  "is_demo",
] as const;

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function jsonCell(value: unknown): string {
  return JSON.stringify(value);
}

function accountValues(account: Account): unknown[] {
  return [
    account.name,
    account.domain,
    account.score,
    account.confidence,
    account.status,
    account.industry,
    account.employee_range,
    account.location,
    account.description,
    jsonCell(account.why_fit),
    jsonCell(account.why_now),
    jsonCell(account.unknowns),
    jsonCell(account.score_breakdown),
    jsonCell(account.evidence.map((item) => item.url)),
    jsonCell(account.evidence.map((item) => item.excerpt)),
    jsonCell(
      account.evidence.map((item) => ({
        id: item.id,
        published_at: item.published_at,
        retrieved_at: item.retrieved_at,
      })),
    ),
    account.researched_at,
    account.decision_engine,
    account.is_demo,
  ];
}

export function exportAccountsCsv(accounts: Account[]): string {
  return [
    ACCOUNT_CSV_FIELDS.map(csvCell).join(","),
    ...accounts.map((account) => accountValues(account).map(csvCell).join(",")),
  ].join("\r\n");
}
