"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Account, WorkspaceData } from "../lib/types";
import { errorMessage, jsonBody } from "../lib/api";
import {
  isCustomerMessageDraft,
  qualifiedCustomerAccounts,
  type CustomerMessageDraft,
} from "./customer-result-view";
import {
  hasContactEmail,
  contactPriority,
  isSharedInbox,
  orderCustomerAccounts,
  publicSourceUrl,
  searchInProgress,
  selectedCustomerAccounts,
  type CustomerSearchRun,
  type CustomerSort,
  validCustomerSearchId,
} from "../lib/customer-search";
import { customerCsv } from "./customer-search-export";
import { useWorkspaceSession } from "./workspace-session";
import { Icon } from "./icons";
import { drawerFocusBoundaryTarget } from "../lib/utils";
import { PrepareOutreach } from "./prepare-outreach";
import type { CompanyFlag, OutreachInsights } from "../lib/outreach";
import "./customer-search.css";

function CustomerDraftDialog({
  id,
  title,
  opener,
  onClose,
  children,
  footer,
}: {
  id: string;
  title: string;
  opener: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const openerElement = opener.current;
    const bodyOverflow = document.body.style.overflow;
    const pageOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.closest("[hidden],[inert]") &&
          element.getAttribute("aria-hidden") !== "true",
      );
    const focusFirst = () => (focusable()[0] || dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof Node) || !dialog.contains(event.target))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const next = drawerFocusBoundaryTarget(
        focusable(),
        document.activeElement,
        event.shiftKey,
      );
      if (next) {
        event.preventDefault();
        next.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target))
        focusFirst();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    focusFirst();
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = pageOverflow;
      if (openerElement?.isConnected)
        openerElement.focus({ preventScroll: true });
    };
  }, [opener]);
  return createPortal(
    <dialog
      ref={dialogRef}
      id={id}
      className="customer-search customer-draft-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="customer-draft-dialog-header">
        <div>
          <span>MESSAGE DRAFT</span>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <button
          type="button"
          className="customer-draft-close"
          aria-label={`Close ${title.charAt(0).toLowerCase()}${title.slice(1)}`}
          onClick={onClose}
        >
          <Icon name="close" size={19} />
        </button>
      </header>
      <div className="customer-draft-dialog-scroll">{children}</div>
      {footer && (
        <footer className="customer-draft-dialog-actions">{footer}</footer>
      )}
    </dialog>,
    document.body,
  );
}

function CustomerResult({
  account,
  searchId,
  selected,
  toggle,
  history,
}: {
  account: Account;
  searchId: string;
  selected: boolean;
  toggle: () => void;
  history?: CompanyFlag;
}) {
  const { api } = useWorkspaceSession();
  const [draftOpen, setDraftOpen] = useState(false);
  const [original, setOriginal] = useState<CustomerMessageDraft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [retryCreatesAttempt, setRetryCreatesAttempt] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const requestKey = useRef<string | null>(null);
  const attempted = useRef(false);
  const inFlight = useRef(false);
  const draftScope = useRef<AbortController | null>(null);
  const subjectField = useRef<HTMLInputElement>(null);
  const draftTrigger = useRef<HTMLButtonElement>(null);
  const panelId = `customer-draft-${account.id}`;
  useEffect(() => () => draftScope.current?.abort(), []);

  const website = publicSourceUrl(`https://${account.domain}`);
  const contacts = account.contacts
    .filter((contact) => contact.email?.trim())
    .sort(
      (left, right) =>
        contactPriority(right) - contactPriority(left),
    );
  const primaryContact = contacts[0];
  const citedSources = original
    ? [
        ...new Map(
          original.evidence_ids
            .map((id) => account.evidence.find((item) => item.id === id))
            .filter((item) => Boolean(item))
            .map((item) => [item!.url, item!]),
        ).values(),
      ]
    : [];
  const edited = Boolean(
    original && (subject !== original.subject || body !== original.body),
  );

  async function generate() {
    if (inFlight.current) return;
    const scope = new AbortController();
    draftScope.current = scope;
    inFlight.current = true;
    attempted.current = true;
    setDraftBusy(true);
    setDraftError("");
    setCopyError("");
    setCopied(false);
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const generated = await api<unknown>(
        `/customers/searches/${encodeURIComponent(searchId)}/accounts/${encodeURIComponent(account.id)}/draft`,
        {
          method: "POST",
          body: jsonBody({ idempotency_key: requestKey.current }),
          signal: scope.signal,
        },
      );
      if (scope.signal.aborted) return;
      if (
        !isCustomerMessageDraft(generated) ||
        generated.evidence_ids.some(
          (id) =>
            !account.evidence.some(
              (item) =>
                item.id === id && !item.is_demo && publicSourceUrl(item.url),
            ),
        )
      )
        throw new Error(
          "The draft could not be checked against this company’s saved sources. Please try again.",
        );
      setOriginal(generated);
      setSubject(generated.subject);
      setBody(generated.body);
    } catch (cause) {
      if (!scope.signal.aborted) {
        const terminal = Boolean(
          cause &&
          typeof cause === "object" &&
          "code" in cause &&
          cause.code === "DRAFT_FAILED",
        );
        if (terminal) requestKey.current = null;
        setRetryCreatesAttempt(terminal);
        setDraftError(errorMessage(cause));
      }
    } finally {
      inFlight.current = false;
      if (!scope.signal.aborted) setDraftBusy(false);
    }
  }
  function openDraft() {
    setDraftOpen((open) => !open);
    if (!draftOpen && !attempted.current && !original) void generate();
  }
  async function copy() {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error(
          "Copy isn’t available here. Select the subject and message text to copy them.",
        );
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      setCopyError(
        "Copy isn’t available here. Select the subject and message text to copy them.",
      );
    }
  }

  const draftFooter = original ? (
    <>
      <div className="customer-draft-footer">
        <p>Nothing is sent. Copy only when you’re ready.</p>
        <div>
          {edited && (
            <button
              type="button"
              className="customer-draft-reset"
              onClick={() => {
                setSubject(original.subject);
                setBody(original.body);
                setCopied(false);
                subjectField.current?.focus();
              }}
            >
              Reset edits
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={() => void copy()}
          >
            <Icon name="copy" size={15} />
            {copied ? "Copied" : "Copy message"}
          </button>
        </div>
      </div>
      {copied && (
        <p className="customer-draft-copy-status" role="status">
          Message copied to your clipboard.
        </p>
      )}
      {copyError && (
        <p className="customer-draft-error" role="alert">
          {copyError}
        </p>
      )}
    </>
  ) : null;

  return (
    <>
      <tr
        role="row"
        className="customer-lead-row"
        aria-label={account.name}
        data-selected={selected}
      >
        <td className="customer-lead-select" role="cell">
          <label>
            <input
              type="checkbox"
              checked={selected}
              onChange={toggle}
              aria-label={`Select ${account.name}`}
            />
            <span className="customer-search-sr-only">
              Select {account.name}
            </span>
          </label>
        </td>
        <th scope="row" role="rowheader" className="customer-lead-company">
          {website ? (
            <a
              className="customer-lead-company-link"
              href={website}
              target="_blank"
              rel="noreferrer"
              title={`${account.name} · ${account.domain}`}
            >
              <strong>{account.name}</strong>
              <span className="customer-result-website">
                {account.domain}
                <Icon name="external" size={11} />
              </span>
              <span className="customer-search-sr-only">
                {" "}
                (opens in a new tab)
              </span>
            </a>
          ) : (
            <strong title={account.name}>{account.name}</strong>
          )}
          {history && (history.suppressed || history.contacted || history.paused) && <small className="customer-company-history">
            {history.suppressed ? "Suppressed · do not contact" : history.contacted ? "Already contacted" : "Outreach paused"}
          </small>}
        </th>
        <td className="customer-lead-email" role="cell">
          {primaryContact ? (
            <span title={primaryContact.email || undefined}>
              {primaryContact.email}
              <small className="customer-contact-kind">
                {isSharedInbox(primaryContact.email) && "Shared inbox · "}
                {primaryContact.source_url && publicSourceUrl(primaryContact.source_url)
                  ? <a href={publicSourceUrl(primaryContact.source_url)!} title={`Contact observed ${account.researched_at || "at an unknown time"}`} target="_blank" rel="noreferrer">Source · {account.researched_at?.slice(0, 10) || "date unknown"}</a>
                  : "Source unknown"}
              </small>
            </span>
          ) : (
            <span className="customer-lead-no-email">No email available</span>
          )}
        </td>
        <td className="customer-lead-verification" role="cell">
          {primaryContact ? (
            <span
              className={`customer-search-email-status${primaryContact.verification_status === "verified" ? " verified" : ""}`}
            >
              {primaryContact.verification_status === "verified"
                ? "Provider verified"
                : "Unverified email"}
            </span>
          ) : (
            <span className="customer-lead-no-email">Not available</span>
          )}
        </td>
        <td className="customer-lead-actions" role="cell">
          <button
            ref={draftTrigger}
            type="button"
            className="btn primary customer-draft-action"
            aria-busy={draftBusy}
            aria-haspopup="dialog"
            aria-label={`Draft message for ${account.name}`}
            aria-expanded={draftOpen}
            aria-controls={panelId}
            onClick={openDraft}
          >
            <Icon name="spark" size={15} />
            {draftBusy ? "Drafting…" : "Draft message"}
          </button>
        </td>
      </tr>
      {draftOpen && (
        <CustomerDraftDialog
          id={panelId}
          title={`Draft for ${account.name}`}
          opener={draftTrigger}
          footer={draftFooter}
          onClose={() => setDraftOpen(false)}
        >
          <section className="customer-draft-panel" aria-busy={draftBusy}>
            <div className="customer-draft-header">
              <div>
                <h3>{original ? "Your AI draft" : "Draft a message"}</h3>
                <p>
                  {draftBusy
                    ? "Writing from your business profile and this company’s saved research."
                    : original
                      ? "Review the facts and make it sound like you."
                      : "A personalized first message, based on the company research."}
                </p>
              </div>
            </div>
            {draftBusy && (
              <div className="customer-draft-loading" role="status">
                <Icon name="spark" size={19} />
                Writing your draft…
              </div>
            )}
            {draftError && (
              <div className="customer-draft-error" role="alert">
                <p>{draftError}</p>
                {retryCreatesAttempt && (
                  <p className="customer-draft-retry-note">
                    Retrying starts a new AI attempt and may use your drafting
                    allowance.
                  </p>
                )}
                <button
                  type="button"
                  className="customer-search-text-button"
                  disabled={draftBusy}
                  onClick={() => void generate()}
                >
                  {retryCreatesAttempt ? "Retry AI draft" : "Try draft again"}
                </button>
              </div>
            )}
            {original && (
              <>
                <label className="customer-draft-field">
                  Subject
                  <input
                    ref={subjectField}
                    value={subject}
                    onChange={(event) => {
                      setSubject(event.target.value);
                      setCopied(false);
                    }}
                  />
                </label>
                <label className="customer-draft-field">
                  Message
                  <textarea
                    rows={7}
                    value={body}
                    onChange={(event) => {
                      setBody(event.target.value);
                      setCopied(false);
                    }}
                  />
                </label>
                <div className="customer-draft-sources">
                  <span>Based on</span>
                  {citedSources.map((item, index) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.title || `Company source ${index + 1}`}
                      <Icon name="external" size={11} />
                      <span className="customer-search-sr-only">
                        {" "}
                        (opens in a new tab)
                      </span>
                    </a>
                  ))}
                </div>
                {original.warnings.length > 0 && (
                  <details className="customer-draft-notes">
                    <summary>Draft notes</summary>
                    <ul>
                      {original.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>
        </CustomerDraftDialog>
      )}
    </>
  );
}
function SearchProgress({ search }: { search: CustomerSearchRun | null }) {
  const queued = search?.status === "queued";
  return (
    <section
      className="customer-run-progress"
      aria-labelledby="customer-search-title"
      role="status"
      aria-live="polite"
    >
      <span className="customer-run-mark" aria-hidden="true">
        <Icon name="search" size={30} />
      </span>
      <span className="customer-run-eyebrow">YOUR CUSTOMER SEARCH</span>
      <h1 id="customer-search-title">
        {!search
          ? "Opening your search."
          : queued
            ? "Your search is queued."
            : "Finding businesses for you."}
      </h1>
      <p>
        {!search
          ? "Loading the latest status of this search."
          : queued
            ? "Your search is waiting to start. You can keep this page open or return to it later."
            : "We’re finding candidate businesses and checking their public websites and available contact details."}
      </p>
      {search?.query && <p className="customer-run-query">{search.query}</p>}
      <ol className="customer-run-stages" aria-label="Research progress">
        <li className={search ? "is-done" : "is-current"}>
          <span>{search ? <Icon name="check" size={14} /> : "1"}</span>Search
          requested
        </li>
        <li className={search && !queued ? "is-current" : ""}>
          <span>2</span>Find businesses &amp; check facts
        </li>
        <li>
          <span>3</span>Ready for your review
        </li>
      </ol>
      {search?.stage && (
        <p className="customer-run-stage">Current stage: {search.stage}</p>
      )}
      <p className="customer-run-reassurance">
        Refreshing this page checks the same search. It won’t start another one.
      </p>
    </section>
  );
}

export function CustomerSearchResults({ searchId }: { searchId: string }) {
  const { api, mode } = useWorkspaceSession();
  const [search, setSearch] = useState<CustomerSearchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [sort, setSort] = useState<CustomerSort>("contacts");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [companyFlags, setCompanyFlags] = useState<CompanyFlag[]>([]);
  const [historyError, setHistoryError] = useState("");
  const selectionTouched = useRef(false);
  const selectAll = useRef<HTMLInputElement>(null);
  const contactHistoryReady = !!search && !searchInProgress(search);

  useEffect(() => {
    if (mode !== "local-demo" || !contactHistoryReady) return;
    const scope = new AbortController();
    api<OutreachInsights>("/outreach/insights", { signal: scope.signal }).then(data => {
      if (!scope.signal.aborted) {
        if (!Array.isArray(data?.company_flags)) throw new Error("Prior contact status is unavailable; review saved conversations before outreach.");
        setCompanyFlags(data.company_flags);
        setHistoryError("");
      }
    }).catch(cause => { if (!scope.signal.aborted) setHistoryError(errorMessage(cause)); });
    return () => scope.abort();
  }, [api, mode, searchId, contactHistoryReady]);

  useEffect(() => {
    const scope = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    async function read() {
      try {
        const updated = await api<CustomerSearchRun>(
          `/customers/searches/${searchId}`,
          { signal: scope.signal },
        );
        if (scope.signal.aborted) return;
        setSearch(updated);
        setError("");
        setPollError(false);
        setLoading(false);
        failures = 0;
        if (searchInProgress(updated)) timer = setTimeout(read, 1500);
      } catch (cause) {
        if (scope.signal.aborted) return;
        setLoading(false);
        setError(errorMessage(cause));
        setPollError(true);
        if (++failures < 3) timer = setTimeout(read, 3000);
      }
    }
    void read();
    return () => {
      scope.abort();
      if (timer) clearTimeout(timer);
    };
  }, [api, searchId, revision]);

  useEffect(() => {
    const scope = new AbortController();
    async function restoreHistory() {
      try {
        const workspace = await api<WorkspaceData | null>("/workspace", {
          signal: scope.signal,
        });
        if (scope.signal.aborted || !workspace?.id) return;
        const key = `clientrove:customer-results:${mode}:${workspace.id}:${searchId}`;
        let saved: { ids?: unknown; sort?: unknown } | null = null;
        try {
          const raw = sessionStorage.getItem(key);
          if (raw && raw.length < 8192) saved = JSON.parse(raw);
        } catch {
          /* Optional. */
        }
        if (!selectionTouched.current) {
          if (Array.isArray(saved?.ids))
            setSelection(
              new Set(
                saved.ids.filter(
                  (id): id is string =>
                    typeof id === "string" && validCustomerSearchId(id),
                ),
              ),
            );
          if (
            saved?.sort === "contacts" ||
            saved?.sort === "score" ||
            saved?.sort === "name"
          )
            setSort(saved.sort);
        }
        setStorageKey(key);
      } catch {
        /* Optional history never delays status polling or blocks current results. */
      }
    }
    void restoreHistory();
    return () => scope.abort();
  }, [api, mode, searchId]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ ids: [...selection], sort }),
      );
    } catch {
      /* Optional. */
    }
  }, [selection, sort, storageKey]);

  const qualified = qualifiedCustomerAccounts(search?.accounts || []);
  const excludedCount = (search?.accounts.length || 0) - qualified.length;
  const accounts = orderCustomerAccounts(qualified, sort);
  const currentSelection = new Set(
    accounts
      .filter((account) => selection.has(account.id))
      .map((account) => account.id),
  );
  const selectedCount = currentSelection.size;
  const allSelected = accounts.length > 0 && selectedCount === accounts.length;
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate = selectedCount > 0 && !allSelected;
  }, [selectedCount, allSelected]);

  function toggle(id: string) {
    selectionTouched.current = true;
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function download() {
    const rows = selectedCustomerAccounts(qualified, selection, sort);
    if (!rows.length) return;
    const url = URL.createObjectURL(
      new Blob(["\ufeff", customerCsv(rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientrove-customers.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const waiting = loading || searchInProgress(search);

  const emailCount = accounts.filter(hasContactEmail).length;
  return (
    <section
      className="customer-search customer-run"
      aria-labelledby="customer-search-title"
    >
      <div className="customer-run-navigation">
        <Link className="customer-search-back" href="/workspace/customers">
          ← Customer search
        </Link>
        <Link className="customer-run-new" href="/workspace/customers">
          New search <Icon name="plus" size={14} />
        </Link>
      </div>
      {waiting ? (
        <SearchProgress search={search} />
      ) : !search ? (
        <section className="customer-run-unavailable">
          <Icon name="info" size={28} />
          <h1 id="customer-search-title">This search couldn’t be opened.</h1>
          <p>{error || "The search is unavailable in this workspace."}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Check status again
          </button>
          <p className="customer-run-reassurance">
            This only checks the existing search.
          </p>
        </section>
      ) : (
        <div className="customer-search-results">
          <div className="customer-run-heading">
            <span className="customer-run-eyebrow">YOUR CUSTOMER LIST</span>
            <h1 id="customer-search-title">
              {search.status === "failed" && !accounts.length
                ? "This search couldn’t finish."
                : accounts.length
                  ? `${accounts.length} ${accounts.length === 1 ? "business" : "businesses"} to review.`
                  : "No matching businesses this time."}
            </h1>
            <p>Review the fit, check the facts, and choose who to contact.</p>
          </div>
          {excludedCount > 0 && (
            <p className="customer-run-excluded">
              {excludedCount}{" "}
              {excludedCount === 1 ? "candidate left" : "candidates left"} out
              because a clear customer-type match wasn’t established.
            </p>
          )}
          {(search.status === "partial" ||
            search.errors.length > 0 ||
            search.status === "failed") && (
            <div
              className="customer-run-partial customer-leads-partial"
              role="status"
            >
              <Icon name="info" size={16} />
              <p>
                {search.status === "failed"
                  ? "Some parts of this search couldn’t finish."
                  : "Some research is incomplete."}
              </p>
              {search.status === "failed" && (
                <button
                  className="customer-search-text-button"
                  type="button"
                  onClick={() => setRevision((value) => value + 1)}
                >
                  Check this search’s status
                </button>
              )}
            </div>
          )}
          {!!accounts.length && (
            <>
              <div className="customer-run-toolbar">
                <div>
                  <label htmlFor="customer-sort">Sort by</label>
                  <select
                    id="customer-sort"
                    value={sort}
                    onChange={(event) => {
                      selectionTouched.current = true;
                      setSort(event.target.value as CustomerSort);
                    }}
                  >
                    <option value="contacts">Contact details first</option>
                    <option value="score">Website match: highest first</option>
                    <option value="name">Company name: A–Z</option>
                  </select>
                </div>
                <button
                  className="btn primary"
                  type="button"
                  disabled={!selectedCount}
                  onClick={download}
                >
                  <Icon name="download" size={16} />
                  Export selected ({selectedCount})
                </button>
                <PrepareOutreach
                  searchId={searchId}
                  accountIds={selectedCustomerAccounts(
                    qualified,
                    selection,
                    sort,
                  ).map((account) => account.id)}
                />
              </div>
              <div className="customer-run-list-meta">
                <p>{selectedCount} selected</p>
                <p>
                  {emailCount} with email <span aria-hidden="true">·</span>{" "}
                  {accounts.length - emailCount} without email
                </p>
              </div>
              <div
                className="customer-leads-table-wrap"
                role="region"
                aria-label="Customer leads"
                tabIndex={0}
              >
                <table className="customer-leads-table" role="table">
                  <caption className="customer-search-sr-only">
                    Your customer list. Select businesses to include in the CSV,
                    or draft a message for a company.
                  </caption>
                  <colgroup>
                    <col className="customer-lead-checkbox-column" />
                    <col className="customer-lead-company-column" />
                    <col className="customer-lead-email-column" />
                    <col className="customer-lead-status-column" />
                    <col className="customer-lead-action-column" />
                  </colgroup>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th
                        scope="col"
                        role="columnheader"
                        className="customer-lead-select"
                      >
                        <label>
                          <input
                            ref={selectAll}
                            type="checkbox"
                            aria-label="Select all businesses"
                            checked={allSelected}
                            onChange={(event) => {
                              selectionTouched.current = true;
                              setSelection(
                                event.target.checked
                                  ? new Set(
                                      accounts.map((account) => account.id),
                                    )
                                  : new Set(),
                              );
                            }}
                          />
                          <span className="customer-search-sr-only">
                            Select all businesses
                          </span>
                        </label>
                      </th>
                      <th scope="col" role="columnheader">
                        Company
                      </th>
                      <th scope="col" role="columnheader">
                        Email
                      </th>
                      <th scope="col" role="columnheader">
                        Verification
                      </th>
                      <th scope="col" role="columnheader">
                        <span className="customer-search-sr-only">
                          Message action
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {accounts.map((account) => (
                      <CustomerResult
                        key={account.id}
                        account={account}
                        searchId={searchId}
                        selected={selection.has(account.id)}
                        toggle={() => toggle(account.id)}
                        history={companyFlags.find(item => item.domain === account.domain.toLowerCase().replace(/\.$/, "").replace(/^www\./, ""))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className="customer-leads-scroll-hint"
                id="customer-leads-scroll-hint"
              >
                Scroll across to see emails and message actions{" "}
                <Icon name="arrow" size={14} />
              </p>
            </>
          )}
          {!accounts.length && search.status === "complete" && (
            <div className="customer-search-empty">
              <p>
                Try a broader business type or location. A new search only
                starts when you choose Find customers.
              </p>
              <Link className="btn primary" href="/workspace/customers">
                Adjust your search <Icon name="arrow" size={16} />
              </Link>
            </div>
          )}
        </div>
      )}
      {pollError && search && (
        <div className="customer-search-notice" role="alert">
          <strong>The latest status couldn’t be refreshed.</strong>
          <p>
            Your search may still be running. Check it again without starting
            another search.
          </p>
          <button
            className="customer-search-text-button"
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Check status again
          </button>
        </div>
      )}
      <p className="customer-search-footer">
        <Icon name="shield" size={14} />
        Public sources and available contacts stay attached. An email’s
        verification status doesn’t establish buying intent. Nothing is sent.
      </p>
      {historyError && <p role="status">{historyError}</p>}
    </section>
  );
}
