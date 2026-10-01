import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedHost, hasTrustedHeaders } from "../lib/local-host.ts";
test("only strict loopback hosts and valid ports are accepted", () => {
  for (const value of ["localhost", "LOCALHOST:3000", "127.0.0.1:3000"])
    assert.equal(isAllowedHost(value), true, value);
  for (const value of [
    null,
    "rebound.attacker.com",
    "localhost.attacker.com",
    "localhost:0",
    "localhost:65536",
    "localhost:abc",
    "localhost:3000,attacker.com",
    "user@localhost",
    "localhost.",
    "[::1]:3000",
  ])
    assert.equal(isAllowedHost(value), false, String(value));
});
test("host mismatch and ambiguous forwarded headers cannot cross the proxy boundary", () => {
  assert.equal(
    hasTrustedHeaders(
      new Headers({
        host: "localhost:3000",
        "x-forwarded-host": "localhost:3000",
      }),
    ),
    true,
  );
  const cases: Array<Record<string, string>> = [
    { host: "attacker.com" },
    { host: "localhost:3000", "x-forwarded-host": "attacker.com" },
    { host: "localhost:3000", forwarded: "host=attacker.com" },
  ];
  for (const headers of cases)
    assert.equal(hasTrustedHeaders(new Headers(headers)), false);
});

test("the preview adds exactly one HTTPS host without weakening localhost checks", () => {
  const origin = "https://preview.company.com";
  assert.equal(isAllowedHost("preview.company.com", origin), true);
  assert.equal(isAllowedHost("preview.company.com:443", origin), true);
  assert.equal(isAllowedHost("localhost:3000", origin), true);
  for (const host of [
    "preview.company.com.evil.com",
    "preview.company.com:80",
    "preview.company.com.",
    "evil.com",
  ])
    assert.equal(isAllowedHost(host, origin), false, host);
  const valid = {
    host: "preview.company.com",
    "x-forwarded-host": "preview.company.com",
    "x-forwarded-proto": "https",
    origin,
  };
  assert.equal(hasTrustedHeaders(new Headers(valid), origin), true);
  const alteredHeaders: Array<Record<string, string>> = [
    { "x-forwarded-proto": "http" },
    { "x-forwarded-proto": "https,http" },
    { "x-forwarded-host": "evil.com" },
    { origin: "https://evil.com" },
    { origin: "null" },
    { forwarded: "host=preview.company.com" },
  ];
  for (const altered of alteredHeaders)
    assert.equal(
      hasTrustedHeaders(new Headers({ ...valid, ...altered }), origin),
      false,
    );
});

test("invalid preview configuration fails closed", () => {
  for (const origin of [
    "http://preview.company.com",
    "https://*.company.com",
    "https://preview.company.com/",
    "https://user:pass@preview.company.com",
    "https://preview.company.com:443",
    "https://127.0.0.1",
    "https://preview.local",
    "https://a..com",
    "https://-a.com",
  ])
    assert.throws(() => isAllowedHost("localhost:3000", origin), Error, origin);
});
