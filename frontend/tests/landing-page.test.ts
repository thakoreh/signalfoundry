import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../components/landing-page.tsx", import.meta.url), "utf8");
test("public landing preserves signup/sign-in return to workspace and the complete workflow", () => {
 for (const phrase of ["/sign-up?redirect_url=/workspace", "/sign-in?redirect_url=/workspace", 'href="#workflow"', "Define the ICP", "Import accounts", "Review evidence", "Shortlist or export", "public evidence"]) assert.ok(source.toLowerCase().includes(phrase.toLowerCase()), phrase);
});
test("public landing distinguishes illustrative research from customers and discloses limitations and trust routes", () => {
 for (const phrase of ["public website research example", "Lowcode Agency", "Airtable", "XRay", "No automatic discovery", "No contact enrichment or verification", "No sending, replies, or meeting booking", 'href="/privacy"', 'href="/terms"', 'href="/contact"', "Staging preview"]) assert.ok(source.includes(phrase), phrase);
 assert.ok(source.includes("not invented leads, customer logos"));
 assert.doesNotMatch(source, /Trusted by|customers include/);
});
