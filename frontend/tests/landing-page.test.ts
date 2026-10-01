import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../components/landing-page.tsx"), "utf8");


test("landing page source keeps the public product journey explicit", () => {
  for (const phrase of [
    "Research signal,",
    "not noise.",
    'href=\"/workspace\"',
    'href=\"#workflow\"',
    "Start with your website",
    "Shape the ICP",
    "Import company domains or CSV",
    "public evidence",
    "shortlist",
    "draft or export",
  ]) {
    assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("landing page source labels examples and keeps unsupported claims out", () => {
  for (const phrase of [
    "public website research example",
    "Lowcode Agency",
    "agency",
    "Airtable",
    "software vendor",
    "XRay",
    "consultancy",
    "does not discover contacts",
    "does not verify email addresses",
    "does not send campaigns",
    "plan and limits are visible in the workspace",
    'href=\"/privacy\"',
    'href=\"/terms\"',
    'href=\"/contact\"',
    "staging preview",
  ]) {
    assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(source, /Trusted by/);
  assert.doesNotMatch(source, /customers include/);
});
