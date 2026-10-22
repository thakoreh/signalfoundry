"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import { replyLabels, type OutreachThread } from "../lib/outreach";
import { useWorkspaceSession } from "./workspace-session";

export function SavedOutreach() {
  const { api, mode } = useWorkspaceSession();
  const [threads, setThreads] = useState<OutreachThread[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (mode !== "local-demo") return;
    const scope = new AbortController();
    api<{ threads: OutreachThread[] }>("/outreach", { signal: scope.signal }).then(result => {
      if (!Array.isArray(result?.threads)) throw new Error("Saved conversations could not be read.");
      if (!scope.signal.aborted) { setThreads(result.threads); setError(""); }
    }).catch(cause => { if (!scope.signal.aborted) setError(errorMessage(cause)); });
    return () => scope.abort();
  }, [api, mode, revision]);
  if (mode !== "local-demo") return null;
  const matches = [...(threads || [])].filter(thread => `${thread.company_name} ${thread.recipient}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const recent = expanded || query.trim() ? matches : matches.slice(0, 10);
  return <section className="workspace-saved" aria-labelledby="saved-work-title">
    <div className="next-up-heading"><h2 id="saved-work-title">Saved conversations</h2>
      <button className="btn" type="button" onClick={() => setRevision(value => value + 1)}>Refresh saved work</button></div>
    {error && <p role="alert">{error}</p>}
    {!threads && !error && <p role="status">Opening saved conversations…</p>}
    {threads && !threads.length && <p>Your prepared outreach will stay here. Start with up to five relevant businesses.</p>}
    {!!threads?.length && <label>Find saved work<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Company or email" /></label>}
    {!!threads?.length && !matches.length && <p>No saved conversation matches that company or email.</p>}
    <ul>{recent.map(thread => <li key={thread.id}>
      <div><strong>{thread.company_name}</strong><p>{thread.recipient || "Contact not added"}</p>
        <small>{thread.suppressed ? "Stopped · suppressed" : thread.paused ? "Paused" : thread.reply_state ? replyLabels[thread.reply_state] : "No reply reported"}</small></div>
      <Link className="btn" href={`/workspace/outreach/${encodeURIComponent(thread.search_id)}?thread=${encodeURIComponent(thread.id)}`}>Open saved work</Link>
    </li>)}</ul>
    {threads && threads.length > 10 && !query.trim() && <button className="btn" type="button" onClick={() => setExpanded(value => !value)}>{expanded ? "Show ten recent conversations" : `Show all ${threads.length} saved conversations`}</button>}
  </section>;
}
