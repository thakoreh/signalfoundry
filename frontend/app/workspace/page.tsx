import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Workspace from "@/components/workspace";
import { WorkspaceSession } from "@/components/workspace-session";
import { SaasWorkspace } from "@/components/saas-workspace";
import { runtimeConfig } from "@/lib/runtime-config";

export default async function WorkspacePage() {
  const config = runtimeConfig();
  if (!config.ready) return null;
  if (config.mode === "local-demo")
    return (
      <WorkspaceSession mode="local-demo" role="org:admin">
        <Workspace />
      </WorkspaceSession>
    );
  const session = await auth();
  if (!session.userId) redirect("/sign-in");
  return <SaasWorkspace />;
}
