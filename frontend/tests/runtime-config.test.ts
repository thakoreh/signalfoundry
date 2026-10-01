import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runtimeConfig,
  exactOrigin,
  trustedSaasHost,
} from "../lib/runtime-config.ts";
const saas = {
  SIGNALFOUNDRY_MODE: "saas",
  NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "saas",
  APP_URL: "https://app.example.com",
  CONVEX_URL: "https://example-123.convex.cloud",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
  CLERK_SECRET_KEY: "sk_test_example",
};
test("mode must be explicit, public/server/build aligned, and never falls back", () => {
  assert.equal(runtimeConfig({}, undefined).ready, false);
  for (const mode of ["production", "demo", "SAAS"])
    assert.equal(
      runtimeConfig(
        { SIGNALFOUNDRY_MODE: mode, NEXT_PUBLIC_SIGNALFOUNDRY_MODE: mode },
        mode,
      ).ready,
      false,
    );
  assert.equal(
    runtimeConfig(
      {
        SIGNALFOUNDRY_MODE: "local-demo",
        NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "local-demo",
      },
      "local-demo",
    ).ready,
    true,
  );
  assert.equal(runtimeConfig(saas, "saas").ready, true);
  assert.equal(runtimeConfig(saas, "local-demo").ready, false);
  assert.equal(
    runtimeConfig(
      { ...saas, NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "local-demo" },
      "saas",
    ).ready,
    false,
  );
});
test("missing provider keys, malformed URL, and endpoint SSRF targets fail closed", () => {
  for (const key of [
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "APP_URL",
    "CONVEX_URL",
  ])
    assert.equal(
      runtimeConfig({ ...saas, [key]: "" }, "saas").ready,
      false,
      key,
    );
  for (const origin of [
    "https://example.com/",
    "https://x:y@example.com",
    "http://example.com",
    "https://example.com/path",
    "https://example.com?secret=x",
  ])
    assert.equal(exactOrigin(origin), null);
  for (const value of [
    "http://localhost:8080",
    "https://api.evil.com",
    "https://demo.convex.cloud.evil.com",
    "https://demo.convex.cloud/path",
  ])
    assert.equal(
      runtimeConfig({ ...saas, CONVEX_URL: value }, "saas").ready,
      false,
    );
  assert.equal(exactOrigin("http://localhost:3000"), "http://localhost:3000");
});
test("SaaS proxy trusts only exact configured host and unambiguous forwarded headers", () => {
  const good = {
    host: "app.example.com",
    "x-forwarded-host": "app.example.com",
    "x-forwarded-proto": "https",
  };
  assert.equal(trustedSaasHost(new Headers(good), saas.APP_URL), true);
  for (const alteration of [
    { host: "evil.com" },
    { host: "app.example.com:444" },
    { "x-forwarded-host": "evil.com" },
    { "x-forwarded-proto": "http" },
    { forwarded: "host=app.example.com" },
  ] as Array<Record<string, string>>)
    assert.equal(
      trustedSaasHost(new Headers({ ...good, ...alteration }), saas.APP_URL),
      false,
    );
});
