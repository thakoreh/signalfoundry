import type { Profile, WorkerAccount } from "../validators";

// Fictional fixtures only; reserved domains and no invented personal contacts.
export const DEMO_PROFILE: Profile = {
  company_name: "SignalFoundry Demo",
  description:
    "Fictional demo company helping B2B SaaS teams research qualified accounts. Edit these starter ICP rules to explore scoring.",
  industries: ["B2B SaaS", "Developer tools"],
  company_sizes: ["11–50", "51–200"],
  geographies: ["United States", "United Kingdom"],
  buyer_roles: ["VP Sales", "Head of Growth", "Revenue Operations"],
  keywords: ["sales", "workflow", "automation", "pipeline", "developer"],
  exclusions: ["consumer retail", "agency"],
};
const FIXTURES = [
  {
    name: "Atlas Workflow",
    domain: "atlasworkflow.example",
    industry: "B2B SaaS",
    employee_range: "51–200",
    location: "United States",
    description:
      "Fictional B2B SaaS company building workflow automation for sales and revenue teams.",
    text: "Atlas Workflow: B2B SaaS workflow automation for sales pipeline teams. VP Sales, Head of Growth, Revenue Operations. We are hiring and expanding our developer platform.",
  },
  {
    name: "RelayStack",
    domain: "relaystack.example",
    industry: "Developer tools",
    employee_range: "11–50",
    location: "United Kingdom",
    description:
      "Fictional developer platform for integrating revenue workflows.",
    text: "RelayStack developer tools connect workflow automation to sales pipeline data. Built for Head of Growth and Revenue Operations. Our new product launch helps developer teams.",
  },
  {
    name: "Northstar Metrics",
    domain: "northstarmetrics.example",
    industry: "B2B SaaS",
    employee_range: "51–200",
    location: "United States",
    description:
      "Fictional B2B SaaS analytics workspace for go-to-market teams.",
    text: "Northstar Metrics B2B SaaS sales pipeline analytics and workflow collaboration. Built for VP Sales and Revenue Operations. Explore our platform.",
  },
  {
    name: "Harbor API",
    domain: "harborapi.example",
    industry: "Developer tools",
    employee_range: "11–50",
    location: "Canada",
    description: "Fictional developer tools business offering API monitoring.",
    text: "Harbor API developer tools provide workflow automation and API monitoring. Our team is hiring engineers for a new product launch.",
  },
  {
    name: "Clearpath Ops",
    domain: "clearpathops.example",
    industry: "B2B SaaS",
    employee_range: "201–500",
    location: "Germany",
    description: "Fictional operations software for service teams.",
    text: "Clearpath Ops B2B SaaS workflow automation for service organizations and Revenue Operations teams. Learn about our services.",
  },
  {
    name: "Fern Studio",
    domain: "fernstudio.example",
    industry: "Agency",
    employee_range: "11–50",
    location: "United Kingdom",
    description: "Fictional creative agency serving local consumer brands.",
    text: "Fern Studio is a creative agency focused on consumer retail design. Branding, identity and retail experiences.",
  },
  {
    name: "Cedar Market",
    domain: "cedarmarket.example",
    industry: "Consumer retail",
    employee_range: "11–50",
    location: "United States",
    description: "Fictional consumer retail business selling home accessories.",
    text: "Cedar Market consumer retail accessories for your home. Shop kitchen, garden and interior collections.",
  },
  {
    name: "Summit Supply",
    domain: "summitsupply.example",
    industry: "Manufacturing",
    employee_range: "201–500",
    location: "Australia",
    description: "Fictional industrial components supplier.",
    text: "Summit Supply manufactures durable industrial parts. Explore our catalog and services for factory maintenance teams.",
  },
];
const INDUSTRY_TERMS: Record<string, string[]> = {
  "B2B SaaS": ["saas", "b2b", "software as a service"],
  "Developer tools": ["developer", "api", "sdk"],
  "Financial technology": ["fintech", "payments", "financial technology"],
  "Healthcare technology": ["healthcare", "clinical", "patient"],
  "E-commerce": ["ecommerce", "e-commerce", "online store"],
  Manufacturing: ["manufacturing", "industrial", "factory"],
  Agency: ["agency", "consultancy"],
};
const SIGNAL_TERMS = [
  "hiring",
  "new product",
  "launch",
  "expanding",
  "funding",
  "partnership",
];
const matches = (term: string, text: string) =>
  new RegExp(
    `(?<!\\w)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`,
    "i",
  ).test(text);
export function demoAccounts(
  profile: Profile,
  campaignId: string,
  timestamp: string,
): WorkerAccount[] {
  return FIXTURES.map((fixture, index) => {
    const keywords = profile.keywords.filter((term) =>
      matches(term, fixture.text),
    );
    const industries = profile.industries.filter(
      (term) =>
        matches(term, fixture.text) ||
        (INDUSTRY_TERMS[term] ?? []).some((alias) =>
          matches(alias, fixture.text),
        ),
    );
    const roles = profile.buyer_roles.filter((term) =>
      matches(term, fixture.text),
    );
    const signals = SIGNAL_TERMS.filter((term) => matches(term, fixture.text));
    const exclusions = profile.exclusions.filter((term) =>
      matches(term, fixture.text),
    );
    const part = (
      label: string,
      actual: string[],
      targets: string[],
      max_points: number,
      cap: number,
    ) => ({
      label,
      max_points,
      points: targets.length
        ? Math.round(
            max_points *
              Math.min(actual.length / Math.min(targets.length, cap), 1),
          )
        : 0,
      reason: !targets.length
        ? "No targeting rules configured; no points awarded"
        : actual.length
          ? `Website text matches: ${actual.join(", ")}`
          : "No matching website text found",
    });
    const score_breakdown = [
      part("Keyword fit", keywords, profile.keywords, 40, 4),
      part("Industry language", industries, profile.industries, 25, 1),
      part("Buyer-role language", roles, profile.buyer_roles, 15, 2),
      part("Observable signals", signals, SIGNAL_TERMS, 20, 2),
    ];
    if (exclusions.length)
      score_breakdown.push({
        label: "Exclusion penalty",
        points: -50,
        max_points: 0,
        reason: `Excluded website language: ${exclusions.join(", ")}`,
      });
    const why_fit = score_breakdown
      .slice(0, 3)
      .filter((p) => p.points > 0)
      .map((p) => p.reason);
    if (exclusions.length)
      why_fit.push(`Exclusion penalty applied: ${exclusions.join(", ")}`);
    const url = `https://${fixture.domain}/`;
    return {
      id: `demo_${index}`,
      campaign_id: campaignId,
      name: fixture.name,
      domain: fixture.domain,
      description: fixture.description,
      industry: fixture.industry,
      employee_range: fixture.employee_range,
      location: fixture.location,
      score: Math.max(
        0,
        Math.min(
          100,
          score_breakdown.reduce((sum, p) => sum + p.points, 0),
        ),
      ),
      confidence: keywords.length && industries.length ? "medium" : "low",
      decision_engine: "rules",
      status: "new",
      why_fit: why_fit.length
        ? why_fit
        : ["No configured ICP language matched the available page text"],
      why_now: signals.length
        ? signals
            .slice(0, 3)
            .map(
              (s) =>
                `Website mentions “${s}”; timing and current relevance are unverified`,
            )
        : ["No timely buying signal established from this page"],
      unknowns: [
        "All company details and evidence are fictional demo fixtures",
        "No contact-enrichment provider is configured; people and email addresses are unavailable",
        "Budget, buying intent, and decision authority are unknown",
        "Publication dates and the recency of website statements are unknown",
        "Company size and geography do not contribute to the score",
      ],
      evidence: [
        {
          id: `demo_ev_${index}`,
          title: `Fictional demo: ${fixture.name}`,
          url,
          excerpt: `Fictional fixture. ${fixture.text}`,
          kind: "company",
          published_at: null,
          retrieved_at: timestamp,
          is_demo: true,
        },
      ],
      contacts: [
        {
          name: null,
          role: profile.buyer_roles[0] ?? "Relevant decision-maker",
          email: null,
          verification_status: "not_available",
          source_url: null,
          note: "Suggested role to research, not an identified person. Contact provider is not configured.",
        },
      ],
      is_demo: true,
      researched_at: timestamp,
      score_breakdown,
    };
  });
}
