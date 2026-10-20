"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile, WorkspaceData } from "@/lib/types";
import { PRODUCT_NAME } from "@/lib/product";
import { Icon } from "./icons";
import { ProfileEditor } from "./profile-editor";
import { SignalBrand } from "./signal-brand";
import { BillingPanel } from "./billing-panel";
import { useWorkspaceSession } from "./workspace-session";
import "./business-onboarding.css";

export function BusinessOnboarding({
  website,
  setWebsite,
  analyze,
  analyzing,
  loading,
  error,
  profile,
  readOnly = false,
  review,
  changeWebsite,
  onSaved,
  organizationControl,
  userControl,
  initialManual = false,
}: {
  website: string;
  setWebsite: (value: string) => void;
  analyze: (event: React.FormEvent) => Promise<void>;
  analyzing: boolean;
  loading: boolean;
  error: string;
  profile: Profile | null;
  readOnly?: boolean;
  review: boolean;
  changeWebsite: () => void;
  onSaved: (workspace: WorkspaceData) => void;
  organizationControl?: React.ReactNode;
  userControl?: React.ReactNode;
  initialManual?: boolean;
}) {
  const [manual, setManual] = useState(initialManual);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(false);
  const { mode, isAdmin } = useWorkspaceSession();
  const canManageBilling = mode === "saas" && isAdmin;
  const busy = loading || analyzing || saving;
  const reviewing = review || readOnly;
  const showDetails = manual || reviewing;
  const waitingForProfile = readOnly && !profile;

  return (
    <div className="business-onboarding">
      <a className="skip-link" href="#business-setup">
        Skip to business setup
      </a>
      <header className="business-onboarding-header">
        <Link
          className="sf-brand business-onboarding-brand"
          href="/"
          aria-label={`${PRODUCT_NAME} home`}
        >
          <SignalBrand />
        </Link>
        {(organizationControl || userControl || canManageBilling) && (
          <div className="business-onboarding-account">
            {canManageBilling && (
              <button
                type="button"
                className="business-onboarding-billing"
                onClick={() => setBilling(true)}
              >
                Plan &amp; billing
              </button>
            )}
            {organizationControl}
            {userControl}
          </div>
        )}
      </header>

      <main
        id="business-setup"
        className={`business-onboarding-main${billing ? " business-onboarding-main--customers" : ""}`}
      >
        {billing ? (
          <>
            <button
              type="button"
              className="business-onboarding-back"
              onClick={() => setBilling(false)}
            >
              ← Back to your business
            </button>
            <BillingPanel />
          </>
        ) : (
          <>
            <div
              key={reviewing ? "review" : manual ? "manual" : "website"}
              className="business-onboarding-intro"
            >
              <span className="business-onboarding-step">
                <span aria-hidden="true">{reviewing ? "02" : "01"}</span>{" "}
                {reviewing ? "REVIEW YOUR BUSINESS" : "YOUR BUSINESS"}
              </span>
              <h1>
                {waitingForProfile ? (
                  loading ? (
                    "Opening your workspace…"
                  ) : (
                    "Your team’s profile comes first."
                  )
                ) : readOnly ? (
                  "Your business profile."
                ) : reviewing ? (
                  "Does this look right?"
                ) : manual ? (
                  "Tell us in your own words."
                ) : (
                  <>
                    Tell us about
                    <br />
                    your business.
                  </>
                )}
              </h1>
              <p>
                {waitingForProfile
                  ? loading
                    ? "Just a moment while we load your business."
                    : "An administrator needs to add your team’s business details before customer search can begin."
                  : readOnly
                    ? "Review your team’s details. An administrator can make changes."
                    : reviewing
                      ? "Here’s your draft business profile. Adjust anything we missed."
                      : manual
                        ? "Just the basics: what you do and who you’d like to reach."
                        : "A good customer match starts with understanding you. Let’s start with your website."}
              </p>
            </div>

            {waitingForProfile ? null : showDetails ? (
              <>
                {!readOnly && (
                  <button
                    className="business-onboarding-back"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setManual(false);
                      changeWebsite();
                    }}
                  >
                    <span aria-hidden="true">←</span>{" "}
                    {reviewing ? "Change website" : "Use my website instead"}
                  </button>
                )}
                <div className="business-onboarding-details">
                  <ProfileEditor
                    profile={profile}
                    onSaved={(updated) => {
                      setManual(false);
                      onSaved(updated);
                    }}
                    onboarding
                    onContinue={() => router.push("/workspace/customers")}
                    onBusyChange={setSaving}
                  />
                  {readOnly && (
                    <button
                      className="btn primary business-onboarding-save"
                      type="button"
                      onClick={() => router.push("/workspace/customers")}
                    >
                      Find customers
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <section
                  className="business-onboarding-card"
                  aria-labelledby="website-option-title"
                >
                  <div className="business-onboarding-card-heading">
                    <span
                      className="business-onboarding-icon"
                      aria-hidden="true"
                    >
                      <Icon name="globe" size={23} />
                    </span>
                    <span className="business-onboarding-recommended">
                      Recommended
                    </span>
                  </div>
                  <h2 id="website-option-title">Start with your website</h2>
                  <p>
                    We’ll read your public homepage and draft a business summary
                    and customer profile for you to review.
                  </p>
                  <form onSubmit={analyze} aria-busy={busy}>
                    <label htmlFor="business-website">
                      Your business website
                    </label>
                    <div className="business-onboarding-field">
                      <Icon name="globe" size={18} />
                      <input
                        id="business-website"
                        name="website"
                        required
                        inputMode="url"
                        autoComplete="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="yourcompany.com"
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        disabled={busy}
                        aria-describedby="business-website-hint"
                      />
                    </div>
                    <p
                      id="business-website-hint"
                      className="business-onboarding-hint"
                    >
                      Use your business or product’s public website.
                    </p>
                    {error && (
                      <div className="notice error" role="alert">
                        <Icon name="info" size={17} />
                        <span>{error}</span>
                      </div>
                    )}
                    <button
                      className="btn primary business-onboarding-submit"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <span className="spinner" />
                          <span role="status">
                            {loading
                              ? "Opening your workspace…"
                              : "Reading your website…"}
                          </span>
                        </>
                      ) : (
                        <>
                          Analyze my website
                          <Icon name="arrow" size={18} />
                        </>
                      )}
                    </button>
                  </form>
                  <p className="business-onboarding-reassurance">
                    <Icon name="check" size={15} />
                    You can review and edit everything before continuing.
                  </p>
                </section>

                <div className="business-onboarding-alternative">
                  <span>Prefer to start from scratch?</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setManual(true)}
                  >
                    Enter business details manually
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
        <p className="business-onboarding-footer">
          <Icon name="shield" size={14} />
          Public website information only. You’re in control.
        </p>
      </main>
    </div>
  );
}
