import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productionOrigin,
  publicPageMetadata,
  PUBLIC_PATHS,
  PRIVATE_PATHS,
  cspNonce,
  websiteSchema,
} from "../lib/seo.ts";

const live = {
  NODE_ENV: "production",
  SIGNALFOUNDRY_MODE: "saas",
  NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "saas",
  SEO_ALLOW_INDEXING: "true",
  APP_URL: "https://app.clientrove.com",
  CONVEX_URL: "https://test-123.convex.cloud",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: "sk_live_example",
};

test("indexing requires explicit launch, ready SaaS production, and live auth", () => {
  assert.equal(productionOrigin(live), live.APP_URL);
  for (const edit of [
    { NODE_ENV: "development" },
    { SEO_ALLOW_INDEXING: undefined },
    { SIGNALFOUNDRY_MODE: "local-demo" },
    { NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "local-demo" },
    { CLERK_SECRET_KEY: undefined },
    { CLERK_SECRET_KEY: "sk_test_example" },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example" },
    { VERCEL_ENV: "preview" },
    { CONTEXT: "deploy-preview" },
  ])
    assert.equal(
      productionOrigin({ ...live, ...edit }),
      null,
      JSON.stringify(edit),
    );
});

test("canonical origins reject local, staging, placeholder, credentials, paths and non-HTTPS URLs", () => {
  for (const APP_URL of [
    "http://localhost:3000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://192.168.1.10",
    "https://app.internal",
    "https://preview.clientrove.com",
    "https://clientrove-staging.com",
    "https://project.vercel.app",
    "https://project.netlify.app",
    "https://example.com",
    "https://app.example.com",
    "http://clientrove.com",
    "https://app.clientrove.com/",
    "https://app.clientrove.com/path",
    "https://app.clientrove.com:444",
    "https://x:y@app.clientrove.com",
    "https://app.clientrove.com?key=value",
    "https://-invalid.clientrove.com",
    "https://invalid-.clientrove.com",
    "not a URL",
  ])
    assert.equal(productionOrigin({ ...live, APP_URL }), null, APP_URL);
});

test("public metadata has route-specific canonical and real-origin social image only after launch", () => {
  const preview = publicPageMetadata("/", "Find businesses", undefined, {});
  assert.deepEqual(preview.robots, { index: false, follow: false });
  assert.equal(preview.alternates, undefined);
  assert.equal(preview.openGraph, undefined);
  for (const path of PUBLIC_PATHS) {
    const meta = publicPageMetadata(path, "Find businesses", undefined, live);
    assert.deepEqual(meta.robots, { index: true, follow: true });
    assert.equal(meta.alternates?.canonical, new URL(path, live.APP_URL).href);
  }
  for (const path of PRIVATE_PATHS)
    assert.equal(new Set<string>(PUBLIC_PATHS).has(path), false);
});

test("structured data uses existing script-src nonce and a minimal truthful WebSite schema", () => {
  assert.equal(
    cspNonce(
      "default-src 'self'; script-src 'self' 'nonce-AbC123+/=' 'strict-dynamic';",
    ),
    "AbC123+/=",
  );
  assert.equal(
    cspNonce("style-src 'nonce-styleOnly'; script-src 'self'"),
    null,
  );
  assert.equal(cspNonce(null), null);
  const schema = JSON.parse(websiteSchema(live.APP_URL));
  assert.equal(schema.name, "Clientrove");
  assert.equal(schema.url, live.APP_URL);
  assert.equal(schema["@type"], "WebSite");
  assert.equal(
    websiteSchema("https://app.clientrove.com</script>").includes("<"),
    false,
  );
});
