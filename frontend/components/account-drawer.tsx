"use client";
import { useState } from "react";
import type { Account, AccountStatus, Draft, Evidence } from "@/lib/types";
import { errorMessage } from "@/lib/api";
import { formatDate, initials, safeUrl, scoreLabel } from "@/lib/utils";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
import { useWorkspaceSession } from "./workspace-session";
function EvidenceCard({
  evidence,
  index,
}: {
  evidence: Evidence;
  index: number;
}) {
  const url = safeUrl(evidence.url);
  return (
    <article className="evidence-card">
      <div className="evidence-meta">
        <span className={`tag ${evidence.kind === "signal" ? "amber" : ""}`}>
          {evidence.kind === "signal"
            ? "Signal mention"
            : evidence.kind === "fit"
              ? "Fit evidence"
              : "Company source"}
        </span>
        <span className="source-number">
          EVIDENCE {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h4>{evidence.title}</h4>
      <p className="excerpt">“{evidence.excerpt}”</p>
      <div className="evidence-dates">
        <span>
          Published:{" "}
          {evidence.published_at
            ? formatDate(evidence.published_at)
            : "Unknown"}
        </span>
        <span>Retrieved: {formatDate(evidence.retrieved_at)}</span>
      </div>
      {evidence.is_demo ? (
        <div className="source-link fictional">
          <Icon name="info" size={13} /> Fictional source · not a live website
        </div>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link"
        >
          View source
          <Icon name="external" size={13} />
        </a>
      ) : (
        <div className="input-hint">Source URL not available</div>
      )}
    </article>
  );
}
export function AccountDrawer({
  account,
  onClose,
  onStatusChange,
  busy,
  statusError,
}: {
  account: Account;
  onClose: () => void;
  onStatusChange: (status: AccountStatus) => Promise<void>;
  busy: boolean;
  statusError: string;
}) {
  const { api } = useWorkspaceSession();
  const [tab, setTab] = useState<"overview" | "evidence" | "outreach">(
    "overview",
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function generate() {
    setDraftBusy(true);
    setError("");
    try {
      setDraft(
        await api<Draft>(`/accounts/${account.id}/draft`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDraftBusy(false);
    }
  }
  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draft.subject}\n\n${draft.body}`,
      );
      setCopied(true);
    } catch {
      setError(
        "Clipboard access is unavailable. Select and copy the draft text below.",
      );
    }
  }
  return (
    <Dialog title={`${account.name} account details`} onClose={onClose} drawer>
      <div className="account-head">
        <div className="company-logo large">{initials(account.name)}</div>
        <div className="account-title">
          <div className="account-tags">
            <span className="eyebrow">ACCOUNT INTELLIGENCE</span>
            {account.is_demo && (
              <span className="tag amber">Fictional demo</span>
            )}
          </div>
          <h2>{account.name}</h2>
          {account.is_demo ? (
            <span className="muted domain">{account.domain}</span>
          ) : safeUrl(`https://${account.domain}`) ? (
            <a
              className="domain"
              href={safeUrl(`https://${account.domain}`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {account.domain}
              <Icon name="external" size={13} />
            </a>
          ) : (
            <span className="muted">{account.domain}</span>
          )}
        </div>
      </div>
      {account.is_demo && (
        <div className="notice demo compact">
          <Icon name="info" size={16} /> Fictional company, sources, and
          signals. For demo use only.
        </div>
      )}
      {statusError && (
        <div className="notice error" role="alert">
          {statusError}
        </div>
      )}
      <div className="account-action-row">
        <button
          className={`btn ${account.status === "shortlisted" ? "shortlisted" : "primary"}`}
          disabled={busy}
          onClick={() =>
            onStatusChange(
              account.status === "shortlisted" ? "new" : "shortlisted",
            )
          }
        >
          <Icon
            name={account.status === "shortlisted" ? "check" : "bookmark"}
            size={17}
          />
          {account.status === "shortlisted"
            ? "Shortlisted"
            : "Add to shortlist"}
        </button>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() =>
            onStatusChange(account.status === "dismissed" ? "new" : "dismissed")
          }
        >
          {account.status === "dismissed" ? "Restore account" : "Dismiss"}
        </button>
      </div>
      <div
        className="drawer-tabs"
        role="tablist"
        aria-label="Account detail views"
      >
        {(["overview", "evidence", "outreach"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-controls={`panel-${t}`}
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(e) => {
              const tabs = ["overview", "evidence", "outreach"] as const;
              const index = tabs.indexOf(t);
              const next =
                e.key === "ArrowRight"
                  ? tabs[(index + 1) % 3]
                  : e.key === "ArrowLeft"
                    ? tabs[(index + 2) % 3]
                    : e.key === "Home"
                      ? tabs[0]
                      : e.key === "End"
                        ? tabs[2]
                        : null;
              if (next) {
                e.preventDefault();
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "overview"
              ? "Overview"
              : t === "evidence"
                ? `Evidence (${account.evidence.length})`
                : "Outreach draft"}
          </button>
        ))}
      </div>
      <div
        className="drawer-content"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "overview" && (
          <>
            <div className="score-panel">
              <div>
                <span className="eyebrow">ACCOUNT FIT</span>
                <div className="big-score">
                  {account.score}
                  <span>/100</span>
                </div>
                <span className="score-label">{scoreLabel(account.score)}</span>
              </div>
              <div className="score-confidence">
                <span
                  className={`tag ${account.confidence === "high" ? "green" : ""}`}
                >
                  {account.confidence} confidence
                </span>
                <span>
                  {account.decision_engine === "rules"
                    ? "Transparent rules-based scoring"
                    : "Decision engine scoring"}
                </span>
                <span>Researched {formatDate(account.researched_at)}</span>
              </div>
            </div>
            <section className="detail-section">
              <h3>Company snapshot</h3>
              <p>
                {account.description ||
                  "A company description is not available from the supplied sources."}
              </p>
              <div className="snapshot-grid">
                <div>
                  <span>Industry</span>
                  <strong>{account.industry || "Unknown"}</strong>
                </div>
                <div>
                  <span>Company size</span>
                  <strong>{account.employee_range || "Unknown"}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{account.location || "Unknown"}</strong>
                </div>
                <div>
                  <span>Review status</span>
                  <strong className="capitalize">{account.status}</strong>
                </div>
              </div>
            </section>
            <section className="detail-section">
              <h3>
                <Icon name="target" size={18} />
                Why it fits
              </h3>
              {account.why_fit.length ? (
                <ul className="reason-list">
                  {account.why_fit.map((reason, i) => (
                    <li key={i}>
                      <Icon name="check" size={16} />
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No confirmed fit evidence yet.</p>
              )}
            </section>
            <section className="detail-section">
              <h3>
                <Icon name="bolt" size={18} />
                Why now
              </h3>
              {account.why_now.length ? (
                <ul className="reason-list signals">
                  {account.why_now.map((reason, i) => (
                    <li key={i}>
                      <Icon name="bolt" size={16} />
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="notice soft compact">
                  No verified timing signal was found. Don’t imply urgency in
                  outreach.
                </div>
              )}
            </section>
            <section className="detail-section">
              <h3>Behind the score</h3>
              <p className="section-note">
                Every point has a reason. A fit score is a research aid, not a
                guarantee of buying intent.
              </p>
              <div className="breakdown-list">
                {account.score_breakdown.map((item, i) => (
                  <div className="breakdown" key={i}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>
                        {item.points}
                        <span className="muted"> / {item.max_points}</span>
                      </span>
                    </div>
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, item.max_points ? (item.points / item.max_points) * 100 : 0))}%`,
                        }}
                      />
                    </div>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="detail-section">
              <h3>
                <Icon name="info" size={18} />
                What we don’t know
              </h3>
              {account.unknowns.length ? (
                <ul className="unknown-list">
                  {account.unknowns.map((unknown, i) => (
                    <li key={i}>{unknown}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  No additional gaps were reported. Review the sources before
                  using this research.
                </p>
              )}
            </section>
            <section className="detail-section">
              <h3>
                <Icon name="users" size={18} />
                People & contact coverage
              </h3>
              <p className="section-note">
                Contact enrichment is not connected. No email addresses are
                inferred.
              </p>
              {account.contacts.length ? (
                account.contacts.map((contact, i) => (
                  <div className="contact-card" key={i}>
                    <div>
                      <strong>
                        {contact.name || "Contact not identified"}
                      </strong>
                      <span>{contact.role || "Role unknown"}</span>
                    </div>
                    <span
                      className={`tag ${contact.verification_status === "verified" ? "green" : ""}`}
                    >
                      {contact.verification_status === "not_available"
                        ? "Not available"
                        : contact.verification_status}
                    </span>
                    <p>{contact.note}</p>
                    {contact.email &&
                    contact.verification_status === "verified" ? (
                      <p>{contact.email}</p>
                    ) : (
                      <p className="input-hint">Verified email not available</p>
                    )}
                    {contact.source_url &&
                      safeUrl(contact.source_url) &&
                      !account.is_demo && (
                        <a
                          className="source-link"
                          href={safeUrl(contact.source_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Contact source
                          <Icon name="external" size={12} />
                        </a>
                      )}
                  </div>
                ))
              ) : (
                <div className="notice soft compact">
                  No contact identified. Verify the right buyer independently.
                </div>
              )}
            </section>
          </>
        )}
        {tab === "evidence" && (
          <>
            <div className="detail-section first">
              <h3>Go straight to the source</h3>
              <p className="section-note">
                Check the original context. Retrieval dates tell you when a page
                was read, not when an event happened.
              </p>
            </div>
            {account.evidence.length ? (
              account.evidence.map((e, i) => (
                <EvidenceCard key={e.id} evidence={e} index={i} />
              ))
            ) : (
              <div className="empty-small">
                <Icon name="file" size={28} />
                <h3>No sources yet</h3>
                <p>This account doesn’t have supporting source material.</p>
              </div>
            )}
          </>
        )}
        {tab === "outreach" && (
          <>
            <div className="detail-section first">
              <h3>Start with something relevant</h3>
              <p className="section-note">
                A draft grounded in this account’s evidence. Review and
                personalize it before you use it.
              </p>
            </div>
            <div className="notice soft compact">
              <Icon name="shield" size={16} /> Draft only. Nothing is sent, and
              no contact is enrolled.
            </div>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {draft ? (
              <>
                <article className="outreach-draft">
                  <span className="eyebrow">SUBJECT</span>
                  <p className="draft-subject">{draft.subject}</p>
                  <hr />
                  <div className="draft-body">{draft.body}</div>
                </article>
                <div className="draft-actions">
                  <button className="btn primary" onClick={copy}>
                    <Icon name={copied ? "check" : "copy"} size={16} />
                    {copied ? "Copied to clipboard" : "Copy draft"}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={generate}
                    disabled={draftBusy}
                  >
                    <Icon name="refresh" size={16} />
                    {draftBusy ? "Generating…" : "Regenerate"}
                  </button>
                </div>
                <div className="notice amber-note">
                  <Icon name="info" size={16} />
                  {draft.warning}
                </div>
                <section className="detail-section">
                  <h3>What this draft is based on</h3>
                  <ul className="unknown-list">
                    {draft.basis.map((basis, i) => (
                      <li key={i}>{basis}</li>
                    ))}
                  </ul>
                  <p className="input-hint">
                    Generated using an evidence-grounded template
                  </p>
                </section>
              </>
            ) : (
              <div className="draft-empty">
                <span className="modal-icon">
                  <Icon name="mail" size={25} />
                </span>
                <h3>Less generic. More grounded.</h3>
                <p>
                  Use the account’s fit and public evidence to write a
                  thoughtful first touch.
                </p>
                <button
                  className="btn primary"
                  onClick={generate}
                  disabled={draftBusy}
                >
                  {draftBusy ? (
                    <>
                      <span className="spinner" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Icon name="spark" size={16} />
                      Generate outreach draft
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
