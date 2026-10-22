"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import {
  replyLabels,
  type NextUpResponse,
  type OutreachInsights,
  type OutreachSummary,
} from "../lib/outreach";
import { useWorkspaceSession } from "./workspace-session";
import { meetingTimeLabel } from "./outreach-timing";
import "./outreach-dashboard.css";

type Snapshot = {
  threads: OutreachSummary[];
  activity: OutreachInsights;
  actions: NextUpResponse["items"];
};
type Filter = "All" | "Replies" | "Meetings";

const actions = {
  review_reply: "Review reply",
  answer_reply: "Reply",
  report_meeting: "Update meeting",
  manual_send: "Open approved message",
  review_followup: "Review follow-up",
  review_message: "Review message",
  plan_followup: "Plan follow-up",
};

function status(thread: OutreachSummary) {
  if (thread.suppressed) return "Stopped";
  if (thread.recipient_status === "invalid") return "Invalid address";
  if (thread.paused) return "Paused";
  if (thread.meeting_state === "booked_reported") return "Meeting reported";
  if (thread.meeting_state === "attended_reported") return "Meeting held";
  if (thread.has_inbound && thread.reply_state)
    return replyLabels[thread.reply_state];
  if (thread.has_outbound) return "Awaiting reply";
  return thread.has_approval ? "Message approved" : "Needs approval";
}

export function OutreachDashboard() {
  const { api, mode } = useWorkspaceSession();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (mode !== "local-demo") return;
    const scope = new AbortController();
    Promise.all([
      api<{ threads: OutreachSummary[] }>("/outreach", {
        signal: scope.signal,
      }),
      api<OutreachInsights>("/outreach/insights", { signal: scope.signal }),
      api<NextUpResponse>("/outreach/next-up", { signal: scope.signal }),
    ])
      .then(([threads, activity, queue]) => {
        if (
          !Array.isArray(threads?.threads) ||
          !activity?.funnel ||
          ![
            activity.funnel.contacted,
            activity.funnel.replied,
            activity.funnel.meetings_held,
          ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
          !threads.threads.every(
            (thread) =>
              typeof thread.has_inbound === "boolean" &&
              typeof thread.has_outbound === "boolean" &&
              typeof thread.has_approval === "boolean",
          ) ||
          !Array.isArray(queue?.items)
        )
          throw new Error("Outreach activity could not be read.");
        if (!scope.signal.aborted) {
          setSnapshot({
            threads: threads.threads,
            activity,
            actions: queue.items,
          });
          setError("");
        }
      })
      .catch((cause) => {
        if (!scope.signal.aborted) setError(errorMessage(cause));
      });
    return () => scope.abort();
  }, [api, mode, refresh]);
  const rows = [...(snapshot?.threads || [])]
    .filter((thread) => {
      if (filter === "Replies" && !thread.has_inbound) return false;
      if (filter === "Meetings" && thread.meeting_state === "not_recorded")
        return false;
      return `${thread.company_name} ${thread.recipient}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <section className="outreach-dashboard" aria-labelledby="dashboard-title">
      <header className="outreach-dashboard-header">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1 id="dashboard-title">Your outreach.</h1>
          <p>Choose who to reach. Keep every conversation moving.</p>
        </div>
        <div className="outreach-dashboard-nav">
          <Link className="btn" href="/workspace/settings">
            Settings
          </Link>
          <Link className="btn primary" href="/workspace/customers">
            Find customers
          </Link>
        </div>
      </header>
      {mode !== "local-demo" ? (
        <p>Outreach is not available for hosted workspaces yet.</p>
      ) : (
        <>
          <p className="outreach-connection">
            Email not connected <span aria-hidden="true">·</span> Activity below
            is reported by you. Nothing sends automatically.
          </p>
          {error && (
            <div role="alert" className="notice error">
              <p>{error}</p>
              <button
                type="button"
                className="btn"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!snapshot && !error && <p role="status">Loading outreach…</p>}
          {snapshot && (
            <>
              <dl
                className="outreach-dashboard-stats"
                aria-label="Reported company activity"
              >
                <div>
                  <dt>Contacted</dt>
                  <dd>{snapshot.activity.funnel.contacted}</dd>
                </div>
                <div>
                  <dt>Human replies</dt>
                  <dd>{snapshot.activity.funnel.replied}</dd>
                </div>
                <div>
                  <dt>Meetings held</dt>
                  <dd>{snapshot.activity.funnel.meetings_held}</dd>
                </div>
              </dl>
              <div className="outreach-dashboard-list-heading">
                <h2>Activity</h2>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  Refresh
                </button>
              </div>
              <div className="outreach-dashboard-filters">
                <div role="group" aria-label="Filter outreach">
                  {(["All", "Replies", "Meetings"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={filter === item}
                      onClick={() => setFilter(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {snapshot.threads.length > 0 && (
                  <label className="outreach-dashboard-search">
                    <span className="sr-only">Find a business</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find a business"
                    />
                  </label>
                )}
              </div>
              {!rows.length ? (
                <div className="outreach-dashboard-empty">
                  <h3>
                    {snapshot.threads.length
                      ? "Nothing here yet."
                      : "Your first conversation starts with a customer."}
                  </h3>
                  <p>
                    {snapshot.threads.length
                      ? "Try another filter or search."
                      : "Find businesses, then select one to prepare its outreach."}
                  </p>
                </div>
              ) : (
                <ul className="outreach-dashboard-activity">
                  {rows.map((thread) => {
                    const action = snapshot.actions.find(
                      (item) => item.thread_id === thread.id,
                    );
                    const view =
                      filter === "Meetings" ||
                      action?.action === "report_meeting"
                        ? "Meetings"
                        : filter === "Replies" ||
                            action?.action === "review_reply" ||
                            action?.action === "answer_reply"
                          ? "Conversations"
                          : "Review";
                    return (
                      <li key={thread.id}>
                        <div>
                          <strong>{thread.company_name}</strong>
                          <span>{thread.recipient || "Contact needed"}</span>
                          {filter === "Meetings" && thread.meeting_at && (
                            <small>
                              {meetingTimeLabel(
                                thread.meeting_at,
                                thread.meeting_timezone,
                              )}
                            </small>
                          )}
                        </div>
                        <span className="outreach-dashboard-state">
                          {status(thread)}
                        </span>
                        <Link
                          className="btn"
                          href={`/workspace/outreach/${encodeURIComponent(thread.search_id)}?thread=${encodeURIComponent(thread.id)}&view=${view}`}
                        >
                          {filter === "Meetings"
                            ? "View meeting"
                            : filter === "Replies" &&
                                action?.action !== "review_reply" &&
                                action?.action !== "answer_reply"
                              ? "View conversation"
                              : action
                                ? actions[action.action]
                                : "Open outreach"}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <details className="outreach-dashboard-details">
                <summary>About these numbers</summary>
                <p>
                  All-time unique companies, reported by you. Counts are
                  independent; a reply is not a booking and a meeting is not a
                  sale.
                </p>
                {snapshot.activity.excluded_example_companies > 0 && (
                  <p>
                    {snapshot.activity.excluded_example_companies} example or
                    unknown-provenance companies are excluded.
                  </p>
                )}
                <p>{snapshot.activity.provenance}</p>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
