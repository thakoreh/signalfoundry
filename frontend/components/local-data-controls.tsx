"use client";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/api";
import { useWorkspaceSession } from "./workspace-session";

export function LocalDataControls() {
  const { api, mode } = useWorkspaceSession();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const flight = useRef<AbortController | null>(null);
  useEffect(() => () => flight.current?.abort(), []);
  if (mode !== "local-demo") return null;
  async function download() {
    if (flight.current) return;
    const scope = new AbortController(); flight.current = scope;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api<{ format: string }>("/privacy/export", { signal: scope.signal });
      if (scope.signal.aborted) return;
      if (data.format !== "clientrove-local-export-v1") throw new Error("The saved workspace export could not be read.");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "clientrove-workspace.json";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Workspace export prepared for download. It contains contact data and manual reports.");
    } catch (cause) { if (!scope.signal.aborted) setError(errorMessage(cause)); }
    finally { if (!scope.signal.aborted) setBusy(false); if (flight.current === scope) flight.current = null; }
  }
  return <details className="workspace-saved"><summary>Your local data</summary>
    <p>Your profile, research, drafts and manual conversation records are saved on this computer. No inbox or calendar is connected.</p>
    <button className="btn" type="button" disabled={busy} onClick={() => void download()}>{busy ? "Preparing export…" : "Export saved workspace"}</button>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <p>Workspace deletion is an explicit local owner operation that also closes the workspace. Minimal suppression and spending records remain to prevent renewed outreach or a reset allowance. Separate backups, exports and external messages are not deleted by this app.</p>
  </details>;
}
