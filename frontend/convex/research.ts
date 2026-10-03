import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { callWorker, WorkerFailure } from "./lib/worker";
import type { Profile, WorkerAccount } from "./validators";
import type { Id } from "./_generated/dataModel";

export const execute = internalAction({
  args: { id: v.id("jobs"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const work: {
      orgId: string;
      campaignId: Id<"campaigns">;
      mode: "demo" | "manual";
      domains: string[];
      excludedDomains: string[];
      profile: Profile;
    } | null = await ctx.runMutation(internal.jobs.claim, args);
    if (!work) return null;
    // Every domain was reviewed or workspace-suppressed before dispatch.
    if (!work.domains.length) {
      await ctx.runMutation(internal.jobs.finish, {
        ...args,
        accounts: [],
        errors: [],
      });
      return null;
    }
    try {
      let result: { accounts: WorkerAccount[]; errors: string[] };
      {
        const response = await callWorker("/worker/research", {
          profile: work.profile,
          campaign_id: work.campaignId,
          mode: work.mode,
          domains: work.domains,
          excluded_domains: work.excludedDomains,
        });
        if (
          !response ||
          typeof response !== "object" ||
          !("accounts" in response) ||
          !("errors" in response) ||
          !Array.isArray(response.accounts) ||
          !Array.isArray(response.errors) ||
          response.accounts.length > 10 ||
          response.errors.length > 20
        ) {
          throw new WorkerFailure(
            "Research worker returned an invalid result",
            false,
          );
        }
        // The internal mutation validates the complete nested shape and business invariants before any writes.
        result = response as { accounts: WorkerAccount[]; errors: string[] };
      }
      await ctx.runMutation(internal.jobs.finish, { ...args, ...result });
    } catch (error) {
      await ctx.runMutation(internal.jobs.fail, {
        ...args,
        error:
          error instanceof WorkerFailure
            ? error.message
            : "Research results failed validation; no partial writes were saved",
        retryable: error instanceof WorkerFailure && error.retryable,
      });
    }
    return null;
  },
});
