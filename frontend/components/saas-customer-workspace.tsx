"use client";

import {
  OrganizationList,
  OrganizationSwitcher,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import Link from "next/link";
import { customerSearchPath } from "../lib/customer-search";
import { WorkspaceSession } from "./workspace-session";
import { CustomerWorkspaceScreen } from "./customer-workspace-screen";

export function SaasCustomerWorkspace({
  searchId,
  outreach = false,
}: {
  searchId?: string;
  outreach?: boolean;
}) {
  const { isLoaded, isSignedIn, userId, orgId, orgRole } = useAuth();
  const destination =
    outreach && searchId
      ? `/workspace/outreach/${encodeURIComponent(searchId)}`
      : searchId
        ? customerSearchPath(searchId)
        : "/workspace/customers";
  if (!isLoaded)
    return (
      <main className="auth-shell" role="status">
        Checking your secure session…
      </main>
    );
  if (!isSignedIn)
    return (
      <main className="auth-shell">
        <section className="setup-card">
          <h1>Your session has ended</h1>
          <p>Sign in to return to this customer search.</p>
          <Link
            className="btn primary"
            href={`/sign-in?redirect_url=${encodeURIComponent(destination)}`}
          >
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
            <p>Select your team to access its private customer research.</p>
          </div>
          <UserButton />
        </div>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl={destination}
          afterCreateOrganizationUrl={destination}
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
  return (
    <WorkspaceSession
      key={`${userId}:${orgId}:${orgRole}`}
      mode="saas"
      role={orgRole}
      organizationId={orgId}
    >
      <CustomerWorkspaceScreen
        searchId={searchId}
        outreach={outreach}
        organizationControl={
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/workspace/customers"
            afterCreateOrganizationUrl="/workspace/customers"
          />
        }
        userControl={<UserButton />}
      />
    </WorkspaceSession>
  );
}
