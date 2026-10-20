import type { Account, WorkspaceData } from "../lib/types";
import type { CustomerSearchRun } from "../lib/customer-search";
export const fixtureWorkspace: WorkspaceData = {
  id: "workspace_a",
  name: "Business",
  website: "https://example.com",
  created_at: "2026-10-19",
  profile: {
    company_name: "Business",
    description: "Software",
    industries: ["B2B SaaS", "Developer tools", "Agencies"],
    geographies: ["Canada"],
    company_sizes: [],
    buyer_roles: [],
    keywords: [],
    exclusions: [],
  },
};
export function fixtureAccount(
  id: string,
  score: number,
  email: "verified" | "unverified" | null = null,
): Account {
  return {
    id,
    name: id,
    domain: `${id}.company.com`,
    score,
    campaign_id: "search_a",
    description: "A test business",
    industry: null,
    employee_range: null,
    location: null,
    confidence: "low",
    decision_engine: "rules",
    status: "new",
    why_fit: ["Matches the customer profile"],
    why_now: [],
    unknowns: ["Buying intent is unknown"],
    evidence: [
      {
        id: `${id}-source`,
        title: "Company homepage",
        url: `https://${id}.company.com/`,
        excerpt: "B2B software for developer teams",
        kind: "company",
        published_at: null,
        retrieved_at: "2026-10-19",
        is_demo: false,
      },
    ],
    contacts: email
      ? [
          {
            name: null,
            role: "Business contact",
            email: `info@${id}.example`,
            verification_status: email,
            source_url: null,
            note: "Test contact",
          },
        ]
      : [],
    is_demo: false,
    researched_at: "2026-10-19",
    score_breakdown: [
      {
        label: "Customer-type language",
        points: 60,
        max_points: 60,
        reason: "Its homepage describes B2B software for developer teams.",
      },
    ],
  };
}
export function fixtureRun(
  status: CustomerSearchRun["status"] = "complete",
): CustomerSearchRun {
  return {
    id: "search_a",
    status,
    stage:
      status === "queued"
        ? "Queued"
        : status === "running"
          ? "Finding businesses and checking public facts"
          : "Search finished",
    query: "B2B SaaS, Developer tools, Agencies in Canada",
    accounts:
      status === "queued" || status === "running"
        ? []
        : [
            fixtureAccount("absent", 100),
            fixtureAccount("unverified", 99, "unverified"),
            fixtureAccount("verified", 10, "verified"),
          ],
    errors: [],
    created_at: "2026-10-19",
    updated_at: "2026-10-19",
  };
}
