"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import type { NextUpItem, NextUpResponse } from "@/lib/outreach";
import { useWorkspaceSession } from "./workspace-session";
import "./next-up-queue.css";

const actionLabels: Record<NextUpItem["action"], string> = {
  review_reply: "Review the received reply",
  answer_reply: "Write a human answer",
  report_meeting: "Report what happened after the meeting",
  manual_send: "Copy and record the approved message",
  review_followup: "Check for a reply and review the due reminder",
};

export function NextUpQueue() {
  const { api, mode } = useWorkspaceSession();
  const [items, setItems] = useState<NextUpItem[]>([]);
  const [loading, setLoading] = useState(mode === "local-demo");
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    if (mode !== "local-demo") return;
    setLoading(true);
    setError("");
    try {
      const result = await api<NextUpResponse>("/outreach/next-up", { signal });
      if (!signal?.aborted) setItems(result.items);
    } catch (cause) {
      if (!signal?.aborted) setError(errorMessage(cause));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, mode]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);
  if (mode !== "local-demo") return null;
  return (
    <section className="next-up-queue" aria-labelledby="next-up-title">
      <div className="next-up-heading">
        <div>
          <span className="eyebrow">RETURNING WORK</span>
          <h2 id="next-up-title">Next up</h2>
          <p>One safe, durable action at a time. Opening this list never creates work or sends anything.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>
      {loading && <p role="status">Checking saved conversations…</p>}
      {error && <div className="notice error" role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div>}
      {!loading && !error && !items.length && (
        <div className="next-up-empty"><strong>You’re caught up.</strong><p>There is no saved reply, meeting, or approved manual action waiting for you.</p></div>
      )}
      {!loading && !error && items.map((item) => (
        <article className="next-up-item" key={item.thread_id}>
          <div>
            <strong>{item.company_name}</strong>
            <p>{actionLabels[item.action]}</p>
            <small>{item.reason}</small>
          </div>
          <Link className="btn primary" href={`/workspace/outreach/${encodeURIComponent(item.search_id)}?thread=${encodeURIComponent(item.thread_id)}${item.action === "report_meeting" ? "&view=Meetings" : item.action === "review_reply" ? "&view=Conversations" : ""}`}>
            Open conversation
          </Link>
        </article>
      ))}
    </section>
  );
}
