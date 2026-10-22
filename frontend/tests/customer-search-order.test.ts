import test from "node:test";
import assert from "node:assert/strict";
import type { Account } from "../lib/types.ts";
import {
  customerContactRank,
  orderCustomerAccounts,
  selectedCustomerAccounts,
  customerResearchDetails,
  customerSearchPath,
  validCustomerSearchId,
} from "../lib/customer-search.ts";
import { customerCsv } from "../components/customer-search-export.ts";
function account(
  id: string,
  name: string,
  score: number,
  status: "verified" | "unverified" | "absent" = "absent",
): Account {
  return {
    id,
    name,
    score,
    campaign_id: "search_test",
    domain: `${id}.example`,
    description: "A test business",
    industry: null,
    employee_range: null,
    location: null,
    confidence: "low",
    decision_engine: "rules",
    status: "new",
    why_fit: [],
    why_now: [],
    unknowns: [],
    evidence: [],
    contacts:
      status === "absent"
        ? []
        : [
            {
              name: null,
              role: "Business contact",
              email: `info@${id}.example`,
              verification_status: status,
              source_url: null,
              note: "Test fixture",
            },
          ],
    is_demo: false,
    researched_at: "2026-10-19",
    score_breakdown: [],
  };
}

test("default order prioritizes verified email, then unverified email, then absent email before website score", () => {
  const absent = account("absent", "Absent", 100);
  const unverified = account("unverified", "Unverified", 99, "unverified");
  const verified = account("verified", "Verified", 5, "verified");
  const original = [absent, unverified, verified];
  assert.deepEqual(
    orderCustomerAccounts(original).map((row) => row.id),
    ["verified", "unverified", "absent"],
  );
  assert.deepEqual(
    original.map((row) => row.id),
    ["absent", "unverified", "verified"],
  );
  assert.equal(unverified.contacts[0].verification_status, "unverified");
  assert.equal(
    customerContactRank({
      ...verified,
      contacts: [{ ...verified.contacts[0], email: " " }],
    }),
    0,
  );
});

test("contact bands use descending score and deterministic name/id ties", () => {
  const rows = [
    account("z", "Same", 80, "unverified"),
    account("a", "Same", 80, "unverified"),
    account("b", "Alpha", 80, "unverified"),
    account("c", "Low", 20, "unverified"),
  ];
  assert.deepEqual(
    orderCustomerAccounts(rows).map((row) => row.id),
    ["b", "a", "z", "c"],
  );
  assert.deepEqual(
    orderCustomerAccounts([...rows].reverse()).map((row) => row.id),
    ["b", "a", "z", "c"],
  );
});

test("individual business addresses rank above shared inboxes without upgrading verification", () => {
  const shared = account("shared", "Shared", 99, "verified");
  const individual = account("individual", "Individual", 10, "unverified");
  individual.contacts[0].email = "alex@individual.example";
  assert.deepEqual(orderCustomerAccounts([shared, individual]).map(row => row.id), ["individual", "shared"]);
  assert.equal(individual.contacts[0].verification_status, "unverified");
});

test("alternate sorts deliberately prioritize website score or company name", () => {
  const rows = [
    account("b", "Beta", 30, "verified"),
    account("a", "Alpha", 90),
    account("c", "Charlie", 60, "unverified"),
  ];
  assert.deepEqual(
    orderCustomerAccounts(rows, "score").map((row) => row.id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    orderCustomerAccounts(rows, "name").map((row) => row.id),
    ["a", "b", "c"],
  );
});

test("selected CSV rows follow displayed sort and preserve verification status", () => {
  const rows = [
    account("a", "Alpha", 100),
    account("b", "Beta", 20, "verified"),
    account("c", "Charlie", 90, "unverified"),
  ];
  const selected = selectedCustomerAccounts(
    rows,
    new Set(["a", "b", "c"]),
    "contacts",
  );
  assert.deepEqual(
    selected.map((row) => row.id),
    ["b", "c", "a"],
  );
  const csv = customerCsv(selected);
  assert.ok(csv.indexOf('"Beta"') < csv.indexOf('"Charlie"'));
  assert.ok(csv.indexOf('"Charlie"') < csv.indexOf('"Alpha"'));
  assert.match(csv, /"verified"/);
  assert.match(csv, /"unverified"/);
  assert.match(csv, /"not_available"/);
  assert.deepEqual(
    selectedCustomerAccounts(rows, new Set(["b", "a"]), "score").map(
      (row) => row.id,
    ),
    ["a", "b"],
  );
});

test("partial research details use plain language without asking users to repair discovered websites", () => {
  const details = customerResearchDetails([
    "https://candidate.example HTTP 403 Forbidden",
    "HTTP403",
    "contact provider timed out",
  ]);
  assert.equal(details.length, 2);
  assert.match(details[0], /limited automated access/);
  assert.doesNotMatch(
    details.join(" "),
    /HTTP|403|fix|your website|candidate\.example/i,
  );
});

test("search route IDs cannot introduce path segments or accept absent responses", () => {
  assert.equal(validCustomerSearchId("search-123_abc"), true);
  for (const id of [
    "",
    "../../elsewhere",
    "a/b",
    "?job=1",
    undefined as unknown as string,
  ])
    assert.equal(validCustomerSearchId(id), false);
  assert.equal(
    customerSearchPath("search-123_abc"),
    "/workspace/customers/search-123_abc",
  );
});
