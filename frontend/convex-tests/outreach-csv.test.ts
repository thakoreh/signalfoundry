import { describe, expect, it } from "vitest";
import type { Account, Profile } from "../lib/types";
import { makeGroundedDraft } from "../convex/lib/outreach";
import { exportAccountsCsv } from "../lib/account-export";

const profile: Profile = {
  company_name: "Grand River AI",
  description: "Editable supplier profile; not target evidence.",
  industries: ["Agency"],
  company_sizes: ["11–50"],
  geographies: ["Canada"],
  buyer_roles: ["Founder"],
  keywords: ["automation"],
  exclusions: [],
};

const account: Account = {
  id: "a1",
  campaign_id: "c1",
  name: "Airtable: Build Enterprise-ready AI Workflows, Apps & Agents",
  domain: "www.airtable.com",
  description: "500,000+ brands use Airtable to enable real-time collaboration and automate repetitive work.",
  industry: "Unknown",
  employee_range: "Unknown",
  location: "Unknown",
  score: 0,
  confidence: "low",
  decision_engine: "jev",
  status: "new",
  why_fit: ["Jev qualification is unknown; no qualified fit established"],
  why_now: ["Website mentions launch; timing and current relevance are unverified"],
  unknowns: ["Budget, buying intent, and decision authority are unknown"],
  evidence: [
    {
      id: "ev_company",
      title: "Airtable home",
      url: "https://www.airtable.com/",
      excerpt: "500,000+ brands use Airtable to enable real-time collaboration and automate repetitive work.",
      kind: "company",
      published_at: null,
      retrieved_at: "2026-10-01T22:30:38.057161Z",
      is_demo: false,
    },
    {
      id: "ev_fit",
      title: "Website language: integrations",
      url: "https://www.airtable.com/",
      excerpt: "…-end workflows What's New See Airtable's latest product updates Back Integrations.",
      kind: "fit",
      published_at: "2026-09-30",
      retrieved_at: "2026-10-01T22:30:38.057161Z",
      is_demo: false,
    },
  ],
  contacts: [],
  is_demo: false,
  researched_at: "2026-10-01T22:30:38.057161Z",
  score_breakdown: [
    {
      label: "Jev ICP fit",
      points: 0,
      max_points: 100,
      reason: "Qualification unknown overrides the returned fit score.",
    },
  ],
};

describe("grounded outreach and account export utilities", () => {
  it("uses a complete company sentence and warns when fit is unconfirmed", () => {
    const draft = makeGroundedDraft(account, profile);
    expect(draft.subject).toBe("A question for Airtable");
    expect(draft.body).toContain(
      "500,000+ brands use Airtable to enable real-time collaboration and automate repetitive work.",
    );
    expect(draft.body).not.toContain("Back Integrations");
    expect(draft.body).not.toContain("…");
    expect(draft.body).not.toMatch(/funding|hiring|contact person|buying intent/i);
    expect(draft.warning).toContain("Fit is unconfirmed");
  });

  it("exports evidence URLs, snippets, dates, explanations, confidence, and engine safely", () => {
    const dangerous = {
      ...account,
      description: "=HYPERLINK(\"https://evil.example\")",
      why_fit: ["+positive-looking claim"],
      unknowns: ["@unknown claim"],
      evidence: account.evidence.map((item) => ({
        ...item,
        excerpt: "-formula-like source text",
      })),
    };
    const csv = exportAccountsCsv([dangerous]);
    const header = csv.split("\r\n", 1)[0];
    expect(header).toContain("evidence_urls");
    expect(header).toContain("evidence_snippets");
    expect(header).toContain("evidence_dates");
    expect(header).toContain("confidence");
    expect(header).toContain("decision_engine");
    expect(csv).toContain("https://www.airtable.com/");
    expect(csv).toContain("-formula-like source text");
    expect(csv).toContain("2026-09-30");
    expect(csv).toContain("Jev ICP fit");
    expect(csv).toContain("+positive-looking claim");
    expect(csv).toContain("@unknown claim");
    expect(csv).not.toContain("' =HYPERLINK");
    expect(csv).toContain("'=HYPERLINK");
  });
});

it("does not discard a complete business sentence merely because it mentions internal tools", () => {
 const sentence="We build custom internal tools for growing teams.";
 const draft=makeGroundedDraft({...account,description:"",evidence:[{...account.evidence[0],excerpt:sentence}]},profile);
 expect(draft.body).toContain(sentence); expect(draft.basis[0]).toContain(account.evidence[0].url);
});

it("preserves a short coherent company paragraph instead of selecting a standalone pain slogan",()=>{
 const excerpt="Your workflows break. Your team waits. Your tools don't talk to each other. We build automations that fix this. Real systems. Real results. Fast.";
 const draft=makeGroundedDraft({...account,name:"XRAY",description:excerpt,evidence:[{...account.evidence[0],excerpt}]},profile);
 expect(draft.body).toContain(`“${excerpt}”`);
});

it("never treats a high fit score as verification of sender offer or geographic relevance",()=>{
 const draft=makeGroundedDraft({...account,score:88,confidence:"medium",why_fit:["Agency"],score_breakdown:[]},{...profile,description:"Free AI Opportunity Audit for businesses in Paris, Ontario."});
 expect(draft.warning).toContain("Sender offer relevance and geographic applicability are not verified");
 expect(draft.body).not.toContain("you are based in Paris");
});

it("grounds the sender offer in the editable supplier description rather than inventing results",()=>{
 const offer="We help agencies automate repetitive workflows.";
 const draft=makeGroundedDraft(account,{...profile,description:offer});
 expect(draft.body).toContain(offer); expect(draft.basis.join(" ")).toContain("offer");
});
