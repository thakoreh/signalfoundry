import type { Profile } from "./types.ts";

export type AudienceHypothesis = {
  id: string;
  label: string;
  source: string;
  buyerRoles: string[];
  keywords: string[];
};

type AudienceRule = {
  id: string;
  label: string;
  pattern: RegExp;
  buyerRoles: string[];
  keywords: string[];
};

// These are transparent language rules, not AI understanding or customer facts.
// A seller's category is never a buyer segment without an explicit buyer clause.
const audiences: AudienceRule[] = [
  {
    id: "plumbing",
    label: "Plumbing businesses",
    pattern: /\bplumb(?:er(?:s)?|ing)\b/i,
    buyerRoles: ["Owner", "Operations Manager"],
    keywords: ["plumbing", "service area"],
  },
  {
    id: "veterinary",
    label: "Veterinary clinics",
    pattern: /\b(?:veterinar(?:y|ian(?:s)?)|vet(?:s)?)\b/i,
    buyerRoles: ["Practice Manager", "Owner"],
    keywords: ["veterinary", "appointments"],
  },
  {
    id: "hospitality",
    label: "Hospitality",
    pattern: /\b(?:restaurant(?:s)?|hospitality|hotel(?:s)?)\b/i,
    buyerRoles: ["Owner", "Operations Manager"],
    keywords: ["restaurant", "hospitality"],
  },
  {
    id: "retail",
    label: "Retail & ecommerce",
    pattern: /\b(?:retail(?:er(?:s)?)?|ecommerce|e-commerce|online stores?)\b/i,
    buyerRoles: ["Head of Operations", "Owner"],
    keywords: ["retail", "ecommerce"],
  },
  {
    id: "healthcare",
    label: "Healthcare services",
    pattern: /\b(?:healthcare|clinics?|medical|dental|dentists?)\b/i,
    buyerRoles: ["Practice Manager", "Operations Director"],
    keywords: ["patient", "appointments"],
  },
  {
    id: "agencies",
    label: "Professional services",
    pattern: /\b(?:agency|agencies|consultancies)\b/i,
    buyerRoles: ["Founder", "Head of Operations"],
    keywords: ["client services", "projects"],
  },
  {
    id: "fintech",
    label: "Financial technology",
    pattern: /\b(?:fintech|financial technology)\b/i,
    buyerRoles: ["Head of Operations", "CTO"],
    keywords: ["fintech", "payments"],
  },
  {
    id: "saas",
    label: "B2B SaaS",
    pattern: /\b(?:saas|software companies|software teams)\b/i,
    buyerRoles: ["Founder", "Head of Operations"],
    keywords: ["software", "business customers"],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    pattern: /\b(?:manufactur(?:ing|ers?)|factories|industrial companies)\b/i,
    buyerRoles: ["Operations Director", "Plant Manager"],
    keywords: ["manufacturing", "production"],
  },
  {
    id: "legal",
    label: "Legal services",
    pattern: /\b(?:law firms?|lawyers?|legal teams)\b/i,
    buyerRoles: ["Managing Partner", "Practice Manager"],
    keywords: ["legal services", "clients"],
  },
];

const functions: [RegExp, string[], string[]][] = [
  [
    /\b(?:sales|revenue|prospecting|outbound|crm)\b/i,
    ["Head of Sales", "Revenue Operations"],
    ["sales operations", "business development"],
  ],
  [
    /\b(?:support|customer service|helpdesk|ticketing)\b/i,
    ["Head of Customer Support", "Customer Success Lead"],
    ["customer support", "customer experience"],
  ],
  [
    /\b(?:developer|engineering|devops|observability)\b/i,
    ["Engineering Manager", "CTO"],
    ["software engineering", "reliability"],
  ],
  [
    /\b(?:hiring|recruiting|hr|talent)\b/i,
    ["Head of People", "Talent Acquisition Lead"],
    ["recruitment", "human resources"],
  ],
  [
    /\b(?:finance|accounting|invoice|billing|expense)\b/i,
    ["Finance Director", "Head of Operations"],
    ["finance operations", "accounting"],
  ],
  [
    /\b(?:marketing|content|seo|advertising)\b/i,
    ["Head of Marketing", "Growth Lead"],
    ["marketing operations", "growth"],
  ],
];

function negativeClauses(text: string): string[] {
  return [
    ...text.matchAll(
      /\b(?:not(?!\s+(?:just|only)\b)|excluding|exclude|except)\s+([^.!?;,]{2,100})/gi,
    ),
  ].map((match) => match[1].trim());
}

function directBuyerClause(value: string): string {
  // A buyer can serve another industry. Keep the immediate beneficiary, not
  // that beneficiary's customer: "help agencies serve plumbers" => agencies.
  return value
    .split(
      /\s+(?:serv(?:e|es|ing)|sell(?:s|ing)?|reach(?:es|ing)?|help(?:s|ing)?|build(?:s|ing)?|improv(?:e|es|ing)|automate(?:s)?|manage(?:s)?|with us)\b/i,
      1,
    )[0]
    .trim();
}

export function explicitAudienceText(offering: string): string {
  const positive = offering.replace(
    /\b(?:not(?!\s+(?:just|only)\b)|excluding|exclude|except)\s+[^.!?;,]{2,100}/gi,
    " ",
  );
  return [
    ...positive.matchAll(
      /\b(?:for|to|helps?|serving|serves?|targeting)\s+([^.!?;]{2,180})/gi,
    ),
  ]
    .map((match) => directBuyerClause(match[1]))
    .join("; ");
}

export function audienceHypotheses(
  offering: string,
  explicitBuyer = "",
): AudienceHypothesis[] {
  const source = explicitBuyer.trim()
    ? directBuyerClause(explicitBuyer.trim())
    : explicitAudienceText(offering);
  if (!source) return [];
  const functionMatch = functions.find(([pattern]) => pattern.test(source));
  return audiences
    .filter((rule) => rule.pattern.test(source))
    .filter(
      (rule) =>
        rule.id !== "healthcare" || !/\b(?:veterinary|vet)\b/i.test(source),
    )
    .slice(0, 3)
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      source,
      buyerRoles: [...(functionMatch?.[1] ?? rule.buyerRoles)],
      keywords: [...(functionMatch?.[2] ?? rule.keywords)],
    }));
}

/** Editable hypotheses only. Unknown buyer criteria stay empty. */
export function suggestTargetBrief(
  companyName: string,
  offering: string,
  explicitBuyer = "",
  selectedAudience?: string,
): Profile {
  const text = offering.trim();
  if (!companyName.trim() || text.length < 20)
    throw new Error(
      "Add your product name and at least 20 characters describing who it helps and how.",
    );
  const hypotheses = audienceHypotheses(text, explicitBuyer);
  const selected =
    hypotheses.find((item) => item.id === selectedAudience) ?? hypotheses[0];
  const buyerText = explicitBuyer.trim() || explicitAudienceText(text);
  const role = functions.find(([pattern]) => pattern.test(buyerText));
  const geographies = [
    [/\b(?:US|USA)\b|\b[Uu]nited [Ss]tates\b|\bU\.S\./, "United States"],
    [/\bUK\b|\b[Uu]nited [Kk]ingdom\b/, "United Kingdom"],
    [/\bCanada\b/i, "Canada"],
    [/\bAustralia\b/i, "Australia"],
  ] as const;
  return {
    company_name: companyName.trim(),
    description: text,
    industries: selected ? [selected.label] : [],
    buyer_roles: selected?.buyerRoles ?? [...(role?.[1] ?? [])],
    keywords: selected?.keywords ?? [...(role?.[2] ?? [])],
    company_sizes: [],
    geographies: geographies
      .filter(([pattern]) => pattern.test(buyerText))
      .map(([, label]) => label),
    exclusions: negativeClauses(text),
  };
}
