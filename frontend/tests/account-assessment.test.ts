import test from "node:test";
import assert from "node:assert/strict";
import { assessAccount, needsResearch } from "../lib/account-assessment.ts";
import type { Account, Profile } from "../lib/types.ts";
const profile: Profile = {
  company_name: "Seller",
  description: "Scheduling for veterinary clinics",
  industries: ["Veterinary clinics"],
  company_sizes: ["11-50"],
  geographies: ["United States"],
  buyer_roles: ["Practice Manager"],
  keywords: ["appointments"],
  exclusions: ["chain hospitals"],
};
const account: Account = {
  id: "a",
  campaign_id: "c",
  name: "Clinic",
  domain: "clinic.example",
  description: "Veterinary clinics with appointments",
  industry: "Veterinary clinics",
  employee_range: "Unknown",
  location: "Unknown",
  score: 80,
  confidence: "low",
  decision_engine: "rules",
  status: "new",
  why_fit: [],
  why_now: [],
  unknowns: [],
  contacts: [],
  is_demo: false,
  researched_at: "2026-10-03",
  score_breakdown: [],
  evidence: [
    {
      id: "e",
      title: "Clinic",
      url: "https://clinic.example",
      excerpt:
        "Veterinary clinics with appointments. Ask the Practice Manager.",
      kind: "company",
      published_at: null,
      retrieved_at: "2026-10-03",
      is_demo: false,
    },
  ],
};
test("unknown hard firmographics stay unknown despite a high search score", () => {
  const rows = assessAccount(account, profile);
  assert.equal(rows.find((row) => row.key === "geography")?.state, "unknown");
  assert.equal(rows.find((row) => row.key === "size")?.state, "unknown");
  assert.equal(needsResearch(account, profile), true);
});
test("matched language links to its actual saved source and does not claim intent", () => {
  const rows = assessAccount(account, profile);
  for (const key of ["industry", "buyer", "criteria"]) {
    const row = rows.find((item) => item.key === key)!;
    assert.equal(row.state, "matched");
    assert.equal(row.evidence?.id, "e");
  }
  assert.match(
    rows.find((row) => row.key === "criteria")!.explanation,
    /does not prove/,
  );
});
test("generic signal words cannot become verified urgency", () => {
  const dated = {
    ...account,
    evidence: [
      {
        ...account.evidence[0],
        kind: "signal" as const,
        published_at: "2026-10-01",
        excerpt: "We are hiring",
      },
    ],
  };
  assert.equal(
    assessAccount(dated, profile).find((row) => row.key === "timing")?.state,
    "unknown",
  );
});
test("search output fields without source evidence are not verified firmographics", () => {
  const sourced = {
    ...account,
    location: "United States",
    employee_range: "11-50",
  };
  const rows = assessAccount(sourced, profile);
  assert.equal(rows.find((row) => row.key === "geography")?.state, "unknown");
  assert.equal(rows.find((row) => row.key === "size")?.state, "unknown");
});
test("an explicit hard exclusion is a non-match and cannot be overridden by score", () => {
  const rows = assessAccount(
    {
      ...account,
      score_breakdown: [
        {
          label: "Exclusion penalty",
          points: -100,
          max_points: 0,
          reason: "Excluded company identity",
        },
      ],
    },
    profile,
  );
  assert.equal(
    rows.find((row) => row.key === "exclusions")?.state,
    "not_matched",
  );
});
test("keyword boundaries avoid accidental substring evidence", () => {
  const rows = assessAccount(account, { ...profile, keywords: ["point"] });
  assert.equal(rows.find((row) => row.key === "criteria")?.state, "unknown");
});
test("missing profile keeps assessment unknown and never invents criteria", () => {
  assert.deepEqual(assessAccount(account, null), []);
  assert.equal(needsResearch(account, null), true);
});

test("retail industry aliases agree with backend canonical scoring", () => {
  const retail = {
    ...account,
    industry: "E-commerce",
    evidence: [
      { ...account.evidence[0], excerpt: "E-commerce retail business" },
    ],
  };
  const rows = assessAccount(retail, {
    ...profile,
    industries: ["Retail & ecommerce"],
  });
  assert.equal(rows.find((row) => row.key === "industry")?.state, "matched");
});
