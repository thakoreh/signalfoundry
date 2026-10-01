import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const fake = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  createSession: vi.fn(),
  retrieveSession: vi.fn(),
  listSubscriptions: vi.fn(),
  retrieveSubscription: vi.fn(),
  createPortal: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    customers = { create: fake.createCustomer };
    checkout = {
      sessions: { create: fake.createSession, retrieve: fake.retrieveSession },
    };
    subscriptions = {
      list: fake.listSubscriptions,
      retrieve: fake.retrieveSubscription,
    };
    billingPortal = { sessions: { create: fake.createPortal } };
  },
}));
const modules = import.meta.glob("../convex/**/*.ts");
const identity = {
  subject: "user_admin",
  issuer: "https://clerk.example.com",
  tokenIdentifier: "https://clerk.example.com|user_admin",
  o: { id: "org_alpha", rol: "admin" },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_PRICE_ID", "price_approved");
  vi.stubEnv("SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT", "25");
  vi.stubEnv("SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT", "5");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("STRIPE_SECRET_KEY", crypto.randomUUID());
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", crypto.randomUUID());
  fake.listSubscriptions.mockResolvedValue({ data: [], has_more: false });
  fake.retrieveSession.mockResolvedValue({
    status: "open",
    subscription: null,
  });
  fake.createSession.mockImplementation(async (args) => ({
    id: "cs_runtime_fixture",
    url: "https://checkout.stripe.com/session-fixture",
    expires_at: args.expires_at,
  }));
  fake.createCustomer.mockResolvedValue({ id: "cus_alpha" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.billing.setCustomer, {
    orgId: "org_alpha",
    customerId: "cus_alpha",
  });
  return { t, admin: t.withIdentity(identity) };
}
describe("Stripe action contract mocks (no provider network)", () => {
  it("keeps complete Checkout parameters and idempotency key stable after a lost response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const { admin } = await setup();
    const requestId = crypto.randomUUID();
    fake.createSession.mockRejectedValueOnce(
      new Error("Lost provider response"),
    );
    await expect(
      admin.action(api.stripe.checkout, { requestId }),
    ).rejects.toThrow(/Retry with the same/);
    vi.setSystemTime(new Date("2026-10-01T12:00:05Z"));
    const result = await admin.action(api.stripe.checkout, { requestId });
    expect(result.url).toBe("https://checkout.stripe.com/session-fixture");
    expect(fake.createSession.mock.calls[1]).toEqual(
      fake.createSession.mock.calls[0],
    );
    expect(fake.createSession.mock.calls[0][0].expires_at).toBe(
      Math.floor(new Date("2026-10-02T11:00:00Z").getTime() / 1000),
    );
  });
  it("reuses an open checkout across tabs without creating another Stripe session", async () => {
    const { admin } = await setup();
    await admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() });
    await admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() });
    expect(fake.createSession).toHaveBeenCalledTimes(1);
    expect(fake.retrieveSession).toHaveBeenCalledWith("cs_runtime_fixture");
  });
  it.each(["active", "past_due", "unpaid", "trialing", "paused", "incomplete"])(
    "blocks another subscription when authoritative Stripe state is %s",
    async (status) => {
      const { admin } = await setup();
      fake.listSubscriptions.mockResolvedValue({
        data: [{ status }],
        has_more: false,
      });
      await expect(
        admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() }),
      ).rejects.toThrow(/existing subscription/);
      expect(fake.createSession).not.toHaveBeenCalled();
    },
  );
  it("fails closed if subscription history is incomplete", async () => {
    const { admin } = await setup();
    fake.listSubscriptions.mockResolvedValue({ data: [], has_more: true });
    await expect(
      admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() }),
    ).rejects.toThrow(/existing subscription/);
    expect(fake.createSession).not.toHaveBeenCalled();
  });
  it("detects completed checkout even when the first subscription list was stale", async () => {
    const { admin } = await setup();
    await admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() });
    fake.retrieveSession.mockResolvedValue({
      status: "complete",
      subscription: "sub_alpha",
    });
    fake.retrieveSubscription.mockResolvedValue({ status: "active" });
    await expect(
      admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() }),
    ).rejects.toThrow(/existing subscription/);
    expect(fake.createSession).toHaveBeenCalledTimes(1);
  });
  it("creates a new checkout after a completed subscription is confirmed canceled", async () => {
    const { admin } = await setup();
    await admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() });
    fake.retrieveSession.mockResolvedValue({
      status: "complete",
      subscription: "sub_old",
    });
    fake.retrieveSubscription.mockResolvedValue({ status: "canceled" });
    fake.listSubscriptions.mockResolvedValue({
      data: [{ status: "canceled" }],
      has_more: false,
    });
    await admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() });
    expect(fake.createSession).toHaveBeenCalledTimes(2);
    expect(fake.createSession.mock.calls[1][1].idempotencyKey).not.toBe(
      fake.createSession.mock.calls[0][1].idempotencyKey,
    );
  });
  it("limits provider calls even when idempotent/cached operations are reused", async () => {
    const { admin } = await setup();
    const requestId = crypto.randomUUID();
    for (let n = 0; n < 10; n++)
      await admin.action(api.stripe.checkout, { requestId });
    await expect(
      admin.action(api.stripe.checkout, { requestId }),
    ).rejects.toThrow(/attempt limit/);
    expect(fake.listSubscriptions).toHaveBeenCalledTimes(10);
    expect(fake.createSession).toHaveBeenCalledTimes(1);
  });
  it("never grants entitlement when creating Checkout or trusts provider redirects", async () => {
    const { t, admin } = await setup();
    fake.createSession.mockImplementation(async (args) => ({
      id: "cs_fixture",
      url: "https://evil.example/redirect",
      expires_at: args.expires_at,
    }));
    await expect(
      admin.action(api.stripe.checkout, { requestId: crypto.randomUUID() }),
    ).rejects.toThrow(/Billing provider/);
    expect((await admin.query(api.billing.status, {})).entitled).toBe(false);
    expect(
      (await t.query(internal.billing.forOrg, { orgId: "org_alpha" }))?.status,
    ).toBe("none");
  });
  it("binds Portal to authenticated organization customer and fixed return origin", async () => {
    const { admin } = await setup();
    fake.createPortal.mockResolvedValue({
      url: "https://billing.stripe.com/session-fixture",
    });
    await admin.action(api.stripe.portal, { requestId: crypto.randomUUID() });
    expect(fake.createPortal.mock.calls[0][0]).toEqual({
      customer: "cus_alpha",
      return_url: "https://app.example.com",
    });
  });
});
