"use node";
import Stripe from "stripe";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { adminAction } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  billingConfigured,
  billingOrigin,
  billingPolicy,
  isEntitled,
} from "./lib/billingPolicy";

function client() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw appError("CONFIGURATION_ERROR", "Billing is not configured");
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000 });
}
function trustedLink(value: string | null, host: string) {
  if (!value) throw new Error("Billing provider returned no URL");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password
  )
    throw new Error("Billing provider returned an invalid URL");
  return value;
}
const link = v.object({ url: v.string() });

export const checkout = adminAction({
  args: { requestId: v.string() },
  returns: link,
  handler: async (ctx, { requestId }): Promise<{ url: string }> => {
    if (!billingConfigured())
      throw appError(
        "CONFIGURATION_ERROR",
        "Billing is not configured. Contact the workspace operator",
      );
    const orgId = ctx.principal.orgId;
    await ctx.runMutation(internal.billing.admitAttempt, { orgId });
    const policy = billingPolicy()!;
    const row = await ctx.runQuery(internal.billing.forOrg, { orgId });
    if (isEntitled(row, policy))
      throw appError(
        "CONFLICT",
        "This workspace already has an active subscription. Use Manage billing",
      );
    const previous = await ctx.runQuery(internal.billing.latestCheckout, {
      orgId,
    });
    let operation = await ctx.runMutation(internal.billing.reserveOperation, {
      orgId,
      kind: "checkout",
      requestId,
    });
    const stripe = client();
    try {
      let customerId = row?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create(
          { metadata: { signalfoundry_org_id: orgId } },
          { idempotencyKey: `sf-customer-v1-${orgId}` },
        );
        customerId = customer.id;
        await ctx.runMutation(internal.billing.setCustomer, {
          orgId,
          customerId,
        });
      }
      // Read Stripe now: local webhook delay must never create a second subscription.
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      const nonterminal = (status: string) =>
        !["canceled", "incomplete_expired"].includes(status);
      if (
        subscriptions.has_more ||
        subscriptions.data.some((s) => nonterminal(s.status))
      )
        throw appError(
          "CONFLICT",
          "An existing subscription needs attention. Use Manage billing",
        );
      if (previous?.stripeSessionId) {
        const prior = await stripe.checkout.sessions.retrieve(
          previous.stripeSessionId,
        );
        if (prior.status === "complete" && !prior.subscription)
          throw appError(
            "CONFLICT",
            "Completed checkout is awaiting billing reconciliation",
          );
        if (prior.status === "complete" && prior.subscription) {
          const id =
            typeof prior.subscription === "string"
              ? prior.subscription
              : prior.subscription.id;
          const sub = await stripe.subscriptions.retrieve(id);
          if (nonterminal(sub.status))
            throw appError(
              "CONFLICT",
              "An existing subscription needs attention. Use Manage billing",
            );
        }
        if (prior.status === "expired" || prior.status === "complete") {
          await ctx.runMutation(internal.billing.closeCheckout, {
            id: previous.id,
          });
          if (operation.id === previous.id)
            operation = await ctx.runMutation(
              internal.billing.reserveOperation,
              { orgId, kind: "checkout", requestId },
            );
        } else if (operation.id !== previous.id) {
          throw appError(
            "CONFLICT",
            "A previous checkout is still open. Please retry after it expires",
          );
        }
      }
      if (operation.url) return { url: operation.url };
      // This persisted value keeps Stripe idempotency parameters identical on retries.
      if (operation.expiresAt < Date.now() + 31 * 60 * 1000)
        throw appError(
          "CONFLICT",
          "A prior billing request is unresolved. Retry after its checkout expires",
        );
      const origin = billingOrigin();
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: policy.priceId, quantity: 1 }],
          client_reference_id: orgId,
          metadata: { signalfoundry_org_id: orgId },
          subscription_data: { metadata: { signalfoundry_org_id: orgId } },
          expires_at: Math.floor(operation.expiresAt / 1000),
          success_url: `${origin}/?billing=return`,
          cancel_url: `${origin}/?billing=cancelled`,
        },
        { idempotencyKey: `sf-checkout-${orgId}-${operation.requestId}` },
      );
      const url = trustedLink(session.url, "checkout.stripe.com");
      await ctx.runMutation(internal.billing.completeOperation, {
        id: operation.id,
        url,
        expiresAt: session.expires_at * 1000,
        stripeSessionId: session.id,
      });
      return { url };
    } catch (error) {
      if (error instanceof Error && error.name === "ConvexError") throw error;
      throw appError(
        "BILLING_UNAVAILABLE",
        "Billing provider could not complete this request. Retry with the same request identifier",
      );
    }
  },
});

export const portal = adminAction({
  args: { requestId: v.string() },
  returns: link,
  handler: async (ctx, { requestId }): Promise<{ url: string }> => {
    if (!billingConfigured())
      throw appError("CONFIGURATION_ERROR", "Billing is not configured");
    const orgId = ctx.principal.orgId;
    await ctx.runMutation(internal.billing.admitAttempt, { orgId });
    const row = await ctx.runQuery(internal.billing.forOrg, { orgId });
    if (!row?.stripeCustomerId)
      throw appError("CONFLICT", "This workspace has no billing account");
    const operation = await ctx.runMutation(internal.billing.reserveOperation, {
      orgId,
      kind: "portal",
      requestId,
    });
    if (operation.url) return { url: operation.url };
    try {
      const session = await client().billingPortal.sessions.create(
        {
          customer: row.stripeCustomerId,
          return_url: billingOrigin(),
          ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
            ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
            : {}),
        },
        { idempotencyKey: `sf-portal-${orgId}-${requestId}` },
      );
      const url = trustedLink(session.url, "billing.stripe.com");
      await ctx.runMutation(internal.billing.completeOperation, {
        id: operation.id,
        url,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return { url };
    } catch {
      throw appError(
        "BILLING_UNAVAILABLE",
        "Billing provider could not complete this request. Please retry",
      );
    }
  },
});

export const reconcile = internalAction({
  args: {
    eventId: v.string(),
    type: v.string(),
    created: v.number(),
    subscriptionId: v.string(),
    expectedLiveMode: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      await ctx.runQuery(internal.billing.eventProcessed, {
        eventId: args.eventId,
      })
    )
      return null;
    // Retrieve authoritative state instead of granting access from checkout redirect or client metadata.
    const subscription = await client().subscriptions.retrieve(
      args.subscriptionId,
    );
    if (subscription.livemode !== args.expectedLiveMode)
      throw new Error("Billing mode mismatch");
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const row = await ctx.runQuery(internal.billing.forCustomer, {
      customerId,
    });
    if (!row || subscription.metadata.signalfoundry_org_id !== row.orgId)
      return null;
    const items = subscription.items.data;
    const item = items.length === 1 ? items[0] : null;
    await ctx.runMutation(internal.billing.applySubscription, {
      eventId: args.eventId,
      type: args.type,
      created: args.created,
      customerId,
      subscriptionId: subscription.id,
      status: item && item.quantity === 1 ? subscription.status : "unsupported",
      ...(item
        ? {
            priceId: item.price.id,
            currentPeriodEnd: item.current_period_end * 1000,
          }
        : {}),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    return null;
  },
});
