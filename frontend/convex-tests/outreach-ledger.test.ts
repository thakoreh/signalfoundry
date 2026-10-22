/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import * as ledgerExports from "../convex/outreachLedger";
import { DEMO_PROFILE, manualAccounts } from "./helpers";
import {
  awareInstant,
  senderFooter,
  zonedInstant,
} from "../convex/lib/outreachLedgerPolicy";

const modules = import.meta.glob("../convex/**/*.ts");
const identity = {
  subject: "user_fictional_founder",
  org_id: "org_fictional",
  org_role: "org:admin",
};
const profile = {
  ...DEMO_PROFILE,
  company_name: "Fictional Seller",
  sender_name: "Test Founder",
  mailing_address: "100 Fictional Street, Toronto ON (test fixture)",
  sender_contact: "founder@example.com",
};
const key = () => crypto.randomUUID();
const scope = { expectedOrgId: identity.org_id };
const basis = (recipient: string) => ({
  version: 1 as const,
  published_email: recipient,
  source_url: "https://example.com/team",
  captured_at: "2026-10-20T12:00:00Z",
  publisher_attribution: "recipient" as const,
  notice_status: "clear" as const,
  recipient_role: "Operations lead (fictional)",
  message_relevance:
    "The fictional seller offers the workflow this role operates.",
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
      throw new Error("No external calls allowed in manual-ledger tests");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity(identity);
  await admin.mutation(api.workspaces.provision, {});
  await admin.mutation(api.workspaces.saveProfile, { profile });
  const seed = manualAccounts(
    profile,
    "fictional_search",
    new Date().toISOString(),
  )[0];
  const accounts = ["first", "second"].map((name) => ({
    ...seed,
    id: name,
    domain: "https://www.example.com/",
    name: `Fictional ${name}`,
    is_demo: false,
    contacts: [
      {
        name: null,
        role: "Shared inbox",
        email: "info@example.com",
        verification_status: "unverified" as const,
        source_url: "https://example.com/team",
        note: "Fictional",
      },
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
      target: "Fictional",
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
  const startArgs = {
    ...scope,
    searchId,
    accountIds: [accounts[0].id],
    idempotencyKey: key(),
  };
  const [initial] = await admin.mutation(
    internal.outreachLedger.start,
    startArgs,
  );
  return { t, admin, searchId, accounts, initial, startArgs };
}
type Setup = Awaited<ReturnType<typeof setup>>;
type LedgerView = Setup["initial"];
const revision = (row: LedgerView) => ({
  ...scope,
  threadId: row.thread._id,
  expectedRevision: row.thread.revision,
  idempotencyKey: key(),
});
async function prepare(s: Setup, row = s.initial) {
  row = await s.admin.mutation(internal.outreachLedger.edit, {
    ...revision(row),
    recipient: row.thread.recipient,
    subject: "A plain question",
    body:
      "You operate a published workflow. We provide workflow software. Would this be useful?" +
      row.senderFooter,
  });
  return s.admin.mutation(internal.outreachLedger.saveBasis, {
    ...revision(row),
    basis: basis(row.thread.recipient),
  });
}
async function approved(s: Setup, row = s.initial) {
  return s.admin.mutation(
    internal.outreachLedger.approve,
    revision(await prepare(s, row)),
  );
}
async function sibling(s: Setup) {
  const [row] = await s.admin.mutation(internal.outreachLedger.start, {
    ...scope,
    searchId: s.searchId,
    accountIds: [s.accounts[1].id],
    idempotencyKey: key(),
  });
  return row;
}
async function get(s: Setup, row: LedgerView) {
  return s.admin.query(internal.outreachLedger.get, {
    ...scope,
    threadId: row.thread._id,
  });
}

describe("internal hosted manual-ledger prerequisites (offline; REST stays closed)", () => {
  it("has no public function exports and defaults to disabled without network or records", async () => {
    for (const fn of Object.values(ledgerExports))
      expect(fn.isInternal).toBe(true);
    const s = await setup();
    vi.stubEnv("SIGNALFOUNDRY_HOSTED_OUTREACH_PERSISTENCE_ENABLED", "false");
    const before = await s.t.run((ctx) =>
      ctx.db.query("outreachRequests").take(20),
    );
    await expect(
      s.admin.query(internal.outreachLedger.list, scope),
    ).rejects.toThrow("disabled");
    await expect(
      s.admin.mutation(internal.outreachLedger.edit, {
        ...revision(s.initial),
        recipient: "first@example.com",
        subject: "A",
        body: "B",
      }),
    ).rejects.toThrow("disabled");
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachRequests").take(20)),
    ).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("derives tenant and role only from verified identity; members read but cannot write", async () => {
    const s = await setup();
    await expect(
      s.t.query(internal.outreachLedger.get, {
        ...scope,
        threadId: s.initial.thread._id,
      }),
    ).rejects.toThrow("Authentication");
    const member = s.t.withIdentity({
      ...identity,
      subject: "user_fictional_reader",
      org_role: "org:member",
    });
    expect(
      (
        await member.query(internal.outreachLedger.get, {
          ...scope,
          threadId: s.initial.thread._id,
        })
      ).thread._id,
    ).toBe(s.initial.thread._id);
    await expect(
      member.mutation(internal.outreachLedger.approve, revision(s.initial)),
    ).rejects.toThrow("admin");
    const other = s.t.withIdentity({ ...identity, org_id: "org_other" });
    await expect(
      other.query(internal.outreachLedger.get, {
        expectedOrgId: "org_other",
        threadId: s.initial.thread._id,
      }),
    ).rejects.toThrow("not found");
    await expect(
      other.mutation(internal.outreachLedger.start, {
        ...s.startArgs,
        expectedOrgId: "org_other",
      }),
    ).rejects.toThrow("not found");
    await expect(
      other.mutation(internal.outreachLedger.pause, {
        ...revision(s.initial),
        expectedOrgId: "org_other",
        paused: false,
      }),
    ).rejects.toThrow("not found");
    expect(
      await other.query(internal.outreachLedger.list, {
        expectedOrgId: "org_other",
      }),
    ).toEqual([]);
  });
  it("rejects organization-switch intent on reads and writes before resource access", async () => {
    const s = await setup();
    for (const role of ["org:admin", "org:member"]) {
      const other = s.t.withIdentity({
        ...identity,
        org_id: "org_other",
        org_role: role,
      });
      await expect(
        other.query(internal.outreachLedger.get, {
          ...scope,
          threadId: s.initial.thread._id,
        }),
      ).rejects.toThrow("organization changed");
    }
    await expect(
      s.admin.mutation(internal.outreachLedger.pause, {
        ...revision(s.initial),
        expectedOrgId: "org_old",
        paused: true,
      }),
    ).rejects.toThrow("organization changed");
    const pending = s.t.withIdentity({ ...identity, sts: "pending" });
    await expect(
      pending.query(internal.outreachLedger.list, scope),
    ).rejects.toThrow("Complete your Clerk session");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("creates at most one saved record per prospect, ranks named email above shared and never upgrades verification", async () => {
    const s = await setup();
    expect(s.initial.thread.recipient).toBe("first@example.com");
    expect(s.initial.thread.recipientStatus).toBe("published_unverified");
    expect(s.initial.thread.contactBasis).toBeNull();
    expect(s.initial.readyForManualAction).toBe(false);
    const repeated = await s.admin.mutation(
      internal.outreachLedger.start,
      s.startArgs,
    );
    const alias = await s.admin.mutation(internal.outreachLedger.start, {
      ...s.startArgs,
      idempotencyKey: key(),
    });
    expect(repeated[0].thread._id).toBe(s.initial.thread._id);
    expect(alias[0].thread._id).toBe(s.initial.thread._id);
    await expect(
      s.admin.mutation(internal.outreachLedger.start, {
        ...s.startArgs,
        accountIds: ["first", "second"],
      }),
    ).rejects.toThrow("different changes");
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachThreads").take(101)),
    ).toHaveLength(1);
  });
  it("rejects missing, unfinished, duplicate, oversized and fictional selections atomically", async () => {
    const s = await setup();
    for (const ids of [
      [],
      ["first", "first"],
      ["a", "b", "c", "d", "e", "f"],
      ["second", "missing"],
    ]) {
      await expect(
        s.admin.mutation(internal.outreachLedger.start, {
          ...s.startArgs,
          accountIds: ids,
          idempotencyKey: key(),
        }),
      ).rejects.toThrow();
    }
    await s.t.run((ctx) => ctx.db.patch(s.searchId, { status: "running" }));
    await expect(
      s.admin.mutation(internal.outreachLedger.start, {
        ...s.startArgs,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("finish");
    await s.t.run((ctx) =>
      ctx.db.patch(s.searchId, {
        status: "complete",
        accounts: s.accounts.map((a) => ({ ...a, is_demo: true })),
      }),
    );
    await expect(
      s.admin.mutation(internal.outreachLedger.start, {
        ...s.startArgs,
        accountIds: ["second"],
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("Fictional demo");
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachThreads").take(101)),
    ).toHaveLength(1);
  });
  it("requires the sender/footer and exact contact basis without inferring consent", async () => {
    const s = await setup();
    let row = await prepare(s);
    for (const patch of [
      { recipient_country: "other" as const },
      { notice_status: "prohibits" as const },
      { publisher_attribution: "third_party" as const },
      { published_email: "different@example.com" },
      { recipient_role: "" },
      { source_url: "" },
    ]) {
      row = await s.admin.mutation(internal.outreachLedger.saveBasis, {
        ...revision(row),
        basis: { ...basis(row.thread.recipient), ...patch },
      });
      await expect(
        s.admin.mutation(internal.outreachLedger.approve, revision(row)),
      ).rejects.toThrow("basis");
    }
    row = await s.admin.mutation(internal.outreachLedger.saveBasis, {
      ...revision(row),
      basis: basis(row.thread.recipient),
    });
    await s.admin.mutation(api.workspaces.saveProfile, {
      profile: { ...profile, mailing_address: "" },
    });
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(row)),
    ).rejects.toThrow("sender");
    await s.admin.mutation(api.workspaces.saveProfile, { profile });
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: row.thread.recipient,
      subject: "Question",
      body: "Missing required footer",
    });
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(row)),
    ).rejects.toThrow("footer");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves the optional sender fields through authenticated profile save and rejects malformed public inputs", async () => {
    const s = await setup();
    expect(
      (await s.admin.query(api.workspaces.get, {}))?.profile,
    ).toMatchObject({
      sender_name: profile.sender_name,
      mailing_address: profile.mailing_address,
      sender_contact: profile.sender_contact,
    });
    for (const address of [
      "x@127.0.0.1",
      "x@private.local",
      "Bad <x@example.com>",
      "x@example.com\r\nBcc: y@example.com",
    ]) {
      await expect(
        s.admin.mutation(internal.outreachLedger.edit, {
          ...revision(s.initial),
          recipient: address,
          subject: "Question",
          body: "Body",
        }),
      ).rejects.toThrow();
    }
    for (const url of [
      "https://127.0.0.1",
      "https://user:pass@example.com",
      "https://example.com:444",
      "file:///tmp/foo",
    ]) {
      await expect(
        s.admin.mutation(internal.outreachLedger.saveBasis, {
          ...revision(s.initial),
          basis: { ...basis(s.initial.thread.recipient), source_url: url },
        }),
      ).rejects.toThrow();
    }
    await expect(
      s.admin.mutation(internal.outreachLedger.saveBasis, {
        ...revision(s.initial),
        basis: {
          ...basis(s.initial.thread.recipient),
          captured_at: "2099-01-01T00:00:00Z",
        },
      }),
    ).rejects.toThrow("future");
    await expect(
      s.admin.mutation(internal.outreachLedger.edit, {
        ...revision(s.initial),
        recipient: "first@example.com",
        subject: "x\nBcc: x",
        body: "Body",
      }),
    ).rejects.toThrow("one line");
  });
  it("copy/open preflight is read-only; report with changes keeps actual and immutable approved texts separate", async () => {
    const s = await setup();
    const row = await approved(s);
    const approval = row.approval!;
    const args = {
      ...scope,
      threadId: row.thread._id,
      expectedRevision: row.thread.revision,
      approvalId: approval._id,
    };
    expect(
      await s.admin.query(internal.outreachLedger.checkManualAction, args),
    ).toEqual(approval);
    expect(
      await s.admin.query(internal.outreachLedger.checkManualAction, args),
    ).toEqual(approval);
    expect((await get(s, row)).messages).toHaveLength(0);
    const report = {
      ...revision(row),
      approvalId: approval._id,
      sentAs: "with_changes" as const,
      actualSubject: "Actually sent subject",
      actualBody: "Actual text copied from the external email (fictional).",
    };
    const sent = await s.admin.mutation(
      internal.outreachLedger.reportSent,
      report,
    );
    expect(sent.messages).toHaveLength(1);
    expect(sent.messages[0]).toMatchObject({
      direction: "outbound",
      subject: report.actualSubject,
      body: report.actualBody,
      source: "user_reported",
      approvalId: approval._id,
    });
    expect(await s.t.run((ctx) => ctx.db.get(approval._id))).toEqual(approval);
    expect(
      (await s.admin.mutation(internal.outreachLedger.reportSent, report))
        .messages,
    ).toHaveLength(1);
    await expect(
      s.admin.mutation(internal.outreachLedger.reportSent, {
        ...report,
        actualBody: "Different retry",
      }),
    ).rejects.toThrow("different changes");
    await expect(
      s.admin.query(internal.outreachLedger.checkManualAction, args),
    ).rejects.toThrow("no longer current");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("binds sent reports to the actual approval identity and rejects contradictory report fields", async () => {
    const s = await setup();
    let row = await approved(s);
    const old = row.approval!;
    row = await s.admin.mutation(
      internal.outreachLedger.approve,
      revision(row),
    );
    await expect(
      s.admin.mutation(internal.outreachLedger.reportSent, {
        ...revision(row),
        approvalId: old._id,
        sentAs: "approved",
      }),
    ).rejects.toThrow("exact");
    await expect(
      s.admin.mutation(internal.outreachLedger.reportSent, {
        ...revision(row),
        approvalId: row.approval!._id,
        sentAs: "approved",
        actualBody: "Altered",
      }),
    ).rejects.toThrow("changes");
    const sent = await s.admin.mutation(internal.outreachLedger.reportSent, {
      ...revision(row),
      approvalId: row.approval!._id,
      sentAs: "approved",
    });
    expect(sent.messages[0].body).toBe(row.approval!.body);
    // A second initial message is not a substitute for the still-unbuilt bounded hosted sequence.
    const next = await prepare(s, sent);
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(next)),
    ).rejects.toThrow("followup planning");
  });
  it("invalidates approval after edits, recipient/basis changes, pause and monotonic profile changes", async () => {
    const s = await setup();
    let row = await approved(s);
    const approveArgs = revision(row);
    const old = row.approval!;
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: row.thread.recipient,
      subject: row.thread.subject,
      body: row.thread.body,
    });
    expect(row.approval).toBeNull();
    await expect(
      s.admin.query(internal.outreachLedger.checkManualAction, {
        ...scope,
        threadId: row.thread._id,
        expectedRevision: row.thread.revision,
        approvalId: old._id,
      }),
    ).rejects.toThrow();
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, approveArgs),
    ).rejects.toThrow("changed");
    row = await approved(s, row);
    await s.admin.mutation(api.workspaces.saveProfile, {
      profile: { ...profile, description: "Changed offer" },
    });
    expect((await get(s, row)).approval).toBeNull();
    await s.admin.mutation(api.workspaces.saveProfile, { profile });
    expect((await get(s, row)).approval).toBeNull();
    row = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(row),
      paused: true,
    });
    row = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(row),
      paused: false,
    });
    expect(row.approval).toBeNull();
    row = await approved(s, row);
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: "new@example.com",
      subject: row.thread.subject,
      body: row.thread.body,
    });
    expect(row.thread.contactBasis).toBeNull();
    expect(row.approval).toBeNull();
  });
  it("returns current safety state for a replay rather than restoring an old approval or decision", async () => {
    const s = await setup();
    const prepared = await prepare(s);
    const approveArgs = revision(prepared);
    let row = await s.admin.mutation(
      internal.outreachLedger.approve,
      approveArgs,
    );
    row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(row),
      body: "Please remove me",
      replyState: "interested",
    });
    const replay = await s.admin.mutation(
      internal.outreachLedger.approve,
      approveArgs,
    );
    expect(replay.thread.revision).toBe(row.thread.revision);
    expect(replay.suppressed).toBe(true);
    expect(replay.readyForManualAction).toBe(false);
    expect(replay.approval).toBeNull();
  });
  it("has one active company cold owner; a reply pauses siblings until explicit resume plus NEW approval", async () => {
    const s = await setup();
    let first = await approved(s);
    let second = await prepare(s, await sibling(s));
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(second)),
    ).rejects.toThrow("paused company");
    first = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(first),
      body: "This sounds relevant",
      replyState: "interested",
    });
    expect((await get(s, second)).companyPaused).toBe(true);
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(second)),
    ).rejects.toThrow("paused company");
    second = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(second),
      paused: false,
    });
    expect(second.approval).toBeNull();
    expect(second.readyForManualAction).toBe(false);
    second = await s.admin.mutation(
      internal.outreachLedger.approve,
      revision(second),
    );
    expect(second.readyForManualAction).toBe(true);
    expect(first.thread.replyState).toBe("interested");
  });
  it("serializes competing cold approvals and stale-revision writes in the same tenant", async () => {
    const s = await setup();
    const first = await prepare(s),
      second = await prepare(s, await sibling(s));
    const attempts = await Promise.allSettled([
      s.admin.mutation(internal.outreachLedger.approve, revision(first)),
      s.admin.mutation(internal.outreachLedger.approve, revision(second)),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const a = await get(s, first),
      b = await get(s, second);
    expect([a, b].filter((row) => row.readyForManualAction)).toHaveLength(1);
    const race = await Promise.allSettled([
      s.admin.mutation(internal.outreachLedger.pause, {
        ...revision(a),
        paused: true,
      }),
      s.admin.mutation(internal.outreachLedger.pause, {
        ...revision(a),
        paused: false,
      }),
    ]);
    expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
  });
  it.each(["opt_out", "source_question"] as const)(
    "keeps %s effective across corrections, recipient edits, explicit resume and later searches",
    async (state) => {
      const s = await setup();
      let row = await approved(s);
      row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
        ...revision(row),
        body:
          state === "opt_out"
            ? "No further messages please."
            : "Explain this contact.",
        replyState: state,
      });
      row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
        ...revision(row),
        replyState: "interested",
      });
      row = await s.admin.mutation(internal.outreachLedger.pause, {
        ...revision(row),
        paused: false,
      });
      row = await prepare(s, row);
      expect(row.suppressed).toBe(true);
      await expect(
        s.admin.mutation(internal.outreachLedger.approve, revision(row)),
      ).rejects.toThrow("permanent");
      const otherContact = await prepare(s, await sibling(s));
      expect(otherContact.suppressed).toBe(true);
      const search = await s.t.run((ctx) => ctx.db.get(s.searchId));
      const laterSearch = await s.t.run((ctx) => {
        const { _id: _id, _creationTime: _time, ...fields } = search!;
        void _id;
        void _time;
        return ctx.db.insert("customerSearches", {
          ...fields,
          requestKey: key(),
        });
      });
      const [later] = await s.admin.mutation(internal.outreachLedger.start, {
        ...scope,
        searchId: laterSearch,
        accountIds: ["first"],
        idempotencyKey: key(),
      });
      expect(later.suppressed).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("keeps bounce invalidity tied to the original email through recipient edits and status correction", async () => {
    const s = await setup();
    let row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.initial),
      body: "Fictional delivery failure",
      replyState: "bounce",
    });
    const original = row.thread.recipient;
    expect(row.invalidRecipient).toBe(true);
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: "other@example.com",
      subject: "Q",
      body: "Changed recipient",
    });
    row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
      ...revision(row),
      replyState: "interested",
    });
    expect(row.invalidRecipient).toBe(false);
    expect(row.blockedReason).toContain("different recipient");
    row = await s.admin.mutation(internal.outreachLedger.edit, {
      ...revision(row),
      recipient: original.toUpperCase(),
      subject: "Q",
      body: "Restored address",
    });
    row = await s.admin.mutation(internal.outreachLedger.pause, {
      ...revision(row),
      paused: false,
    });
    expect(row.invalidRecipient).toBe(true);
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(row)),
    ).rejects.toThrow("invalid");
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
    "records %s as manual classification, clears approval and permanently stops cold followups",
    async (state) => {
      const s = await setup();
      const row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
        ...revision(await approved(s)),
        body: "Fictional incoming message",
        replyState: state,
        ...(["not_now", "auto_reply"].includes(state)
          ? {
              revisitAt: "2026-11-03T10:00:00-05:00",
              revisitTimezone: "America/Toronto",
            }
          : {}),
      });
      expect(row.thread.replyState).toBe(state);
      expect(row.thread.coldFollowupsStopped).toBe(true);
      expect(row.approval).toBeNull();
      expect(row.messages[0]).toMatchObject({
        direction: "inbound",
        source: "user_reported",
        reportedReplyState: state,
      });
      if (["not_now", "auto_reply"].includes(state)) {
        vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
        expect((await get(s, row)).reviewDue).toBe(true);
        expect((await get(s, row)).readyForManualAction).toBe(false);
      }
    },
  );
  it("fails closed on obvious unsubscribe/source text despite affirmative correction", async () => {
    const s = await setup();
    let row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.initial),
      body: "Where did you get my email?",
      replyState: "interested",
    });
    expect(row.thread.replyState).toBe("source_question");
    row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
      ...revision(row),
      replyState: "interested",
    });
    expect(row.thread.replyState).toBe("source_question");
    row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(row),
      body: "Unsubscribe",
      replyState: "question",
    });
    expect(row.thread.replyState).toBe("opt_out");
    expect(row.suppressed).toBe(true);
  });
  it("keeps undated inbound as review work, validates original wall/offset and accepts both Toronto folds", async () => {
    const s = await setup();
    let row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.initial),
      body: "Back later (fictional)",
      replyState: "auto_reply",
      revisitAt: "2026-11-03T10:00:00-05:00",
    });
    expect(row.thread.replyState).toBe("awaiting_review");
    expect(row.messages[0].body).toBe("Back later (fictional)");
    for (const at of [
      "2027-03-14T02:30:00-05:00",
      "2026-11-03T10:00:00-04:00",
      "2026-11-03T10:00:00",
    ]) {
      await expect(
        s.admin.mutation(internal.outreachLedger.classifyReply, {
          ...revision(row),
          replyState: "auto_reply",
          revisitAt: at,
          revisitTimezone: "America/Toronto",
        }),
      ).rejects.toThrow();
    }
    for (const offset of ["-04:00", "-05:00"]) {
      row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
        ...revision(row),
        replyState: "auto_reply",
        revisitAt: `2026-11-01T01:30:00${offset}`,
        revisitTimezone: "America/Toronto",
      });
      expect(row.thread.revisitAt).toBe(
        Date.parse(`2026-11-01T01:30:00${offset}`),
      );
    }
    expect(zonedInstant("2026-11-03T10:00:00-05:00", "America/Toronto")).toBe(
      Date.parse("2026-11-03T15:00:00Z"),
    );
  });
  it("limits requests, conversations and messages without partially recording rejected work", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const limits = (await ctx.db.query("outreachLedgers").take(1))[0];
      await ctx.db.patch(limits._id, { threadCount: 100 });
    });
    await expect(sibling(s)).rejects.toThrow("allowance");
    await s.t.run(async (ctx) => {
      const limits = (await ctx.db.query("outreachLedgers").take(1))[0];
      await ctx.db.patch(limits._id, { requestCount: 10000 });
    });
    await expect(
      s.admin.mutation(internal.outreachLedger.pause, {
        ...revision(s.initial),
        paused: true,
      }),
    ).rejects.toThrow("allowance");
    // Same exact operation replay remains safe at the cap.
    expect(
      (await s.admin.mutation(internal.outreachLedger.start, s.startArgs))[0]
        .thread._id,
    ).toBe(s.initial.thread._id);
    await s.t.run(async (ctx) => {
      const limits = (await ctx.db.query("outreachLedgers").take(1))[0];
      await ctx.db.patch(limits._id, { requestCount: 10 });
      await ctx.db.patch(s.initial.thread._id, { messageCount: 50 });
    });
    await expect(
      s.admin.mutation(internal.outreachLedger.pasteReply, {
        ...revision(s.initial),
        body: "No room",
        replyState: "question",
      }),
    ).rejects.toThrow("allowance");
    expect(
      await s.t.run((ctx) => ctx.db.query("outreachMessages").take(51)),
    ).toHaveLength(0);
  });
  it("retains immutable received text and original classification during later review", async () => {
    const s = await setup();
    let row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.initial),
      body: "How does this work? (fictional)",
      replyState: "awaiting_review",
    });
    const original = row.messages[0];
    row = await s.admin.mutation(internal.outreachLedger.classifyReply, {
      ...revision(row),
      replyState: "question",
    });
    expect(row.thread.replyState).toBe("question");
    expect(await s.t.run((ctx) => ctx.db.get(original._id))).toEqual(original);
    expect(row.messages[0]).toEqual(original);
  });
  it("has no implicit answer permission after a paused or changed received context", async () => {
    const s = await setup();
    let row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(s.initial),
      body: "Question for the seller",
      replyState: "question",
    });
    row = await approved(s, row);
    const old = row.approval!;
    row = await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(row),
      body: "Actually not now",
      replyState: "not_now",
    });
    await expect(
      s.admin.query(internal.outreachLedger.checkManualAction, {
        ...scope,
        threadId: row.thread._id,
        expectedRevision: row.thread.revision,
        approvalId: old._id,
      }),
    ).rejects.toThrow();
    expect(row.thread.replyState).toBe("awaiting_review");
    expect(row.readyForManualAction).toBe(false);
  });
  it("makes the current sender footer identical to the local manual contract", () => {
    expect(senderFooter(profile)).toBe(
      `\n\n--\n${profile.sender_name} | ${profile.company_name}\n${profile.mailing_address}\nContact: ${profile.sender_contact}\nAdvertisement: business outreach.\nTo opt out, reply "unsubscribe".`,
    );
    expect(senderFooter({ ...profile, sender_contact: "Not reachable" })).toBe(
      "",
    );
    expect(senderFooter({ ...profile, company_name: "Legacy\ncompany" })).toBe(
      "",
    );
  });
  it.each([
    {},
    { sender_name: "", mailing_address: "", sender_contact: "" },
    {
      sender_name: "Invented worker sender",
      mailing_address: "Invented worker address",
      sender_contact: "invented@example.com",
    },
  ])(
    "website analysis preserves founder-entered identity regardless of worker identity fields %j",
    async (workerIdentity) => {
      const s = await setup();
      const row = await approved(s);
      const lease = await s.admin.mutation(internal.workspaces.beginAnalyze, {
        orgId: identity.org_id,
      });
      const result = await s.admin.mutation(internal.workspaces.finishAnalyze, {
        orgId: identity.org_id,
        ...lease,
        website: "https://example.com",
        profile: { ...DEMO_PROFILE, ...workerIdentity },
      });
      expect(result.profile).toMatchObject({
        sender_name: profile.sender_name,
        mailing_address: profile.mailing_address,
        sender_contact: profile.sender_contact,
      });
      expect((await get(s, row)).approval).toBeNull();
    },
  );
  it("website analysis cannot establish an unsaved sender identity from worker claims", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const workspace = (await ctx.db.query("workspaces").take(1))[0];
      await ctx.db.patch(workspace._id, { profile: DEMO_PROFILE });
    });
    const lease = await s.admin.mutation(internal.workspaces.beginAnalyze, {
      orgId: identity.org_id,
    });
    const result = await s.admin.mutation(internal.workspaces.finishAnalyze, {
      orgId: identity.org_id,
      ...lease,
      website: "https://example.com",
      profile,
    });
    expect(result.profile?.sender_name).toBeUndefined();
    expect(result.profile?.mailing_address).toBeUndefined();
    expect(result.profile?.sender_contact).toBeUndefined();
    expect((await get(s, s.initial)).senderFooter).toBe("");
    const repaired = await prepare(s, await get(s, s.initial));
    await expect(
      s.admin.mutation(internal.outreachLedger.approve, revision(repaired)),
    ).rejects.toThrow("sender");
  });
  it("does not let inflight analysis overwrite a newer founder identity edit", async () => {
    const s = await setup();
    const lease = await s.admin.mutation(internal.workspaces.beginAnalyze, {
      orgId: identity.org_id,
    });
    await s.admin.mutation(api.workspaces.saveProfile, {
      profile: { ...profile, sender_name: "Updated fictional founder" },
    });
    await expect(
      s.admin.mutation(internal.workspaces.finishAnalyze, {
        orgId: identity.org_id,
        ...lease,
        website: "https://example.com",
        profile: DEMO_PROFILE,
      }),
    ).rejects.toThrow("changes were preserved");
    expect(
      (await s.admin.query(api.workspaces.get, {}))?.profile?.sender_name,
    ).toBe("Updated fictional founder");
  });
  it("tries valid alternate saved contacts instead of hiding them behind one invalid address", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.searchId, {
        accounts: s.accounts.map((a) => ({
          ...a,
          contacts: [
            { ...a.contacts[1], email: "bad@@example.com" },
            { ...a.contacts[1], email: "valid.person@example.com" },
            { ...a.contacts[0], email: "info@example.com" },
          ],
        })),
      }),
    );
    const row = await sibling(s);
    expect(row.thread.recipient).toBe("valid.person@example.com");
    expect(row.thread.recipientStatus).toBe("published_unverified");
    expect(row.thread.contactBasis).toBeNull();
    const invalidOnly = {
      ...s.accounts[0],
      id: "third_invalid",
      contacts: s.accounts[0].contacts.map((c) => ({
        ...c,
        email: "bad@@example.com",
      })),
    };
    await s.t.run((ctx) =>
      ctx.db.patch(s.searchId, { accounts: [...s.accounts, invalidOnly] }),
    );
    const [missing] = await s.admin.mutation(internal.outreachLedger.start, {
      ...scope,
      searchId: s.searchId,
      accountIds: [invalidOnly.id],
      idempotencyKey: key(),
    });
    expect(missing.thread.recipient).toBe("");
    expect(missing.thread.recipientStatus).toBe("missing");
    expect(missing.readyForManualAction).toBe(false);
  });
  it("requires a named IANA zone even when Intl supports offset-only zone strings", async () => {
    const s = await setup();
    for (const zone of ["-05:00", "+00:00", "+05:30"]) {
      await expect(
        s.admin.mutation(internal.outreachLedger.pasteReply, {
          ...revision(s.initial),
          body: "Future return (fictional)",
          replyState: "auto_reply",
          revisitAt: `2026-11-03T10:00:00${zone}`,
          revisitTimezone: zone,
        }),
      ).rejects.toThrow("IANA");
    }
    expect(zonedInstant("2026-11-03T10:00:00Z", "UTC")).toBe(
      Date.parse("2026-11-03T10:00:00Z"),
    );
    expect(zonedInstant("2026-11-03T10:00:00-05:00", "Etc/GMT+5")).toBe(
      Date.parse("2026-11-03T15:00:00Z"),
    );
  });
  it("preserves omitted sender identity on old-client saves while explicit clearing invalidates approval", async () => {
    const s = await setup();
    const row = await approved(s);
    await s.admin.mutation(api.workspaces.saveProfile, {
      profile: { ...DEMO_PROFILE, company_name: profile.company_name },
    });
    expect(
      (await s.admin.query(api.workspaces.get, {}))?.profile,
    ).toMatchObject({
      sender_name: profile.sender_name,
      mailing_address: profile.mailing_address,
      sender_contact: profile.sender_contact,
    });
    expect((await get(s, row)).approval).toBeNull();
    await s.admin.mutation(api.workspaces.saveProfile, {
      profile: { ...profile, sender_name: "" },
    });
    expect((await get(s, row)).senderFooter).toBe("");
    expect(
      (await s.admin.query(api.workspaces.get, {}))?.profile?.sender_name,
    ).toBe("");
  });
  it("rejects calendar-overflow source observations rather than normalizing them", async () => {
    const s = await setup();
    for (const value of [
      "2026-02-30T10:00:00Z",
      "2026-10-20T24:00:00Z",
      "2026-02-30T10:00:00-05:00",
    ]) {
      expect(() => awareInstant(value)).toThrow();
      await expect(
        s.admin.mutation(internal.outreachLedger.saveBasis, {
          ...revision(s.initial),
          basis: { ...basis(s.initial.thread.recipient), captured_at: value },
        }),
      ).rejects.toThrow();
    }
    expect(awareInstant("2024-02-29T10:00:00-05:00")).toBe(
      Date.parse("2024-02-29T15:00:00Z"),
    );
  });
  it("keeps company ownership, identical request keys and sticky stops independent across tenants", async () => {
    const s = await setup();
    const one = await approved(s);
    await s.admin.mutation(internal.outreachLedger.pasteReply, {
      ...revision(one),
      body: "Stop emailing (fictional)",
      replyState: "opt_out",
    });
    const other = s.t.withIdentity({ ...identity, org_id: "org_other" });
    await other.mutation(api.workspaces.provision, {});
    await other.mutation(api.workspaces.saveProfile, { profile });
    const source = await s.t.run((ctx) => ctx.db.get(s.searchId));
    const searchId = await s.t.run((ctx) => {
      const { _id, _creationTime, ...fields } = source!;
      void _id;
      void _creationTime;
      return ctx.db.insert("customerSearches", {
        ...fields,
        orgId: "org_other",
      });
    });
    const [row] = await other.mutation(internal.outreachLedger.start, {
      ...s.startArgs,
      searchId,
      expectedOrgId: "org_other",
    });
    expect(row.suppressed).toBe(false);
    expect(row.companyPaused).toBe(false);
    expect(row.invalidRecipient).toBe(false);
    expect(row.thread.recipient).toBe(one.thread.recipient);
    expect(row.thread._id).not.toBe(one.thread._id);
  });
});
