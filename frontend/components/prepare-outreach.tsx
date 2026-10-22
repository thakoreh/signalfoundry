"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { errorMessage, jsonBody } from "../lib/api";
import { useWorkspaceSession } from "./workspace-session";

export const outreachPath = (id: string) =>
  `/workspace/outreach/${encodeURIComponent(id)}`;

export function PrepareOutreach({
  searchId,
  accountIds,
  onPrepared,
  companyName,
  triggerRef,
}: {
  searchId: string;
  accountIds: string[];
  onPrepared?: (path: string) => void;
  companyName?: string;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { api, mode } = useWorkspaceSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const flight = useRef(false);
  const keys = useRef(new Map<string, string>());
  const scope = useRef<AbortController | null>(null);
  useEffect(() => () => scope.current?.abort(), []);
  async function prepare() {
    if (flight.current || !accountIds.length || accountIds.length > 5) return;
    flight.current = true;
    scope.current = new AbortController();
    const signal = scope.current.signal;
    const selection = [...new Set(accountIds)].sort();
    const signature = selection.join(":");
    const key = keys.current.get(signature) || crypto.randomUUID();
    keys.current.set(signature, key);
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        threads: { id: string; account_id: string; search_id: string }[];
      }>("/outreach", {
        method: "POST",
        signal,
        body: jsonBody({
          search_id: searchId,
          account_ids: selection,
          idempotency_key: key,
        }),
      });
      if (signal.aborted) return;
      const first = Array.isArray(result?.threads)
        ? result.threads.find(
            (thread) =>
              thread &&
              typeof thread.id === "string" &&
              thread.search_id === searchId &&
              selection.includes(thread.account_id) &&
              /^[A-Za-z0-9_-]{1,128}$/.test(thread.id),
          )
        : undefined;
      if (!first)
        throw new Error(
          "The selected business could not be opened. Try again to recover the same outreach.",
        );
      const path =
        outreachPath(searchId) +
        `?thread=${encodeURIComponent(first.id)}&view=Review`;
      if (onPrepared) onPrepared(path);
      else window.location.assign(path);
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!signal.aborted) {
        flight.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div
      className={`customer-prepare-outreach${companyName ? " customer-prepare-outreach-row" : ""}`}
    >
      <button
        ref={triggerRef}
        className="btn primary"
        type="button"
        disabled={
          busy ||
          !accountIds.length ||
          accountIds.length > 5 ||
          mode !== "local-demo"
        }
        onClick={() => void prepare()}
        aria-label={
          companyName ? `Start outreach for ${companyName}` : undefined
        }
      >
        {busy
          ? "Preparing…"
          : companyName
            ? "Start outreach"
            : `Start outreach (${accountIds.length})`}
      </button>
      {mode !== "local-demo" && (
        <p>Outreach is not available for hosted workspaces yet.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
