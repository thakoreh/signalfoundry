import test from "node:test";
import assert from "node:assert/strict";
import { manualEmailLink } from "../lib/manual-email.ts";

test("email handoff safely encodes recipient and exact plaintext without extra headers", () => {
  const body = 'A question?\n\n--\nAlex Fixture\n100 Example Street\nReply "unsubscribe".';
  const link = manualEmailLink("alex+sales@example.org", "A question & an idea", body)!;
  assert.ok(link.startsWith("mailto:alex%2Bsales@example.org?"));
  const query = new URLSearchParams(link.split("?")[1]);
  assert.deepEqual([...query.keys()], ["subject", "body"]);
  assert.equal(query.get("body"), body);
  assert.equal(query.get("subject"), "A question & an idea");
});
test("header injection and oversized encoded messages fall back to Copy", () => {
  assert.equal(manualEmailLink("alex@example.org\r\nBcc:other@example.org", "Hello", "Text"), null);
  assert.equal(manualEmailLink("alex@example.org", "Hello\r\nBcc: other@example.org", "Text"), null);
  assert.equal(manualEmailLink("alex@example.org", "Hello", "😀".repeat(200)), null);
});
