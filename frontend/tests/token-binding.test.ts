import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenMatchesSession } from "../lib/server/token-binding.ts";
const session = { userId: "user_a", orgId: "org_a", orgRole: "org:admin" };
const base = {
  sub: "user_a",
  exp: Date.now() / 1000 + 300,
  org_id: "org_a",
  org_role: "org:admin",
};
const token = (claims: object) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
test("binds server-issued template claims to active verified session, including compact format", () => {
  assert.equal(tokenMatchesSession(token(base), session), true);
  assert.equal(
    tokenMatchesSession(
      token({ sub: base.sub, exp: base.exp, o: { id: "org_a", rol: "admin" } }),
      session,
    ),
    true,
  );
  for (const claims of [
    { ...base, sub: "user_b" },
    { ...base, org_id: "org_b" },
    { ...base, org_role: "org:member" },
    { ...base, o: { id: "org_b", rol: "admin" } },
    { ...base, exp: 0 },
    { sub: base.sub, exp: base.exp },
  ])
    assert.equal(tokenMatchesSession(token(claims), session), false);
  for (const malformed of ["", "not-a-jwt", "a.b.c", "a.e30.c"])
    assert.equal(tokenMatchesSession(malformed, session), false);
});
