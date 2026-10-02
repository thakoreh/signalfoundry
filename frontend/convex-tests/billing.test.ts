import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import Stripe from "stripe";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { billingPolicy, isEntitled } from "../convex/lib/billingPolicy";

const modules = import.meta.glob("../convex/**/*.ts");
const identity = (org = "org_alpha", role = "admin") => ({
  subject: `user_${org}`,
  issuer: "https://clerk.example.com",
  tokenIdentifier: `https://clerk.example.com|${org}`,
  o: { id: org, rol: role },
});
const configured = () => {
  vi.stubEnv("STRIPE_PRICE_ID", "price_approved");
  vi.stubEnv("SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT", "25");
  vi.stubEnv("SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT", "5");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("STRIPE_SECRET_KEY", crypto.randomUUID());
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", crypto.randomUUID());
};
afterEach(() => vi.unstubAllEnvs());

describe("server billing policy", () => {
  it("fails closed with missing or invalid plan choices", () => {
    expect(billingPolicy({})).toBeNull();
    expect(
      billingPolicy({
        STRIPE_PRICE_ID: "price_approved",
        SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT: "unlimited",
        SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT: "5",
      }),
    ).toBeNull();
    expect(
      billingPolicy({
        STRIPE_PRICE_ID: "price_approved",
        SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT: "20",
        SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT: "11",
      }),
    ).toBeNull();
  });
  it("accepts only active matching unexpired authoritative subscriptions", () => {
    const policy = {
      priceId: "price_approved",
      monthlyResearchLimit: 25,
      domainsPerCampaignLimit: 5,
    };
    const row = {
      status: "active",
      priceId: "price_approved",
      currentPeriodEnd: 200,
    };
    expect(isEntitled(row, policy, 100)).toBe(true);
    for (const change of [
      { status: "trialing" },
      { status: "past_due" },
      { status: "canceled" },
      { priceId: "price_other" },
      { currentPeriodEnd: 100 },
      { currentPeriodEnd: undefined },
    ])
      expect(isEntitled({ ...row, ...change }, policy, 100)).toBe(false);
    expect(isEntitled(row, null, 100)).toBe(false);
  });
});

describe("tenant billing boundary", () => {
  beforeEach(configured);
  it("rejects anonymous status and member checkout/portal before provider calls", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.billing.status, {})).rejects.toThrow(
      /Authentication/,
    );
    const member = t.withIdentity(identity("org_alpha", "member"));
    await expect(
      member.action(api.stripe.checkout, { requestId: crypto.randomUUID() }),
    ).rejects.toThrow(/admin/);
    await expect(
      member.action(api.stripe.portal, { requestId: crypto.randomUUID() }),
    ).rejects.toThrow(/admin/);
  });
  it("does not leak another organization's subscription", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.billing.setCustomer, {
      orgId: "org_alpha",
      customerId: "cus_alpha",
    });
    await t.mutation(internal.billing.applySubscription, {
      eventId: "evt_one",
      type: "customer.subscription.updated",
      created: 100,
      customerId: "cus_alpha",
      subscriptionId: "sub_alpha",
      status: "active",
      priceId: "price_approved",
      currentPeriodEnd: Date.now() + 60_000,
      cancelAtPeriodEnd: false,
    });
    expect(
      (await t.withIdentity(identity()).query(api.billing.status, {})).entitled,
    ).toBe(true);
    const other = await t
      .withIdentity(identity("org_beta"))
      .query(api.billing.status, {});
    expect(other.entitled).toBe(false);
    expect(other.status).toBe("none");
    await expect(
      t.mutation(internal.billing.setCustomer, {
        orgId: "org_beta",
        customerId: "cus_alpha",
      }),
    ).rejects.toThrow(/conflict/);
  });
  it("is idempotent and rejects stale entitlement restoration", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.billing.setCustomer, {
      orgId: "org_alpha",
      customerId: "cus_alpha",
    });
    const event = {
      eventId: "evt_cancel",
      type: "customer.subscription.deleted",
      created: 200,
      customerId: "cus_alpha",
      subscriptionId: "sub_alpha",
      status: "canceled",
      priceId: "price_approved",
      currentPeriodEnd: Date.now() + 60_000,
      cancelAtPeriodEnd: false,
    };
    expect(await t.mutation(internal.billing.applySubscription, event)).toBe(
      "applied",
    );
    expect(await t.mutation(internal.billing.applySubscription, event)).toBe(
      "duplicate",
    );
    expect(
      await t.mutation(internal.billing.applySubscription, {
        ...event,
        eventId: "evt_old",
        created: 100,
        status: "active",
      }),
    ).toBe("ignored");
    expect(
      await t.mutation(internal.billing.applySubscription, {
        ...event,
        eventId: "evt_equal",
        status: "active",
      }),
    ).toBe("ignored");
    expect(
      (await t.withIdentity(identity()).query(api.billing.status, {})).entitled,
    ).toBe(false);
  });
  it.each([
    { status: "past_due", priceId: "price_approved" },
    { status: "unpaid", priceId: "price_approved" },
    { status: "paused", priceId: "price_approved" },
    { status: "unsupported", priceId: "price_approved" },
    { status: "active", priceId: "price_other" },
  ])(
    "fails closed on reversed same-second inactive snapshots: %o",
    async (change) => {
      const t = convexTest(schema, modules);
      await t.mutation(internal.billing.setCustomer, {
        orgId: "org_alpha",
        customerId: "cus_alpha",
      });
      const event = {
        eventId: "evt_inactive",
        type: "customer.subscription.updated",
        created: 200,
        customerId: "cus_alpha",
        subscriptionId: "sub_alpha",
        status: "active",
        priceId: "price_approved",
        currentPeriodEnd: Date.now() + 60_000,
        cancelAtPeriodEnd: false,
      };
      await t.mutation(internal.billing.applySubscription, {
        ...event,
        ...change,
      });
      expect(
        await t.mutation(internal.billing.applySubscription, {
          ...event,
          eventId: "evt_delayed_active",
        }),
      ).toBe("ignored");
      expect(
        (await t.withIdentity(identity()).query(api.billing.status, {}))
          .entitled,
      ).toBe(false);
      expect(
        await t.mutation(internal.billing.applySubscription, {
          ...event,
          eventId: "evt_later_authoritative",
          created: 201,
        }),
      ).toBe("applied");
      expect(
        (await t.withIdentity(identity()).query(api.billing.status, {}))
          .entitled,
      ).toBe(true);
    },
  );
  it("reuses operation results and limits new requests", async () => {
    const t = convexTest(schema, modules);
    const requestId = crypto.randomUUID();
    const op = await t.mutation(internal.billing.reserveOperation, {
      orgId: "org_alpha",
      kind: "checkout",
      requestId,
    });
    await t.mutation(internal.billing.completeOperation, {
      id: op.id,
      url: "https://checkout.stripe.com/test-result",
      expiresAt: Date.now() + 60_000,
    });
    expect(
      (
        await t.mutation(internal.billing.reserveOperation, {
          orgId: "org_alpha",
          kind: "checkout",
          requestId,
        })
      ).url,
    ).toBe("https://checkout.stripe.com/test-result");
    expect(
      (
        await t.mutation(internal.billing.reserveOperation, {
          orgId: "org_alpha",
          kind: "checkout",
          requestId: crypto.randomUUID(),
        })
      ).id,
    ).toBe(op.id);
    for (let n = 0; n < 5; n++)
      await t.mutation(internal.billing.reserveOperation, {
        orgId: "org_alpha",
        kind: "portal",
        requestId: crypto.randomUUID(),
      });
    await expect(
      t.mutation(internal.billing.reserveOperation, {
        orgId: "org_alpha",
        kind: "portal",
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/limit/);
  });
});

describe("Stripe webhook raw-body verification", () => {
  beforeEach(configured);
  it("rejects missing, invalid, expired and changed signatures; accepts a signed irrelevant event", async () => {
    const t = convexTest(schema, modules);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const payload = JSON.stringify({
      id: "evt_signature_only",
      object: "event",
      type: "customer.created",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object: { id: "cus_not_bound" } },
    });
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    });
    const call = (body: string, sig?: string) =>
      t.fetch("/stripe/webhook", {
        method: "POST",
        body,
        headers: sig ? { "stripe-signature": sig } : {},
      });
    expect((await call(payload)).status).toBe(400);
    expect((await call(payload, "invalid")).status).toBe(400);
    expect((await call(payload + " ", signature)).status).toBe(400);
    const old = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
      timestamp: Math.floor(Date.now() / 1000) - 400,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    });
    expect((await call(payload, old)).status).toBe(400);
    expect((await call(payload, signature)).status).toBe(200);
    expect((await call(" ".repeat(262_145), signature)).status).toBe(413);
  });
});
