import { describe, expect, it } from "vitest";
import {
  groundedCustomerReason,
  isCustomerMessageDraft,
  qualifiedCustomerAccounts,
} from "../components/customer-result-view";
import { fixtureAccount } from "./customer-fixtures";

describe("grounded compact result eligibility", () => {
  it("requires the explicit customer-type identity match, not a high aggregate score", () => {
    const qualified = fixtureAccount("qualified", 10, "verified");
    const weak = {
      ...fixtureAccount("weak", 100, "verified"),
      score_breakdown: [
        {
          label: "Customer-type language",
          points: 30,
          max_points: 60,
          reason: "Body keyword only",
        },
        { label: "Geography", points: 70, max_points: 70, reason: "Location" },
      ],
    };
    const oldRun = [weak, qualified];
    expect(
      qualifiedCustomerAccounts(oldRun).map((account) => account.id),
    ).toEqual(["qualified"]);
    expect(oldRun).toHaveLength(2);
    expect(weak.score).toBe(100);
    expect(groundedCustomerReason(qualified)).toBe(
      "Its homepage describes B2B software for developer teams.",
    );
  });
  it("excludes demo/excluded records and private or missing company evidence", () => {
    const good = fixtureAccount("good", 80);
    for (const bad of [
      { ...good, is_demo: true },
      {
        ...good,
        score_breakdown: [
          ...good.score_breakdown,
          {
            label: "Exclusion penalty",
            points: -30,
            max_points: 0,
            reason: "Excluded",
          },
        ],
      },
      { ...good, evidence: [] },
      { ...good, evidence: [{ ...good.evidence[0], is_demo: true }] },
      { ...good, evidence: [{ ...good.evidence[0], kind: "signal" as const }] },
      ...[
        "http://localhost/",
        "http://127.0.0.1/",
        "http://10.0.0.2/",
        "http://[::1]/",
        "https://service.internal/",
        "javascript:alert(1)",
      ].map((url) => ({ ...good, evidence: [{ ...good.evidence[0], url }] })),
    ])
      expect(qualifiedCustomerAccounts([bad])).toEqual([]);
  });
  it("does not accept templates or uncited content as an AI draft", () => {
    const draft = {
      subject: "About your product",
      body: "A grounded draft",
      evidence_ids: ["source_a"],
      warnings: [],
      generation_engine: "deepseek",
      created_at: "2026-10-19",
    };
    expect(isCustomerMessageDraft(draft)).toBe(true);
    expect(
      isCustomerMessageDraft({
        ...draft,
        generation_engine: "grounded_template",
      }),
    ).toBe(false);
    expect(isCustomerMessageDraft({ ...draft, evidence_ids: [] })).toBe(false);
    expect(isCustomerMessageDraft({ ...draft, body: "" })).toBe(false);
  });
});
