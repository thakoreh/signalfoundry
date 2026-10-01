"use client";
import {
  OrganizationList,
  OrganizationSwitcher,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import Link from "next/link";
import Workspace from "./workspace";
import { WorkspaceSession } from "./workspace-session";

export function SaasWorkspace() {
  const { isLoaded, isSignedIn, userId, orgId, orgRole } = useAuth();
  if (!isLoaded)
    return (
      <main className="auth-shell" role="status">
        <span className="spinner" />
        Checking your secure session…
      </main>
    );
  if (!isSignedIn)
    return (
      <main className="auth-shell">
        <section className="setup-card">
          <h1>Your session has ended</h1>
          <p>Sign in again to continue in your organization’s workspace.</p>
          <Link href="/sign-in" className="btn primary">
            Sign in
          </Link>
        </section>
      </main>
    );
  if (!orgId)
    return (
      <main className="auth-shell">
        <div className="organization-heading">
          <div>
            <span className="eyebrow">YOUR TEAM, YOUR WORKSPACE</span>
            <h1>Choose an organization</h1>
            <p>Select or create an organization to access private research.</p>
          </div>
          <UserButton />
        </div>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/"
          afterCreateOrganizationUrl="/"
        />
      </main>
    );
  if (orgRole !== "org:admin" && orgRole !== "org:member")
    return (
      <main className="auth-shell">
        <section className="setup-card">
          <h1>Your role doesn’t have workspace access</h1>
          <p>
            Ask an organization administrator to assign the member or
            administrator role.
          </p>
          <OrganizationSwitcher hidePersonal />
          <UserButton />
        </section>
      </main>
    );
  // Remount the entire data tree on user, organization, or role change. Its request
  // scope aborts all old requests and continuations before the new tree loads.
  return (
    <WorkspaceSession
      key={`${userId}:${orgId}:${orgRole}`}
      mode="saas"
      role={orgRole}
      organizationId={orgId}
    >
      <Workspace
        organizationControl={
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/"
            afterCreateOrganizationUrl="/"
          />
        }
        userControl={<UserButton />}
      />
    </WorkspaceSession>
  );
}
