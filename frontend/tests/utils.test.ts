import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokens,
  filterAccounts,
  safeUrl,
  formatDate,
  scoreLabel,
  signalCount,
  sourceCount,
  replaceSelectedAccount,
} from "../lib/utils.ts";
import type { Account, Evidence } from "../lib/types.ts";
const accounts = [
  {
    name: "Beta",
    domain: "beta.example",
    score: 85,
    status: "shortlisted",
    industry: "SaaS",
  },
  {
    name: "Alpha",
    domain: "alpha.example",
    score: 45,
    status: "new",
    industry: null,
  },
] as Account[];
test("profile tags are trimmed, deduplicated, and support newlines", () =>
  assert.deepEqual(tokens(" SaaS, SaaS,\n AI ,, "), ["SaaS", "AI"]));
test("account filters compose, using real account statuses", () =>
  assert.equal(
    filterAccounts(accounts, "saas", "shortlisted", "high", "score").length,
    1,
  ));
test("search is case insensitive and sort does not mutate the source", () => {
  assert.equal(
    filterAccounts(accounts, "ALPHA", "all", "all", "score")[0].name,
    "Alpha",
  );
  assert.equal(
    filterAccounts(accounts, "", "all", "all", "name")[0].name,
    "Alpha",
  );
  assert.equal(accounts[0].name, "Beta");
});
test("unsafe source URLs are never linked", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");
});
test("missing publication dates remain unknown", () => {
  assert.equal(formatDate(null), "Date unknown");
  assert.equal(formatDate("bad"), "Date unknown");
});
test("score labels match filter thresholds", () => {
  assert.equal(scoreLabel(65), "Strong fit");
  assert.equal(scoreLabel(50), "Potential fit");
  assert.equal(scoreLabel(20), "Explore fit");
});

test("no-signal placeholder text never counts as evidence", () => {
  assert.equal(signalCount([]), 0);
  assert.equal(
    signalCount([{ kind: "fit" }, { kind: "signal" }] as Evidence[]),
    1,
  );
});
test("multiple excerpts from one URL are one source", () =>
  assert.equal(
    sourceCount([
      { url: "https://example.com" },
      { url: "https://example.com" },
      { url: "https://other.com" },
    ] as Evidence[]),
    2,
  ));
test("late status response cannot reopen dismissed detail or overwrite newer selection", () => {
  const updated = { id: "a", status: "shortlisted" } as Account;
  assert.equal(replaceSelectedAccount(null, updated), null);
  const newer = { id: "b" } as Account;
  assert.equal(replaceSelectedAccount(newer, updated), newer);
  assert.equal(
    replaceSelectedAccount({ id: "a" } as Account, updated),
    updated,
  );
});
