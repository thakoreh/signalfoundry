/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { DEMO_PROFILE } from "../convex/lib/fixtures";
import { callWorker, workerConfiguration } from "../convex/lib/worker";
const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({
    subject: "user_admin",
    org_id: "org_one",
    org_role: "org:admin",
  });
  await admin.mutation(api.workspaces.provision, {});
  await admin.mutation(api.workspaces.saveProfile, { profile: DEMO_PROFILE });
  return { t, admin };
}
beforeEach(() => {
  vi.stubEnv("SIGNALFOUNDRY_WORKER_URL", "https://worker.example.com");
  vi.stubEnv(
    "SIGNALFOUNDRY_WORKER_TOKEN",
    "test-only-worker-token-not-a-real-secret",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("bounded stateless worker and website analysis", () => {
  it("rejects invalid configured endpoints and never forwards credentials on redirects", async () => {
    for (const url of [
      "http://worker.example.com",
      "https://user:pass@worker.example.com",
      "https://worker.example.com/",
      "https://worker.example.com?q=token",
      "https://127.0.0.1",
      "https://worker.internal",
    ]) {
      vi.stubEnv("SIGNALFOUNDRY_WORKER_URL", url);
      expect(() => workerConfiguration()).toThrow();
    }
    vi.stubEnv("SIGNALFOUNDRY_WORKER_URL", "https://worker.example.com");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer test-only-worker-token-not-a-real-secret",
      );
      return Response.json({
        profile: DEMO_PROFILE,
        website: "https://business.com/",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      callWorker("/worker/analyze", { website: "https://business.com" }),
    ).resolves.toMatchObject({ profile: DEMO_PROFILE });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://worker.example.com/worker/analyze",
    );
  });
  it("rejects oversized bodies and responses, invalid JSON, and non-JSON output", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      callWorker("/worker/analyze", { data: "x".repeat(65_537) }),
    ).rejects.toThrow("size limit");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(
      new Response("x".repeat(1_048_577), {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(callWorker("/worker/analyze", {})).rejects.toThrow(
      "size limit",
    );
    fetchMock.mockResolvedValue(
      new Response("{broken", {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(callWorker("/worker/analyze", {})).rejects.toThrow(
      "invalid JSON",
    );
    fetchMock.mockResolvedValue(new Response("<html>oops</html>"));
    await expect(callWorker("/worker/analyze", {})).rejects.toThrow(
      "invalid response",
    );
  });
  it("updates a validated profile but preserves a concurrent user edit", async () => {
    const { admin } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          profile: { ...DEMO_PROFILE, company_name: "Business" },
          website: "https://business.com/",
        }),
      ),
    );
    expect(
      await admin.action(api.workspaces.analyze, { website: "business.com" }),
    ).toMatchObject({ name: "Business", website: "https://business.com/" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await admin.mutation(api.workspaces.saveProfile, {
          profile: { ...DEMO_PROFILE, company_name: "My edit" },
        });
        return Response.json({
          profile: { ...DEMO_PROFILE, company_name: "Overwrite" },
          website: "https://business.com/",
        });
      }),
    );
    await expect(
      admin.action(api.workspaces.analyze, { website: "business.com" }),
    ).rejects.toThrow("CONFLICT");
    expect(await admin.query(api.workspaces.get, {})).toMatchObject({
      name: "My edit",
    });
  });
  it("preserves existing data on invalid profile output, enforces quota and expires abandoned leases", async () => {
    const { t, admin } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          profile: { company_name: "incomplete" },
          website: "https://business.com/",
        }),
      ),
    );
    await expect(
      admin.action(api.workspaces.analyze, { website: "business.com" }),
    ).rejects.toThrow("RESEARCH_FAILED");
    expect(await admin.query(api.workspaces.get, {})).toMatchObject({
      name: DEMO_PROFILE.company_name,
    });
    const lease = await t.mutation(internal.workspaces.beginAnalyze, {
      orgId: "org_one",
    });
    await expect(
      t.mutation(internal.workspaces.beginAnalyze, { orgId: "org_one" }),
    ).rejects.toThrow("CONFLICT");
    await t.mutation(internal.workspaces.releaseAnalyze, {
      orgId: "org_one",
      lease: lease.lease,
    });
    for (let i = 2; i < 10; i++) {
      const current = await t.mutation(internal.workspaces.beginAnalyze, {
        orgId: "org_one",
      });
      await t.mutation(internal.workspaces.releaseAnalyze, {
        orgId: "org_one",
        lease: current.lease,
      });
    }
    await expect(
      t.mutation(internal.workspaces.beginAnalyze, { orgId: "org_one" }),
    ).rejects.toThrow("RATE_LIMITED");
  });
});
