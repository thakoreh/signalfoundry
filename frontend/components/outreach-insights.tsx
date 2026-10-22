"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import type { OutreachInsights as Insights } from "../lib/outreach";
import { useWorkspaceSession } from "./workspace-session";
import "./outreach-insights.css";

const labels = { companies: "Companies in review", contacted: "Contacted", replied: "Human replies", interested: "Currently interested", meetings_held: "Meetings held", customers: "Customers reported" };
export function OutreachInsights({ revision = 0 }: { revision?: number }) {
  const { api, mode } = useWorkspaceSession();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (mode !== "local-demo") return;
    const scope = new AbortController();
    api<Insights>("/outreach/insights", { signal: scope.signal }).then(value => {
      if (!value?.funnel || !value?.departure) throw new Error("The saved activity summary could not be read.");
      if (!scope.signal.aborted) { setData(value); setError(""); }
    }).catch(cause => { if (!scope.signal.aborted) setError(errorMessage(cause)); });
    return () => scope.abort();
  }, [api, mode, revision, refresh]);
  if (mode !== "local-demo") return null;
  return <section className="outreach-insights" aria-labelledby="activity-title">
    <div className="outreach-insights-heading"><h2 id="activity-title">Your progress and what’s next</h2>
      <button className="btn" type="button" onClick={() => setRefresh(value => value + 1)}>Refresh activity</button></div>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Reading saved activity…</p>}
    {data && <>
      <p>All-time unique companies · reported by you. These stages are independent counts, not a conversion-rate claim.</p>
      <dl className="outreach-funnel">{Object.entries(labels).map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{data.funnel[key as keyof Insights["funnel"]]}</dd>
      </div>)}</dl>
      {data.excluded_example_companies > 0 && <p>{data.excluded_example_companies} example or unknown-provenance companies excluded.</p>}
      <h3>Before you leave</h3>
      <p>{data.departure.approvals_pending} saved messages await review. External replies and opt-outs take effect here when you record them; no inbox is connected.</p>
      {data.departure.upcoming.length ? <ul>{data.departure.upcoming.map(item => <li key={`${item.thread_id}:${item.action}`}>
        <Link href={`/workspace/outreach/${encodeURIComponent(item.search_id)}?thread=${encodeURIComponent(item.thread_id)}&view=${encodeURIComponent(item.view)}`}>
          {item.action} · {item.company_name}</Link>
        <span>{new Date(item.at).toLocaleString(undefined, { timeZone: item.timezone || "UTC" })} ({item.timezone || "UTC"})</span>
      </li>)}</ul> : <p>No future review dates are saved. Unknown replies and outcomes stay unknown.</p>}
      <p>{data.provenance}</p>
      <Link className="btn" href="/workspace/customers">Find your next five businesses</Link>
    </>}
  </section>;
}
