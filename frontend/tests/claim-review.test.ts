import test from "node:test";
import assert from "node:assert/strict";
import { reviewClaims } from "../lib/claim-review.ts";

test("claim review maps only literal saved wording and excludes the sender footer", () => {
  const footer = '\n\n--\nAlex | Fictional Seller\n100 Example Street\nReply "unsubscribe".';
  const sources = [{ id: "source_one", excerpt: "We manage commercial properties across Ontario.", url: "https://example.org/about", retrieved_at: "2026-10-20T12:00:00Z" }];
  const result = reviewClaims("We manage commercial properties across Ontario.\nWe help teams record repair requests.\nWe guarantee you will double revenue." + footer, footer, "We help teams record repair requests.", sources);
  assert.deepEqual(result.map(item => item.label), ["Matches saved recipient text", "Matches your saved offer", "Needs your source review"]);
  assert.equal(result[0].source?.id, "source_one");
  assert.ok(result.every(item => !item.text.includes("unsubscribe")));
});

test("paraphrases, missing sources and ungrounded superlatives remain unmapped", () => {
  const result = reviewClaims("Your company is the fastest growing team. Could we discuss this next week?", "", "A repair tool", []);
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.label === "Needs your source review" && !item.source));
});
