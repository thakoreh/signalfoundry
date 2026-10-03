import type { Account, Evidence, Profile } from "./types.ts";

export type CriterionAssessment = {
  key: string;
  label: string;
  expected: string;
  state: "matched" | "not_matched" | "unknown";
  explanation: string;
  evidence: Evidence | null;
};

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[–—]/g, "-");
const canonicalIndustry = (value: string) =>
  ({
    "professional services": "agency",
    "retail & ecommerce": "e-commerce",
    retail: "e-commerce",
    ecommerce: "e-commerce",
    plumbing: "plumbing businesses",
    plumbers: "plumbing businesses",
    veterinary: "veterinary clinics",
    "veterinary clinic": "veterinary clinics",
  })[normalize(value)] ?? normalize(value);
const known = (value: string | null | undefined) =>
  Boolean(
    value && !["unknown", "not available", "n/a"].includes(normalize(value)),
  );
const containsTerm = (text: string, term: string) =>
  new RegExp(
    `(^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(text);

function sourceFor(account: Account, terms: string[]): Evidence | null {
  return (
    account.evidence.find((item) =>
      terms.some((term) => containsTerm(`${item.title} ${item.excerpt}`, term)),
    ) ?? null
  );
}

/** This view explains saved evidence; it never upgrades a heuristic to verified intent. */
export function assessAccount(
  account: Account,
  profile: Profile | null | undefined,
): CriterionAssessment[] {
  if (!profile) return [];
  const rows: CriterionAssessment[] = [];
  if (profile.industries.length) {
    const current = canonicalIndustry(account.industry ?? "");
    const matches = profile.industries.some(
      (term) => canonicalIndustry(term) === current,
    );
    const source = sourceFor(
      account,
      [account.industry ?? "", ...profile.industries].filter(Boolean),
    );
    rows.push({
      key: "industry",
      label: "Business type",
      expected: profile.industries.join(", "),
      state:
        matches && source
          ? "matched"
          : known(account.industry) && !matches
            ? "not_matched"
            : "unknown",
      explanation:
        matches && source
          ? "Company-language match in the saved evidence; independent classification is still unverified."
          : known(account.industry) && !matches
            ? `Reported category is ${account.industry}. Review the source before excluding it.`
            : "The saved sources do not establish this company’s business type.",
      evidence: source,
    });
  }
  for (const [key, label, expected, value] of [
    ["geography", "Geography", profile.geographies, account.location],
    ["size", "Company size", profile.company_sizes, account.employee_range],
  ] as const) {
    if (!expected.length) continue;
    const source = known(value) ? sourceFor(account, [value!]) : null;
    const matches =
      known(value) &&
      expected.some((term) => normalize(term) === normalize(value!));
    rows.push({
      key,
      label,
      expected: expected.join(", "),
      state: source ? (matches ? "matched" : "not_matched") : "unknown",
      explanation: source
        ? `Source reports ${value}; confirm this meets the saved criterion.`
        : "Not established by the saved source. A search filter alone does not verify this criterion.",
      evidence: source,
    });
  }
  if (profile.buyer_roles.length) {
    const source = sourceFor(account, profile.buyer_roles);
    rows.push({
      key: "buyer",
      label: "Buyer role",
      expected: profile.buyer_roles.join(", "),
      state: source ? "matched" : "unknown",
      explanation: source
        ? "The role is mentioned in source language. Decision authority and a reachable person are unverified."
        : "No cited role match. A suggested role is not an identified decision-maker.",
      evidence: source,
    });
  }
  if (profile.keywords.length) {
    const source = sourceFor(account, profile.keywords);
    rows.push({
      key: "criteria",
      label: "Observable match criteria",
      expected: profile.keywords.join(", "),
      state: source ? "matched" : "unknown",
      explanation: source
        ? "Matching language appears in the saved evidence. It does not prove need, budget, or purchase intent."
        : "No cited criterion match in the evidence captured so far.",
      evidence: source,
    });
  }
  if (profile.exclusions.length) {
    const excluded = account.score_breakdown.some(
      (part) => part.label === "Exclusion penalty" && part.points < 0,
    );
    const source = excluded ? sourceFor(account, profile.exclusions) : null;
    rows.push({
      key: "exclusions",
      label: "Hard exclusions",
      expected: profile.exclusions.join(", "),
      state: excluded ? "not_matched" : "unknown",
      explanation: excluded
        ? "An exclusion matched this company’s identity. A high score cannot override it."
        : "No exclusion was detected. Absence from this page does not prove the company is eligible.",
      evidence: source,
    });
  }
  const dated = account.evidence.find(
    (item) =>
      item.kind === "signal" &&
      item.published_at !== null &&
      Number.isFinite(Date.parse(item.published_at)),
  );
  rows.push({
    key: "timing",
    label: "Why now",
    expected: "Dated, relevant buying context",
    state: "unknown",
    explanation: dated
      ? "A publication date is available, but current buying relevance still needs your review."
      : "No dated buying signal is established. Generic hiring, launch, or funding words do not show urgency.",
    evidence: dated ?? null,
  });
  return rows;
}

export function needsResearch(
  account: Account,
  profile: Profile | null | undefined,
): boolean {
  const required = assessAccount(account, profile).filter(
    (row) => row.key !== "timing" && row.key !== "exclusions",
  );
  return (
    required.length === 0 || required.some((row) => row.state !== "matched")
  );
}
