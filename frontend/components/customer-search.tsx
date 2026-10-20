"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceData } from "../lib/types";
import { errorMessage, jsonBody } from "../lib/api";
import {
  customerSearchPath,
  validCustomerSearchId,
  type CustomerEngine,
  type CustomerSearchRun,
} from "../lib/customer-search";
import { useWorkspaceSession } from "./workspace-session";
import { Icon } from "./icons";
import "./customer-search.css";

type SearchDraft = {
  target: string;
  geography: string;
  limit: number;
  requestKey?: string | null;
};

export function CustomerSearch({ onBack }: { onBack: () => void }) {
  const { api, mode } = useWorkspaceSession();
  const router = useRouter();
  const [engine, setEngine] = useState<CustomerEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [geography, setGeography] = useState("");
  const [limit, setLimit] = useState(5);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const storageKey = useRef<string | null>(null);
  const draftKey = useRef<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const createdRun = useRef<string | null>(null);
  const startScope = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const scope = new AbortController();
    async function load() {
      try {
        const [status, workspace] = await Promise.all([
          api<CustomerEngine>("/customers/engine", { signal: scope.signal }),
          api<WorkspaceData | null>("/workspace", { signal: scope.signal }),
        ]);
        if (scope.signal.aborted) return;
        setEngine(status);
        let draft: SearchDraft | null = null;
        if (workspace?.id) {
          storageKey.current = `clientrove:customer-search:${mode}:${workspace.id}`;
          draftKey.current = `${storageKey.current}:draft`;
          try {
            const saved = localStorage.getItem(storageKey.current);
            if (saved && validCustomerSearchId(saved)) setLastSearch(saved);
            const raw = sessionStorage.getItem(draftKey.current);
            if (raw && raw.length < 4096) {
              const parsed = JSON.parse(raw);
              if (
                typeof parsed.target === "string" &&
                typeof parsed.geography === "string"
              )
                draft = parsed;
            }
          } catch {
            /* Optional per-tab form history. */
          }
        }
        setTarget(
          (
            draft?.target ?? (workspace?.profile?.industries || []).join(", ")
          ).slice(0, 200),
        );
        setGeography(
          (
            draft?.geography ??
            (workspace?.profile?.geographies || []).join(", ")
          ).slice(0, 120),
        );
        setLimit(
          Number.isInteger(draft?.limit)
            ? Math.max(1, Math.min(5, draft!.limit))
            : 5,
        );
        requestKey.current =
          draft?.requestKey && validCustomerSearchId(draft.requestKey)
            ? draft.requestKey
            : null;
        setError("");
      } catch (cause) {
        if (!scope.signal.aborted) setError(errorMessage(cause));
      } finally {
        if (!scope.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => scope.abort();
  }, [api, mode, revision]);

  useEffect(() => () => startScope.current?.abort(), []);
  useEffect(() => {
    if (loading || !draftKey.current) return;
    try {
      sessionStorage.setItem(
        draftKey.current,
        JSON.stringify({
          target,
          geography,
          limit,
          requestKey: requestKey.current,
        }),
      );
    } catch {
      /* Optional. */
    }
  }, [target, geography, limit, loading]);

  function changed() {
    requestKey.current = null;
    createdRun.current = null;
  }
  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || loading) return;
    if (createdRun.current) {
      router.push(customerSearchPath(createdRun.current));
      return;
    }
    if (target.trim().length < 2) {
      setError("Enter a customer industry or business type.");
      return;
    }
    const scope = new AbortController();
    startScope.current = scope;
    inFlight.current = true;
    setStarting(true);
    setError("");
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      if (draftKey.current)
        try {
          sessionStorage.setItem(
            draftKey.current,
            JSON.stringify({
              target,
              geography,
              limit,
              requestKey: requestKey.current,
            }),
          );
        } catch {
          /* Optional. */
        }
      const created = await api<CustomerSearchRun>("/customers/search", {
        method: "POST",
        body: jsonBody({
          target: target.trim(),
          geography: geography.trim(),
          limit,
          idempotency_key: requestKey.current,
        }),
        signal: scope.signal,
      });
      if (scope.signal.aborted) return;
      if (!validCustomerSearchId(created.id))
        throw new Error(
          "The search response could not be opened. Please try again.",
        );
      createdRun.current = created.id;
      setLastSearch(created.id);
      requestKey.current = null;
      if (storageKey.current)
        try {
          localStorage.setItem(storageKey.current, created.id);
        } catch {
          /* Optional. */
        }
      if (draftKey.current)
        try {
          sessionStorage.setItem(
            draftKey.current,
            JSON.stringify({ target, geography, limit, requestKey: null }),
          );
        } catch {
          /* Optional. */
        }
      router.push(customerSearchPath(created.id));
    } catch (cause) {
      if (!scope.signal.aborted) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      if (!scope.signal.aborted) setStarting(false);
    }
  }

  return (
    <section
      className="customer-search"
      aria-labelledby="customer-search-title"
    >
      <button type="button" className="customer-search-back" onClick={onBack}>
        ← Your business profile
      </button>
      <div className="customer-search-heading">
        <span className="business-onboarding-step">
          <span aria-hidden="true">03</span> FIND CUSTOMERS
        </span>
        <h1 id="customer-search-title">Who would you like to reach?</h1>
        <p>
          Choose a focused search. We’ll check public websites and bring the
          facts together for you.
        </p>
      </div>
      <div
        className="customer-search-capabilities"
        aria-label="Research availability"
      >
        <span>
          <Icon
            name={engine?.discovery.status === "ready" ? "check" : "info"}
            size={15}
          />
          Company search:{" "}
          {loading
            ? "Checking…"
            : engine?.discovery.status === "ready"
              ? "Ready"
              : "Not connected"}
        </span>
        <span>
          <Icon
            name={engine?.contacts.status === "ready" ? "check" : "info"}
            size={15}
          />
          Email verification:{" "}
          {loading
            ? "Checking…"
            : engine?.contacts.status === "ready"
              ? "Ready"
              : "Not connected"}
        </span>
      </div>
      {!loading && !engine && (
        <div className="customer-search-notice">
          <p>Search availability could not be loaded.</p>
          <button
            type="button"
            className="customer-search-text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Check availability again
          </button>
        </div>
      )}
      {!loading && engine && engine.discovery.status !== "ready" && (
        <div className="customer-search-notice" role="status">
          <strong>Company research is unavailable.</strong>
          <p>
            Customer search needs the existing company-research provider in the
            local backend. A local operator must configure that provider and
            restart the backend; this page cannot connect a provider.
          </p>
          <p>
            Email verification is optional for research and is not connected in
            this workspace. Any address remains unverified until an actual
            verifier supplies evidence.
          </p>
          {engine.discovery.detail && (
            <p className="customer-search-notice-detail">
              Company research status: {engine.discovery.detail}
            </p>
          )}
          {engine.contacts.detail && (
            <p className="customer-search-notice-detail">
              Email verification status: {engine.contacts.detail}
            </p>
          )}
          <button
            type="button"
            className="customer-search-text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Recheck local availability
          </button>
          <span className="customer-search-notice-footnote">
            Recheck only reads local configuration; it does not configure or
            purchase a provider.
          </span>
        </div>
      )}
      <form
        className="customer-search-form"
        onSubmit={start}
        aria-busy={starting}
      >
        <label>
          Customer industries or business types
          <input
            required
            minLength={2}
            maxLength={200}
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              changed();
            }}
            disabled={starting || loading}
            placeholder="e.g. B2B SaaS, developer tools, agencies"
          />
        </label>
        <div className="customer-search-options">
          <label>
            Location <span>(optional)</span>
            <input
              maxLength={120}
              value={geography}
              onChange={(event) => {
                setGeography(event.target.value);
                changed();
              }}
              disabled={starting || loading}
              placeholder="e.g. Toronto, Canada"
            />
          </label>
          <label>
            Maximum results
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                changed();
              }}
              disabled={starting || loading}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="customer-search-help">
          Choose 1–5 businesses. Location is a search preference; review the
          source details before reaching out.
        </p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <button
          className="btn primary"
          disabled={starting || loading || engine?.discovery.status !== "ready"}
          type="submit"
        >
          {starting ? "Opening your search…" : "Find customers"}
          <Icon name="arrow" size={17} />
        </button>
      </form>
      {lastSearch && (
        <p className="customer-search-last">
          <Link href={customerSearchPath(lastSearch)}>
            View your last search <Icon name="arrow" size={14} />
          </Link>
        </p>
      )}
      <p className="customer-search-footer">
        <Icon name="shield" size={14} />
        Your results open on their own page. Research sources and email status
        stay attached. Nothing is sent.
      </p>
    </section>
  );
}
