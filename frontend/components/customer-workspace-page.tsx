import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { runtimeConfig } from "../lib/runtime-config";
import { customerSearchPath } from "../lib/customer-search";
import { WorkspaceSession } from "./workspace-session";
import { CustomerWorkspaceScreen } from "./customer-workspace-screen";
import { SaasCustomerWorkspace } from "./saas-customer-workspace";

export async function CustomerWorkspacePage({
  searchId,
  initialThreadId,
  outreach = false,
}: {
  searchId?: string;
  initialThreadId?: string;
  outreach?: boolean;
}) {
  const config = runtimeConfig();
  if (!config.ready) return null;
  if (config.mode === "local-demo")
    return (
      <WorkspaceSession mode="local-demo" role="org:admin">
        <CustomerWorkspaceScreen searchId={searchId} initialThreadId={initialThreadId} outreach={outreach} />
      </WorkspaceSession>
    );
  const session = await auth();
  if (!session.userId) {
    const destination =
      outreach && searchId
        ? `/workspace/outreach/${encodeURIComponent(searchId)}`
        : searchId
          ? customerSearchPath(searchId)
          : "/workspace/customers";
    redirect(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
  }
  return <SaasCustomerWorkspace searchId={searchId} outreach={outreach} />;
}
