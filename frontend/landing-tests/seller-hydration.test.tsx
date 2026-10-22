// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CustomerWorkspaceScreen } from "../components/customer-workspace-screen";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: "local-demo", isAdmin: true }),
}));
it("preserves early message and pasted inbound through same-scope seller hydration and profile return", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let release!: (value: unknown) => void;
  const workspace = { id: "workspace_a", profile: {
    company_name: "Fictional Co", sender_name: "Alex Example", description: "Factual offer",
    industries: [], company_sizes: [], geographies: [], buyer_roles: [], keywords: [], exclusions: [],
  } };
  const thread = { id: "thread_a", search_id: "search_a", account_id: "a", company_name: "Fictional recipient",
    domain: "example.org", recipient: "hello@example.org", subject: "Fixture subject", body: "Saved fixture words",
    booking_link: "", paused: false, suppressed: false, reply_state: null, revision: 1, approval: null,
    ready_for_manual_action: false, messages: [], meeting_state: "not_recorded", sale_state: "not_recorded" };
  api.mockImplementation(async (path: string) => {
    if (path === "/workspace") return new Promise(resolve => { release = resolve; });
    if (path.startsWith("/outreach?")) return { threads: [structuredClone(thread)] };
    if (path === "/workspace/profile") return workspace;
    throw Error("Unexpected " + path);
  });
  const button = (name: string) => [...host.querySelectorAll("button")].find(b => b.textContent === name)!;
  const message = () => host.querySelector<HTMLTextAreaElement>(".outreach-draft-fields textarea")!;
  const inbound = () => host.querySelector<HTMLTextAreaElement>(".outreach-conversation textarea")!;
  async function type(field: HTMLTextAreaElement, value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  try {
    await act(async () => root.render(<CustomerWorkspaceScreen searchId="search_a" outreach />));
    await type(message(), "Private early typing");
    await act(async () => button("Conversations").click());
    await type(inbound(), "Private early inbound");
    await act(async () => release(workspace));
    expect(message().value).toBe("Private early typing");
    expect(inbound().value).toBe("Private early inbound");
    expect(host.textContent).toContain("Alex Example · Fictional Co");
    await act(async () => button("Edit business").click());
    await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await act(async () => button("Back to saved work").click());
    expect(message().value).toBe("Private early typing");
    expect(inbound().value).toBe("Private early inbound");
    expect(button("Copy approved message").disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    api.mockReset();
  }
});
