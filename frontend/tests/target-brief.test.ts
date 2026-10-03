import test from "node:test";
import assert from "node:assert/strict";
import { audienceHypotheses, suggestTargetBrief } from "../lib/target-brief.ts";

test("explicit buyer language, not the seller category, determines audience", () => {
  const cases = [
    [
      "We are a web agency building conversion websites for US plumbers.",
      "Plumbing businesses",
      "Owner",
    ],
    [
      "We sell scheduling software to veterinary clinics.",
      "Veterinary clinics",
      "Practice Manager",
    ],
    [
      "Agency management software for web agencies.",
      "Professional services",
      "Founder",
    ],
    [
      "Developer observability for fintech engineering teams.",
      "Financial technology",
      "Engineering Manager",
    ],
    [
      "We help B2B SaaS sales teams improve their pipeline.",
      "B2B SaaS",
      "Head of Sales",
    ],
  ];
  for (const [offering, industry, role] of cases) {
    const brief = suggestTargetBrief("Northstar", offering);
    assert.deepEqual(brief.industries, [industry]);
    assert.equal(brief.buyer_roles[0], role);
    assert.deepEqual(brief.company_sizes, []);
  }
});

test("negative buyer language becomes an exclusion, never a target", () => {
  const brief = suggestTargetBrief(
    "Northstar",
    "We build conversion websites for US plumbers, not agencies.",
  );
  assert.deepEqual(brief.industries, ["Plumbing businesses"]);
  assert.deepEqual(brief.geographies, ["United States"]);
  assert.deepEqual(brief.exclusions, ["agencies"]);
});

test("unfamiliar or ambiguous buyer stays unknown instead of defaulting to the seller", () => {
  for (const offering of [
    "We are a marketing agency with talented developers.",
    "We streamline everyday workflows for growing teams.",
  ]) {
    const brief = suggestTargetBrief("Northstar", offering);
    assert.deepEqual(brief.industries, []);
    assert.deepEqual(brief.buyer_roles, []);
    assert.deepEqual(brief.keywords, []);
    assert.deepEqual(brief.geographies, []);
  }
});

test("an explicit buyer answer overrides ambiguous offering language", () => {
  const brief = suggestTargetBrief(
    "Northstar",
    "We are a marketing agency with talented developers.",
    "plumbers in Canada",
  );
  assert.deepEqual(brief.industries, ["Plumbing businesses"]);
  assert.deepEqual(brief.buyer_roles, ["Owner", "Operations Manager"]);
  assert.deepEqual(brief.geographies, ["Canada"]);
});

test("multiple segments are alternatives, and choosing one does not target all", () => {
  const text =
    "We automate appointments for veterinary clinics and dental clinics.";
  const options = audienceHypotheses(text);
  assert.equal(options[0].label, "Veterinary clinics");
  const alternatives = audienceHypotheses(
    "We offer analytics for retailers and manufacturing companies.",
  );
  assert.equal(alternatives.length, 2);
  const chosen = suggestTargetBrief(
    "Northstar",
    "We offer analytics for retailers and manufacturing companies.",
    "",
    "manufacturing",
  );
  assert.deepEqual(chosen.industries, ["Manufacturing"]);
});

test("suggestions validate meaningful input and cannot leak edits into the next mission", () => {
  assert.throws(
    () =>
      suggestTargetBrief(" ", "We help sales teams improve their pipeline."),
    /product name/,
  );
  assert.throws(
    () => suggestTargetBrief("Northstar", "Short description"),
    /20 characters/,
  );
  const text = "We build conversion websites for US plumbers.";
  const first = suggestTargetBrief("Northstar", text);
  first.buyer_roles.push("Edited");
  first.industries.push("Edited");
  assert.deepEqual(suggestTargetBrief("Northstar", text).industries, [
    "Plumbing businesses",
  ]);
  assert.deepEqual(suggestTargetBrief("Northstar", text).buyer_roles, [
    "Owner",
    "Operations Manager",
  ]);
});

test("pronoun us is not a US geography and direct buyers outrank their own customers", () => {
  assert.deepEqual(
    suggestTargetBrief("Seller", "Our tools help teams collaborate with us.")
      .geographies,
    [],
  );
  assert.deepEqual(
    suggestTargetBrief(
      "Seller",
      "We help agencies serve plumbers more effectively.",
    ).industries,
    ["Professional services"],
  );
  assert.deepEqual(
    suggestTargetBrief(
      "Seller",
      "Tools for US plumbers to manage appointments.",
    ).geographies,
    ["United States"],
  );
});

test("no-code and not-only language do not create hard exclusions", () => {
  const brief = suggestTargetBrief(
    "Seller",
    "We build no code workflows for agencies.",
  );
  assert.deepEqual(brief.industries, ["Professional services"]);
  assert.deepEqual(brief.exclusions, []);
  assert.deepEqual(
    suggestTargetBrief(
      "Seller",
      "We make websites for plumbers, not just agencies.",
    ).exclusions,
    [],
  );
  assert.deepEqual(
    suggestTargetBrief(
      "Seller",
      "We make websites for plumbers, not only agencies.",
    ).exclusions,
    [],
  );
});
