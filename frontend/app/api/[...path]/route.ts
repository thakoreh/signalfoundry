import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { tokenMatchesSession } from "@/lib/server/token-binding";
import { runtimeConfig } from "@/lib/runtime-config";
import { handleApi, type FunctionName } from "@/lib/server/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const functionKinds: Record<FunctionName, "query" | "mutation" | "action"> = {
  "workspaces.get": "query",
  "workspaces.analyze": "action",
  "workspaces.provision": "mutation",
  "workspaces.saveProfile": "mutation",
  "campaigns.list": "query",
  "campaigns.create": "mutation",
  "campaigns.get": "query",
  "campaigns.accounts": "query",
  "campaigns.exportAccounts": "query",
  "campaigns.suggestBrief": "action",
  "discovery.status": "action",
  "accounts.get": "query",
  "accounts.setStatus": "mutation",
  "accounts.draft": "query",
  "jobs.start": "mutation",
  "jobs.get": "query",
  "jobs.cancel": "mutation",
  "jobs.forCampaign": "query",
  "billing.status": "query",
  "stripe.offer": "action",
  "stripe.checkout": "action",
  "stripe.portal": "action",
};
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const config = runtimeConfig();
  return handleApi(request, (await context.params).path, {
    config,
    session: async () => {
      const session = await auth({ acceptsToken: "session_token" });
      return {
        userId: session.userId,
        orgId: session.orgId ?? null,
        orgRole: session.orgRole ?? null,
        getToken: async () => {
          const token = await session.getToken({
            template: process.env.CLERK_JWT_TEMPLATE || "convex",
          });
          return token &&
            tokenMatchesSession(token, {
              userId: session.userId,
              orgId: session.orgId ?? null,
              orgRole: session.orgRole ?? null,
            })
            ? token
            : null;
        },
      };
    },
    invoke: async (name, args, token) => {
      // Never share a stateful authenticated client between users or requests.
      const client = new ConvexHttpClient(config.convexUrl!);
      client.setAuth(token);
      const functionPath = name.replace(".", ":");
      const kind = functionKinds[name];
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          kind === "query"
            ? client.query(
                makeFunctionReference<
                  "query",
                  Record<string, unknown>,
                  unknown
                >(functionPath),
                args,
              )
            : kind === "mutation"
              ? client.mutation(
                  makeFunctionReference<
                    "mutation",
                    Record<string, unknown>,
                    unknown
                  >(functionPath),
                  args,
                )
              : client.action(
                  makeFunctionReference<
                    "action",
                    Record<string, unknown>,
                    unknown
                  >(functionPath),
                  args,
                ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Provider timeout")),
              ["workspaces.analyze", "campaigns.suggestBrief"].includes(name)
                ? 150_000
                : 25_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
export { handler as GET, handler as POST, handler as PUT, handler as PATCH };
