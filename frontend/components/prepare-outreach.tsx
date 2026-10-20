"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, jsonBody } from "../lib/api";
import { useWorkspaceSession } from "./workspace-session";

export const outreachPath = (id: string) =>
  `/workspace/outreach/${encodeURIComponent(id)}`;

export function PrepareOutreach({
  searchId,
  accountIds,
  onPrepared,
}: {
  searchId: string;
  accountIds: string[];
  onPrepared?: (path: string) => void;
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
      await api("/outreach", {
        method: "POST",
        signal,
        body: jsonBody({
          search_id: searchId,
          account_ids: selection,
          idempotency_key: key,
        }),
      });
      if (signal.aborted) return;
      const path = outreachPath(searchId);
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
    <div className="customer-prepare-outreach">
      <button
        className="btn primary"
        type="button"
        disabled={
          busy ||
          !accountIds.length ||
          accountIds.length > 5 ||
          mode !== "local-demo"
        }
        onClick={() => void prepare()}
      >
        {busy ? "Preparing…" : `Prepare outreach (${accountIds.length})`}
      </button>
      {mode !== "local-demo" && (
        <p>Outreach is not available for hosted workspaces yet.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
