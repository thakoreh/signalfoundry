// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReplyCopilot } from "../components/reply-copilot";
import type { OutreachThread } from "../lib/outreach";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../components/workspace-session", () => ({ useWorkspaceSession: () => ({ api, mode: "local-demo" }) }));
let container: HTMLDivElement, root: Root, thread: OutreachThread;
const apply = vi.fn();
const suggestion = () => ({
  draft: { subject: "Re: Saved subject", body: "A short editable answer based on the saved offering.", evidence_ids: ["seller:offer"],
    warnings: ["Review every claim; nothing is approved or sent."], generation_engine: "deepseek", created_at: "2026-10-21" },
  snapshot_key: "a".repeat(64), expected_revision: 4, inbound_id: "inbound_a",
  facts: [{ id: "seller:offer", excerpt: "Confirmed seller offering." }],
});
function button(label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent === label)!;
}
async function click(label: string) { await act(async () => button(label).click()); }
async function consent() { await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); }
async function mount(key = "clean", disabled = false) {
  await act(async () => root.render(<ReplyCopilot key={key} thread={thread} disabled={disabled} onApply={apply} />));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  thread = { id: "thread_a", search_id: "search_a", account_id: "account_a", company_name: "Fictional business", domain: "example.org",
    recipient: "person@example.org", recipient_status: "published_unverified", subject: "Saved subject", body: "Private manual editor stays outside this component.",
    booking_link: "", paused: false, suppressed: false, suppression_reason: null, reply_state: "question", revision: 4, approval: null,
    ready_for_manual_action: false, meeting_state: "not_recorded", sale_state: "not_recorded", created_at: "2026-10-21", updated_at: "2026-10-21",
    messages: [{ id: "inbound_a", direction: "inbound", recipient: "person@example.org", subject: "Saved subject", body: "How does this help?",
      source: "user_reported", reply_state: "question", created_at: "2026-10-21" }] };
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  api.mockImplementation(async (path: string) => path.endsWith("/check") ? { current: true, snapshot_key: "a".repeat(64) } : suggestion());
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("explicit grounded reply suggestion", () => {
  it("makes zero page-open calls and requires reviewed context before request", async () => {
    await mount();
    expect(api).not.toHaveBeenCalled();
    expect(button("Request reply suggestion").disabled).toBe(true);
    expect(container.textContent).toContain("last six manually recorded messages");
    expect(container.textContent).toContain("does not guarantee anonymization");
    await consent(); await click("Request reply suggestion");
    expect(api).toHaveBeenCalledTimes(1);
    const body = JSON.parse(api.mock.calls[0][1].body);
    expect(body).toMatchObject({ context_confirmed: true, context_version: "reply-context-v2", expected_revision: 4 });
    expect(apply).not.toHaveBeenCalled();
    expect(container.textContent).toContain(suggestion().draft.body);
  });

  it("freshly checks the snapshot before filling the editor, with no save/approve/send", async () => {
    await mount(); await consent(); await click("Request reply suggestion");
    await click("Use as editable reply");
    expect(api.mock.calls.map(call => call[0])).toEqual(["/outreach/thread_a/reply-draft", "/outreach/thread_a/reply-draft/check"]);
    expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ expected_revision: 4, snapshot_key: "a".repeat(64) });
    expect(apply).toHaveBeenCalledExactlyOnceWith(suggestion().draft);
  });

  it("discards an ignored-abort late generation when unsaved parent state replaces scope", async () => {
    const late = deferred<unknown>(); api.mockReturnValueOnce(late.promise);
    await mount(); await consent(); await click("Request reply suggestion");
    const signal = api.mock.calls[0][1].signal;
    await mount("dirty", true);
    expect(signal.aborted).toBe(true);
    await act(async () => late.resolve(suggestion()));
    expect(container.textContent).not.toContain(suggestion().draft.body);
    expect(apply).not.toHaveBeenCalled();
  });

  it("does not apply a late check after recipient/thread/session scope replacement", async () => {
    const late = deferred<{ current: boolean; snapshot_key: string }>();
    await mount(); await consent(); await click("Request reply suggestion");
    api.mockReturnValueOnce(late.promise);
    await click("Use as editable reply");
    thread = { ...thread, revision: 5 };
    await mount("new-context");
    await act(async () => late.resolve({ current: true, snapshot_key: "a".repeat(64) }));
    expect(apply).not.toHaveBeenCalled();
  });

  it("keeps stale or failed suggestions out of the editor", async () => {
    await mount(); await consent(); await click("Request reply suggestion");
    api.mockResolvedValueOnce({ current: false, snapshot_key: "b".repeat(64) });
    await click("Use as editable reply");
    expect(apply).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("conversation changed");
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed source/revision data instead of offering Apply", async () => {
    api.mockResolvedValueOnce({ ...suggestion(), expected_revision: 99 });
    await mount(); await consent(); await click("Request reply suggestion");
    expect(button("Use as editable reply")).toBeUndefined();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not be checked");
    expect(apply).not.toHaveBeenCalled();
  });

  it("uses a new request key only after explicit retry intent and never automatically retries", async () => {
    api.mockRejectedValueOnce(new Error("Monetary admission is blocked."));
    await mount(); await consent(); await click("Request reply suggestion");
    const original = JSON.parse(api.mock.calls[0][1].body).idempotency_key;
    expect(api).toHaveBeenCalledTimes(1);
    await click("Start a new attempt");
    expect(api).toHaveBeenCalledTimes(1);
    await click("Request reply suggestion");
    expect(JSON.parse(api.mock.calls[1][1].body).idempotency_key).not.toBe(original);
    expect(apply).not.toHaveBeenCalled();
  });

  it.each(["not_now", "auto_reply", "opt_out", "source_question", "bounce", "referral", "uncertain", "not_interested"])("offers no AI request for %s", async state => {
    thread = { ...thread, reply_state: state as OutreachThread["reply_state"] };
    await mount(); expect(container.textContent).toBe(""); expect(api).not.toHaveBeenCalled();
  });
});
