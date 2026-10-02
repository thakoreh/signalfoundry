import { v, type Infer } from "convex/values";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { tenantAction } from "./lib/auth";
import { callWorker, WorkerFailure } from "./lib/worker";
import {
  discoveryPolicy,
  filterAccessibleDiscoveryAccounts,
  MAX_DISCOVERY_TARGETS,
} from "./lib/discoveryPolicy";
import { validateResearchResult, text } from "./lib/validation";
import { appError } from "./lib/errors";
import { entitled, failJob, release } from "./jobs";
import * as validators from "./validators";

const LEASE_MS = 150_000;
const provider = v.object({
  configured: v.boolean(),
  licensed: v.boolean(),
  reason: v.string(),
  max_cost_microusd: v.optional(v.number()),
});
export const readiness = v.object({
  enabled: v.boolean(),
  providers: v.object({
    discovery: provider,
    contacts: provider,
    verification: provider,
  }),
  max_target_count: v.number(),
  max_cost_microusd: v.number(),
  blockers: v.array(v.string()),
});
type Readiness = Infer<typeof readiness>;
const unavailable = (reason: string): Readiness => ({
  enabled: false,
  providers: {
    discovery: { configured: false, licensed: false, reason },
    contacts: { configured: false, licensed: false, reason },
    verification: { configured: false, licensed: false, reason },
  },
  max_target_count: MAX_DISCOVERY_TARGETS,
  max_cost_microusd: 0,
  blockers: [reason],
});
function parseReadiness(value: unknown): Readiness {
  if (!value || typeof value !== "object")
    throw new WorkerFailure("Provider status is invalid", false);
  const result = value as Readiness;
  if (
    typeof result.enabled !== "boolean" ||
    !result.providers ||
    !Array.isArray(result.blockers) ||
    result.blockers.length > 20 ||
    !Number.isSafeInteger(result.max_cost_microusd) ||
    result.max_cost_microusd < 0
  )
    throw new WorkerFailure("Provider status is invalid", false);
  for (const name of ["discovery", "contacts", "verification"] as const) {
    const item = result.providers[name];
    if (
      !item ||
      typeof item.configured !== "boolean" ||
      typeof item.licensed !== "boolean" ||
      typeof item.reason !== "string" ||
      item.reason.length > 1000
    )
      throw new WorkerFailure("Provider status is invalid", false);
  }
  result.blockers.forEach((message) => text(message, "Provider blocker", 1000));
  return result;
}
export const status = tenantAction({
  args: {},
  returns: readiness,
  handler: async (): Promise<Readiness> => {
    try {
      const value = parseReadiness(
        await callWorker("/worker/discovery-status", {}),
      );
      const policy = discoveryPolicy();
      return {
        ...value,
        enabled: value.enabled && !!policy,
        max_target_count: MAX_DISCOVERY_TARGETS,
        max_cost_microusd: policy?.jobBudget ?? 0,
        blockers: [
          ...value.blockers,
          ...(policy
            ? []
            : [
                "Discovery awaits approved launch, licensed-data access, and server-side spend limits.",
              ]),
        ],
      };
    } catch {
      return unavailable(
        "Discovery providers are not configured or their status could not be confirmed.",
      );
    }
  },
});

const work = v.object({
  orgId: v.string(),
  campaignId: v.id("campaigns"),
  profile: validators.profile,
  stage: validators.discoveryStage,
  cursor: v.number(),
  targetCount: v.number(),
  offeringWebsite: v.union(v.string(), v.null()),
  accounts: v.array(validators.workerAccount),
  errors: v.array(v.string()),
  remaining: v.number(),
  verificationEnabled: v.boolean(),
});
type Work = Infer<typeof work>;
export const claim = internalMutation({
  args: { id: v.id("jobs"), attempt: v.number() },
  returns: v.union(work, v.null()),
  handler: async (ctx, args): Promise<Work | null> => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.mode !== "discovery" ||
      !["queued", "retrying"].includes(row.status) ||
      row.attempt + 1 !== args.attempt ||
      args.attempt > row.maxAttempts ||
      !row.stage ||
      row.stage === "complete"
    )
      return null;
    try {
      if (!discoveryPolicy())
        throw appError(
          "CONFIGURATION_ERROR",
          "Discovery approvals are no longer active",
        );
      await entitled(ctx, row.orgId, 0);
    } catch {
      await failJob(
        ctx,
        row,
        "Discovery license, budget, or subscription approval is unavailable",
        false,
      );
      return null;
    }
    if (row.stage !== "discovery") {
      const saved = row.intermediateAccounts ?? [];
      const accounts = filterAccessibleDiscoveryAccounts(saved);
      if (
        !accounts.length ||
        accounts.length !== saved.length ||
        accounts.some(
          (account, i) => account.contacts.length !== saved[i]?.contacts.length,
        ) ||
        !accounts[row.stageCursor ?? 0]
      ) {
        // Do not dispatch paid work against an expired checkpoint or shift a
        // persisted cursor after pruning. Settle the surviving evidence once.
        await ctx.db.patch(row._id, {
          status: "running",
          attempt: args.attempt,
          stageInFlight: false,
          intermediateAccounts: accounts,
          stageErrors: [
            ...(row.stageErrors ?? []),
            "Discovery stopped because saved provider data expired or became unavailable.",
          ].slice(0, 20),
          leaseUntil: Date.now() + LEASE_MS,
          updatedAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.jobs.finish, {
          id: row._id,
          attempt: args.attempt,
        });
        await ctx.scheduler.runAfter(LEASE_MS, internal.jobs.recover, {
          id: row._id,
          expectedAttempt: args.attempt,
        });
        return null;
      }
    }
    if (row.stage === "contacts") {
      // PDL's documented default is 10 requests/minute across the API account.
      // Reserve a global slot transactionally across all customer workspaces.
      const window = await ctx.db
        .query("discoveryProviderWindow")
        .withIndex("by_provider", (q) => q.eq("provider", "peopledatalabs"))
        .unique();
      const delay = Math.max(0, (window?.nextAvailableAt ?? 0) - Date.now());
      if (delay) {
        const scheduledId = await ctx.scheduler.runAfter(
          delay,
          internal.discovery.execute,
          args,
        );
        await ctx.db.patch(row._id, {
          scheduledId,
          leaseUntil: Date.now() + delay + LEASE_MS,
        });
        await ctx.scheduler.runAfter(delay + LEASE_MS, internal.jobs.recover, {
          id: row._id,
          expectedAttempt: args.attempt,
        });
        return null;
      }
      if (window)
        await ctx.db.patch(window._id, { nextAvailableAt: Date.now() + 6100 });
      else
        await ctx.db.insert("discoveryProviderWindow", {
          provider: "peopledatalabs",
          nextAvailableAt: Date.now() + 6100,
        });
    }
    await ctx.db.patch(row._id, {
      status: "running",
      stageInFlight: true,
      attempt: args.attempt,
      updatedAt: Date.now(),
      leaseUntil: Date.now() + LEASE_MS,
    });
    await ctx.scheduler.runAfter(LEASE_MS, internal.jobs.recover, {
      id: row._id,
      expectedAttempt: args.attempt,
    });
    return {
      orgId: row.orgId,
      campaignId: row.campaignId,
      profile: row.profile,
      stage: row.stage,
      cursor: row.stageCursor ?? 0,
      targetCount: row.targetCount ?? 20,
      offeringWebsite: row.offeringWebsite ?? null,
      accounts: row.intermediateAccounts ?? [],
      errors: row.stageErrors ?? [],
      remaining: Math.max(
        0,
        (row.reservedMicrousd ?? 0) - (row.spentMicrousd ?? 0),
      ),
      verificationEnabled: row.verificationEnabled ?? false,
    };
  },
});
async function schedule(ctx: MutationCtx, row: Doc<"jobs">) {
  const scheduledId = await ctx.scheduler.runAfter(
    0,
    internal.discovery.execute,
    { id: row._id, attempt: row.attempt + 1 },
  );
  await ctx.db.patch(row._id, {
    scheduledId,
    leaseUntil: Date.now() + LEASE_MS,
  });
  await ctx.scheduler.runAfter(LEASE_MS, internal.jobs.recover, {
    id: row._id,
    expectedAttempt: row.attempt + 1,
  });
}
export const advance = internalMutation({
  args: {
    id: v.id("jobs"),
    attempt: v.number(),
    accounts: v.array(validators.workerAccount),
    errors: v.array(v.string()),
    cost: v.number(),
    uncertain: v.boolean(),
    verificationEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.attempt !== args.attempt) return null;
    if (row.status === "cancelled") {
      await release(ctx, row);
      return null;
    }
    if (
      row.status !== "running" ||
      row.mode !== "discovery" ||
      row.stageInFlight !== true ||
      row.leaseUntil < Date.now()
    )
      return null;
    validateResearchResult(
      args.accounts,
      args.errors,
      row.campaignId,
      "discovery",
    );
    if (
      args.accounts.length > (row.targetCount ?? 30) ||
      !Number.isSafeInteger(args.cost) ||
      args.cost < 0 ||
      args.cost + (row.spentMicrousd ?? 0) > (row.reservedMicrousd ?? 0)
    )
      throw appError(
        "RESEARCH_FAILED",
        "Provider cost or result exceeded its reservation",
      );
    if (row.stage !== "discovery") {
      const old = row.intermediateAccounts ?? [];
      if (
        old.length !== args.accounts.length ||
        old.some(
          (item, i) =>
            item.id !== args.accounts[i]?.id ||
            item.domain !== args.accounts[i]?.domain,
        )
      )
        throw appError(
          "RESEARCH_FAILED",
          "Contact results changed company identity",
        );
    }
    const errors = [...(row.stageErrors ?? []), ...args.errors].slice(0, 19);
    const spentMicrousd = (row.spentMicrousd ?? 0) + args.cost;
    await ctx.db.patch(row._id, {
      stageInFlight: false,
      intermediateAccounts: args.accounts,
      stageErrors: errors,
      spentMicrousd,
      spendStatus: args.uncertain ? "uncertain" : row.spendStatus,
      verificationEnabled: args.verificationEnabled,
      updatedAt: Date.now(),
    });
    const deadlines = args.accounts
      .flatMap((account) => [
        account.license_expires_at,
        ...account.contacts.map((contact) => contact.license_expires_at),
      ])
      .filter((value): value is string => !!value)
      .map(Date.parse)
      .filter(Number.isFinite);
    if (
      deadlines.length &&
      (!row.retentionSweepAt || Math.min(...deadlines) < row.retentionSweepAt)
    ) {
      const deadline = Math.max(Date.now() + 1, Math.min(...deadlines));
      await ctx.db.patch(row._id, { retentionSweepAt: deadline });
      await ctx.scheduler.runAt(deadline, internal.discovery.purgeExpired, {
        id: row._id,
      });
    }
    let nextStage = row.stage;
    let cursor = (row.stageCursor ?? 0) + 1;
    if (row.stage === "discovery") {
      nextStage = "contacts";
      cursor = 0;
    } else if (
      cursor >= args.accounts.length &&
      row.stage === "contacts" &&
      args.verificationEnabled
    ) {
      nextStage = "verification";
      cursor = 0;
    }
    const complete =
      args.uncertain ||
      (args.cost === 0 && args.errors.length > 0) ||
      !args.accounts.length ||
      (row.stage !== "discovery" && cursor >= args.accounts.length) ||
      spentMicrousd >= (row.reservedMicrousd ?? 0);
    if (complete) {
      if (args.uncertain)
        errors.push(
          "Provider billing outcome is uncertain. Remaining budget is held and no paid retry was made.",
        );
      else if (
        spentMicrousd >= (row.reservedMicrousd ?? 0) &&
        cursor < args.accounts.length
      )
        errors.push(
          "Campaign stopped at its approved provider budget; contact coverage may be incomplete.",
        );
      // Provider data lives only in purgeable application rows, never durable
      // scheduler arguments, whose retention is outside this sweep's control.
      await ctx.db.patch(row._id, { stageErrors: errors.slice(0, 20) });
      await ctx.scheduler.runAfter(0, internal.jobs.finish, {
        id: row._id,
        attempt: row.attempt,
      });
      return null;
    }
    await ctx.db.patch(row._id, {
      status: "queued",
      stage: nextStage,
      stageCursor: cursor,
    });
    await schedule(ctx, row);
    return null;
  },
});
export const stop = internalMutation({
  args: {
    id: v.id("jobs"),
    attempt: v.number(),
    message: v.string(),
    uncertain: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.attempt !== args.attempt) return null;
    if (row.status === "cancelled") {
      await release(ctx, row);
      return null;
    }
    if (
      row.status !== "running" ||
      row.mode !== "discovery" ||
      row.stageInFlight !== true
    )
      return null;
    const message = text(args.message, "Discovery failure", 1000);
    await ctx.db.patch(row._id, {
      stageInFlight: false,
      spendStatus: args.uncertain ? "uncertain" : row.spendStatus,
    });
    if (row.intermediateAccounts?.length) {
      const accounts = filterAccessibleDiscoveryAccounts(
        row.intermediateAccounts,
      );
      await ctx.db.patch(row._id, {
        intermediateAccounts: accounts,
        stageErrors: [...(row.stageErrors ?? []), message].slice(0, 20),
        leaseUntil: Date.now() + LEASE_MS,
      });
      await ctx.scheduler.runAfter(0, internal.jobs.finish, {
        id: row._id,
        attempt: row.attempt,
      });
      await ctx.scheduler.runAfter(LEASE_MS, internal.jobs.recover, {
        id: row._id,
        expectedAttempt: row.attempt,
      });
    } else {
      // No provider call means a configuration failure can release its reservation.
      await failJob(
        ctx,
        {
          ...row,
          stageInFlight: args.uncertain,
          status: args.uncertain ? "running" : "queued",
          spendStatus: args.uncertain ? "uncertain" : row.spendStatus,
        },
        message,
        false,
      );
    }
    return null;
  },
});

export const execute = internalAction({
  args: { id: v.id("jobs"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const current: Work | null = await ctx.runMutation(
      internal.discovery.claim,
      args,
    );
    if (!current) return null;
    let called = false;
    try {
      const common = {
        org_id: current.orgId,
        operation_id: `${args.id}_${args.attempt}`,
        campaign_id: current.campaignId,
        profile: current.profile,
        max_cost_microusd: current.remaining,
      };
      let response: unknown;
      let verify = current.verificationEnabled;
      if (current.stage === "discovery") {
        const available = parseReadiness(
          await callWorker("/worker/discovery-status", {}),
        );
        if (
          !available.enabled ||
          !available.providers.discovery.configured ||
          !available.providers.discovery.licensed ||
          !available.providers.contacts.configured ||
          !available.providers.contacts.licensed
        )
          throw new WorkerFailure(
            "Discovery providers are not configured and commercially approved",
            false,
          );
        verify =
          available.providers.verification.configured &&
          available.providers.verification.licensed;
        called = true;
        response = await callWorker("/worker/discover", {
          ...common,
          target_count: current.targetCount,
          offering_website: current.offeringWebsite,
        });
      } else {
        const account = current.accounts[current.cursor];
        if (!account)
          throw new WorkerFailure("Discovery checkpoint is invalid", false);
        called = true;
        response = await callWorker(
          current.stage === "contacts" ? "/worker/contacts" : "/worker/verify",
          current.stage === "contacts"
            ? {
                ...common,
                account_id: account.id,
                domain: account.domain,
                max_contacts: 3,
              }
            : {
                org_id: current.orgId,
                operation_id: common.operation_id,
                campaign_id: current.campaignId,
                max_cost_microusd: current.remaining,
                account_id: account.id,
                contacts: account.contacts,
              },
        );
      }
      if (!response || typeof response !== "object")
        throw new WorkerFailure("Provider returned an invalid result", false);
      const result = response as {
        accounts?: validators.WorkerAccount[];
        account_id?: string;
        contacts?: Infer<typeof validators.contact>[];
        errors: string[];
        cost_microusd: number;
        spend_uncertain: boolean;
      };
      if (
        !Array.isArray(result.errors) ||
        result.errors.length > 20 ||
        typeof result.spend_uncertain !== "boolean" ||
        !Number.isSafeInteger(result.cost_microusd) ||
        result.cost_microusd < 0 ||
        result.cost_microusd > current.remaining
      )
        throw new WorkerFailure("Provider result or cost is invalid", false);
      let accounts = current.accounts;
      if (current.stage === "discovery") {
        if (!Array.isArray(result.accounts))
          throw new WorkerFailure(
            "Discovery returned no account collection",
            false,
          );
        accounts = result.accounts;
        if (!verify)
          result.errors.push(
            "Email verification is not configured. Returned emails remain unverified; discovery does not imply consent to contact.",
          );
      } else {
        if (
          result.account_id !== accounts[current.cursor].id ||
          !Array.isArray(result.contacts) ||
          result.contacts.length > 3
        )
          throw new WorkerFailure(
            "Contact provider returned inconsistent account identity",
            false,
          );
        accounts = accounts.map((account, i) =>
          i === current.cursor
            ? { ...account, contacts: result.contacts! }
            : account,
        );
      }
      await ctx.runMutation(internal.discovery.advance, {
        ...args,
        accounts,
        errors: result.errors.slice(0, 20),
        cost: result.cost_microusd,
        uncertain: result.spend_uncertain,
        verificationEnabled: verify,
      });
    } catch (error) {
      await ctx.runMutation(internal.discovery.stop, {
        ...args,
        message:
          error instanceof WorkerFailure
            ? error.message
            : "Discovery results failed validation; provider calls will not be automatically repeated",
        uncertain: called,
      });
    }
    return null;
  },
});

// Retention is enforced both at read/export time and by physical removal. Each
// new source deadline schedules a bounded sweep scoped to exactly this job.
export const purgeExpired = internalMutation({
  args: { id: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || !row.retentionSweepAt || row.retentionSweepAt > Date.now())
      return null;
    const now = Date.now();
    const alive = (value: {
      source_provider?: string | null;
      provider?: string | null;
      license_expires_at?: string | null;
    }) =>
      !(value.source_provider || value.provider) ||
      (!!value.license_expires_at &&
        Date.parse(value.license_expires_at) > now);
    const next: number[] = [];
    const remember = (value: { license_expires_at?: string | null }) => {
      if (
        value.license_expires_at &&
        Date.parse(value.license_expires_at) > now
      )
        next.push(Date.parse(value.license_expires_at));
    };
    if (row.intermediateAccounts) {
      const accounts = row.intermediateAccounts.filter(alive).map((account) => {
        remember(account);
        const contacts = account.contacts.filter(alive);
        contacts.forEach(remember);
        return { ...account, contacts };
      });
      await ctx.db.patch(row._id, {
        intermediateAccounts: accounts.length ? accounts : undefined,
      });
      const pruned =
        accounts.length !== row.intermediateAccounts.length ||
        accounts.some(
          (account, i) =>
            account.contacts.length !==
            row.intermediateAccounts![i]?.contacts.length,
        );
      if (pruned && ["queued", "retrying", "running"].includes(row.status)) {
        // An expiry can happen while a contact request is in flight. Stop rather
        // than moving its cursor to a different company or accepting a late result.
        // An unresolved call still holds its whole original reservation.
        await ctx.db.patch(row._id, {
          status: "running",
          stageInFlight: false,
          spendStatus: row.stageInFlight ? "uncertain" : row.spendStatus,
          stageErrors: [
            ...(row.stageErrors ?? []),
            "Discovery stopped when provider retention expired; affected data was removed.",
          ].slice(0, 20),
          leaseUntil: now + LEASE_MS,
        });
        await ctx.scheduler.runAfter(0, internal.jobs.finish, {
          id: row._id,
          attempt: row.attempt,
        });
        await ctx.scheduler.runAfter(LEASE_MS, internal.jobs.recover, {
          id: row._id,
          expectedAttempt: row.attempt,
        });
      }
    }
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_jobId", (q) => q.eq("jobId", row._id))
      .take(30);
    for (const account of accounts) {
      if (!alive(account.data)) {
        await ctx.db.delete(account._id);
        continue;
      }
      remember(account.data);
      const contacts = account.data.contacts.filter(alive);
      contacts.forEach(remember);
      if (contacts.length !== account.data.contacts.length)
        await ctx.db.patch(account._id, {
          data: { ...account.data, contacts },
        });
    }
    const campaign = await ctx.db.get(row.campaignId);
    if (campaign?.orgId === row.orgId) {
      const remaining = await ctx.db
        .query("accounts")
        .withIndex("by_orgId_and_campaignId_and_score", (q) =>
          q.eq("orgId", row.orgId).eq("campaignId", row.campaignId),
        )
        .take(30);
      await ctx.db.patch(campaign._id, {
        account_count: remaining.length,
        qualified_count: remaining.filter((item) => item.score >= 65).length,
      });
    }
    await ctx.db.patch(row._id, {
      retentionSweepAt: next.length ? Math.min(...next) : undefined,
    });
    if (next.length)
      await ctx.scheduler.runAt(
        Math.min(...next),
        internal.discovery.purgeExpired,
        { id: row._id },
      );
    return null;
  },
});
