"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { displayedEntitlement } from "@/lib/billing";
import { errorMessage, jsonBody } from "@/lib/api";
import { useWorkspaceSession } from "./workspace-session";
export type BillingStatus = {
  configured: boolean;
  status: string;
  entitled: boolean;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  can_manage: boolean;
  monthly_research_limit: number | null;
  domains_per_campaign_limit: number | null;
};
export function BillingPanel() {
  const { api, isAdmin } = useWorkspaceSession();
  const [now, setNow] = useState(() => Date.now());
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const requestId = useRef<{ action: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBilling(await api<BillingStatus>("/billing"));
      setNow(Date.now());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(() => {
    const remaining = (billing?.current_period_end ?? 0) - Date.now();
    const timer = setTimeout(
      () => setNow(Date.now()),
      remaining > 0 ? Math.min(remaining + 1, 60_000) : 60_000,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [billing?.current_period_end, now]);
  const displayedActive = displayedEntitlement(billing, now);
  const cachedPeriodExpired = !!billing?.entitled && !displayedActive;
  async function open(action: "checkout" | "portal") {
    if (busy) return;
    setBusy(true);
    setError("");
    if (requestId.current?.action !== action)
      requestId.current = { action, id: crypto.randomUUID() };
    try {
      const result = await api<{ url: string }>(`/billing/${action}`, {
        method: "POST",
        body: jsonBody({ requestId: requestId.current.id }),
      });
      const url = new URL(result.url);
      if (
        url.protocol !== "https:" ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname) ||
        url.username ||
        url.password
      )
        throw new Error(
          "The billing service returned an invalid redirect. Contact your administrator.",
        );
      window.location.assign(url.href);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <section className="billing-panel">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLAN & BILLING</span>
          <h1>Your research plan</h1>
          <p>Subscription changes are handled securely through Stripe.</p>
        </div>
        <button
          className="btn secondary"
          onClick={refresh}
          disabled={loading || busy}
        >
          Refresh status
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p role="status">Loading billing status…</p>
      ) : billing ? (
        <div className="setup-card billing-card">
          <span className={`tag ${displayedActive ? "green" : "amber"}`}>
            {billing.configured
              ? cachedPeriodExpired
                ? "Billing confirmation needed"
                : billing.status.replaceAll("_", " ")
              : "Configuration unavailable"}
          </span>
          <h2>
            {displayedActive
              ? "Your research subscription is active"
              : cachedPeriodExpired
                ? "Research access needs billing confirmation"
                : billing.configured
                  ? "Activate public website research"
                  : "Billing hasn’t been configured"}
          </h2>
          {!billing.configured ? (
            <p>
              An administrator must complete Stripe price, webhook, and
              plan-limit configuration before paid research can be enabled.
              Fictional demo research remains available.
            </p>
          ) : (
            <>
              <p>
                {displayedActive
                  ? "Research access follows your verified Stripe subscription status."
                  : cachedPeriodExpired
                    ? "The last verified billing period has ended. Refresh your status or review your subscription in Stripe. Research remains subject to server authorization."
                    : "Review the plan’s price and terms in Stripe Checkout before subscribing. No payment is taken on this page."}
              </p>
              {billing.monthly_research_limit !== null && (
                <p>
                  Research allowance: {billing.monthly_research_limit} runs per
                  month
                </p>
              )}
              {billing.domains_per_campaign_limit !== null && (
                <p>
                  Up to {billing.domains_per_campaign_limit} domains per
                  campaign
                </p>
              )}
              {billing.current_period_end && (
                <p>
                  {billing.cancel_at_period_end
                    ? "Access is scheduled to end"
                    : "Current period ends"}{" "}
                  {new Date(billing.current_period_end).toLocaleDateString()}
                </p>
              )}
              {isAdmin && billing.can_manage ? (
                <div className="billing-actions">
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      open(billing.status === "none" ? "checkout" : "portal")
                    }
                  >
                    {busy
                      ? "Opening Stripe…"
                      : billing.status === "none"
                        ? "Review subscription in Stripe"
                        : "Manage subscription"}
                  </button>
                </div>
              ) : (
                <p>Only organization administrators can manage billing.</p>
              )}
            </>
          )}
          <p className="input-hint">
            After returning from Stripe, refresh this status. Access changes
            only after a verified webhook is processed.
          </p>
        </div>
      ) : (
        <button className="btn secondary" onClick={refresh}>
          Retry billing status
        </button>
      )}
    </section>
  );
}
