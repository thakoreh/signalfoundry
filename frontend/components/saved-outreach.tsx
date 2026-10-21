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
  const recent = [...(threads || [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 10);
  return <section className="workspace-saved" aria-labelledby="saved-work-title">
    <div className="next-up-heading"><h2 id="saved-work-title">Saved conversations</h2>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Refresh saved work</button></div>
    {error && <p role="alert">{error}</p>}
    {!threads && !error && <p role="status">Opening saved conversations…</p>}
    {threads && !threads.length && <p>Your prepared outreach will stay here. Start with up to five relevant businesses.</p>}
    <ul>{recent.map(thread => <li key={thread.id}>
      <div><strong>{thread.company_name}</strong><p>{thread.recipient || "Contact not added"}</p>
        <small>{thread.suppressed ? "Stopped · suppressed" : thread.paused ? "Paused" : thread.reply_state ? replyLabels[thread.reply_state] : "No reply reported"}</small></div>
      <Link className="btn" href={`/workspace/outreach/${encodeURIComponent(thread.search_id)}?thread=${encodeURIComponent(thread.id)}`}>Open saved work</Link>
    </li>)}</ul>
    {threads && threads.length > 10 && <p>Showing your ten most recently updated conversations. Other due work appears in Next up.</p>}
  </section>;
}
