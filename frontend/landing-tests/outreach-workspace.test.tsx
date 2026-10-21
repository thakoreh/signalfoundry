// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutreachWorkspace } from "../components/outreach-workspace";
import { PrepareOutreach } from "../components/prepare-outreach";
import type { OutreachThread } from "../lib/outreach";
const { api, session } = vi.hoisted(() => ({
  api: vi.fn(),
  session: { mode: "local-demo" },
}));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: session.mode }),
}));
let container: HTMLDivElement, root: Root, thread: OutreachThread;
const fixture = (): OutreachThread => ({
  id: "thread_a",
  search_id: "search_a",
  account_id: "account_a",
  company_name: "Example business",
  domain: "example.org",
  recipient: "hello@example.org",
  recipient_status: "published_unverified",
  subject: "A specific introduction",
  body: "A reviewed factual message.",
  booking_link: "",
  paused: false,
  suppressed: false,
  suppression_reason: null,
  reply_state: "awaiting_review",
  revision: 1,
  approval: null,
  ready_for_manual_action: false,
  messages: [],
  meeting_state: "not_recorded",
  sale_state: "not_recorded",
  created_at: "2026-10-19",
  updated_at: "2026-10-19",
});
function button(text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent === text,
  )!;
}
function field(text: string) {
  return [...container.querySelectorAll("label")]
    .find(
      (element) =>
        [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join("")
          .trim() === text,
    )!
    .querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input,textarea,select",
    )!;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function change(label: string, value: string) {
  const element = field(label);
  await act(async () => {
    const prototype =
      element.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : element.tagName === "SELECT"
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      element,
      value,
    );
    element.dispatchEvent(
      new Event(element.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
it("explicitly saves recipient publication evidence without losing message or inbound edits", async () => {
  await mount();
  await change("Message", "Private draft stays");
  await click("Conversations");
  await change("Paste a received reply", "Private inbound stays");
  expect(container.textContent).toContain("Contact basis");
  await change("Publication source URL", "https://example.org/team");
  await change("Observation time (with timezone)", "2026-10-19T10:00:00Z");
  await change("Recipient role", "Founder");
  await change("Message relevance to this role", "Our message discusses their published product");
  await change("Recipient country", "CA");
  await change("Publication attribution", "recipient");
  await change("Unsolicited-message notice review", "clear");
  expect(api.mock.calls.some(([path]) => path.endsWith("/contact-basis"))).toBe(false);
  expect(button("Copy approved message").disabled).toBe(true);
  await click("Save contact basis");
  const call = api.mock.calls.find(([path]) => path.endsWith("/contact-basis"));
  expect(call?.[1].method).toBe("PUT");
  expect(JSON.parse(call![1].body).contact_basis).toMatchObject({
    version: 1, published_email: "hello@example.org", recipient_country: "CA",
    source_url: "https://example.org/team", notice_status: "clear",
    publisher_attribution: "recipient", basis_type: "conspicuous_publication",
  });
  expect(field("Message").value).toBe("Private draft stays");
  expect(field("Paste a received reply").value).toBe("Private inbound stays");
});
it("normalizes incomplete contact-basis editor values to the backend contract", async () => {
  await mount();
  await change("Publication source URL", "https://example.org/team");
  await click("Save contact basis");
  const call = api.mock.calls.find(([path]) => path.endsWith("/contact-basis"));
  expect(JSON.parse(call![1].body).contact_basis).toMatchObject({
    source_url: "https://example.org/team",
    captured_at: "",
    recipient_timezone: "",
  });
});
it("keeps unsafe contact-basis source URLs as text instead of actionable links", async () => {
  await mount();
  await change("Publication source URL", "http://127.0.0.1/contact");
  expect(container.querySelector('a[href="http://127.0.0.1/contact"]')).toBeNull();
  expect(container.textContent).toContain("Source URL is not a safe public link");
});
it("clears local basis when a refreshed recipient no longer has the saved evidence", async () => {
  thread.contact_basis = {
    version: 1,
    basis_type: "conspicuous_publication",
    published_email: "hello@example.org",
    source_url: "https://example.org/team",
    captured_at: "2026-01-01T12:00:00Z",
    publisher_attribution: "recipient",
    notice_status: "clear",
    recipient_role: "Operations lead",
    message_relevance: "A specific role-relevant reason.",
    recipient_country: "CA",
    recipient_timezone: null,
  };
  await mount();
  await change("Recipient role", "Private stale role");
  thread = { ...thread, recipient: "new@example.org", contact_basis: null };
  await act(async () => root.render(<OutreachWorkspace searchId="search_a" profileRefresh={1} />));
  expect(field("Recipient role").value).toBe("");
  expect(container.textContent).not.toContain("Private stale role");
});

it("hides old recipient evidence immediately during an unsaved recipient edit", async () => {
  thread.contact_basis = {
    version: 1,
    basis_type: "conspicuous_publication",
    published_email: "hello@example.org",
    source_url: "https://example.org/team",
    captured_at: "2026-01-01T12:00:00Z",
    publisher_attribution: "recipient",
    notice_status: "clear",
    recipient_role: "Operations lead",
    message_relevance: "A specific role-relevant reason.",
    recipient_country: "CA",
    recipient_timezone: null,
  };
  await mount();
  await change("Recipient", "new@example.org");
  expect(container.querySelector('a[href="https://example.org/team"]')).toBeNull();
  expect(field("Publication source URL").value).toBe("");
  expect(field("Observation time (with timezone)").value).toBe("");
  expect(container.textContent).toContain("Evidence for: new@example.org");
  expect(container.textContent).toContain("Recipient change is unsaved. Old evidence is hidden");
  expect(button("Approve exact message").disabled).toBe(true);
  expect(button("Copy approved message").disabled).toBe(true);
});

it("keeps newer evidence typed during a delayed save and denies late Copy after evidence typing", async () => {
  await mount();
  await click("Approve exact message");
  const snapshot = structuredClone(thread);
  let finish!: (value: OutreachThread) => void;
  api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await click("Copy approved message");
  await change("Recipient role", "New role");
  await act(async () => finish(snapshot));
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  expect(button("Copy approved message").disabled).toBe(true);
  api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await click("Save contact basis");
  // Inputs should remain editable while evidence save is pending.
  expect(field("Recipient role").disabled).toBe(false);
  await change("Recipient role", "Newer role");
  await act(async () => finish({ ...thread, contact_basis: { version: 1 } as never }));
  expect(field("Recipient role").value).toBe("Newer role");
  expect(button("Save contact basis").disabled).toBe(false);
});
it("preserves message and inbound edits through sender repair and reloads current approval", async () => {
  await act(async () =>
    root.render(<OutreachWorkspace searchId="search_a" profileRefresh={0} />),
  );
  await change("Message", "Keep my private unsaved words");
  await click("Conversations");
  await change("Paste a received reply", "Keep my pasted reply");
  await act(async () =>
    root.render(<OutreachWorkspace searchId="search_a" profileRefresh={1} />),
  );
  expect(
    api.mock.calls.filter(([path]) => path.startsWith("/outreach?")).length,
  ).toBe(2);
  expect(field("Message").value).toBe("Keep my private unsaved words");
  expect(field("Paste a received reply").value).toBe("Keep my pasted reply");
  expect(button("Copy approved message").disabled).toBe(true);
});
it("releases a cancelled save flight after profile suspension without losing edits", async () => {
  await mount();
  await change("Message", "Keep this draft");
  const original = api.getMockImplementation()!;
  let finish!: (value: OutreachThread) => void;
  api.mockImplementation((path: string, options: RequestInit = {}) =>
    path.endsWith("/draft")
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : original(path, options),
  );
  await click("Save changes");
  await act(async () =>
    root.render(<OutreachWorkspace searchId="search_a" suspended />),
  );
  await act(async () => root.render(<OutreachWorkspace searchId="search_a" />));
  await act(async () => finish({ ...thread, body: "Obsolete completion" }));
  expect(field("Message").value).toBe("Keep this draft");
  expect(button("Save changes").disabled).toBe(false);
  api.mockImplementation(original);
  await click("Save changes");
  expect(field("Message").value).toBe("Keep this draft");
  expect(thread.body).toBe("Keep this draft");
});
it("keeps profile-return conflict edits until explicit discard reload, then permits fresh revision retry", async () => {
  await mount();
  await change("Message", "Private conflict draft");
  await click("Conversations");
  await change("Paste a received reply", "Private inbound");
  thread.revision++;
  thread.approval = null;
  const original = api.getMockImplementation()!;
  let conflict = true;
  api.mockImplementation(async (path: string, options: RequestInit = {}) => {
    if (path.endsWith("/draft") && conflict)
      throw new Error("Request failed (409). Refresh current revision.");
    return original(path, options);
  });
  await click("Save changes");
  expect(field("Message").value).toBe("Private conflict draft");
  expect(field("Paste a received reply").value).toBe("Private inbound");
  expect(button("Copy approved message").disabled).toBe(true);
  await click("Reload saved version (discard edits)");
  expect(field("Paste a received reply").value).toBe("");
  conflict = false;
  await change("Message", "Fresh retry");
  await click("Save changes");
  expect(thread.body).toBe("Fresh retry");
});
it("labels inbound-only conflict reload as explicit discard", async () => {
  await mount();
  await click("Conversations");
  await change("Paste a received reply", "Private unsaved inbound");
  api.mockRejectedValueOnce(new Error("Request failed (409)."));
  await click("Approve exact message");
  expect(button("Reload saved version (discard edits)")).toBeTruthy();
  expect(field("Paste a received reply").value).toBe("Private unsaved inbound");
});
it("records actual text separately when manually sent with changes", async () => {
  await mount();
  await click("Approve exact message");
  await click("Sent with changes");
  await change("Actual subject sent", "My actual subject");
  await change("Actual message sent", "My actual message");
  await click("Record changed message");
  const call = api.mock.calls.find(([path]) => path.endsWith("/sent"));
  expect(JSON.parse(call![1].body)).toMatchObject({
    sent_as: "with_changes",
    actual_subject: "My actual subject",
    actual_body: "My actual message",
  });
});
it("restores the saved footer without losing edits and copies only revalidated approved bytes", async () => {
  const footer =
    '\n\n--\nAlex | Fixture Co\n100 Example Street\nContact: alex@example.com\nTo opt out, reply "unsubscribe".';
  Object.assign(thread, { sender_footer: footer });
  const original = api.getMockImplementation()!;
  api.mockImplementation(async (path: string, options: RequestInit = {}) => {
    if (path === "/outreach/thread_a") return structuredClone(thread);
    return original(path, options);
  });
  await mount();
  expect(field("Message").value).toBe("A reviewed factual message.");
  expect(button("Save changes").disabled).toBe(true);
  expect(container.textContent).toContain("required sender footer");
  await change("Message", "Keep my unsaved words.");
  await click("Restore saved sender footer");
  expect(field("Message").value).toBe("Keep my unsaved words." + footer);
  await click("Save changes");
  await click("Approve exact message");
  await click("Copy approved message");
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    "To: hello@example.org\nSubject: A specific introduction\n\nKeep my unsaved words." +
      footer,
  );
  expect(thread.messages).toHaveLength(0);
  vi.mocked(navigator.clipboard.writeText).mockClear();
  thread.approval = null;
  thread.ready_for_manual_action = false;
  await click("Copy approved message");
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Approval changed");
});

it("keeps the untouched footer repair explicit and leaves approval fail-closed", async () => {
  const footer =
    '\n\n--\nAlex | Fixture Co\n100 Example Street\nContact: alex@example.com\nTo opt out, reply "unsubscribe".';
  Object.assign(thread, { sender_footer: footer });
  await mount();
  expect(field("Message").value).toBe("A reviewed factual message.");
  expect(container.textContent).toContain(
    "Restore the required sender footer, then save changes before approval.",
  );
  expect(button("Save changes").disabled).toBe(true);
  expect(button("Approve exact message").disabled).toBe(true);
  await click("Restore saved sender footer");
  expect(button("Save changes").disabled).toBe(false);
});

it("shows a persistent safe next action and scopes pause to this outreach", async () => {
  await mount();
  expect(container.textContent).toContain("Next: save your sender details in Edit business before approval.");
  expect(container.querySelector('a[href="#outreach-actions"]')?.textContent).toContain(
    "Jump to next safe action",
  );
  expect(button("Pause this outreach")).toBeTruthy();
});

it("keeps unknown email provenance unknown and separates approval from reachability", async () => {
  await mount();
  expect(container.textContent).toContain("Email status: published but not verified");
  expect(container.textContent).toContain("Provenance: Unknown");
  expect(container.textContent).toContain(
    "Approval confirms exact content; it does not verify reachability or delivery.",
  );
});
describe("pending Copy intent", () => {
  async function pendingCopy() {
    await mount();
    await click("Approve exact message");
    const snapshot = structuredClone(thread);
    let finish!: (value: OutreachThread) => void;
    api.mockImplementationOnce(
      () =>
        new Promise<OutreachThread>((resolve) => {
          finish = resolve;
        }),
    );
    await click("Copy approved message");
    return { snapshot, finish };
  }
  it.each(["Message", "Subject", "Recipient", "Booking link · optional"])(
    "denies late ready bytes after %s edits, even when reverted",
    async (label) => {
      const { snapshot, finish } = await pendingCopy();
      const original = field(label).value;
      await change(label, "New keystrokes");
      await act(async () => finish(snapshot));
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(field(label).value).toBe("New keystrokes");
      expect(thread.messages).toHaveLength(0);
      await change(label, original);
      await click("Copy approved message");
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    },
  );
  it("denies an edit/revert while the same preflight is pending", async () => {
    const { snapshot, finish } = await pendingCopy();
    await change("Message", "Temporary edit");
    await change("Message", snapshot.body);
    await act(async () => finish(snapshot));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
  it.each([
    "approval identity",
    "revision",
    "footer",
    "wrong thread",
    "unknown readiness",
    "paused",
    "suppressed",
  ])("fails closed when preflight changes %s", async (kind) => {
    const { snapshot, finish } = await pendingCopy();
    if (kind === "approval identity")
      snapshot.approval!.approved_at = "new approval";
    if (kind === "revision") snapshot.revision++;
    if (kind === "footer") snapshot.sender_footer = "New sender identity";
    if (kind === "wrong thread") snapshot.id = "thread_other";
    if (kind === "unknown readiness")
      Object.assign(snapshot, { ready_for_manual_action: "unknown" });
    if (kind === "paused") snapshot.paused = true;
    if (kind === "suppressed") snapshot.suppressed = true;
    await act(async () => finish(snapshot));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(thread.messages).toHaveLength(0);
  });
  it.each(["thread", "search", "session", "unmount", "stage"])(
    "denies late completion after %s navigation",
    async (kind) => {
      const original = api.getMockImplementation()!;
      api.mockImplementation(async (path: string, options?: RequestInit) => {
        if (path.startsWith("/outreach?"))
          return {
            threads: [
              structuredClone(thread),
              { ...fixture(), id: "thread_b", company_name: "Other business" },
            ],
          };
        return original(path, options);
      });
      const { snapshot, finish } = await pendingCopy();
      if (kind === "thread")
        await act(async () =>
          container
            .querySelectorAll<HTMLButtonElement>(".outreach-lead")[1]
            .click(),
        );
      if (kind === "stage") await click("Conversations");
      if (kind === "search")
        await act(async () =>
          root.render(<OutreachWorkspace searchId="search_b" />),
        );
      if (kind === "session") {
        session.mode = "saas";
        await mount();
      }
      if (kind === "unmount") {
        await act(async () => root.unmount());
        root = createRoot(container);
      }
      await act(async () => finish(snapshot));
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain("Approved message copied");
      expect(thread.messages).toHaveLength(0);
    },
  );
  it("coalesces concurrent clicks and allows an explicit subsequent retry", async () => {
    const { snapshot, finish } = await pendingCopy();
    // Same-tick clicks also need a synchronous guard, not just a disabled button.
    await act(async () => {
      button("Copy approved message").click();
      button("Copy approved message").click();
    });
    await act(async () => finish(snapshot));
    expect(
      api.mock.calls.filter(([path]) => path === "/outreach/thread_a"),
    ).toHaveLength(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    await click("Copy approved message");
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(thread.messages).toHaveLength(0);
  });
  it("offers safe retry without a manual-copy bypass on failed readiness", async () => {
    await mount();
    await click("Approve exact message");
    api.mockRejectedValueOnce(new Error("Offline"));
    await click("Copy approved message");
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("copy it manually");
    expect(container.textContent).toContain("try Copy again");
    await click("Copy approved message");
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
async function mount() {
  await act(async () => root.render(<OutreachWorkspace searchId="search_a" />));
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  session.mode = "local-demo";
  api.mockReset();
  thread = fixture();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.mockImplementation(async (path: string, options: RequestInit = {}) => {
    if (path.startsWith("/outreach?"))
      return { threads: [structuredClone(thread)] };
    if (path === "/outreach/thread_a" && !options.method)
      return structuredClone(thread);
    const body = JSON.parse((options.body as string) || "{}");
    const action = path.split("/").at(-1);
    expect(body.expected_revision).toBe(thread.revision);
    expect(body.idempotency_key).toBeTruthy();
    if (action === "draft") {
      thread = {
        ...thread,
        ...body,
        approval: null,
        ready_for_manual_action: false,
      };
    }
    if (action === "approve") {
      thread.approval = {
        content_hash: "exact",
        approved_at: "now",
        revision: thread.revision,
      };
      thread.ready_for_manual_action = true;
    }
    if (action === "pause") {
      thread.paused = body.paused;
      thread.approval = null;
      thread.ready_for_manual_action = false;
    }
    if (action === "sent") {
      thread.messages.push({
        id: "sent",
        direction: "outbound",
        recipient: thread.recipient,
        subject: thread.subject,
        body: thread.body,
        source: "user_reported",
        reply_state: null,
        created_at: "now",
      });
      thread.body = "";
      thread.approval = null;
      thread.ready_for_manual_action = false;
    }
    if (action === "replies") {
      thread.messages.push({
        id: "reply",
        direction: "inbound",
        recipient: "",
        subject: "",
        body: body.body,
        source: "user_reported",
        reply_state: body.reply_state,
        created_at: "now",
      });
      thread.reply_state = body.reply_state;
      thread.body = "";
      thread.approval = null;
      thread.ready_for_manual_action = false;
    }
    if (action === "reply-state") {
      thread.reply_state = body.reply_state;
      if (body.reply_state === "opt_out") thread.suppressed = true;
      thread.approval = null;
      thread.ready_for_manual_action = false;
    }
    if (action === "outcomes") {
      thread.meeting_state = body.meeting_state;
      thread.sale_state = body.sale_state;
    }
    thread.revision++;
    return structuredClone(thread);
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("persisted manual outreach journey", () => {
  it("reads existing threads without creation or generation and fails closed in hosted mode", async () => {
    await mount();
    expect(api.mock.calls).toHaveLength(1);
    expect(api.mock.calls[0][0]).toBe("/outreach?search_id=search_a");
    expect(container.textContent).toContain("No mailbox is connected");
    expect(container.textContent).toContain("Email status: published but not verified");
    await act(async () => root.unmount());
    root = createRoot(container);
    session.mode = "saas";
    api.mockClear();
    await mount();
    expect(api).not.toHaveBeenCalled();
    expect(container.textContent).toContain("isn’t available");
  });
  it("requires saved exact approval, invalidates local readiness on edit, and records manual sends only explicitly", async () => {
    await mount();
    expect(button("Copy approved message").disabled).toBe(true);
    expect(container.querySelector(".outreach-lead small")?.textContent).toBe(
      "Needs review",
    );
    await click("Approve exact message");
    expect(button("Copy approved message").disabled).toBe(false);
    expect(container.querySelector(".outreach-lead small")?.textContent).toBe(
      "Approved",
    );
    await change("Message", "The edited exact message.");
    expect(button("Copy approved message").disabled).toBe(true);
    expect(button("Record sent externally").disabled).toBe(true);
    expect(button("Approve exact message").disabled).toBe(true);
    await click("Save changes");
    await click("Approve exact message");
    await click("Copy approved message");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("The edited exact message."),
    );
    expect(thread.messages).toHaveLength(0);
    await click("Record sent externally");
    expect(thread.messages[0].body).toBe("The edited exact message.");
    expect(container.textContent).toContain("Clientrove did not send");
    expect(container.querySelector(".outreach-lead small")?.textContent).toBe(
      "Sent externally",
    );
    expect(button("Copy approved message").disabled).toBe(true);
  });
  it("persists received replies and blocks opt-outs even after classification correction", async () => {
    await mount();
    await click("Conversations");
    await change("Paste a received reply", "Please stop contacting us.");
    await click("Save received reply");
    expect(thread.messages[0].direction).toBe("inbound");
    expect(button("Approve exact message").disabled).toBe(true);
    await change("Review reply status", "opt_out");
    expect(thread.suppressed).toBe(true);
    expect(container.textContent).toContain("Further outreach is blocked");
    await change("Review reply status", "interested");
    expect(thread.suppressed).toBe(true);
    await change("Message", "A new response");
    await click("Save changes");
    expect(button("Approve exact message").disabled).toBe(true);
  });
  it("keeps booking-link edits distinct from user-reported meeting and customer outcomes", async () => {
    await mount();
    await click("Meetings");
    await change("Booking link", "https://example.org/book");
    await click("Save booking link");
    expect(thread.meeting_state).toBe("not_recorded");
    await change("Meeting · reported by you", "booked_reported");
    expect(thread.meeting_state).toBe("booked_reported");
    expect(thread.sale_state).toBe("not_recorded");
    await change("Customer outcome · reported by you", "won_reported");
    expect(thread.sale_state).toBe("won_reported");
    expect(
      api.mock.calls.some(
        ([path]) => path.includes("/draft") && path.includes("/customers/"),
      ),
    ).toBe(false);
  });
  it("preserves unsaved message edits across navigation and blocks paused actions", async () => {
    await mount();
    await change("Message", "Keep this edit.");
    await click("Meetings");
    await click("Review");
    expect(field("Message").value).toBe("Keep this edit.");
    await click("Pause this outreach");
    expect(field("Message").value).toBe("Keep this edit.");
    await click("Save changes");
    expect(button("Approve exact message").disabled).toBe(true);
    await click("Resume this outreach");
    expect(button("Approve exact message").disabled).toBe(false);
  });
  it("prepares only the explicit selection, reusing its key after uncertain failure", async () => {
    const navigate = vi.fn();
    api.mockRejectedValueOnce(new Error("Connection interrupted"));
    await act(async () =>
      root.render(
        <PrepareOutreach
          searchId="search_a"
          accountIds={["account_a", "account_b"]}
          onPrepared={navigate}
        />,
      ),
    );
    expect(api).not.toHaveBeenCalled();
    await click("Prepare outreach (2)");
    const first = JSON.parse(api.mock.calls[0][1].body);
    api.mockResolvedValueOnce({ threads: [] });
    await click("Prepare outreach (2)");
    expect(JSON.parse(api.mock.calls[1][1].body)).toEqual(first);
    expect(first.account_ids).toEqual(["account_a", "account_b"]);
    expect(navigate).toHaveBeenCalledWith("/workspace/outreach/search_a");
  });
  it("retrieves AI only on explicit action, keeps uncertain retries idempotent, and leaves the result unsaved", async () => {
    const original = api.getMockImplementation()!;
    let attempts = 0;
    api.mockImplementation(async (path: string, options: RequestInit = {}) => {
      if (path.startsWith("/customers/")) {
        if (++attempts === 1) throw new Error("Connection interrupted");
        return {
          subject: "Grounded introduction",
          body: "Facts reviewed from public sources.",
          evidence_ids: ["source_a"],
          warnings: [],
          generation_engine: "deepseek",
          created_at: "now",
        };
      }
      return original(path, options);
    });
    await mount();
    expect(attempts).toBe(0);
    await click("Retrieve original AI draft");
    expect(attempts).toBe(1);
    await click("Retrieve original AI draft");
    const calls = api.mock.calls.filter(([path]) =>
      path.startsWith("/customers/"),
    );
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[0][1].body)).toEqual(JSON.parse(calls[1][1].body));
    expect(field("Message").value).toBe("Facts reviewed from public sources.");
    expect(thread.body).toBe("A reviewed factual message.");
    expect(button("Approve exact message").disabled).toBe(true);
  });
  it("includes the approved booking link when copying and aborts pending mutations on unmount", async () => {
    thread.booking_link = "https://example.org/book";
    await mount();
    await click("Approve exact message");
    await click("Copy approved message");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(
        "A reviewed factual message.\n\nBooking link: https://example.org/book",
      ),
    );
    let finish!: (value: OutreachThread) => void;
    api.mockImplementationOnce(
      () =>
        new Promise<OutreachThread>((resolve) => {
          finish = resolve;
        }),
    );
    await click("Record sent externally");
    const options = api.mock.calls.at(-1)![1] as RequestInit;
    expect(options.signal?.aborted).toBe(false);
    await act(async () => root.unmount());
    expect(options.signal?.aborted).toBe(true);
    await act(async () => finish(structuredClone(thread)));
    root = createRoot(container);
  });
});
