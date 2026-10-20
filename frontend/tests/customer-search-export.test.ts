import test from "node:test";
import assert from "node:assert/strict";
import { customerCsv } from "../components/customer-search-export.ts";
import type { Account } from "../lib/types.ts";

const account: Account = {
  id: "account_test",
  campaign_id: "search_test",
  name: "A Company",
  domain: "company.com",
  description: "Services",
  industry: "Unknown",
  employee_range: "Unknown",
  location: "Unknown",
  score: 25,
  confidence: "low",
  decision_engine: "rules",
  status: "new",
  why_fit: ["Website language matches accounting"],
  why_now: [],
  unknowns: ["Buying intent unknown"],
  is_demo: false,
  researched_at: "2026-10-19T00:00:00Z",
  score_breakdown: [],
  evidence: [
    {
      id: "evidence_test",
      title: "Company website",
      url: "https://company.com/",
      excerpt: "Accounting services",
      kind: "company",
      published_at: null,
      retrieved_at: "2026-10-19T00:00:00Z",
      is_demo: false,
    },
  ],
  contacts: [
    {
      name: "Alex",
      role: "Founder",
      email: "alex@company.com",
      verification_status: "unverified",
      source_url: "https://company.com/team",
      note: "Hunter status: accept_all; validity not established",
    },
  ],
};

test("customer export keeps source and verification status, without upgrading unknowns", () => {
  const csv = customerCsv([account]);
  assert.match(csv, /"email_status"/);
  assert.match(csv, /"unverified"/);
  assert.match(csv, /"https:\/\/company.com\/team"/);
  assert.match(csv, /accept_all; validity not established/);
  assert.match(csv, /Buying intent unknown/);
  assert.doesNotMatch(csv, /"verified"/);
  const absent = customerCsv([{ ...account, contacts: [] }]);
  assert.match(absent, /"not_available"/);
  assert.doesNotMatch(absent, /alex@/);
});

test("customer CSV protects every user and provider field from spreadsheet formulas", () => {
  const csv = customerCsv([
    {
      ...account,
      name: '=HYPERLINK("unsafe")',
      description: " \t+SUM(1,2)",
      contacts: [
        {
          ...account.contacts[0],
          name: "@evil",
          note: "\n=WEBSERVICE('unsafe')",
        },
      ],
    },
  ]);
  assert.match(csv, /"'=HYPERLINK\(""unsafe""\)"/);
  assert.match(csv, /"' \t\+SUM\(1,2\)"/);
  assert.match(csv, /"'@evil"/);
  assert.match(csv, /"'\n=WEBSERVICE/);
});
