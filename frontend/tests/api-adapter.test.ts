import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleApi,
  csvCell,
  MAX_BODY_BYTES,
  safeProviderError,
  type AdapterDependencies,
  type FunctionName,
  type Session,
} from "../lib/server/adapter.ts";
const origin = "https://app.example.com";
function setup(overrides: Partial<Session> = {}) {
  const calls: Array<{
    name: FunctionName;
    args: Record<string, unknown>;
    token: string;
  }> = [];
  const deps: AdapterDependencies = {
    config: {
      mode: "saas",
      ready: true,
      issues: [],
      appOrigin: origin,
      convexUrl: "https://demo.convex.cloud",
    },
    session: async () => ({
      userId: "user_a",
      orgId: "org_a",
      orgRole: "org:admin",
      getToken: async () => "server-issued-template-token",
      ...overrides,
    }),
    invoke: async (name, args, token) => {
      calls.push({ name, args, token });
      return { id: "result" };
    },
  };
  return { deps, calls };
}
function request(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}/api/${path}`, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      "x-signalfoundry-organization": "org_a",
      ...headers,
    },
    ...(method !== "GET"
      ? { body: typeof body === "string" ? body : JSON.stringify(body ?? {}) }
      : {}),
  });
}
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  overrides: Partial<Session> = {},
) {
  const state = setup(overrides);
  const response = await handleApi(
    request(path, method, body),
    path.split("/"),
    state.deps,
  );
  return { ...state, response };
}
test("configuration, authentication, active organization, role, and template token fail closed", async () => {
  for (const [overrides, status] of [
    [{ userId: null }, 401],
    [{ orgId: null }, 403],
    [{ orgRole: "org:owner" }, 403],
    [{ getToken: async () => null }, 401],
  ] as Array<[Partial<Session>, number]>) {
    const result = await call("workspace", "GET", undefined, overrides);
    assert.equal(result.response.status, status);
    assert.deepEqual(result.calls, []);
  }
  for (const mode of [null, "local-demo"] as const) {
    const state = setup();
    state.deps.config.mode = mode;
    assert.equal(
      (await handleApi(request("workspace"), ["workspace"], state.deps)).status,
      503,
    );
    assert.equal(state.calls.length, 0);
  }
});
test("expected-organization intent cannot authorize another tenant and rejects cookie-switch races", async () => {
  for (const expected of ["org_b", ""]) {
    const { deps, calls } = setup();
    const response = await handleApi(
      request(
        "workspace",
        "POST",
        {},
        { "x-signalfoundry-organization": expected },
      ),
      ["workspace"],
      deps,
    );
    assert.equal(response.status, 409);
    assert.equal(calls.length, 0);
  }
  const switched = setup({ orgId: "org_b" });
  assert.equal(
    (
      await handleApi(
        request("workspace", "POST", {}),
        ["workspace"],
        switched.deps,
      )
    ).status,
    409,
  );
  assert.equal(switched.calls.length, 0);
});
test("every REST mapping is explicit and forwards only its documented arguments", async () => {
  const cases: Array<
    [string, string, unknown, FunctionName, Record<string, unknown>]
  > = [
    ["workspace", "GET", undefined, "workspaces.get", {}],
    ["workspace", "POST", {}, "workspaces.provision", {}],
    [
      "workspace/analyze",
      "POST",
      { website: "https://business.example" },
      "workspaces.analyze",
      { website: "https://business.example" },
    ],
    ["campaigns", "GET", undefined, "campaigns.list", {}],
    [
      "campaigns",
      "POST",
      { name: "Research", mode: "manual", domains: ["business.example"] },
      "campaigns.create",
      { name: "Research", mode: "manual", domains: ["business.example"] },
    ],
    ["campaigns/c1", "GET", undefined, "campaigns.get", { id: "c1" }],
    [
      "campaigns/c1/accounts",
      "GET",
      undefined,
      "campaigns.accounts",
      { id: "c1" },
    ],
    [
      "campaigns/c1/job",
      "GET",
      undefined,
      "jobs.forCampaign",
      { campaignId: "c1" },
    ],
    [
      "campaigns/c1/research",
      "POST",
      { idempotencyKey: "retry-stable-key" },
      "jobs.start",
      { campaignId: "c1", idempotencyKey: "retry-stable-key" },
    ],
    ["accounts/a1", "GET", undefined, "accounts.get", { id: "a1" }],
    [
      "accounts/a1",
      "PATCH",
      { status: "shortlisted" },
      "accounts.setStatus",
      { id: "a1", status: "shortlisted" },
    ],
    ["accounts/a1/draft", "POST", {}, "accounts.draft", { id: "a1" }],
    ["jobs/j1", "GET", undefined, "jobs.get", { id: "j1" }],
    ["jobs/j1/cancel", "POST", {}, "jobs.cancel", { id: "j1" }],
    ["billing", "GET", undefined, "billing.status", {}],
    [
      "billing/checkout",
      "POST",
      { requestId: "uuid" },
      "stripe.checkout",
      { requestId: "uuid" },
    ],
    [
      "billing/portal",
      "POST",
      { requestId: "uuid" },
      "stripe.portal",
      { requestId: "uuid" },
    ],
  ];
  for (const [path, method, body, name, args] of cases) {
    const result = await call(path, method, body);
    assert.ok(
      result.response.ok,
      `${method} ${path}: ${await result.response.text()}`,
    );
    assert.deepEqual(result.calls, [
      { name, args, token: "server-issued-template-token" },
    ]);
    assert.match(result.response.headers.get("cache-control")!, /no-store/);
  }
});
test("SaaS no longer exposes demo reset or demo campaign creation", async () => {
  const reset = await call("demo/reset", "POST", {});
  assert.equal(reset.response.status, 404);
  assert.equal(reset.calls.length, 0);
  const campaign = await call("campaigns", "POST", {
    name: "Fictional demo",
    mode: "demo",
    domains: [],
  });
  assert.equal(campaign.response.status, 400);
  assert.equal(campaign.calls.length, 0);
});
test("tenant/function/price spoofing and unknown arguments never reach Convex", async () => {
  for (const [path, body] of [
    ["workspace", { orgId: "org_b" }],
    ["campaigns", { name: "x", mode: "demo", domains: [], tenantId: "b" }],
    ["billing/checkout", { requestId: "uuid", price: "cheap" }],
    ["jobs/j1/cancel", { userId: "other" }],
    ["accounts/a1/draft", { function: "internal.deleteEverything" }],
  ] as const) {
    const result = await call(path, "POST", body);
    assert.equal(result.response.status, 400);
    assert.equal(result.calls.length, 0);
  }
  for (const path of [
    "functions/workspaces.get",
    "internal/deleteAll",
    "workspaces.get",
    "campaigns/c1/accounts/extra",
  ]) {
    const result = await call(path);
    assert.equal(result.response.status, 404);
    assert.equal(result.calls.length, 0);
  }
});
test("members can research and review but cannot administer profile, workspace, demo or billing", async () => {
  for (const path of [
    "workspace",
    "workspace/analyze",
    "billing/checkout",
    "billing/portal",
  ]) {
    const result = await call(path, "POST", {}, { orgRole: "org:member" });
    assert.equal(result.response.status, 403);
    assert.equal(result.calls.length, 0);
  }
  assert.equal(
    (await call("workspace/profile", "PUT", {}, { orgRole: "org:member" }))
      .response.status,
    403,
  );
  assert.equal(
    (
      await call(
        "accounts/a1",
        "PATCH",
        { status: "dismissed" },
        { orgRole: "org:member" },
      )
    ).response.status,
    200,
  );
});
test("cross-origin writes, missing Origin, oversized/chunked/malformed/non-JSON bodies are rejected", async () => {
  for (const headers of [
    { origin: "https://evil.com" },
    { origin: "null" },
    { "sec-fetch-site": "cross-site" },
  ] as Array<Record<string, string>>) {
    const { deps, calls } = setup();
    assert.equal(
      (
        await handleApi(
          request("workspace", "POST", {}, headers),
          ["workspace"],
          deps,
        )
      ).status,
      403,
    );
    assert.equal(calls.length, 0);
  }
  const cases: Array<[Request, number]> = [
    [
      new Request(`${origin}/api/workspace`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      403,
    ],
    [request("workspace", "POST", "{invalid}"), 400],
    [request("workspace", "POST", []), 400],
    [request("workspace", "POST", {}, { "content-type": "text/plain" }), 415],
    [request("workspace", "POST", "x".repeat(MAX_BODY_BYTES + 1)), 413],
    [
      request(
        "workspace",
        "POST",
        {},
        { "content-length": String(MAX_BODY_BYTES + 1) },
      ),
      413,
    ],
  ];
  for (const [req, status] of cases) {
    const { deps, calls } = setup();
    assert.equal((await handleApi(req, ["workspace"], deps)).status, status);
    assert.equal(calls.length, 0);
  }
});
test("provider internals never leak; CSV neutralizes spreadsheet formulas", async () => {
  const { deps } = setup();
  deps.invoke = async () => {
    throw new Error("secret-key stack trace");
  };
  const response = await handleApi(request("workspace"), ["workspace"], deps);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret|stack/);
  assert.equal(
    safeProviderError({
      data: { code: "BILLING_REQUIRED", message: "private" },
    }).status,
    402,
  );
  assert.equal(safeProviderError({ data: "ADMIN_REQUIRED" }).status, 403);
  for (const value of ["=IMPORTDATA(1)", " +1", "\t@evil", "-1"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('a"b'), '"a""b"');
});

test("billing offer is a tenant-readable authenticated action without a client price", async () => {
  const result = await call("billing/offer", "GET", undefined, { orgRole: "org:member" });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.calls.map(c => ({ name: c.name, args: c.args })), [{ name: "stripe.offer", args: {} }]);
});

test("real CSV API preserves evidence, reasons, unknowns and engines", async () => {
 const {deps}=setup(); deps.invoke=async()=>[{name:"Public business",domain:"business.example",score:70,confidence:"medium",status:"new",description:"Public facts",why_fit:["Supported fit"],why_now:[],unknowns:["Budget unknown"],score_breakdown:[],evidence:[{id:"ev",url:"https://business.example",excerpt:"Quoted public fact",published_at:null,retrieved_at:"2026-10-01T00:00:00Z"}],researched_at:"2026-10-01T00:00:00Z",decision_engine:"jev",is_demo:false}];
 const response=await handleApi(request("campaigns/c1/export.csv"),["campaigns","c1","export.csv"],deps);
 assert.equal(response.status,200); const csv=await response.text();
 for(const value of ["evidence_urls","evidence_snippets","score_breakdown","decision_engine","Budget unknown","https://business.example","Quoted public fact"]) assert.ok(csv.includes(value),value);
});
