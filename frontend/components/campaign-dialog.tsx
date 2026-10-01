"use client";
import { useRef, useState } from "react";
import type { Campaign } from "@/lib/types";
import { jsonBody, errorMessage } from "@/lib/api";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
import { useWorkspaceSession } from "./workspace-session";
export function CampaignDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (campaign: Campaign) => Promise<void>;
}) {
  const { api, mode: appMode } = useWorkspaceSession();
  const isSaas = appMode === "saas";
  const requestKey = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"manual" | "demo">("manual");
  const [domains, setDomains] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [created, setCreated] = useState<Campaign | null>(null);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let campaign = created;
      if (!campaign) {
        setPhase("Creating your campaign…");
        campaign = await api<Campaign>("/campaigns", {
          method: "POST",
          body: jsonBody({
            name: name.trim(),
            mode,
            domains:
              mode === "manual"
                ? domains
                    .split(/[\s,]+/)
                    .map((v) => v.trim())
                    .filter(Boolean)
                : [],
          }),
        });
        setCreated(campaign);
      }
      setPhase(
        mode === "demo"
          ? "Scoring fictional demo accounts…"
          : "Reading public websites and scoring accounts…",
      );
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const result = await api<Campaign>(`/campaigns/${campaign.id}/research`, {
        method: "POST",
        body: jsonBody(isSaas ? { idempotencyKey: requestKey.current } : {}),
      });
      await onCreated(isSaas ? { ...campaign, status: "researching" } : result);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="New research campaign" onClose={onClose} wide busy={busy}>
      <div className="dialog-heading">
        <span className="modal-icon">
          <Icon name="spark" size={24} />
        </span>
        <span className="eyebrow">FIND YOUR NEXT RIGHT CUSTOMER</span>
        <h2>Start a research campaign</h2>
        <p>
          Bring a list of company websites. We’ll turn public evidence into a
          focused account shortlist.
        </p>
      </div>
      <form onSubmit={create} className="campaign-form">
        {error && (
          <div className="notice error" role="alert">
            <Icon name="info" />
            {error}
          </div>
        )}
        <label>
          Campaign name
          <input
            autoFocus
            required
            disabled={busy || !!created}
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. B2B SaaS · North America"
          />
        </label>
        <fieldset disabled={busy || !!created}>
          <legend>Choose a research mode</legend>
          <div className="mode-options">
            <label
              className={`mode-option ${mode === "manual" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="mode"
                value="manual"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />
              <Icon name="globe" />
              <strong>Public website research</strong>
              <span>Research the company domains you supply</span>
            </label>
            <label
              className={`mode-option ${mode === "demo" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="mode"
                value="demo"
                checked={mode === "demo"}
                onChange={() => setMode("demo")}
              />
              <Icon name="spark" />
              <strong>Explore a demo</strong>
              <span>Try a curated set of fictional accounts</span>
            </label>
          </div>
        </fieldset>
        {mode === "manual" ? (
          <label>
            Company websites
            <textarea
              required
              disabled={busy || !!created}
              rows={5}
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder={"company.com\nanother-company.com"}
            />
            <span className="input-hint">
              One public business domain per line, up to 10 (subject to your
              plan). No people search or verified emails.
            </span>
          </label>
        ) : (
          <div className="notice demo">
            <Icon name="info" />
            <span>
              All demo accounts, people, dates, and signals are fictional.
              They’re for evaluating the workflow only.
            </span>
          </div>
        )}
        {busy && (
          <div className="research-progress" role="status">
            <span className="spinner" />
            <div>
              <strong>{phase}</strong>
              <p>
                {isSaas
                  ? "Starting a durable background job. You can leave once it has been queued."
                  : "Public websites can take a moment. Keep this window open."}
              </p>
            </div>
          </div>
        )}
        <div className="dialog-footer">
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy} type="submit">
            {busy
              ? "Researching…"
              : created
                ? "Retry research"
                : "Create & research"}
            {!busy && <Icon name="arrow" size={16} />}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
