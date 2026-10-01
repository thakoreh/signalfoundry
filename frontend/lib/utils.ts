import type { Account, AccountStatus, Evidence } from "./types.ts";
export function tokens(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}
export function filterAccounts(
  accounts: Account[],
  query: string,
  status: AccountStatus | "all",
  fit: string,
  sort: string,
): Account[] {
  const q = query.trim().toLowerCase();
  return accounts
    .filter(
      (a) =>
        (status === "all" || a.status === status) &&
        (fit === "all" || (fit === "high" ? a.score >= 65 : a.score < 65)) &&
        (!q ||
          [a.name, a.domain, a.industry, a.description, a.location].some((v) =>
            v?.toLowerCase().includes(q),
          )),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "score-low"
          ? a.score - b.score
          : b.score - a.score,
    );
}
export function safeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unknown"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}
export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((v) => v[0])
      .join("")
      .toUpperCase() || "CO"
  );
}
export function scoreLabel(score: number) {
  return score >= 65
    ? "Strong fit"
    : score >= 50
      ? "Potential fit"
      : "Explore fit";
}

export function signalCount(evidence: Evidence[]): number {
  return evidence.filter((e) => e.kind === "signal").length;
}
export function sourceCount(evidence: Evidence[]): number {
  return new Set(evidence.map((e) => e.url).filter(Boolean)).size;
}
export function replaceSelectedAccount(
  current: Account | null,
  updated: Account,
): Account | null {
  return current?.id === updated.id ? updated : current;
}
