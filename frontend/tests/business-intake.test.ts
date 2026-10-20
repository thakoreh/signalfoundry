import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBusinessWebsite,
  saveBusinessIntake,
  consumeBusinessIntake,
} from "../lib/business-intake.ts";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

test("website drafts normalize public URLs and discard query strings without accepting credentials or local targets", () => {
  assert.equal(
    normalizeBusinessWebsite("acme.com/product?token=private#section"),
    "https://acme.com/product",
  );
  for (const input of [
    "",
    "javascript:alert(1)",
    "http://localhost",
    "http://127.1",
    "https://[::1]",
    "https://user:password@acme.com",
    "https://acme.com:8000",
    "foo.internal",
    "some text",
    "yourbusiness.example",
  ])
    assert.equal(normalizeBusinessWebsite(input), "", input);
});

test("the per-tab website handoff is consumed exactly once and expires after one hour", () => {
  const store = storage();
  saveBusinessIntake({ website: "acme.com" }, store);
  assert.deepEqual(consumeBusinessIntake(store), {
    website: "https://acme.com/",
  });
  assert.equal(consumeBusinessIntake(store), null);
  saveBusinessIntake({ website: "acme.com" }, store);
  assert.equal(consumeBusinessIntake(store, Date.now() + 61 * 60 * 1000), null);
});

test("manual entry survives the handoff while malformed storage is ignored and blocked storage is reported on save", () => {
  const store = storage();
  saveBusinessIntake({ manual: true }, store);
  assert.deepEqual(consumeBusinessIntake(store), { manual: true });
  store.setItem("clientrove:business-intake", "malformed");
  assert.equal(consumeBusinessIntake(store), null);
  assert.throws(
    () =>
      saveBusinessIntake(
        { manual: true },
        {
          ...store,
          setItem: () => {
            throw new Error("blocked");
          },
        },
      ),
    /blocked/,
  );
});
