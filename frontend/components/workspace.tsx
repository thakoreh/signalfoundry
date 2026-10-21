"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceData } from "@/lib/types";
import { errorMessage, jsonBody } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/product";
import {
  consumeBusinessIntake,
  type BusinessIntake,
} from "@/lib/business-intake";
import { BusinessOnboarding } from "./business-onboarding";
import { NextUpQueue } from "./next-up-queue";
import { SignalBrand } from "./signal-brand";
import { useWorkspaceSession } from "./workspace-session";

export default function Workspace({
  organizationControl,
  userControl,
  setup = false,
}: {
  organizationControl?: React.ReactNode;
  userControl?: React.ReactNode;
  setup?: boolean;
}) {
  const { api, mode, isAdmin } = useWorkspaceSession();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState("");
  const [review, setReview] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [initialManual, setInitialManual] = useState(false);
  const intake = useRef<{ checked: boolean; value: BusinessIntake | null }>({
    checked: false,
    value: null,
  });
  const analysisScope = useRef<AbortController | null>(null);

  useEffect(() => {
    const scope = new AbortController();
    async function load() {
      if (scope.signal.aborted) return;
      setLoading(true);
      setError("");
      try {
        let current = await api<WorkspaceData | null>("/workspace", {
          signal: scope.signal,
        });
        if (!current && mode === "saas" && isAdmin) {
          current = await api<WorkspaceData>("/workspace", {
            method: "POST",
            body: "{}",
            signal: scope.signal,
          });
        }
        if (scope.signal.aborted) return;
        if (isAdmin && !intake.current.checked) {
          intake.current = { checked: true, value: consumeBusinessIntake() };
        }
        const draft = intake.current.value;
        setWorkspace(current);
        setWebsite(
          draft && "website" in draft ? draft.website : current?.website || "",
        );
        setInitialManual(Boolean(draft && "manual" in draft));
        // Opening Edit business must show the saved profile, never restart analysis.
        setReview(Boolean(current?.profile));
      } catch (cause) {
        if (!scope.signal.aborted) setError(errorMessage(cause));
      } finally {
        if (!scope.signal.aborted) setLoading(false);
      }
    }
    void Promise.resolve().then(load);
    return () => scope.abort();
  }, [api, isAdmin, mode, setup, revision]);

  useEffect(() => () => analysisScope.current?.abort(), []);

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (analyzing || !isAdmin) return;
    const scope = new AbortController();
    analysisScope.current = scope;
    setAnalyzing(true);
    setError("");
    try {
      const updated = await api<WorkspaceData>("/workspace/analyze", {
        method: "POST",
        body: jsonBody({ website: website.trim() }),
        signal: scope.signal,
      });
      if (scope.signal.aborted) return;
      setWorkspace(updated);
      setWebsite(updated.website || website);
      setReview(true);
    } catch (cause) {
      if (!scope.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!scope.signal.aborted) setAnalyzing(false);
    }
  }

  if (!loading && !workspace) {
    return (
      <div className="business-onboarding">
        <header className="business-onboarding-header">
          <Link
            className="sf-brand"
            href="/"
            aria-label={`${PRODUCT_NAME} home`}
          >
            <SignalBrand />
          </Link>
          <div className="business-onboarding-account">
            {organizationControl}
            {userControl}
          </div>
        </header>
        <main className="business-onboarding-main">
          <section className="business-onboarding-card">
            <h1>
              {mode === "saas" && !isAdmin && !error
                ? "Your team’s profile comes first."
                : "Let’s get connected."}
            </h1>
            <p>
              {mode === "saas" && !isAdmin && !error
                ? "An administrator needs to set up your team’s business profile before you can find customers."
                : "Your business details could not be loaded. Check your connection and try again."}
            </p>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              className="btn primary business-onboarding-submit"
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </button>
          </section>
        </main>
      </div>
    );
  }
  return (
    <>
      <BusinessOnboarding
        key={initialManual ? "manual-intake" : "website-intake"}
        initialManual={initialManual}
        website={website}
        setWebsite={setWebsite}
        analyze={analyze}
        analyzing={analyzing}
        loading={loading}
        error={error}
        profile={workspace?.profile || null}
        readOnly={!isAdmin}
        review={review}
        changeWebsite={() => setReview(false)}
        onSaved={(updated) => {
          setWorkspace(updated);
          setReview(true);
        }}
        organizationControl={organizationControl}
        userControl={userControl}
      />
      {workspace?.profile && <NextUpQueue />}
    </>
  );
}
