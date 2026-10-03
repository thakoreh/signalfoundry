"use client";
import { useState } from "react";
import { errorMessage, jsonBody } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useWorkspaceSession } from "./workspace-session";
import { Icon } from "./icons";
type Suppression = {
  domain: string;
  reason: string | null;
  updated_at: string;
};
type Page = {
  items: Suppression[];
  continue_cursor: string | null;
  is_done: boolean;
};

export function SuppressionPanel() {
  const { api } = useWorkspaceSession();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Suppression[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load(after: string | null = null) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const page = await api<Page>(
        `/workspace/suppressions?limit=30${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      setRows((previous) =>
        after
          ? [
              ...previous,
              ...page.items.filter(
                (item) => !previous.some((row) => row.domain === item.domain),
              ),
            ]
          : page.items,
      );
      setCursor(page.continue_cursor);
      setDone(page.is_done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function restore(domain: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/workspace/suppressions/restore", {
        method: "POST",
        body: jsonBody({ domain }),
      });
      setRows((previous) => previous.filter((item) => item.domain !== domain));
      setNotice(
        `${domain} can appear in future workspace searches. Existing campaign passes stay unchanged.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="suppression-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR SEARCH BOUNDARIES</span>
          <h2>Suppressed company domains</h2>
          <p>
            Only domains explicitly excluded from future workspace searches
            appear here. Your campaign-only passes remain in their campaigns.
          </p>
        </div>
        <button
          className="btn secondary small"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            if (!open) void load();
          }}
        >
          {open ? "Hide domains" : "Manage suppressions"}
        </button>
      </div>
      {open && (
        <div className="suppression-content">
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice soft" role="status">
              {notice}
            </p>
          )}
          {rows.length ? (
            <ul>
              {rows.map((row) => (
                <li key={row.domain}>
                  <div>
                    <strong>{row.domain}</strong>
                    <span>
                      {row.reason?.replaceAll("_", " ") || "Passed"} ·{" "}
                      {formatDate(row.updated_at)}
                    </span>
                  </div>
                  <button
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => void restore(row.domain)}
                  >
                    <Icon name="refresh" size={13} />
                    Allow in future searches
                  </button>
                </li>
              ))}
            </ul>
          ) : !busy && !error ? (
            <p className="suppression-empty">
              No domains are suppressed in this workspace.
            </p>
          ) : null}
          <div className="suppression-actions">
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </button>
            {!done && cursor && (
              <button
                className="btn secondary small"
                disabled={busy}
                onClick={() => void load(cursor)}
              >
                Load more
              </button>
            )}
            {busy && <span role="status">Updating search boundaries…</span>}
          </div>
        </div>
      )}
    </section>
  );
}
