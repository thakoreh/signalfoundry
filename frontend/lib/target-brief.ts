import type { Profile } from "./types.ts";

/** Transparent, local targeting hypotheses, never sourced company facts. */
export function suggestTargetBrief(
  companyName: string,
  offering: string,
): Profile {
  const text = offering.trim();
  if (!companyName.trim() || text.length < 20)
    throw new Error(
      "Add your product name and at least 20 characters describing who it helps and how.",
    );
  const hypotheses: [RegExp, string[], string[]][] = [
    [
      /\b(sales|pipeline|leads?|prospecting|outbound|crm)\b/i,
      ["Head of Sales", "Revenue Operations"],
      ["sales operations", "business development"],
    ],
    [
      /\b(support|customer service|helpdesk|ticketing)\b/i,
      ["Head of Customer Support", "Customer Success Lead"],
      ["customer support", "customer experience"],
    ],
    [
      /\b(developer|api|engineering|devops|code)\b/i,
      ["Engineering Manager", "CTO"],
      ["software engineering", "developer tools"],
    ],
    [
      /\b(hiring|recruiting|hr|talent)\b/i,
      ["Head of People", "Talent Acquisition Lead"],
      ["recruitment", "human resources"],
    ],
    [
      /\b(finance|accounting|invoice|billing|expense)\b/i,
      ["Finance Director", "Head of Operations"],
      ["finance operations", "accounting"],
    ],
    [
      /\b(marketing|content|seo|advertising)\b/i,
      ["Head of Marketing", "Growth Lead"],
      ["marketing operations", "growth"],
    ],
  ];
  const match = hypotheses.find(([pattern]) => pattern.test(text));
  const explicitIndustries = [
    [/\b(restaurant|hospitality)\b/i, "Hospitality"],
    [/\b(retail|ecommerce|e-commerce)\b/i, "Retail & ecommerce"],
    [/\b(healthcare|clinic|medical)\b/i, "Healthcare services"],
    [/\b(agency|agencies)\b/i, "Professional services"],
    [/\b(saas|software companies)\b/i, "B2B SaaS"],
  ] as const;
  return {
    company_name: companyName.trim(),
    description: text,
    industries: explicitIndustries
      .filter(([pattern]) => pattern.test(text))
      .map(([, industry]) => industry),
    buyer_roles: match?.[1] ?? ["Head of Operations", "Founder"],
    keywords: match?.[2] ?? ["business operations", "workflow improvement"],
    company_sizes: [],
    geographies: [],
    exclusions: [],
  };
}
