import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
const MAX_WEBHOOK_BYTES = 262_144;
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const key = process.env.STRIPE_SECRET_KEY,
      secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!key || !secret)
      return new Response("Webhook unavailable", { status: 503 });
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Invalid webhook", { status: 400 });
    const reader = request.body?.getReader();
    if (!reader) return new Response("Invalid webhook", { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return new Response("Payload too large", { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const payload = new TextDecoder().decode(bytes);
    const stripe = new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        payload,
        signature,
        secret,
        300,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch {
      return new Response("Invalid webhook", { status: 400 });
    }
    let subscriptionId: string | undefined;
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    )
      subscriptionId = event.data.object.id;
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const sub = event.data.object.subscription;
      subscriptionId = typeof sub === "string" ? sub : sub?.id;
    }
    if (subscriptionId) {
      try {
        await ctx.runAction(internal.stripe.reconcile, {
          eventId: event.id,
          type: event.type,
          created: event.created,
          subscriptionId,
          expectedLiveMode: event.livemode,
        });
      } catch {
        return new Response("Webhook processing unavailable; retry", {
          status: 503,
        });
      }
    }
    return new Response("ok", { status: 200 });
  }),
});
export default http;
