"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { WorkspaceData } from "../lib/types";
import { errorMessage } from "../lib/api";
import { useWorkspaceSession } from "./workspace-session";
import { ProfileEditor } from "./profile-editor";
import { SellingAs } from "./selling-as";
import { PRODUCT_NAME } from "../lib/product";
import { SignalBrand } from "./signal-brand";
import { CustomerSearch } from "./customer-search";
import { CustomerSearchResults } from "./customer-search-results";
import { OutreachWorkspace } from "./outreach-workspace";
import "./business-onboarding.css";

export function CustomerWorkspaceScreen({
  searchId,
  organizationControl,
  userControl,
  outreach = false,
}: {
  searchId?: string;
  organizationControl?: React.ReactNode;
  userControl?: React.ReactNode;
  outreach?: boolean;
}) {
  const router = useRouter();
  const { api, mode } = useWorkspaceSession();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [editing, setEditing] = useState(false);
  const [profileRefresh, setProfileRefresh] = useState(0);
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    const scope = new AbortController();
    api<WorkspaceData | null>("/workspace", { signal: scope.signal })
      .then((data) => {
        if (!scope.signal.aborted) setWorkspace(data);
      })
      .catch((cause) => {
        if (!scope.signal.aborted) setProfileError(errorMessage(cause));
      });
    return () => scope.abort();
  }, [api]);
  return (
    <div className="business-onboarding customer-workspace">
      <a className="skip-link" href="#customer-content">
        Skip to customer search
      </a>
      <header className="business-onboarding-header">
        <Link className="sf-brand" href="/" aria-label={`${PRODUCT_NAME} home`}>
          <SignalBrand />
        </Link>
        <div className="business-onboarding-account">
          {organizationControl}
          {userControl}
        </div>
      </header>
      <main id="customer-content" tabIndex={-1}>
        <SellingAs
          profile={workspace?.profile || null}
          onEdit={() => setEditing(true)}
        />
        {profileError && <p role="alert">{profileError}</p>}
        <section hidden={!editing} className="business-onboarding-details">
          <button
            className="btn"
            type="button"
            onClick={() => setEditing(false)}
          >
            Back to saved work
          </button>
          <h1>Review your saved business</h1>
          <p>
            Message and pasted reply edits stay here while you repair your
            sender details. Nothing is analyzed or sent.
          </p>
          {workspace ? (
            <ProfileEditor
              key={`${mode}:${workspace.id}`}
              profile={workspace.profile}
              onboarding
              onSaved={(updated) => {
                setWorkspace(updated);
                setProfileRefresh((value) => value + 1);
              }}
            />
          ) : (
            <p role="status">Loading saved profile…</p>
          )}
        </section>
        <div
          hidden={editing}
          onClickCapture={(event) => {
            const link = (event.target as Element).closest(
              'a[href="/workspace/setup"]',
            );
            if (link) {
              event.preventDefault();
              event.stopPropagation();
              setEditing(true);
            }
          }}
        >
          {outreach && searchId ? (
            <OutreachWorkspace
              // Session boundaries already remount this screen. Initial profile
              // hydration is not a scope switch and must not destroy drafts.
              key={`${mode}:${searchId}`}
              searchId={searchId}
              profile={workspace?.profile || null}
              profileRefresh={profileRefresh}
              suspended={editing}
            />
          ) : searchId ? (
            <CustomerSearchResults key={searchId} searchId={searchId} />
          ) : (
            <CustomerSearch onBack={() => router.push("/workspace")} />
          )}
        </div>
      </main>
    </div>
  );
}
