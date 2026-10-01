"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Account,
  AccountStatus,
  Campaign,
  Health,
  WorkspaceData,
  ResearchJob,
} from "@/lib/types";
import { errorMessage, jsonBody } from "@/lib/api";
import {
  filterAccounts,
  formatDate,
  initials,
  scoreLabel,
  signalCount,
  sourceCount,
  replaceSelectedAccount,
} from "@/lib/utils";
import { Icon } from "./icons";
import { useWorkspaceSession } from "./workspace-session";
import { Dialog } from "./dialog";
import { ProfileEditor } from "./profile-editor";
import { CampaignDialog } from "./campaign-dialog";
import { AccountDrawer } from "./account-drawer";
import { BillingPanel } from "./billing-panel";
import { activeJob } from "@/lib/jobs";

type View = "accounts" | "campaigns" | "profile" | "shortlist" | "billing";
export default function Workspace({
  organizationControl,
  userControl,
}: {
  organizationControl?: React.ReactNode;
  userControl?: React.ReactNode;
}) {
  const { api, request, mode: appMode, isAdmin } = useWorkspaceSession();
  const isSaas = appMode === "saas";
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [jobRevision, setJobRevision] = useState(0);
  const [jobError, setJobError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [provisionBusy, setProvisionBusy] = useState(false);
  const researchRequest = useRef<{ campaignId: string; key: string } | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [view, setView] = useState<View>("accounts");
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [fit, setFit] = useState("all");
  const [sort, setSort] = useState("score");
  const [website, setWebsite] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [researchBusy, setResearchBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [newCampaign, setNewCampaign] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
  const detailRequest = useRef(0);
  const activeCampaignRef = useRef(selectedId);
  useEffect(() => {
    activeCampaignRef.current = selectedId;
  }, [selectedId]);
  const campaign = campaigns.find((c) => c.id === selectedId) || null;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [w, c, h] = await Promise.all([
        api<WorkspaceData | null>("/workspace"),
        api<Campaign[]>("/campaigns"),
        api<Health>("/health").catch(() => null),
      ]);
      setWorkspace(w);
      setCampaigns(c);
      setHealth(h);
      setSelectedId((old) =>
        old && c.some((item) => item.id === old) ? old : c[0]?.id || null,
      );
      setWebsite(w?.website || "");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setAccountLoading(true);
        setError("");
      }
    });
    api<Account[]>(`/campaigns/${selectedId}/accounts`)
      .then((a) => {
        if (!cancelled) setAccounts(a);
      })
      .catch((e) => {
        if (!cancelled) {
          setAccounts([]);
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) setAccountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, api]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!mobileOpen) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [mobileOpen]);
  useEffect(() => {
    if (!isSaas || !selectedId) return;
    const scope = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      try {
        const current = await api<ResearchJob | null>(
          `/campaigns/${selectedId}/job`,
          { signal: scope.signal },
        );
        if (scope.signal.aborted) return;
        setJob(current);
        setJobError("");
        failures = 0;
        if (activeJob(current)) {
          timer = setTimeout(poll, 1500);
          return;
        }
        if (current) {
          const [list, updated] = await Promise.all([
            api<Campaign[]>("/campaigns", { signal: scope.signal }),
            api<Account[]>(`/campaigns/${selectedId}/accounts`, {
              signal: scope.signal,
            }),
          ]);
          if (!scope.signal.aborted) {
            setCampaigns(list);
            setAccounts(updated);
          }
        }
      } catch (e) {
        if (scope.signal.aborted) return;
        setJobError(errorMessage(e));
        timer = setTimeout(
          poll,
          Math.min(15000, 1500 * 2 ** Math.min(++failures, 4)),
        );
      }
    }
    void Promise.resolve().then(() => {
      if (!scope.signal.aborted) {
        setJob(null);
        setJobError("");
        void poll();
      }
    });
    return () => {
      scope.abort();
      clearTimeout(timer);
    };
  }, [api, isSaas, selectedId, jobRevision]);
  async function cancelResearch() {
    if (!job || cancelBusy) return;
    setCancelBusy(true);
    setJobError("");
    try {
      setJob(
        await api<ResearchJob>(`/jobs/${job.id}/cancel`, {
          method: "POST",
          body: "{}",
        }),
      );
      setJobRevision((revision) => revision + 1);
      setToast(
        "Cancellation requested. Completed account research is preserved.",
      );
    } catch (e) {
      setJobError(errorMessage(e));
    } finally {
      setCancelBusy(false);
    }
  }
  async function provision() {
    if (provisionBusy) return;
    setProvisionBusy(true);
    setError("");
    try {
      await api<WorkspaceData>("/workspace", { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProvisionBusy(false);
    }
  }
  const filtered = useMemo(
    () =>
      filterAccounts(
        accounts,
        query,
        view === "shortlist" ? "shortlisted" : status,
        fit,
        sort,
      ),
    [accounts, query, status, fit, sort, view],
  );
  const shortlisted = accounts.filter((a) => a.status === "shortlisted").length;
  const sources = accounts.reduce((total, a) => total + a.evidence.length, 0);
  function navigate(next: View) {
    setView(next);
    setMobileOpen(false);
    setQuery("");
    setStatus("all");
    setFit("all");
  }
  function chooseCampaign(id: string) {
    navigate("accounts");
    if (id === selectedId) return;
    setSelectedId(id);
    setJob(null);
    setJobError("");
    setSelectedAccount(null);
    detailRequest.current += 1;
    setAccounts([]);
    setAccountLoading(true);
  }
  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setAnalyzing(true);
    setError("");
    try {
      const w = await api<WorkspaceData>("/workspace/analyze", {
        method: "POST",
        body: jsonBody({ website: website.trim() }),
      });
      setWorkspace(w);
      setView("profile");
      setToast("Your draft customer profile is ready to review");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAnalyzing(false);
    }
  }
  async function onCreated(c: Campaign) {
    const list = await api<Campaign[]>("/campaigns");
    setCampaigns(list);
    setSelectedId(c.id);
    setAccounts(await api<Account[]>(`/campaigns/${c.id}/accounts`));
    navigate("accounts");
    setJobRevision((revision) => revision + 1);
    setToast(
      c.status === "complete"
        ? "Research complete. Your accounts are ready."
        : c.status === "partial"
          ? "Research finished with some gaps. Review the campaign notes."
          : "Campaign created. Review the research status.",
    );
  }
  async function research() {
    if (!campaign || researchBusy || activeJob(job)) return;
    setResearchBusy(true);
    setError("");
    const id = campaign.id;
    if (researchRequest.current?.campaignId !== id)
      researchRequest.current = { campaignId: id, key: crypto.randomUUID() };
    try {
      const result = await api<Campaign | ResearchJob>(
        `/campaigns/${id}/research`,
        {
          method: "POST",
          body: jsonBody(
            isSaas ? { idempotencyKey: researchRequest.current.key } : {},
          ),
        },
      );
      researchRequest.current = null;
      const list = await api<Campaign[]>("/campaigns");
      setCampaigns(list);
      if (activeCampaignRef.current === id) {
        if (isSaas) {
          setJob(result as ResearchJob);
          setJobRevision((revision) => revision + 1);
        } else setAccounts(await api<Account[]>(`/campaigns/${id}/accounts`));
      }
      setToast(
        isSaas
          ? "Research queued. You can leave this page and return to its progress."
          : `${campaign.name}: research ${(result as Campaign).status}`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResearchBusy(false);
    }
  }
  async function openAccount(account: Account) {
    const request = ++detailRequest.current;
    setSelectedAccount(account);
    setStatusError("");
    try {
      const a = await api<Account>(`/accounts/${account.id}`);
      if (request === detailRequest.current) setSelectedAccount(a);
    } catch (e) {
      if (request === detailRequest.current) setStatusError(errorMessage(e));
    }
  }
  async function changeStatus(next: AccountStatus) {
    if (!selectedAccount) return;
    const request = ++detailRequest.current;
    setStatusBusy(true);
    setStatusError("");
    try {
      const a = await api<Account>(`/accounts/${selectedAccount.id}`, {
        method: "PATCH",
        body: jsonBody({ status: next }),
      });
      if (request === detailRequest.current)
        setSelectedAccount((current) => replaceSelectedAccount(current, a));
      setAccounts((old) => old.map((item) => (item.id === a.id ? a : item)));
      setToast(
        next === "shortlisted"
          ? "Account added to your shortlist"
          : next === "dismissed"
            ? "Account dismissed"
            : "Account restored",
      );
    } catch (e) {
      if (request === detailRequest.current) setStatusError(errorMessage(e));
    } finally {
      setStatusBusy(false);
    }
  }
  async function toggleShortlist(account: Account) {
    setStatusBusy(true);
    setError("");
    try {
      const a = await api<Account>(`/accounts/${account.id}`, {
        method: "PATCH",
        body: jsonBody({
          status: account.status === "shortlisted" ? "new" : "shortlisted",
        }),
      });
      setAccounts((old) => old.map((item) => (item.id === a.id ? a : item)));
      setToast(
        a.status === "shortlisted"
          ? "Account added to your shortlist"
          : "Account removed from your shortlist",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatusBusy(false);
    }
  }
  async function exportCsv() {
    if (!campaign) return;
    setExportBusy(true);
    setError("");
    try {
      const response = await request(`/campaigns/${campaign.id}/export.csv`);
      if (!response.ok)
        throw new Error(
          "CSV export failed. Try again after research has finished.",
        );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `signalfoundry-${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast("Campaign CSV downloaded");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setExportBusy(false);
    }
  }
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link className="brand" href="/" aria-label="SignalFoundry home">
          <span className="brand-icon">
            <i />
            <i />
            <i />
          </span>
          <span>
            Signal<span className="brand-light">Foundry</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        {organizationControl && (
          <div className="organization-control">{organizationControl}</div>
        )}
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {initials(workspace?.profile?.company_name || "My Workspace")}
          </span>
          <div>
            <strong>
              {workspace?.profile?.company_name || "Your workspace"}
            </strong>
            <span>
              {isSaas
                ? isAdmin
                  ? "Organization administrator"
                  : "Organization member"
                : "Independent local demo"}
            </span>
          </div>
          <span className="workspace-lock">
            <Icon name="shield" size={15} />
          </span>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav className="main-nav">
          <button
            className={view === "accounts" ? "active" : ""}
            onClick={() => navigate("accounts")}
          >
            <Icon name="accounts" />
            Accounts
            <span className="nav-count">{campaign?.account_count || 0}</span>
          </button>
          <button
            className={view === "campaigns" ? "active" : ""}
            onClick={() => navigate("campaigns")}
          >
            <Icon name="grid" />
            Campaigns
            {campaigns.length > 0 && (
              <span className="nav-count">{campaigns.length}</span>
            )}
          </button>
          <button
            className={view === "shortlist" ? "active" : ""}
            onClick={() => navigate("shortlist")}
          >
            <Icon name="bookmark" />
            Shortlist
            {shortlisted > 0 && (
              <span className="nav-count">{shortlisted}</span>
            )}
          </button>
          <button
            className={view === "profile" ? "active" : ""}
            onClick={() => navigate("profile")}
          >
            <Icon name="target" />
            Customer profile
          </button>
          {isSaas && (
            <button
              className={view === "billing" ? "active" : ""}
              onClick={() => navigate("billing")}
            >
              <Icon name="shield" />
              Plan & billing
            </button>
          )}
        </nav>
        <div className="sidebar-section">
          <div className="nav-label-row">
            <span className="nav-label">RECENT CAMPAIGNS</span>
            <button
              className="plain-icon"
              disabled={!workspace?.profile}
              title="New campaign"
              aria-label="New campaign"
              onClick={() => setNewCampaign(true)}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          {campaigns.length ? (
            campaigns.slice(0, 4).map((c) => (
              <button
                key={c.id}
                className={`campaign-nav ${selectedId === c.id ? "selected" : ""}`}
                onClick={() => chooseCampaign(c.id)}
              >
                <span className="small-dot blue" />
                <span>{c.name}</span>
              </button>
            ))
          ) : (
            <p className="sidebar-empty">
              Your next growth opportunity starts with a campaign.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="clarity-card">
            <span className="clarity-art">
              <Icon name="spark" size={23} />
              <span />
              <span />
            </span>
            <h3>Evidence over instinct.</h3>
            <p>Get to the why behind every account on your list.</p>
            <button onClick={() => setShowHelp(true)}>
              How it works
              <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="local-status">
            <span className={`small-dot ${health ? "mint" : "gray"}`} />
            <div>
              <strong>
                {health
                  ? isSaas
                    ? "Private organization"
                    : "Local demo workspace"
                  : "Connecting to service"}
              </strong>
              <span>No outreach is sent</span>
            </div>
            <Icon name="shield" size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb">Workspace</span>
            <Icon name="chevron" size={12} />
            <span>
              {view === "billing"
                ? "Plan & billing"
                : view === "profile"
                  ? "Customer profile"
                  : view === "campaigns"
                    ? "Campaigns"
                    : view === "shortlist"
                      ? "Shortlist"
                      : "Account research"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="engine-badge">
              <span className="small-dot mint" />
              {health?.decision_engine === "jev"
                ? "Decision engine"
                : "Rules-based intelligence"}
            </span>
            <button
              className="help-btn"
              onClick={() => setShowHelp(true)}
              aria-label="How SignalFoundry works"
            >
              <Icon name="info" size={19} />
            </button>
            {userControl || (
              <span className="user-avatar" title="Independent local demo">
                SF
              </span>
            )}
          </div>
        </header>
        <main className="main-content" id="main-content">
          {error && (
            <div className="notice error page-error" role="alert">
              <Icon name="info" />
              <span>{error}</span>
              <button
                className="icon-btn"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-page" aria-live="polite">
              <span className="spinner" />
              <p>Opening your workspace…</p>
              <div className="skeleton-heading" />
              <div className="skeleton-cards">
                {[1, 2, 3].map((n) => (
                  <div key={n} />
                ))}
              </div>
            </div>
          ) : !workspace ? (
            <div className="connection-state">
              <span className="modal-icon">
                <Icon name="globe" size={30} />
              </span>
              <h1>
                {isSaas && !error
                  ? "Initialize your organization workspace"
                  : "Let’s get connected"}
              </h1>
              <p>
                {isSaas
                  ? error
                    ? "Your organization’s data is unavailable. Check your connection or try again."
                    : isAdmin
                      ? "Create a private research workspace for this organization."
                      : "An administrator must initialize this organization’s workspace before you can continue."
                  : "SignalFoundry needs its local research server to load your workspace."}
              </p>
              {isSaas && isAdmin && !error && (
                <button
                  className="btn primary"
                  disabled={provisionBusy}
                  onClick={provision}
                >
                  {provisionBusy ? "Initializing…" : "Initialize workspace"}
                </button>
              )}
              <button className="btn primary" onClick={load}>
                <Icon name="refresh" size={16} />
                Retry connection
              </button>
            </div>
          ) : (
            <>
              {view === "billing" ? (
                <BillingPanel />
              ) : view === "profile" ? (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">DEFINE YOUR DIRECTION</span>
                      <h1>Your ideal customer, clarified.</h1>
                      <p>
                        The right accounts start with a clear picture of who you
                        serve.
                      </p>
                    </div>
                    {workspace.profile && (
                      <button
                        className="btn primary"
                        onClick={() => setNewCampaign(true)}
                      >
                        <Icon name="plus" size={17} />
                        New campaign
                      </button>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="analysis-card">
                      <div>
                        <Icon name="globe" size={21} />
                        <h3>Start with your website</h3>
                        <p>
                          Extract a draft profile from your public homepage.
                        </p>
                      </div>
                      <form onSubmit={analyze}>
                        <label className="sr-only" htmlFor="profile-website">
                          Your company website
                        </label>
                        <input
                          id="profile-website"
                          required
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          placeholder="https://yourcompany.com"
                          disabled={analyzing}
                        />
                        <button className="btn secondary" disabled={analyzing}>
                          {analyzing ? (
                            <span className="spinner" />
                          ) : (
                            <Icon name="spark" size={16} />
                          )}{" "}
                          {analyzing ? "Analyzing…" : "Analyze website"}
                        </button>
                      </form>
                    </div>
                  )}
                  {isSaas && (
                    <div className="notice soft">
                      {isAdmin
                        ? "Analyze your public website or define your customer profile below. Your administrator must configure the research worker before website analysis is available."
                        : "You can review this profile. An organization administrator can change targeting preferences."}
                    </div>
                  )}
                  <ProfileEditor
                    key={JSON.stringify(workspace.profile)}
                    profile={workspace.profile}
                    onSaved={(w) => {
                      setWorkspace(w);
                      setToast("Customer profile saved");
                    }}
                  />
                </>
              ) : view === "campaigns" ? (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        FOCUSED RESEARCH, CLEAR OPPORTUNITIES
                      </span>
                      <h1>Every campaign starts a possibility.</h1>
                      <p>
                        Bring your target accounts into focus, one research run
                        at a time.
                      </p>
                    </div>
                    <button
                      className="btn primary"
                      onClick={() =>
                        workspace.profile
                          ? setNewCampaign(true)
                          : navigate("profile")
                      }
                    >
                      <Icon name="plus" size={17} />
                      New campaign
                    </button>
                  </div>
                  {campaigns.length ? (
                    <div className="campaign-grid">
                      {campaigns.map((c) => (
                        <button
                          className="campaign-card"
                          key={c.id}
                          onClick={() => chooseCampaign(c.id)}
                        >
                          <div className="campaign-card-top">
                            <span className="campaign-card-icon">
                              <Icon
                                name="globe"
                                size={24}
                              />
                            </span>
                            <span
                              className={`tag ${c.status === "complete" ? "green" : c.status === "failed" ? "red" : ""}`}
                            >
                              {c.status}
                            </span>
                          </div>
                          <span className="eyebrow">PUBLIC WEBSITE RESEARCH</span>
                          <h3>{c.name}</h3>
                          <div className="campaign-card-stats">
                            <span>
                              <strong>{c.account_count}</strong> accounts
                            </span>
                            <span>
                              <strong>{c.qualified_count}</strong> qualified
                            </span>
                          </div>
                          <div className="campaign-card-footer">
                            <span>{formatDate(c.created_at)}</span>
                            <span>
                              Open campaign
                              <Icon name="arrow" size={14} />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyCampaign
                      onCreate={() =>
                        workspace.profile
                          ? setNewCampaign(true)
                          : navigate("profile")
                      }
                    />
                  )}
                </>
              ) : campaign ? (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {view === "shortlist"
                          ? "GOOD FITS. WORTH A CONVERSATION."
                          : "THE RIGHT ACCOUNTS. THE REASONS WHY."}
                      </span>
                      <h1>
                        {view === "shortlist"
                          ? "Your shortlist, backed by evidence."
                          : "Your next great customers."}
                      </h1>
                      <p>
                        {view === "shortlist"
                          ? "The accounts you’ve saved for a more thoughtful next step."
                          : "Cut through the noise. Focus on the companies that fit, with the evidence to prove it."}
                      </p>
                    </div>
                    <button
                      className="btn primary"
                      onClick={() => setNewCampaign(true)}
                    >
                      <Icon name="plus" size={17} />
                      New campaign
                    </button>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      icon="accounts"
                      label="Accounts researched"
                      value={campaign.account_count}
                      detail="In this campaign"
                    />
                    <Stat
                      icon="target"
                      label="Qualified accounts"
                      value={campaign.qualified_count}
                      detail="Fit score of 65 or higher"
                      green
                    />
                    <Stat
                      icon="bookmark"
                      label="Your shortlist"
                      value={shortlisted}
                      detail="Selected for the next step"
                    />
                    <Stat
                      icon="file"
                      label="Evidence collected"
                      value={sources}
                      detail="Public evidence records"
                    />
                  </div>
                  <section className="accounts-panel">
                    <div className="table-heading">
                      <div>
                        <div className="campaign-title">
                          <span className="small-dot mint" />
                          <h2>{campaign.name}</h2>
                          <span className="tag">{campaign.status}</span>
                        </div>
                        <p>
                          Ranked by fit. Open an account to see the full
                          picture.
                        </p>
                      </div>
                      <div className="table-actions">
                        {campaign.status !== "researching" && (
                          <button
                            className="btn secondary small"
                            onClick={research}
                            disabled={researchBusy || activeJob(job)}
                          >
                            {researchBusy ? (
                              <span className="spinner" />
                            ) : (
                              <Icon name="refresh" size={15} />
                            )}{" "}
                            {researchBusy
                              ? "Researching…"
                              : campaign.status === "complete"
                                ? "Re-research"
                                : "Run research"}
                          </button>
                        )}
                        <button
                          className="btn secondary small"
                          onClick={exportCsv}
                          disabled={
                            !accounts.length || exportBusy || accountLoading
                          }
                        >
                          <Icon name="download" size={15} />
                          {exportBusy ? "Exporting…" : "Export CSV"}
                        </button>
                      </div>
                    </div>
                    {isSaas && (job || jobError) && (
                      <div className="job-status" aria-live="polite">
                        {job && (
                          <>
                            <strong>Research {job.status}</strong>
                            <span>
                              Attempt {job.attempt} of {job.max_attempts}
                            </span>
                            {activeJob(job) && (
                              <>
                                <span className="spinner" />
                                <button
                                  className="btn secondary small"
                                  disabled={cancelBusy}
                                  onClick={cancelResearch}
                                >
                                  {cancelBusy
                                    ? "Cancelling…"
                                    : "Cancel research"}
                                </button>
                                <span className="input-hint">
                                  The person who started this run or an
                                  administrator can cancel it.
                                </span>
                              </>
                            )}
                            {job.error && <p>{job.error}</p>}
                          </>
                        )}
                        {jobError && (
                          <p role="alert">
                            {jobError} Status checks will retry automatically.
                          </p>
                        )}
                      </div>
                    )}
                    {campaign.errors.length > 0 && (
                      <details className="campaign-errors">
                        <summary>
                          <Icon name="info" size={15} />
                          {campaign.errors.length} research{" "}
                          {campaign.errors.length === 1 ? "note" : "notes"} ·
                          some sources could not be read
                        </summary>
                        <ul>
                          {campaign.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="table-controls">
                      <label className="search-field">
                        <Icon name="search" size={17} />
                        <input
                          aria-label="Search accounts"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search companies, industries…"
                        />
                        {query && (
                          <button
                            className="plain-icon"
                            aria-label="Clear search"
                            onClick={() => setQuery("")}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        )}
                      </label>
                      <div className="filter-controls">
                        {view !== "shortlist" && (
                          <label className="select-wrap">
                            <span className="sr-only">
                              Filter by review status
                            </span>
                            <select
                              value={status}
                              onChange={(e) =>
                                setStatus(
                                  e.target.value as AccountStatus | "all",
                                )
                              }
                            >
                              <option value="all">All statuses</option>
                              <option value="new">New</option>
                              <option value="shortlisted">Shortlisted</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                            <Icon name="down" size={13} />
                          </label>
                        )}
                        <label className="select-wrap">
                          <Icon name="filter" size={16} />
                          <span className="sr-only">Filter by account fit</span>
                          <select
                            value={fit}
                            onChange={(e) => setFit(e.target.value)}
                          >
                            <option value="all">All fit scores</option>
                            <option value="high">Strong fit · 65+</option>
                            <option value="other">Below 65</option>
                          </select>
                          <Icon name="down" size={13} />
                        </label>
                        <label className="select-wrap sort-wrap">
                          <span className="sr-only">Sort accounts</span>
                          <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option value="score">Best fit first</option>
                            <option value="score-low">Lowest fit first</option>
                            <option value="name">Company A–Z</option>
                          </select>
                          <Icon name="down" size={13} />
                        </label>
                      </div>
                    </div>
                    {accountLoading ? (
                      <div className="table-loading" role="status">
                        <span className="spinner" />
                        Loading account research…
                      </div>
                    ) : filtered.length ? (
                      <div className="table-scroll">
                        <table className="accounts-table">
                          <thead>
                            <tr>
                              <th scope="col">Company</th>
                              <th scope="col">Profile</th>
                              <th scope="col">
                                Fit score <Icon name="down" size={11} />
                              </th>
                              <th scope="col">Evidence</th>
                              <th scope="col">Status</th>
                              <th scope="col">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((a, index) => (
                              <tr
                                key={a.id}
                                className={
                                  a.status === "dismissed"
                                    ? "dismissed-row"
                                    : ""
                                }
                              >
                                <td>
                                  <button
                                    className="company-button"
                                    onClick={() => openAccount(a)}
                                  >
                                    <span
                                      className={`company-logo color-${index % 5}`}
                                    >
                                      {initials(a.name)}
                                    </span>
                                    <span>
                                      <strong>{a.name}</strong>
                                      <span>
                                        {a.domain}
                                      </span>
                                    </span>
                                  </button>
                                </td>
                                <td>
                                  <div className="company-profile">
                                    <strong>
                                      {a.industry || "Industry unknown"}
                                    </strong>
                                    <span>
                                      {a.employee_range
                                        ? a.employee_range + " employees"
                                        : "Size unknown"}
                                      <span className="meta-dot">·</span>
                                      {a.location || "Location unknown"}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="score-cell"
                                    onClick={() => openAccount(a)}
                                    aria-label={`View ${a.name}: ${a.score} out of 100, ${scoreLabel(a.score)}`}
                                  >
                                    <span
                                      className={`score-number ${a.score >= 65 ? "high" : a.score >= 50 ? "mid" : "low"}`}
                                    >
                                      {a.score}
                                      <span>/100</span>
                                    </span>
                                    <span className="mini-score">
                                      <span
                                        style={{
                                          width: `${Math.max(0, Math.min(100, a.score))}%`,
                                        }}
                                      />
                                    </span>
                                  </button>
                                </td>
                                <td>
                                  <button
                                    className="evidence-cell"
                                    onClick={() => openAccount(a)}
                                  >
                                    <span>
                                      <Icon name="file" size={13} />
                                      {sourceCount(a.evidence)} sources
                                    </span>
                                    <span
                                      className={
                                        signalCount(a.evidence)
                                          ? "signal-found"
                                          : "muted"
                                      }
                                    >
                                      <Icon
                                        name={
                                          signalCount(a.evidence)
                                            ? "bolt"
                                            : "clock"
                                        }
                                        size={12}
                                      />
                                      {signalCount(a.evidence)
                                        ? `${signalCount(a.evidence)} signal ${signalCount(a.evidence) === 1 ? "mention" : "mentions"}`
                                        : "Timing unknown"}
                                    </span>
                                  </button>
                                </td>
                                <td>
                                  <span className={`status-tag ${a.status}`}>
                                    <span />
                                    {a.status === "new"
                                      ? "To review"
                                      : a.status === "shortlisted"
                                        ? "Shortlisted"
                                        : "Dismissed"}
                                  </span>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className={`icon-btn bookmark-btn ${a.status === "shortlisted" ? "saved" : ""}`}
                                      title={
                                        a.status === "shortlisted"
                                          ? "Remove from shortlist"
                                          : "Add to shortlist"
                                      }
                                      aria-label={`${a.status === "shortlisted" ? "Remove" : "Add"} ${a.name} ${a.status === "shortlisted" ? "from" : "to"} shortlist`}
                                      disabled={statusBusy}
                                      onClick={() => toggleShortlist(a)}
                                    >
                                      <Icon name="bookmark" size={18} />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      aria-label={`View ${a.name} details`}
                                      onClick={() => openAccount(a)}
                                    >
                                      <Icon name="chevron" size={17} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-results">
                        <Icon
                          name={view === "shortlist" ? "bookmark" : "search"}
                          size={30}
                        />
                        <h3>
                          {view === "shortlist" && !query
                            ? "Your next conversation starts here"
                            : accounts.length
                              ? "No accounts match those filters"
                              : "No accounts researched yet"}
                        </h3>
                        <p>
                          {view === "shortlist" && !query
                            ? "Save promising accounts using the bookmark icon."
                            : accounts.length
                              ? "Try a different search or broaden your filters."
                              : "Run this campaign to build an evidence-backed account list."}
                        </p>
                        {accounts.length && view !== "shortlist" ? (
                          <button
                            className="btn secondary small"
                            onClick={() => {
                              setQuery("");
                              setFit("all");
                              setStatus("all");
                            }}
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    )}
                    <div className="table-footer">
                      <span>
                        Showing <strong>{filtered.length}</strong> of{" "}
                        <strong>{accounts.length}</strong> accounts
                      </span>
                      <span>
                        <Icon name="shield" size={13} />{" "}
                        Evidence-led research
                        <span className="footer-divider">·</span>Contacts are
                        not enriched
                      </span>
                    </div>
                  </section>
                  <div className="bottom-insight">
                    <span className="insight-icon">
                      <Icon name="spark" size={20} />
                    </span>
                    <div>
                      <strong>
                        A good score starts a conversation. Evidence makes it
                        relevant.
                      </strong>
                      <p>
                        Open any account to explore its fit, timing signals, and
                        what’s still unknown.
                      </p>
                    </div>
                    <button onClick={() => navigate("profile")}>
                      Refine your profile
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <Welcome
                  website={website}
                  setWebsite={setWebsite}
                  analyze={analyze}
                  analyzing={analyzing}
                  profileReady={!!workspace.profile}
                  editProfile={() => navigate("profile")}
                  newCampaign={() => setNewCampaign(true)}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>Built for thoughtful prospecting.</span>
          <span>
            <Icon name="shield" size={12} />
            Public evidence. Clear limitations. Human decisions.
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {newCampaign && (
        <CampaignDialog
          onClose={() => setNewCampaign(false)}
          onCreated={onCreated}
        />
      )}
      {selectedAccount && (
        <AccountDrawer
          key={selectedAccount.id}
          account={selectedAccount}
          onClose={() => {
            ++detailRequest.current;
            setSelectedAccount(null);
          }}
          onStatusChange={changeStatus}
          busy={statusBusy}
          statusError={statusError}
        />
      )}
      {showHelp && (
        <Dialog
          title="How SignalFoundry works"
          onClose={() => setShowHelp(false)}
        >
          <div className="dialog-heading">
            <span className="modal-icon">
              <Icon name="spark" size={25} />
            </span>
            <span className="eyebrow">CLARITY BEFORE OUTREACH</span>
            <h2>From website to right-fit accounts.</h2>
            <p>A focused research workflow with the evidence always in view.</p>
          </div>
          <ol className="help-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Define your ideal customer</strong>
                <p>
                  Analyze your public website or enter your profile manually.
                  Review and edit every targeting detail.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Bring the companies to research</strong>
                <p>
                  Supply public business domains for research.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Review evidence, then decide</strong>
                <p>
                  Compare transparent fit scores, inspect original sources, and
                  shortlist the accounts worth your attention.
                </p>
              </div>
            </li>
          </ol>
          <div className="notice soft">
            <Icon name="shield" size={19} />
            <span>
              SignalFoundry uses rules-based extraction and grounded outreach
              templates. Contact enrichment and automatic prospect discovery
              aren’t connected. No emails are sent.
            </span>
          </div>
          <button
            className="btn primary full-width"
            onClick={() => setShowHelp(false)}
          >
            Got it
            <Icon name="check" size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  detail,
  green = false,
}: {
  icon: string;
  label: string;
  value: number;
  detail: string;
  green?: boolean;
}) {
  return (
    <article className={`stat-card ${green ? "highlight-stat" : ""}`}>
      <div className="stat-label">
        <span>{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <div className="stat-value">
        {value}
        <span>{green && <Icon name="spark" size={22} />}</span>
      </div>
      <div className="stat-detail">
        {green && <span className="small-dot mint" />}
        {detail}
      </div>
    </article>
  );
}
function EmptyCampaign({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-campaign">
      <span className="modal-icon">
        <Icon name="grid" size={30} />
      </span>
      <h2>Your first campaign is a fresh start.</h2>
      <p>
        Organize a set of target companies and discover what makes each one a
        potential customer.
      </p>
      <button className="btn primary" onClick={onCreate}>
        <Icon name="plus" size={17} />
        Create a campaign
      </button>
    </div>
  );
}
function Welcome({
  website,
  setWebsite,
  analyze,
  analyzing,
  profileReady,
  editProfile,
  newCampaign,
}: {
  website: string;
  setWebsite: (v: string) => void;
  analyze: (e: React.FormEvent) => Promise<void>;
  analyzing: boolean;
  profileReady: boolean;
  editProfile: () => void;
  newCampaign: () => void;
}) {
  const { mode, isAdmin } = useWorkspaceSession();
  const isSaas = mode === "saas";
  return (
    <>
      <div className="welcome-heading">
        <span className="welcome-kicker">
          <span className="small-dot mint" />
          LESS NOISE. BETTER CONVERSATIONS.
        </span>
        <h1>
          Find your next
          <br />
          <span>right-fit customer.</span>
        </h1>
        <p>
          Turn company websites into a focused, evidence-backed shortlist.
          <br className="desktop-break" /> Know who fits, why they fit, and what
          to say next.
        </p>
      </div>
      <section className="welcome-grid">
        <div className="start-card">
          <span className="step-label">01 / YOUR STARTING POINT</span>
          <h2>
            {profileReady
              ? "Your profile is ready. Let’s find your people."
              : isSaas
                ? "Define your ideal customer."
                : "Your website is all it takes to start."}
          </h2>
          <p>
            {profileReady
              ? "Add companies to a campaign and let the evidence guide your shortlist."
              : isSaas
                ? "Start with your team’s targeting preferences, then research public business websites."
                : "We’ll read your public homepage and help shape a profile of your ideal customer."}
          </p>
          {profileReady ? (
            <div className="ready-actions">
              <button className="btn primary" onClick={newCampaign}>
                Create your first campaign
                <Icon name="arrow" size={17} />
              </button>
              <button className="text-btn" onClick={editProfile}>
                Review your customer profile
              </button>
            </div>
          ) : isSaas && !isAdmin ? (
            <div className="ready-actions">
              <button className="btn primary" onClick={editProfile}>
                Review customer profile
              </button>
              <p>
                An administrator must create the profile before research can
                begin.
              </p>
            </div>
          ) : (
            <form onSubmit={analyze}>
              <label htmlFor="welcome-website">Your company website</label>
              <div className="website-field">
                <Icon name="globe" size={19} />
                <input
                  id="welcome-website"
                  required
                  placeholder="https://yourcompany.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={analyzing}
                />
              </div>
              <button className="btn primary full-width" disabled={analyzing}>
                {analyzing ? (
                  <>
                    <span className="spinner" />
                    Reading your website…
                  </>
                ) : (
                  <>
                    Build my customer profile
                    <Icon name="arrow" size={17} />
                  </>
                )}
              </button>
              <button
                type="button"
                className="text-btn full-width"
                onClick={editProfile}
              >
                Or build your profile manually
              </button>
            </form>
          )}
          <div className="start-card-note">
            <Icon name="shield" size={14} />
            <span>Public business data only. You stay in control.</span>
          </div>
        </div>
        <div className="promise-card">
          <div className="orbit-graphic">
            <span className="orbit o1" />
            <span className="orbit o2" />
            <span className="orbit o3" />
            <span className="orbit-center">
              <Icon name="target" size={38} />
            </span>
            <span className="orbit-token t1">
              <Icon name="accounts" size={20} />
            </span>
            <span className="orbit-token t2">
              <Icon name="file" size={18} />
            </span>
            <span className="orbit-token t3">
              <Icon name="bolt" size={18} />
            </span>
            <span className="orbit-chip">
              <span className="small-dot mint" /> The right signals, connected
            </span>
          </div>
          <div className="promise-content">
            <span className="eyebrow">RESEARCH WITH A REASON</span>
            <h2>
              Not just another list.
              <br />A reason to reach out.
            </h2>
            <p>
              Transparent scores. Sources you can inspect.
              <br />
              Unknowns that stay unknown.
            </p>
          </div>
        </div>
      </section>
      <div className="workflow-strip">
        {[
          {
            n: "01",
            title: "Define your fit",
            text: "A customer profile you can shape.",
            icon: "target",
          },
          {
            n: "02",
            title: "Follow the evidence",
            text: "Source-backed research, ranked.",
            icon: "file",
          },
          {
            n: "03",
            title: "Make a meaningful move",
            text: "A shortlist and a grounded first draft.",
            icon: "mail",
          },
        ].map((step) => (
          <div key={step.n}>
            <span className="workflow-number">{step.n}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <Icon name={step.icon} size={20} />
          </div>
        ))}
      </div>
    </>
  );
}
