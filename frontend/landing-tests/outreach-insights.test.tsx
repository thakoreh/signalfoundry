// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OutreachInsights } from "../components/outreach-insights";
const { api, session } = vi.hoisted(() => ({ api: vi.fn(), session: { mode: "local-demo" } }));
vi.mock("../components/workspace-session", () => ({ useWorkspaceSession: () => ({ api, mode: session.mode }) }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); api.mockReset(); session.mode = "local-demo"; });
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("shows independent reported counts and saved return dates using GET only", async () => {
  api.mockResolvedValue({ funnel: { companies: 3, contacted: 2, replied: 1, interested: 0, meetings_held: 0, customers: 1 },
    excluded_example_companies: 2, company_flags: [], provenance: "Local reports by you.",
    departure: { approvals_pending: 1, upcoming: [{ thread_id: "t_a", search_id: "search_a", company_name: "Fictional business", action: "Report the meeting outcome", at: "2026-11-05T15:00:00Z", timezone: "America/Toronto", view: "Meetings" }] } });
  await act(async () => root.render(<OutreachInsights />));
  expect(api).toHaveBeenCalledExactlyOnceWith("/outreach/insights", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(container.textContent).toContain("reported by you");
  expect(container.textContent).toContain("2 example or unknown-provenance companies excluded");
  expect(container.querySelector('a[href="/workspace/outreach/search_a?thread=t_a&view=Meetings"]')).not.toBeNull();
  expect(container.querySelectorAll("dd")[5].textContent).toBe("1");
  expect(container.textContent).toContain("no inbox is connected");
});
it("does not substitute zero counts for a failed read and makes no hosted request", async () => {
  api.mockRejectedValue(new Error("Activity unavailable"));
  await act(async () => root.render(<OutreachInsights />));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Activity unavailable");
  expect(container.querySelector("dd")).toBeNull();
  session.mode = "saas";
  api.mockClear();
  await act(async () => root.render(<OutreachInsights revision={1} />));
  expect(api).not.toHaveBeenCalled();
  expect(container.textContent).toBe("");
});
