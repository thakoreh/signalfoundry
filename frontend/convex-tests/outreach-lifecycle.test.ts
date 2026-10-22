/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { DEMO_PROFILE, manualAccounts } from "./helpers";
import { weekdayGap } from "../convex/lib/outreachLifecyclePolicy";
import * as lifecycleExports from "../convex/outreachLifecycle";
import * as activityExports from "../convex/outreachActivity";

const modules = import.meta.glob("../convex/**/*.ts");
const identity = {
  subject: "user_fixture",
  org_id: "org_fixture",
  org_role: "org:admin",
};
const scope = { expectedOrgId: identity.org_id };
const profile = {
  ...DEMO_PROFILE,
  company_name: "Fictional Seller",
  sender_name: "Test Founder",
  mailing_address: "100 Imaginary Street (fictional fixture), Toronto ON",
  sender_contact: "founder@example.com",
};
const key = () => crypto.randomUUID();
const bucket = () => Math.floor(Date.now() / 60_000);
const basis = (recipient: string) => ({
  version: 1 as const,
  published_email: recipient,
  source_url: "https://example.com/team",
  captured_at: "2026-10-20T12:00:00Z",
  publisher_attribution: "recipient" as const,
  notice_status: "clear" as const,
  recipient_role: "Operations lead",
  message_relevance:
    "Fictional workflow software relates to the published operating role.",
  recipient_country: "CA" as const,
  recipient_timezone: "America/Toronto",
  basis_type: "conspicuous_publication" as const,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T15:00:00Z"));
  vi.stubEnv("SIGNALFOUNDRY_HOSTED_OUTREACH_PERSISTENCE_ENABLED", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No external request allowed in lifecycle fixtures");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function setup() {
  const t = convexTest(schema, modules),
    admin = t.withIdentity(identity);
  await admin.mutation(api.workspaces.provision, {});
  await admin.mutation(api.workspaces.saveProfile, { profile });
  const seed = manualAccounts(
    profile,
    "fictional_search",
    new Date().toISOString(),
  )[0];
  const accounts = ["first", "second", "third"].map((name) => ({
    ...seed,
    id: name,
    name: `Fictional ${name}`,
    domain: name === "third" ? "example.net" : "www.example.com",
    score_breakdown: [
      {
        label: "Customer-type language",
        points: 60,
        max_points: 60,
        reason: "Fictional published company identity",
      },
    ],
    evidence: [
      {
        ...seed.evidence[0],
        id: `fact_${name}`,
        url: "https://example.com/about",
        kind: "company" as const,
        excerpt: "The fictional company operates a published workflow.",
        is_demo: false,
      },
    ],
    contacts: [
      {
        name: `Test ${name}`,
        role: "Operations lead",
        email: `${name}@example.com`,
        verification_status: "unverified" as const,
        source_url: "https://example.com/team",
        note: "Fictional",
      },
    ],
  }));
  const searchId = await t.run((ctx) =>
    ctx.db.insert("customerSearches", {
      orgId: identity.org_id,
      createdBy: identity.subject,
      requestKey: key(),
      status: "complete",
      stage: "Fictional completed search",
      query: "Fictional",
      target: "Workflow operators",
      geography: "Canada",
      limit: 5,
      profile,
      website: null,
      accounts,
      errors: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  const rows = await admin.mutation(internal.outreachLedger.start, {
    ...scope,
    searchId,
    accountIds: ["first", "second", "third"],
    idempotencyKey: key(),
  });
  return { t, admin, searchId, accounts, rows };
}
type Setup = Awaited<ReturnType<typeof setup>>;
type View = Setup["rows"][number];
const revision = (row: View) => ({
  ...scope,
  threadId: row.thread._id,
  expectedRevision: row.thread.revision,
  idempotencyKey: key(),
});
const body = (
  row: View,
  value = "Your published workflow is relevant to our software. Is this useful?",
) => value + row.senderFooter;
const get = (s: Setup, row: View) =>
  s.admin.query(internal.outreachLedger.get, {
    ...scope,
    threadId: row.thread._id,
    clockBucket: bucket(),
  });
const queue = (s: Setup) =>
  s.admin.query(internal.outreachActivity.nextUp, {
    ...scope,
    clockBucket: bucket(),
  });
const insights = (s: Setup) =>
  s.admin.query(internal.outreachActivity.insights, {
    ...scope,
    clockBucket: bucket(),
  });
async function prepare(s: Setup, row: View) {
  row = await s.admin.mutation(internal.outreachLedger.edit, {
    ...revision(row),
    recipient: row.thread.recipient,
    subject: "A plain question",
    body: body(row),
  });
  return s.admin.mutation(internal.outreachLedger.saveBasis, {
    ...revision(row),
    basis: basis(row.thread.recipient),
  });
}
async function approve(s: Setup, row: View) {
  return s.admin.mutation(internal.outreachLedger.approve, revision(row));
}
async function ready(s: Setup, row = s.rows[0]) {
  return approve(s, await prepare(s, row));
}
async function sent(s: Setup, row: View) {
  return s.admin.mutation(internal.outreachLedger.reportSent, {
    ...revision(row),
    approvalId: row.approval!._id,
    sentAs: "approved",
  });
}
async function initialSend(s: Setup, row = s.rows[0]) {
  return sent(s, await ready(s, row));
}
async function followup(s: Setup, row: View, at = "2026-10-26T11:00:00-04:00") {
  return s.admin.mutation(internal.outreachLifecycle.planFollowup, {
    ...revision(row),
    subject: "Same conversation",
    body: body(row, "A short reminder. Is this relevant?"),
    scheduledAt: at,
    scheduledTimezone: "America/Toronto",
  });
}
async function meeting(
  s: Setup,
  row: View,
  at = "2026-10-22T10:00:00-04:00",
  zone = "America/Toronto",
) {
  return s.admin.mutation(internal.outreachLifecycle.reportMeeting, {
    ...revision(row),
    meetingAt: at,
    meetingTimezone: zone,
  });
}

describe("hosted lifecycle, return queue and reported outcomes (isolated offline fixtures)", () => {
  it("keeps every new function internal/default-off with no external calls or writes on reads", async () => {
    for (const fn of [
      ...Object.values(lifecycleExports),
      ...Object.values(activityExports),
    ])
      expect(fn.isInternal).toBe(true);
    const s = await setup();
    const before = await s.t.run((ctx) =>
      ctx.db.query("outreachRequests").take(10),
    );
    await queue(s);
    await insights(s);
    await queue(s);
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachRequests").take(10)),
    ).toEqual(before);
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachMessages").take(1)),
    ).toEqual([]);
    vi.stubEnv("SIGNALFOUNDRY_HOSTED_OUTREACH_PERSISTENCE_ENABLED", "false");
    await expect(queue(s)).rejects.toThrow("disabled");
    await expect(meeting(s, s.rows[0])).rejects.toThrow("disabled");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires strong sourced customer-type fit rather than geography, exclusions, demo or private evidence", async () => {
    const s = await setup(),
      baseline = s.accounts[0];
    const cases = [
      {
        ...baseline,
        score_breakdown: [
          {
            label: "Customer-type language",
            points: 30,
            max_points: 60,
            reason: "Body only",
          },
          {
            label: "Location language",
            points: 40,
            max_points: 40,
            reason: "Nearby",
          },
        ],
      },
      {
        ...baseline,
        score_breakdown: [
          ...baseline.score_breakdown,
          {
            label: "Exclusion penalty",
            points: -1,
            max_points: 100,
            reason: "Excluded",
          },
        ],
      },
      {
        ...baseline,
        evidence: baseline.evidence.map((e) => ({
          ...e,
          url: "https://127.0.0.1",
        })),
      },
      {
        ...baseline,
        evidence: baseline.evidence.map((e) => ({
          ...e,
          kind: "signal" as const,
        })),
      },
      { ...baseline, is_demo: true },
    ];
    for (const [i, account] of cases.entries()) {
      const a = { ...account, id: `weak_${i}` };
      await s.t.run((ctx) => ctx.db.patch(s.searchId, { accounts: [a] }));
      await expect(
        s.admin.mutation(internal.outreachLedger.start, {
          ...scope,
          searchId: s.searchId,
          accountIds: [a.id],
          idempotencyKey: key(),
        }),
      ).rejects.toThrow();
    }
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachThreads").take(101)),
    ).toHaveLength(3);
  });
  it("adds a distinct referral with actual parent credit, fresh permission and idempotent current-state replay", async () => {
    const s = await setup();
    let parent = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.rows[0]),
      body: "Please talk to Test Referred (fictional)",
      replyState: "referral",
    });
    const original = parent.messages[0];
    const args = {
      ...revision(parent),
      recipient: "referred@example.com",
      contactName: "Test Referred",
      referrerName: "Test First",
      referrerMessageId: original._id,
    };
    let child = await s.admin.mutation(internal.outreachLifecycle.refer, args);
    expect(child.thread._id).not.toBe(parent.thread._id);
    expect(child.thread.companyKey).toBe(parent.thread.companyKey);
    expect(child.thread.referral).toEqual({
      threadId: parent.thread._id,
      messageId: original._id,
      referrerName: "Test First",
    });
    expect(child.thread.sourceFacts).toEqual(parent.thread.sourceFacts);
    expect(child.thread.contactBasis).toBeNull();
    expect(child.approval).toBeNull();
    expect(child.thread.recipientStatus).toBe("user_entered");
    expect((await get(s, parent)).messages[0]).toEqual(original);
    expect((await queue(s)).some((t) => t.threadId === parent.thread._id)).toBe(
      false,
    );
    expect(
      (await s.admin.mutation(internal.outreachLifecycle.refer, args)).thread
        ._id,
    ).toBe(child.thread._id);
    child = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(child),
      body: "Unsubscribe",
      replyState: "opt_out",
    });
    expect(
      (await s.admin.mutation(internal.outreachLifecycle.refer, args))
        .suppressed,
    ).toBe(true);
    expect((await get(s, parent)).suppressed).toBe(true);
    parent = await get(s, parent);
    await expect(
      s.admin.mutation(internal.outreachLifecycle.refer, {
        ...args,
        ...revision(parent),
        recipient: "another@example.com",
      }),
    ).rejects.toThrow("suppression");
  });
  it("rejects stale, duplicate, original, suppressed and bounced referral targets without inheriting parent approval", async () => {
    const s = await setup();
    let parent = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.rows[0]),
      body: "Talk to someone else (fictional)",
      replyState: "referral",
    });
    const args = {
      ...revision(parent),
      recipient: "new@example.com",
      contactName: "Test New",
      referrerName: "Test First",
      referrerMessageId: parent.thread.latestInboundId!,
    };
    await expect(
      s.admin.mutation(internal.outreachLifecycle.refer, {
        ...args,
        recipient: parent.thread.recipient,
      }),
    ).rejects.toThrow("different");
    await expect(
      s.admin.mutation(internal.outreachLifecycle.refer, {
        ...args,
        recipient: s.rows[1].thread.recipient,
      }),
    ).rejects.toThrow("existing");
    const bounced = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.rows[2]),
      body: "Delivery failed (fictional)",
      replyState: "bounce",
    });
    await expect(
      s.admin.mutation(internal.outreachLifecycle.refer, {
        ...args,
        recipient: bounced.thread.recipient,
      }),
    ).rejects.toThrow("bounced");
    parent = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(parent),
      body: "Another referral (fictional)",
      replyState: "referral",
    });
    await expect(
      s.admin.mutation(internal.outreachLifecycle.refer, {
        ...args,
        ...revision(parent),
      }),
    ).rejects.toThrow("current referral");
    expect((await get(s, bounced)).messages).toHaveLength(1);
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachThreads").take(101)),
    ).toHaveLength(3);
  });
  it("enforces the 100-conversation bound atomically for referrals", async () => {
    const s = await setup();
    const parent = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.rows[0]),
      body: "Referral (fictional)",
      replyState: "referral",
    });
    await s.t.run(async (ctx) => {
      const limits = (await ctx.db.query("outreachLedgers").take(1))[0];
      await ctx.db.patch(limits._id, { threadCount: 100 });
    });
    await expect(
      s.admin.mutation(internal.outreachLifecycle.refer, {
        ...revision(parent),
        recipient: "new@example.com",
        contactName: "",
        referrerName: "Test First",
        referrerMessageId: parent.thread.latestInboundId!,
      }),
    ).rejects.toThrow("allowance");
    expect((await get(s, parent)).thread.revision).toBe(parent.thread.revision);
    expect((await get(s, parent)).thread.completedReferralIds).toEqual([]);
  });
  it("plans only after a reported send, keeps a minimum weekday gap and requires fresh due approval", async () => {
    const s = await setup();
    let row = await ready(s);
    await expect(followup(s, row)).rejects.toThrow("reported initial");
    await s.admin.mutation(internal.outreachLifecycle.preflightManualAction, {
      ...scope,
      threadId: row.thread._id,
      expectedRevision: row.thread.revision,
      approvalId: row.approval!._id,
    });
    expect((await get(s, row)).messages).toEqual([]);
    row = await sent(s, row);
    for (const date of [
      "2026-10-23T11:00:00-04:00",
      "2026-10-25T11:00:00-04:00",
      "2026-10-20T11:00:00-04:00",
    ])
      await expect(followup(s, row, date)).rejects.toThrow("weekday");
    row = await followup(s, row);
    expect(row.events).toHaveLength(1);
    expect(row.approval).toBeNull();
    await expect(approve(s, row)).rejects.toThrow("not due");
    expect((await queue(s)).some((t) => t.threadId === row.thread._id)).toBe(
      false,
    );
    expect((await insights(s)).upcoming).toMatchObject([
      { kind: "followup", at: Date.parse("2026-10-26T15:00:00Z") },
    ]);
    vi.setSystemTime(new Date("2026-10-26T15:00:00Z"));
    expect(
      (await queue(s)).find((t) => t.threadId === row.thread._id)?.action,
    ).toBe("review_followup");
    expect((await get(s, row)).approval).toBeNull();
    row = await approve(s, row);
    await expect(
      s.admin.query(internal.outreachLedger.checkManualAction, {
        ...scope,
        threadId: row.thread._id,
        expectedRevision: row.thread.revision,
        approvalId: row.approval!._id,
      }),
    ).rejects.toThrow("fresh");
    const before = await s.t.run((ctx) =>
      ctx.db.query("outreachRequests").take(100),
    );
    await s.admin.mutation(internal.outreachLifecycle.preflightManualAction, {
      ...scope,
      threadId: row.thread._id,
      expectedRevision: row.thread.revision,
      approvalId: row.approval!._id,
    });
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachRequests").take(100)),
    ).toEqual(before);
    expect(row.thread.activity?.coldFollowupsSent).toBe(0);
  });
  it("permits at most two independently approved followups in the original thread", async () => {
    const s = await setup();
    let row = await initialSend(s);
    row = await followup(s, row);
    vi.setSystemTime(new Date("2026-10-26T15:00:00Z"));
    row = await sent(s, await approve(s, row));
    expect(row.thread.activity?.coldFollowupsSent).toBe(1);
    row = await followup(s, row, "2026-10-29T11:00:00-04:00");
    vi.setSystemTime(new Date("2026-10-29T15:00:00Z"));
    row = await sent(s, await approve(s, row));
    expect(row.thread.activity?.coldFollowupsSent).toBe(2);
    expect(row.messages.map((m) => m.purpose)).toEqual([
      "initial",
      "cold_followup",
      "cold_followup",
    ]);
    expect(row.messages.map((m) => m.recipient)).toEqual(
      Array(3).fill(row.thread.recipient),
    );
    await expect(followup(s, row, "2026-11-03T11:00:00-05:00")).rejects.toThrow(
      "At most two",
    );
    expect((await insights(s)).contacted).toBe(1);
  });
  it.each([
    "awaiting_review",
    "interested",
    "question",
    "not_now",
    "not_interested",
    "opt_out",
    "uncertain",
    "referral",
    "source_question",
    "auto_reply",
    "bounce",
  ] as const)(
    "%s permanently cancels approved followups even after date expiry, classification correction and resume",
    async (replyState) => {
      const s = await setup();
      let row = await followup(s, await initialSend(s));
      vi.setSystemTime(new Date("2026-10-26T15:00:00Z"));
      row = await approve(s, row);
      const old = row.approval!;
      row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
        ...revision(row),
        body: "Fictional received reply",
        replyState,
        ...(["not_now", "auto_reply"].includes(replyState)
          ? {
              revisitAt: "2026-10-28T11:00:00-04:00",
              revisitTimezone: "America/Toronto",
            }
          : {}),
      });
      expect(row.thread.lifecycle?.dueAt).toBeNull();
      expect(row.approval).toBeNull();
      expect(row.thread.coldFollowupsStopped).toBe(true);
      await expect(
        s.admin.mutation(internal.outreachLifecycle.preflightManualAction, {
          ...scope,
          threadId: row.thread._id,
          expectedRevision: row.thread.revision,
          approvalId: old._id,
        }),
      ).rejects.toThrow();
      row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
        ...revision(row),
        replyState: "interested",
      });
      row = await s.admin.mutation(internal.outreachLedger.pause, {
        ...revision(row),
        paused: false,
      });
      vi.setSystemTime(new Date("2026-11-03T15:00:00Z"));
      await expect(
        followup(s, row, "2026-11-06T11:00:00-05:00"),
      ).rejects.toThrow("permanently");
      expect(
        row.messages.filter((m) => m.direction === "outbound"),
      ).toHaveLength(1);
    },
  );
  it("does not restore a paused plan and rejects recipient changes, offset mismatches and weekend plans", async () => {
    const s = await setup();
    let row = await followup(s, await initialSend(s));
    row = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(row),
      paused: true,
    });
    row = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(row),
      paused: false,
    });
    expect(row.thread.lifecycle?.dueAt).toBeNull();
    expect(row.approval).toBeNull();
    await expect(followup(s, row, "2026-10-26T11:00:00-05:00")).rejects.toThrow(
      "offset",
    );
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: "replacement@example.com",
      subject: "Q",
      body: body(row),
    });
    await expect(followup(s, row)).rejects.toThrow("original recipient");
    expect(
      weekdayGap(
        Date.parse("2026-10-23T15:00:00Z"),
        Date.parse("2026-10-28T15:00:00Z"),
        "America/Toronto",
      ),
    ).toBe(3);
  });
  it("bounds original Toronto gap/fold time semantics for meeting reports", async () => {
    const s = await setup();
    const row = s.rows[0];
    for (const at of [
      "2027-03-14T02:30:00-05:00",
      "2026-11-03T10:00:00-04:00",
      "2026-11-03T10:00:00",
    ])
      await expect(meeting(s, row, at)).rejects.toThrow();
    let updated = row;
    for (const offset of ["-04:00", "-05:00"]) {
      updated = await meeting(s, updated, `2026-11-01T01:30:00${offset}`);
      expect(updated.thread.lifecycle?.meeting?.at).toBe(
        Date.parse(`2026-11-01T01:30:00${offset}`),
      );
    }
    expect(updated.events).toHaveLength(2);
  });
  it("gives one confirmation per booking version, immutable history, and no renewed allowance for the same instant/zone correction", async () => {
    const s = await setup();
    let row = await meeting(s, await initialSend(s));
    const initialVersion = row.thread.lifecycle!.meeting!.version;
    row = await s.admin.mutation(
      internal.outreachLifecycle.prepareConfirmation,
      {
        ...revision(row),
        subject: "Meeting confirmation",
        body: body(row, "Confirming our reported meeting time."),
      },
    );
    row = await approve(s, row);
    const approval = row.approval!;
    row = await sent(s, row);
    const original = row.messages.at(-1)!;
    expect(original.purpose).toBe("meeting_confirmation");
    expect(original.meetingVersion).toBe(initialVersion);
    row = await meeting(s, row, "2026-10-22T14:00:00Z", "UTC");
    expect(row.thread.lifecycle!.meeting!.version).toBe(initialVersion);
    await expect(
      s.admin.mutation(internal.outreachLifecycle.prepareConfirmation, {
        ...revision(row),
        subject: "Again",
        body: body(row),
      }),
    ).rejects.toThrow("already recorded");
    row = await meeting(s, row, "2026-10-23T10:00:00-04:00");
    expect(row.thread.lifecycle!.meeting!.version).toBe(initialVersion + 1);
    expect(await s.t.run((ctx) => ctx.db.get(approval._id))).toEqual(approval);
    expect(row.messages.at(-1)).toEqual(original);
    expect(row.events.map((e) => e.kind)).toEqual([
      "meeting_reported",
      "meeting_reported",
      "meeting_reported",
    ]);
    expect((await insights(s)).meetingsHeld).toBe(0);
    expect((await insights(s)).customers).toBe(0);
  });
  it("denies expired confirmation in the uncached preflight without a database change or caller-clock authority", async () => {
    const s = await setup();
    let row = await meeting(s, await prepare(s, s.rows[0]));
    row = await s.admin.mutation(
      internal.outreachLifecycle.prepareConfirmation,
      { ...revision(row), subject: "Confirming", body: body(row) },
    );
    row = await approve(s, row);
    const args = {
      ...scope,
      threadId: row.thread._id,
      expectedRevision: row.thread.revision,
      approvalId: row.approval!._id,
    };
    await s.admin.mutation(
      internal.outreachLifecycle.preflightManualAction,
      args,
    );
    await expect(
      s.admin.query(internal.outreachLedger.checkManualAction, args),
    ).rejects.toThrow("fresh");
    vi.setSystemTime(new Date("2026-10-22T14:00:01Z"));
    await expect(
      s.admin.mutation(internal.outreachLifecycle.preflightManualAction, args),
    ).rejects.toThrow("time window");
    await expect(sent(s, row)).rejects.toThrow("exact message");
    expect(
      (await queue(s)).find((t) => t.threadId === row.thread._id)?.action,
    ).toBe("report_meeting");
    expect((await get(s, row)).thread.revision).toBe(row.thread.revision);
    expect((await get(s, row)).messages).toEqual([]);
    await expect(
      s.admin.query(internal.outreachActivity.nextUp, {
        ...scope,
        clockBucket: bucket() + 9999,
      }),
    ).rejects.toThrow("clock");
  });
  it("keeps a booking tied to its original recipient through corrections, even after an outcome reset", async () => {
    const s = await setup();
    let row = await meeting(s, s.rows[0]);
    row = await s.admin.mutation(internal.outreachLifecycle.reportOutcomes, {
      ...revision(row),
      meetingState: "not_recorded",
      saleState: "not_recorded",
    });
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: "new@example.com",
      subject: "Q",
      body: body(row),
    });
    await expect(meeting(s, row, "2026-10-23T11:00:00-04:00")).rejects.toThrow(
      "original recipient",
    );
    await expect(
      s.admin.mutation(internal.outreachLifecycle.prepareConfirmation, {
        ...revision(row),
        subject: "Q",
        body: body(row),
      }),
    ).rejects.toThrow();
    expect(row.thread.lifecycle?.meeting?.recipient).toBe(
      s.rows[0].thread.recipient,
    );
  });
  it("logs attendance only after time, keeps sale separate and leaves ignored outcomes unknown", async () => {
    const s = await setup();
    let row = await meeting(s, await initialSend(s));
    expect(row.thread.lifecycle?.sale).toBe("not_recorded");
    await expect(
      s.admin.mutation(internal.outreachLifecycle.reportOutcomes, {
        ...revision(row),
        meetingState: "attended_reported",
        saleState: "not_recorded",
      }),
    ).rejects.toThrow("Wait");
    vi.setSystemTime(new Date("2026-10-22T14:01:00Z"));
    const before = await get(s, row);
    expect(before.thread.lifecycle?.meeting?.state).toBe("booked_reported");
    row = await s.admin.mutation(internal.outreachLifecycle.reportOutcomes, {
      ...revision(row),
      meetingState: "attended_reported",
      saleState: "not_recorded",
    });
    expect(await insights(s)).toMatchObject({
      contacted: 1,
      meetingsHeld: 1,
      customers: 0,
      source: "reported_by_you",
    });
    row = await s.admin.mutation(internal.outreachLifecycle.reportOutcomes, {
      ...revision(row),
      meetingState: "attended_reported",
      saleState: "won_reported",
    });
    expect((await insights(s)).customers).toBe(1);
    expect(row.events.at(-1)).toMatchObject({
      kind: "outcome_reported",
      source: "user_reported",
      saleState: "won_reported",
    });
    expect(
      (await queue(s)).some(
        (t) => t.threadId === row.thread._id && t.action === "report_meeting",
      ),
    ).toBe(false);
  });
  it.each(["no_show_reported", "cancelled_reported"] as const)(
    "records %s without turning it into a held meeting or sale",
    async (meetingState) => {
      const s = await setup();
      let row = await meeting(s, s.rows[0]);
      vi.setSystemTime(new Date("2026-10-22T15:00:00Z"));
      row = await s.admin.mutation(internal.outreachLifecycle.reportOutcomes, {
        ...revision(row),
        meetingState,
        saleState: "not_recorded",
      });
      expect(row.thread.lifecycle?.meeting?.state).toBe(meetingState);
      expect(await insights(s)).toMatchObject({
        meetingsHeld: 0,
        customers: 0,
      });
    },
  );
  it("pauses sibling approvals on reported meetings and requires an explicit decision plus new approval", async () => {
    const s = await setup();
    let first = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.rows[0]),
      body: "Interested (fictional)",
      replyState: "interested",
    });
    let second = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(s.rows[1]),
      paused: false,
    });
    second = await ready(s, second);
    const old = second.approval!;
    first = await meeting(s, first);
    expect((await get(s, second)).companyPaused).toBe(true);
    await expect(
      s.admin.mutation(internal.outreachLifecycle.preflightManualAction, {
        ...scope,
        threadId: second.thread._id,
        expectedRevision: second.thread.revision,
        approvalId: old._id,
      }),
    ).rejects.toThrow();
    second = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(second),
      paused: false,
    });
    expect(second.approval).toBeNull();
    expect((await approve(s, second)).readyForManualAction).toBe(true);
    expect(first.thread.lifecycle?.meeting?.state).toBe("booked_reported");
  });
  it("keeps reported funnel counts company-unique, excludes OOO/bounce/example/unknown, and reuses next-batch company flags", async () => {
    const s = await setup();
    let first = await initialSend(s);
    first = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(first),
      body: "Fictional automatic notice",
      replyState: "auto_reply",
      revisitAt: "2026-10-28T11:00:00-04:00",
      revisitTimezone: "America/Toronto",
    });
    expect(await insights(s)).toMatchObject({
      contacted: 1,
      replied: 0,
      interested: 0,
    });
    first = await s.admin.mutation(internal.outreachLedger.classifyReply, {
      ...revision(first),
      replyState: "interested",
    });
    let second = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(s.rows[1]),
      paused: false,
    });
    second = await initialSend(s, second);
    expect(await insights(s)).toMatchObject({
      contacted: 1,
      replied: 1,
      interested: 1,
    });
    let third = await initialSend(s, s.rows[2]);
    third = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(third),
      body: "Fictional bounce",
      replyState: "bounce",
    });
    expect(await insights(s)).toMatchObject({ contacted: 2, replied: 1 });
    await s.t.run((ctx) =>
      ctx.db.patch(third.thread._id, { sourceIsDemo: true }),
    );
    expect((await insights(s)).contacted).toBe(1);
    first = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(first),
      body: "Unsubscribe",
      replyState: "opt_out",
    });
    expect(first.suppressed).toBe(true);
    const state = await insights(s);
    expect(
      state.companies.find((c) => c.companyKey === "example.com"),
    ).toMatchObject({ contacted: true, suppressed: true });
    expect(state.pendingApprovals).toBe(0);
    expect(second.messages).toHaveLength(1);
  });
  it("provides one useful next-day task per thread and removes answered work until a new inbound arrives", async () => {
    const s = await setup();
    let row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.rows[0]),
      body: "How does it work?",
      replyState: "question",
    });
    expect(
      (await queue(s)).filter((t) => t.threadId === row.thread._id),
    ).toMatchObject([{ action: "answer_reply" }]);
    row = await ready(s, row);
    row = await sent(s, row);
    expect((await queue(s)).some((t) => t.threadId === row.thread._id)).toBe(
      false,
    );
    row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(row),
      body: "Another question",
      replyState: "question",
    });
    expect(
      (await queue(s)).find((t) => t.threadId === row.thread._id)?.action,
    ).toBe("answer_reply");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("repairs legacy activity in bounded idempotent tenant batches and never restores an approval", async () => {
    const s = await setup();
    let row = await ready(s);
    const approval = row.approval!;
    await s.t.run((ctx) =>
      ctx.db.patch(row.thread._id, {
        activity: undefined,
        sourceFacts: undefined,
        sourceIsDemo: undefined,
      }),
    );
    expect(
      (await queue(s)).find((t) => t.threadId === row.thread._id)?.action,
    ).toBe("review_history");
    expect((await insights(s)).unknownHistory).toBe(1);
    const result = await s.admin.mutation(
      internal.outreachActivity.repairActivity,
      { ...scope, cursor: null },
    );
    expect(result.repaired).toBe(1);
    expect(
      (
        await s.admin.mutation(internal.outreachActivity.repairActivity, {
          ...scope,
          cursor: null,
        })
      ).repaired,
    ).toBe(0);
    row = await get(s, row);
    expect(row.approval).toBeNull();
    expect(row.thread.revision).toBeGreaterThan(approval.profileVersion);
    expect((await insights(s)).unknownHistory).toBe(0);
    expect(await s.t.run((ctx) => ctx.db.get(approval._id))).toEqual(approval);
  });
  it("bounds planning history and keeps invalid operations transactionally unchanged", async () => {
    const s = await setup();
    const row = await initialSend(s);
    const before = await get(s, row);
    await expect(
      s.admin.mutation(internal.outreachLifecycle.planFollowup, {
        ...revision(row),
        subject: "Bad\nheader",
        body: body(row),
        scheduledAt: "2026-10-26T11:00:00-04:00",
        scheduledTimezone: "America/Toronto",
      }),
    ).rejects.toThrow();
    expect(await get(s, row)).toEqual(before);
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachEvents").take(1)),
    ).toEqual([]);
    await s.t.run(async (ctx) => {
      for (let i = 0; i < 200; i++)
        await ctx.db.insert("outreachEvents", {
          orgId: identity.org_id,
          threadId: row.thread._id,
          kind: "followup_planned",
          at: Date.now(),
          reportedBy: identity.subject,
          source: "user_reported",
          scheduledAt: Date.now() + i,
          timezone: "UTC",
          meetingVersion: null,
          meetingState: null,
          saleState: null,
        });
      await ctx.db.patch(row.thread._id, { eventCount: 200 });
    });
    await expect(meeting(s, row)).rejects.toThrow("allowance");
    expect((await get(s, row)).events).toHaveLength(200);
  });
  it("shows an already-due meeting outcome even when a later OOO return is snoozed", async () => {
    const s = await setup();
    let row = await meeting(s, s.rows[0]);
    vi.setSystemTime(new Date("2026-10-23T15:00:00Z"));
    row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(row),
      body: "Fictional automatic vacation notice",
      replyState: "auto_reply",
      revisitAt: "2026-11-03T10:00:00-05:00",
      revisitTimezone: "America/Toronto",
    });
    expect(
      (await queue(s)).find((t) => t.threadId === row.thread._id)?.action,
    ).toBe("report_meeting");
    expect(row.thread.lifecycle?.meeting?.state).toBe("booked_reported");
    expect(row.thread.lifecycle?.sale).toBe("not_recorded");
    expect(row.readyForManualAction).toBe(false);
  });
  it("keeps an edited contact basis on the same scheduled plan and never treats a future clock bucket as authority", async () => {
    const s = await setup();
    let row = await followup(s, await initialSend(s));
    const due = row.thread.lifecycle!.dueAt!;
    row = await s.admin.mutation(internal.outreachLedger.saveBasis, {
      ...revision(row),
      basis: {
        ...basis(row.thread.recipient),
        message_relevance: "Updated fictional relevance",
      },
    });
    expect(row.thread.lifecycle!.dueAt).toBe(due);
    vi.setSystemTime(new Date(due - 30_000));
    const early = await s.admin.query(internal.outreachActivity.nextUp, {
      ...scope,
      clockBucket: bucket() + 2,
    });
    expect(early.some((t) => t.threadId === row.thread._id)).toBe(false);
    await expect(approve(s, row)).rejects.toThrow("not due");
    vi.setSystemTime(new Date(due));
    expect(
      (await queue(s)).find((t) => t.threadId === row.thread._id)?.action,
    ).toBe("review_followup");
  });
  it("binds booking-link bytes to current interest and invalidates edits before a fresh manual handoff", async () => {
    const s = await setup();
    let row = await prepare(s, s.rows[0]);
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: row.thread.recipient,
      subject: row.thread.subject,
      body: row.thread.body,
      bookingLink: "https://example.com/book",
    });
    await expect(approve(s, row)).rejects.toThrow("interest");
    row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(row),
      body: "Interested (fictional)",
      replyState: "interested",
    });
    row = await prepare(s, row);
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: row.thread.recipient,
      subject: row.thread.subject,
      body: row.thread.body,
      bookingLink: "https://example.com/book",
    });
    row = await approve(s, row);
    const old = row.approval!;
    expect(old.body).toBe(
      row.thread.body + "\n\nBooking link: https://example.com/book",
    );
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: row.thread.recipient,
      subject: row.thread.subject,
      body: row.thread.body,
      bookingLink: "https://example.com/book-new",
    });
    await expect(
      s.admin.mutation(internal.outreachLifecycle.preflightManualAction, {
        ...scope,
        threadId: row.thread._id,
        expectedRevision: row.thread.revision,
        approvalId: old._id,
      }),
    ).rejects.toThrow();
    row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
      ...revision(row),
      replyState: "question",
    });
    row = await prepare(s, row);
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: row.thread.recipient,
      subject: row.thread.subject,
      body: row.thread.body,
      bookingLink: "https://example.com/book-new",
    });
    await expect(approve(s, row)).rejects.toThrow("interest");
  });
  it("cannot double-report one confirmation and preserves a company stop racing a sibling approval", async () => {
    const s = await setup();
    let row = await meeting(s, await prepare(s, s.rows[0]));
    row = await s.admin.mutation(
      internal.outreachLifecycle.prepareConfirmation,
      { ...revision(row), subject: "Confirming", body: body(row) },
    );
    row = await approve(s, row);
    const result = await Promise.allSettled([sent(s, row), sent(s, row)]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await get(s, row)).messages).toHaveLength(1);
    const fresh = await setup();
    let first = await initialSend(fresh);
    first = await fresh.admin.mutation(internal.outreachLedger.pause, {
      ...revision(first),
      paused: true,
    });
    const second = await prepare(fresh, fresh.rows[1]);
    const race = await Promise.allSettled([
      fresh.admin.mutation(internal.outreachLedger.pasteReply, {
        ...revision(first),
        body: "Unsubscribe",
        replyState: "opt_out",
      }),
      approve(fresh, second),
    ]);
    expect(race[0].status).toBe("fulfilled");
    expect((await get(fresh, second)).suppressed).toBe(true);
    expect((await get(fresh, second)).readyForManualAction).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks role, organization intent and ownership on every new operation without leaking foreign state", async () => {
    const s = await setup();
    const row = await ready(s);
    const member = s.t.withIdentity({ ...identity, org_role: "org:member" }),
      other = s.t.withIdentity({ ...identity, org_id: "org_other" });
    await expect(
      member.mutation(internal.outreachLifecycle.reportMeeting, {
        ...revision(row),
        meetingAt: "2026-10-22T10:00:00-04:00",
        meetingTimezone: "America/Toronto",
      }),
    ).rejects.toThrow("admin");
    await expect(
      member.mutation(internal.outreachLifecycle.preflightManualAction, {
        ...scope,
        threadId: row.thread._id,
        expectedRevision: row.thread.revision,
        approvalId: row.approval!._id,
      }),
    ).rejects.toThrow("admin");
    await expect(
      other.mutation(internal.outreachLifecycle.reportMeeting, {
        ...revision(row),
        expectedOrgId: "org_other",
        meetingAt: "2026-10-22T10:00:00-04:00",
        meetingTimezone: "America/Toronto",
      }),
    ).rejects.toThrow("not found");
    await expect(
      other.query(internal.outreachActivity.insights, {
        ...scope,
        clockBucket: bucket(),
      }),
    ).rejects.toThrow("organization changed");
    expect(
      (
        await other.query(internal.outreachActivity.insights, {
          expectedOrgId: "org_other",
          clockBucket: bucket(),
        })
      ).companies,
    ).toEqual([]);
    expect(
      (
        await member.query(internal.outreachActivity.insights, {
          ...scope,
          clockBucket: bucket(),
        })
      ).pendingApprovals,
    ).toBe(1);
  });
});
