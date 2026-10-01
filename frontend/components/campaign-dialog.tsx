"use client";
import { useRef, useState } from "react";
import type { Campaign } from "@/lib/types";
import { jsonBody, errorMessage } from "@/lib/api";
import { parseProspectImport } from "@/lib/prospect-import";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
import { useWorkspaceSession } from "./workspace-session";

export function CampaignDialog({ onClose, onCreated }: {
  onClose: () => void; onCreated: (campaign: Campaign) => Promise<void>;
}) {
  const { api, mode: appMode } = useWorkspaceSession();
  const isSaas = appMode === "saas";
  const requestKey = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [importNote, setImportNote] = useState("");
  const [created, setCreated] = useState<Campaign | null>(null);

  async function importFile(file?: File) {
    if (!file) return;
    setError(""); setImportNote("");
    try {
      if (file.size > 100_000) throw new Error("Keep imports under 100 KB.");
      const parsed = parseProspectImport(await file.text());
      if (!parsed.domains.length) throw new Error("No valid public company websites found. Use a Website or Domain column.");
      setDomains(parsed.domains.join("\n"));
      setImportNote(`${parsed.domains.length} unique company websites imported${parsed.rejected ? `; ${parsed.rejected} invalid entries skipped` : ""}. Review before starting research.`);
    } catch (e) { setError(errorMessage(e)); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      let campaign = created;
      if (!campaign) {
        const parsed = parseProspectImport(domains);
        if (!parsed.domains.length) throw new Error("Add at least one public company website.");
        if (parsed.rejected) throw new Error(`${parsed.rejected} invalid website entries found. Remove them before starting.`);
        setPhase("Creating your campaign…");
        campaign = await api<Campaign>("/campaigns", { method: "POST", body: jsonBody({ name: name.trim(), mode: "manual", domains: parsed.domains }) });
        setCreated(campaign);
      }
      setPhase("Reading public websites and qualifying accounts…");
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const result = await api<Campaign>(`/campaigns/${campaign.id}/research`, { method: "POST", body: jsonBody(isSaas ? { idempotencyKey: requestKey.current } : {}) });
      await onCreated(isSaas ? { ...campaign, status: "researching" } : result);
      onClose();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <Dialog title="New research campaign" onClose={onClose} wide busy={busy}>
    <div className="dialog-heading">
      <span className="modal-icon"><Icon name="spark" size={24} /></span>
      <span className="eyebrow">FROM PROSPECT LIST TO PRIORITY LIST</span>
      <h2>Build your next campaign</h2>
      <p>Import company websites, qualify them against your customer profile, then review the evidence before outreach.</p>
    </div>
    <form onSubmit={create} className="campaign-form">
      {error && <div className="notice error" role="alert"><Icon name="info" />{error}</div>}
      <label>Campaign name<input autoFocus required disabled={busy || !!created} value={name} maxLength={200} onChange={e => setName(e.target.value)} placeholder="e.g. October outbound shortlist" /></label>
      <label>Import a prospect list<input type="file" accept=".csv,.txt,text/csv,text/plain" disabled={busy || !!created} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /><span className="input-hint">CSV with a Website or Domain column, or a text list. Up to 100 KB. Files are parsed in your browser; only reviewed domains are submitted.</span></label>
      {importNote && <p className="notice" role="status">{importNote}</p>}
      <label>Company websites<textarea required disabled={busy || !!created} rows={5} value={domains} onChange={e => setDomains(e.target.value)} placeholder={"lowcode.agency\nxray.tech"} /><span className="input-hint">One public business domain per line, up to 10 subject to your plan. Duplicate domains are merged. No contact enrichment or automated sending.</span></label>
      {busy && <div className="research-progress" role="status"><span className="spinner" /><div><strong>{phase}</strong><p>{isSaas ? "Starting a durable background job. You can leave once it has been queued." : "Public websites can take a moment. Keep this window open."}</p></div></div>}
      <div className="dialog-footer"><button className="btn secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} type="submit">{busy ? "Starting research…" : created ? "Retry research" : "Create & qualify"}{!busy && <Icon name="arrow" size={16} />}</button></div>
    </form>
  </Dialog>;
}
