import { appError } from "./errors";
import type { Profile, WorkerAccount } from "../validators";

export function text(value: string, label: string, max = 240): string {
  const result = value.trim();
  if (
    !result ||
    result.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)
  ) {
    throw appError(
      "VALIDATION_ERROR",
      `${label} must contain 1–${max} characters without control characters`,
    );
  }
  return result;
}
export function validateProfile(value: Profile): Profile {
  const list = (items: string[], label: string, max: number) => {
    if (items.length > max)
      throw appError(
        "VALIDATION_ERROR",
        `${label} allows at most ${max} entries`,
      );
    return items.map((item) => text(item, label));
  };
  return {
    company_name: text(value.company_name, "Company name"),
    description: text(value.description, "Description", 3000),
    industries: list(value.industries, "Industries", 12),
    company_sizes: list(value.company_sizes, "Company sizes", 12),
    geographies: list(value.geographies, "Geographies", 12),
    buyer_roles: list(value.buyer_roles, "Buyer roles", 12),
    keywords: list(value.keywords, "Keywords", 20),
    exclusions: list(value.exclusions, "Exclusions", 20),
  };
}
export function normalizeWebsite(input: string): string {
  const value = text(input, "Website", 2048);
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw appError("VALIDATION_ERROR", "Enter a valid public business website");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    host.startsWith("[") ||
    /(^|\.)(localhost|local|internal|invalid|example|test|onion|home|lan|arpa)$/.test(
      host,
    )
  ) {
    throw appError(
      "VALIDATION_ERROR",
      "Use a public business HTTP(S) domain without credentials or a custom port",
    );
  }
  url.hostname = host;
  url.hash = "";
  return url.toString();
}
export function normalizeDomains(
  mode: "demo" | "manual" | "discovery",
  domains: string[],
): string[] {
  if (
    domains.length > 10 ||
    (mode !== "manual" && domains.length) ||
    (mode === "manual" && !domains.length)
  ) {
    throw appError(
      "VALIDATION_ERROR",
      "Manual campaigns require 1–10 public domains; demo campaigns use no domains",
    );
  }
  const normalized = domains.map(
    (domain) => new URL(normalizeWebsite(domain)).origin,
  );
  if (new Set(normalized).size !== normalized.length)
    throw appError("VALIDATION_ERROR", "Remove duplicate domains");
  return normalized;
}
export function boundedLimit(
  value: number | undefined,
  fallback = 50,
  max = 100,
): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw appError("VALIDATION_ERROR", `Limit must be between 1 and ${max}`);
  return value;
}
export function validateResearchResult(
  accounts: WorkerAccount[],
  errors: string[],
  campaignId: string,
  mode: "demo" | "manual" | "discovery",
) {
  if (accounts.length > (mode === "discovery" ? 30 : 10) || errors.length > 20)
    throw appError("RESEARCH_FAILED", "Worker result exceeds allowed size");
  const domains = new Set<string>();
  for (const row of accounts) {
    if (
      row.campaign_id !== campaignId ||
      row.is_demo !== (mode === "demo") ||
      !Number.isInteger(row.score) ||
      row.score < 0 ||
      row.score > 100
    ) {
      throw appError(
        "RESEARCH_FAILED",
        "Worker returned inconsistent account metadata",
      );
    }
    if (
      mode === "discovery" &&
      (row.source_provider !== "exa" ||
        !row.license_reference ||
        !row.license_expires_at ||
        !Number.isFinite(Date.parse(row.license_expires_at)) ||
        Date.parse(row.license_expires_at) <= Date.now())
    )
      throw appError(
        "RESEARCH_FAILED",
        "Discovery data requires a current source license and retention deadline",
      );
    for (const contact of row.contacts) {
      if (mode === "discovery" && contact.provider !== "peopledatalabs")
        throw appError(
          "RESEARCH_FAILED",
          "Discovery contacts require named provider provenance",
        );
      if (
        contact.provider &&
        (!contact.license_reference ||
          !contact.license_expires_at ||
          !Number.isFinite(Date.parse(contact.license_expires_at)) ||
          Date.parse(contact.license_expires_at) <= Date.now())
      )
        throw appError(
          "RESEARCH_FAILED",
          "Contact data requires a current license and retention deadline",
        );
      if (
        contact.verification_status === "verified" &&
        (!contact.email ||
          contact.email_status !== "valid" ||
          !contact.email_checked_at ||
          !contact.email_verification_provider)
      )
        throw appError(
          "RESEARCH_FAILED",
          "Verified email requires independent verification evidence",
        );
    }
    text(row.domain, "Account domain", 253);
    if (mode !== "demo") normalizeWebsite(row.domain);
    if (domains.has(row.domain.toLowerCase()))
      throw appError("RESEARCH_FAILED", "Worker returned duplicate domains");
    domains.add(row.domain.toLowerCase());
    if (
      mode === "demo" &&
      (!row.domain.endsWith(".example") ||
        row.contacts.some((item) => item.email !== null))
    ) {
      throw appError(
        "RESEARCH_FAILED",
        "Fictional accounts must use .example and cannot contain emails",
      );
    }
    if (
      row.evidence.length > 20 ||
      row.contacts.length > 10 ||
      row.score_breakdown.length > 20 ||
      row.why_fit.length > 20 ||
      row.why_now.length > 20 ||
      row.unknowns.length > 30
    ) {
      throw appError(
        "RESEARCH_FAILED",
        "Worker result exceeds allowed field limits",
      );
    }
    for (const item of row.evidence) {
      if (item.is_demo !== row.is_demo)
        throw appError("RESEARCH_FAILED", "Evidence fiction label mismatch");
      const url = new URL(item.url);
      if (mode !== "demo") normalizeWebsite(item.url);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw appError("RESEARCH_FAILED", "Invalid evidence URL");
    }
    for (const part of row.score_breakdown) {
      if (
        !Number.isInteger(part.points) ||
        !Number.isInteger(part.max_points) ||
        Math.abs(part.points) > 100 ||
        part.max_points < 0 ||
        part.max_points > 100
      ) {
        throw appError("RESEARCH_FAILED", "Invalid score component");
      }
    }
    // Bound every text field, including nested worker/provider output.
    const inspect = (value: unknown): void => {
      if (
        typeof value === "string" &&
        (value.length > 6000 ||
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
      )
        throw appError("RESEARCH_FAILED", "Invalid worker text");
      if (Array.isArray(value)) value.forEach(inspect);
      else if (value && typeof value === "object")
        Object.values(value).forEach(inspect);
    };
    inspect(row);
  }
  errors.forEach((error) => text(error, "Research error", 1000));
}
