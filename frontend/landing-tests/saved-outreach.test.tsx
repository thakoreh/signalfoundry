// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SavedOutreach } from "../components/saved-outreach";
import { RecipientTime } from "../components/recipient-time";
const { api, session } = vi.hoisted(() => ({ api: vi.fn(), session: { mode: "local-demo" } }));
vi.mock("../components/workspace-session", () => ({ useWorkspaceSession: () => ({ api, mode: session.mode }) }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); api.mockReset(); session.mode = "local-demo"; });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it("reopens saved threads using bounded recent links, without creating or sending work", async () => {
  api.mockResolvedValue({ threads: [{ id: "a", search_id: "s", company_name: "Fictional Old", recipient: "team@example.org", updated_at: "2026-10-19", reply_state: "auto_reply" }, { id: "b", search_id: "t", company_name: "Fictional New", recipient: "alex@example.org", updated_at: "2026-10-21", suppressed: true }] });
  await act(async () => root.render(<SavedOutreach />));
  expect(api).toHaveBeenCalledExactlyOnceWith("/outreach", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(container.querySelectorAll("li")[0].textContent).toContain("Fictional New");
  expect(container.textContent).toContain("Stopped · suppressed");
  expect(container.textContent).toContain("Auto-reply / OOO");
  expect(container.querySelector('a[href="/workspace/outreach/t?thread=b"]')).not.toBeNull();
});
it("keeps a failed read honest and never requests unsupported hosted outreach", async () => {
  api.mockRejectedValue(new Error("Saved read failed"));
  await act(async () => root.render(<SavedOutreach />));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Saved read failed");
  expect(container.textContent).not.toContain("will stay here");
  api.mockClear(); session.mode = "saas";
  await act(async () => root.render(<SavedOutreach />));
  expect(api).not.toHaveBeenCalled(); expect(container.textContent).toBe("");
});
it("shows only an explicitly known timezone and labels working hours as guidance", async () => {
  await act(async () => root.render(<RecipientTime />));
  expect(container.textContent).toBe("");
  await act(async () => root.render(<RecipientTime zone="America/Toronto" />));
  expect(container.textContent).toContain("Recipient local time:");
  expect(container.textContent).toContain("guidance, not an optimal send time");
  await act(async () => root.render(<RecipientTime zone="not/a-zone" />));
  expect(container.textContent).toBe("Recipient timezone needs review.");
});

it("provides an app path to older saved work even when nothing is due", async () => {
  api.mockResolvedValue({ threads: Array.from({ length: 11 }, (_, i) => ({ id: `thread_${i}`, search_id: `search_${i}`, company_name: `Fictional ${i}`, recipient: `alex${i}@example.org`, updated_at: `2026-10-${String(i + 1).padStart(2, "0")}` })) });
  await act(async () => root.render(<SavedOutreach />));
  expect(container.querySelectorAll("li")).toHaveLength(10);
  expect(container.querySelector('a[href="/workspace/outreach/search_0?thread=thread_0"]')).toBeNull();
  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Show all 11 saved conversations")!.click());
  expect(container.querySelector('a[href="/workspace/outreach/search_0?thread=thread_0"]')).not.toBeNull();
});
