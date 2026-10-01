"use client";
import { useState } from "react";
import type { Profile, WorkspaceData } from "@/lib/types";
import { jsonBody, errorMessage } from "@/lib/api";
import { tokens } from "@/lib/utils";
import { Icon } from "./icons";
import { useWorkspaceSession } from "./workspace-session";
const fields = [
  [
    "industries",
    "Target industries",
    "e.g. B2B SaaS, Software, Financial services",
  ],
  ["company_sizes", "Company size", "e.g. 11–50, 51–200, 201–500"],
  [
    "geographies",
    "Markets & geographies",
    "e.g. United States, United Kingdom",
  ],
  [
    "buyer_roles",
    "Buyer roles",
    "e.g. VP of Sales, Head of Revenue Operations",
  ],
  [
    "keywords",
    "Buying signals & keywords",
    "e.g. scaling sales, outbound, new funding",
  ],
  [
    "exclusions",
    "Exclude from research",
    "e.g. agencies, consulting, consumer apps",
  ],
] as const;
export function ProfileEditor({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: (workspace: WorkspaceData) => void;
}) {
  const { api, mode: appMode, isAdmin } = useWorkspaceSession();
  const [name, setName] = useState(profile?.company_name || "");
  const [description, setDescription] = useState(profile?.description || "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map(([key]) => [key, (profile?.[key] || []).join(", ")]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const payload = {
        company_name: name.trim(),
        description: description.trim(),
        ...Object.fromEntries(
          fields.map(([key]) => [key, tokens(values[key])]),
        ),
      };
      const result = await api<WorkspaceData>("/workspace/profile", {
        method: "PUT",
        body: jsonBody(payload),
      });
      onSaved(result);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="profile-form">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR NORTH STAR</span>
          <h2>A sharper profile. Better prospects.</h2>
          <p>Tell us who you help and what makes a customer a great fit.</p>
        </div>
        <span className="tag green">
          <Icon name="edit" size={13} />{" "}
          {isAdmin ? "Admin managed" : "Read only"}
        </span>
      </div>
      <div className="notice soft">
        <Icon name="info" size={17} />
        <span>
          {appMode === "saas"
            ? "Your organization’s targeting preferences guide research. Only administrators can save changes."
            : "Website analysis creates a rules-based draft. Review these inputs before researching accounts. You can also fill this out from scratch."}
        </span>
      </div>
      {error && (
        <div role="alert" className="notice error">
          <Icon name="info" />
          {error}
        </div>
      )}
      <div className="form-grid">
        <label className="full">
          Your company name
          <input
            required
            disabled={busy || !isAdmin}
            maxLength={200}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="Your company"
          />
        </label>
        <label className="full">
          What do you help customers do?
          <textarea
            required
            disabled={busy || !isAdmin}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={3000}
            placeholder="We help B2B teams identify and prioritize their best-fit accounts…"
          />
        </label>
        {fields.map(([key, label, placeholder]) => (
          <label key={key}>
            {label}
            <textarea
              disabled={busy || !isAdmin}
              value={values[key]}
              onChange={(e) => {
                setValues({ ...values, [key]: e.target.value });
                setSaved(false);
              }}
              rows={2}
              placeholder={placeholder}
            />
            <span className="input-hint">
              {key === "company_sizes" || key === "geographies"
                ? "Planning context only; not yet used in scoring. Separate with commas."
                : "Separate values with commas"}
            </span>
            {tokens(values[key]).length > 0 && (
              <span className="tag-preview">
                {tokens(values[key])
                  .slice(0, 6)
                  .map((value) => (
                    <span className="tag" key={value}>
                      {value}
                    </span>
                  ))}
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="form-footer">
        <p>
          <Icon name="shield" size={16} /> Your profile guides scoring across
          new campaigns
        </p>
        <button
          className="btn primary"
          disabled={busy || !isAdmin}
          type="submit"
        >
          {busy ? (
            <>
              <span className="spinner" />
              Saving profile…
            </>
          ) : saved ? (
            <>
              <Icon name="check" size={16} />
              Profile saved
            </>
          ) : (
            <>
              Save customer profile
              <Icon name="arrow" size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
