import test from "node:test";
import assert from "node:assert/strict";
import { suggestTargetBrief } from "../lib/target-brief.ts";

test("offering-only suggestions preserve the offering and leave unsupported criteria empty", () => {
  const brief = suggestTargetBrief(
    "  Northstar  ",
    "  We help B2B SaaS sales teams improve their pipeline.  ",
  );
  assert.equal(brief.company_name, "Northstar");
  assert.equal(
    brief.description,
    "We help B2B SaaS sales teams improve their pipeline.",
  );
  assert.deepEqual(brief.industries, ["B2B SaaS"]);
  assert.deepEqual(brief.buyer_roles, ["Head of Sales", "Revenue Operations"]);
  assert.deepEqual(brief.keywords, [
    "sales operations",
    "business development",
  ]);
  assert.deepEqual(brief.company_sizes, []);
  assert.deepEqual(brief.geographies, []);
  assert.deepEqual(brief.exclusions, []);
});

test("suggestions cover each supported offering without inventing people or contact data", () => {
  const cases = [
    [
      "We simplify support workflows for retail teams.",
      "Head of Customer Support",
      "Retail & ecommerce",
    ],
    [
      "We provide developer tools for software companies.",
      "Engineering Manager",
      "B2B SaaS",
    ],
    [
      "We simplify hiring workflows for restaurant groups.",
      "Head of People",
      "Hospitality",
    ],
    [
      "We automate finance reporting for healthcare clinics.",
      "Finance Director",
      "Healthcare services",
    ],
    [
      "We automate marketing analytics for agencies.",
      "Head of Marketing",
      "Professional services",
    ],
  ];
  for (const [offering, buyer, industry] of cases) {
    const brief = suggestTargetBrief("Northstar", offering);
    assert.equal(brief.buyer_roles[0], buyer);
    assert.deepEqual(brief.industries, [industry]);
    assert.deepEqual(Object.keys(brief).sort(), [
      "buyer_roles",
      "company_name",
      "company_sizes",
      "description",
      "exclusions",
      "geographies",
      "industries",
      "keywords",
    ]);
  }
});

test("an unfamiliar offering gets editable generic hypotheses and no invented industry", () => {
  const brief = suggestTargetBrief(
    "Northstar",
    "We streamline everyday workflows for growing teams.",
  );
  assert.deepEqual(brief.industries, []);
  assert.deepEqual(brief.buyer_roles, ["Head of Operations", "Founder"]);
  assert.deepEqual(brief.keywords, [
    "business operations",
    "workflow improvement",
  ]);
});

test("suggestions require a meaningful offering and company name", () => {
  assert.throws(
    () =>
      suggestTargetBrief(
        "   ",
        "We streamline everyday workflows for growing teams.",
      ),
    /product name/,
  );
  assert.throws(
    () => suggestTargetBrief("Northstar", "Short description"),
    /20 characters/,
  );
  assert.throws(
    () => suggestTargetBrief("Northstar", " ".repeat(25)),
    /20 characters/,
  );
});

test("fresh suggestions cannot inherit edits from a previous campaign brief", () => {
  const first = suggestTargetBrief(
    "Northstar",
    "We streamline everyday workflows for growing teams.",
  );
  first.industries.push("Edited industry");
  first.buyer_roles.push("Edited role");
  first.geographies.push("Edited geography");
  const second = suggestTargetBrief(
    "Northstar",
    "We streamline everyday workflows for growing teams.",
  );
  assert.deepEqual(second.industries, []);
  assert.deepEqual(second.buyer_roles, ["Head of Operations", "Founder"]);
  assert.deepEqual(second.geographies, []);
});
