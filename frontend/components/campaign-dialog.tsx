"use client";
import { useEffect, useRef, useState } from "react";
import type {
  Campaign,
  CampaignInput,
  DiscoveryStatus,
  Profile,
  WorkspaceData,
} from "@/lib/types";
import {
  createCampaign,
  discoveryReady,
  jsonBody,
  errorMessage,
} from "@/lib/api";
import { suggestTargetBrief } from "@/lib/target-brief";
import { parseProspectImport } from "@/lib/prospect-import";
import { tokens } from "@/lib/utils";
import { Dialog } from "./dialog";
import { Icon } from "./icons";
import { useWorkspaceSession } from "./workspace-session";
import {
  DiscoveryReadiness,
  TargetBrief,
  targetFields,
} from "./discovery-readiness";

export function CampaignDialog({
  workspace,
  onClose,
  onCreated,
}: {
  workspace: WorkspaceData;
  onClose: () => void;
  onCreated: (campaign: Campaign) => Promise<void>;
}) {
  const { api, mode: appMode } = useWorkspaceSession();
  const isSaas = appMode === "saas";
  const requestKey = useRef<string | null>(null);
  const submitLock = useRef(false);
  const suggestionLock = useRef(false);
  const targetCountEdited = useRef(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"discovery" | "manual">("discovery");
  const [website, setWebsite] = useState(workspace.website || "");
  const [companyName, setCompanyName] = useState(
    workspace.profile?.company_name || workspace.name,
  );
  const [description, setDescription] = useState(
    workspace.profile?.description || "",
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      targetFields.map(([key]) => [
        key,
        (workspace.profile?.[key] || []).join(", "),
      ]),
    ),
  );
  const [targetCount, setTargetCount] = useState("20");
  const [domains, setDomains] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [briefNote, setBriefNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [importNote, setImportNote] = useState("");
  const [created, setCreated] = useState<Campaign | null>(null);
  const [researchStarted, setResearchStarted] = useState(false);
  const [review, setReview] = useState<CampaignInput | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [capabilities, setCapabilities] = useState<DiscoveryStatus | null>(
    null,
  );
  const [checking, setChecking] = useState(true);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<DiscoveryStatus>("/discovery/status", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setCapabilities(result);
        if (!targetCountEdited.current)
          setTargetCount(
            String(Math.max(1, Math.min(20, result.max_target_count || 30))),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setCapabilities(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [api]);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  const maximum =
    mode === "manual"
      ? 10
      : Math.max(1, Math.min(30, capabilities?.max_target_count || 30));
  const canResearch = mode === "manual" || discoveryReady(capabilities);

  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    setImportNote("");
    try {
      if (file.size > 100_000) throw new Error("Keep imports under 100 KB.");
      const parsed = parseProspectImport(await file.text());
      if (!parsed.domains.length)
        throw new Error(
          "No valid public company websites found. Use a Website or Domain column.",
        );
      setDomains(parsed.domains.join("\n"));
      setImportNote(
        `${parsed.domains.length} unique company websites imported${parsed.rejected ? `; ${parsed.rejected} invalid entries skipped` : ""}. Review before starting research.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function suggestBrief(fromWebsite: boolean) {
    if (suggestionLock.current) return;
    suggestionLock.current = true;
    setSuggesting(true);
    setError("");
    try {
      const result = fromWebsite
        ? await api<{ profile: Profile; website: string }>(
            "/campaigns/suggest-brief",
            { method: "POST", body: jsonBody({ website: website.trim() }) },
          )
        : { profile: suggestTargetBrief(companyName, description), website };
      setCompanyName(result.profile.company_name);
      setDescription(result.profile.description);
      if (fromWebsite) setWebsite(result.website);
      setValues(
        Object.fromEntries(
          targetFields.map(([key]) => [key, result.profile[key].join(", ")]),
        ),
      );
      setBriefNote(
        fromWebsite
          ? "Draft suggestions from public website language. Confirm that these are your buyers, then choose company sizes, geographies and exclusions."
          : "Draft targeting hypotheses from your offering description. These are suggestions to edit, not verified facts about your customers.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      suggestionLock.current = false;
      setSuggesting(false);
    }
  }

  function prepareReview(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const parsed =
        mode === "manual"
          ? parseProspectImport(domains)
          : { domains: [], rejected: 0 };
      if (mode === "manual" && !parsed.domains.length)
        throw new Error("Add at least one public company website.");
      if (parsed.rejected)
        throw new Error(
          `${parsed.rejected} invalid website entries found. Remove them before continuing.`,
        );
      const count =
        mode === "manual" ? parsed.domains.length : Number(targetCount);
      if (!Number.isInteger(count) || count < 1 || count > maximum)
        throw new Error(`Choose between 1 and ${maximum} companies.`);
      if (!name.trim() || !companyName.trim() || !description.trim())
        throw new Error(
          "Add a campaign name, your company name, and an offering description.",
        );
      let offeringWebsite: string | null = null;
      if (website.trim()) {
        const parsedWebsite = parseProspectImport(website.trim());
        if (parsedWebsite.domains.length !== 1 || parsedWebsite.rejected)
          throw new Error("Use one public website for your offering.");
        offeringWebsite = `https://${parsedWebsite.domains[0]}`;
      }
      const profile = {
        company_name: companyName.trim(),
        description: description.trim(),
        ...Object.fromEntries(
          targetFields.map(([key]) => [key, tokens(values[key])]),
        ),
      } as Profile;
      setReview({
        name: name.trim(),
        mode,
        domains: parsed.domains,
        target_count: count,
        offering_website: offeringWebsite,
        profile_snapshot: profile,
      });
      setConfirmed(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function save(startResearch: boolean) {
    if (
      submitLock.current ||
      !review ||
      !confirmed ||
      (startResearch && !canResearch)
    )
      return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      setPhase("Saving the reviewed campaign brief…");
      let campaign = created;
      if (!campaign) {
        campaign = await createCampaign(api, review);
        setCreated(campaign);
      }
      if (startResearch && !researchStarted) {
        setPhase(
          mode === "discovery"
            ? "Queueing customer discovery…"
            : "Queueing public website research…",
        );
        if (!requestKey.current) requestKey.current = crypto.randomUUID();
        const result = await api<Campaign>(
          `/campaigns/${campaign.id}/research`,
          {
            method: "POST",
            body: jsonBody(
              isSaas ? { idempotencyKey: requestKey.current } : {},
            ),
          },
        );
        campaign = isSaas ? { ...campaign, status: "researching" } : result;
        setCreated(campaign);
        setResearchStarted(true);
      }
      await onCreated(campaign);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="New customer campaign"
      onClose={onClose}
      wide
      busy={busy || suggesting}
    >
      <div className="dialog-heading">
        <span className="modal-icon">
          <Icon name="spark" size={24} />
        </span>
        <span className="eyebrow">
          {review
            ? "02 / REVIEW YOUR TARGETING"
            : "01 / DEFINE YOUR NEXT CUSTOMERS"}
        </span>
        <h2 ref={reviewHeading} tabIndex={-1}>
          {review
            ? "A clear brief. A focused search."
            : "Find customers for your offering"}
        </h2>
        <p>
          {review
            ? "These criteria are saved with this campaign. Future workspace profile changes won’t change this brief."
            : "Start with your website and an editable target brief. No prospect list required."}
        </p>
      </div>
      <form
        onSubmit={
          review
            ? (e) => {
                e.preventDefault();
                void save(canResearch);
              }
            : prepareReview
        }
        className="campaign-form"
      >
        {error && (
          <div className="notice error" role="alert">
            <Icon name="info" />
            {error}
          </div>
        )}
        {review ? (
          <>
            <div className="review-campaign-name">
              <h3>{review.name}</h3>
              <span className="tag">
                {mode === "discovery" ? "Find customers" : "Manual import"}
              </span>
            </div>
            <TargetBrief
              profile={review.profile_snapshot}
              website={review.offering_website}
              targetCount={review.target_count}
              manual={mode === "manual"}
            />
            {mode === "manual" && (
              <div className="review-domains">
                <strong>Company websites</strong>
                <p>{review.domains.join(", ")}</p>
              </div>
            )}
            {mode === "discovery" && (
              <DiscoveryReadiness status={capabilities} loading={checking} />
            )}
            <label className="review-confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy || !!created}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I’ve reviewed the offering and targeting criteria for this
                campaign.
              </span>
            </label>
            {created && (
              <p className="notice soft">
                Campaign saved. Retrying uses the same campaign, without
                creating another.
              </p>
            )}
          </>
        ) : (
          <fieldset className="campaign-edit-fields" disabled={suggesting}>
            <legend className="sr-only">Offering and target criteria</legend>
            <fieldset className="campaign-mode">
              <legend>How would you like to start?</legend>
              <div className="mode-options">
                <label
                  className={`mode-option ${mode === "discovery" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="campaign-mode"
                    value="discovery"
                    checked={mode === "discovery"}
                    onChange={() => setMode("discovery")}
                  />
                  <Icon name="spark" size={20} />
                  <strong>Find customers</strong>
                  <span>Discover companies from your target brief</span>
                </label>
                <label
                  className={`mode-option ${mode === "manual" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="campaign-mode"
                    value="manual"
                    checked={mode === "manual"}
                    onChange={() => setMode("manual")}
                  />
                  <Icon name="file" size={20} />
                  <strong>Manual import</strong>
                  <span>Already have company websites? Bring up to 10</span>
                </label>
              </div>
            </fieldset>
            <label>
              Campaign name
              <input
                autoFocus
                required
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. October customer discovery"
              />
            </label>
            <div className="form-grid campaign-brief-fields">
              <label className="full">
                Your app or offering website
                <input
                  value={website}
                  maxLength={2000}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                />
                <span className="input-hint">
                  Prefilled from your workspace. This is what you sell, not a
                  prospect website.
                </span>
              </label>
              <label className="full">
                Your company or product name
                <input
                  required
                  value={companyName}
                  maxLength={200}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </label>
              <label className="full">
                What does your offering help customers do?
                <textarea
                  required
                  rows={3}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="We help operations teams automate their client workflows…"
                />
              </label>
            </div>
            <div className="brief-generation-actions">
              <button
                className="btn secondary small"
                type="button"
                disabled={suggesting || !website.trim()}
                onClick={() => void suggestBrief(true)}
              >
                {suggesting ? "Drafting…" : "Draft brief from website"}
              </button>
              <button
                className="btn secondary small"
                type="button"
                disabled={suggesting || description.trim().length < 20}
                onClick={() => void suggestBrief(false)}
              >
                Suggest from offering
              </button>
            </div>
            {briefNote && (
              <p className="notice soft" role="status">
                {briefNote}
              </p>
            )}
            <div className="target-brief-heading">
              <span className="eyebrow">EDITABLE TARGET BRIEF</span>
              <p>
                {workspace.profile
                  ? "Drafted from your workspace profile. Review every field before research."
                  : "Define who could benefit from your offering. These details guide the search."}
              </p>
            </div>
            <div className="form-grid campaign-brief-fields">
              {targetFields.map(([key, label, placeholder]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={values[key]}
                    onChange={(e) =>
                      setValues({ ...values, [key]: e.target.value })
                    }
                    placeholder={placeholder}
                  />
                  <span className="input-hint">
                    Separate values with commas
                  </span>
                </label>
              ))}
            </div>
            {mode === "discovery" ? (
              <>
                <label>
                  Maximum companies to find
                  <input
                    type="number"
                    min={1}
                    max={maximum}
                    step={1}
                    required
                    value={targetCount}
                    onChange={(e) => {
                      targetCountEdited.current = true;
                      setTargetCount(e.target.value);
                    }}
                  />
                  <span className="input-hint">
                    Up to {maximum} companies per campaign. This is a limit, not
                    a promise of matches.
                  </span>
                </label>
                <DiscoveryReadiness status={capabilities} loading={checking} />
              </>
            ) : (
              <>
                <label>
                  Import a prospect list
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <span className="input-hint">
                    CSV with a Website or Domain column, or a text list. Up to
                    100 KB. Files are parsed in your browser; only reviewed
                    domains are submitted.
                  </span>
                </label>
                {importNote && (
                  <p className="notice" role="status">
                    {importNote}
                  </p>
                )}
                <label>
                  Company websites
                  <textarea
                    required
                    rows={5}
                    value={domains}
                    onChange={(e) => setDomains(e.target.value)}
                    placeholder={"lowcode.agency\nxray.tech"}
                  />
                  <span className="input-hint">
                    One public business domain per line, up to 10 subject to
                    your plan. Duplicates are merged.
                  </span>
                </label>
              </>
            )}
          </fieldset>
        )}
        {busy && (
          <div className="research-progress" role="status">
            <span className="spinner" />
            <div>
              <strong>{phase}</strong>
              <p>
                {isSaas
                  ? "Keep this window open until your request is confirmed."
                  : "Public websites can take a moment. Keep this window open."}
              </p>
            </div>
          </div>
        )}
        <div className="dialog-footer campaign-actions">
          <button
            className="btn secondary"
            type="button"
            disabled={busy || suggesting}
            onClick={() => {
              if (review && !created) {
                setReview(null);
                setConfirmed(false);
                setError("");
                reviewHeading.current?.focus();
              } else onClose();
            }}
          >
            {review && !created ? "Back to edit" : "Cancel"}
          </button>
          {review ? (
            <>
              <button
                className={`btn ${canResearch ? "secondary" : "primary"}`}
                type="button"
                disabled={busy || !confirmed}
                onClick={() => void save(false)}
              >
                {busy
                  ? "Saving…"
                  : created
                    ? "Open saved campaign"
                    : "Save draft"}
              </button>
              {canResearch && !researchStarted && (
                <button
                  className="btn primary"
                  disabled={busy || !confirmed}
                  type="submit"
                >
                  {busy
                    ? "Starting…"
                    : created
                      ? "Retry research"
                      : mode === "discovery"
                        ? "Find customers"
                        : "Create & research"}
                  {!busy && <Icon name="arrow" size={16} />}
                </button>
              )}
            </>
          ) : (
            <button className="btn primary" type="submit" disabled={suggesting}>
              Review campaign
              <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
        <p className="campaign-safety-note">
          <Icon name="shield" size={13} />
          No outreach is sent. A saved draft does not start research.
        </p>
      </form>
    </Dialog>
  );
}
