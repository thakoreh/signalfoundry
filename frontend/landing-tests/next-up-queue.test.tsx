// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextUpQueue } from "../components/next-up-queue";

const { api, session } = vi.hoisted(() => ({
  api: vi.fn(),
  session: { mode: "local-demo" },
}));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: session.mode }),
}));

describe("NextUpQueue", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api.mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  it("reads the durable projection and routes one primary action into the existing thread", async () => {
    api.mockResolvedValue({
      items: [{
        thread_id: "thread_a",
        search_id: "search_a",
        company_name: "Example business",
        action: "answer_reply",
        reason: "Write and review a human answer using saved facts.",
        reply_state: "interested",
        meeting_state: "not_recorded",
        updated_at: "2026-10-20T12:00:00Z",
      }],
    });
    await act(async () => root.render(<NextUpQueue />));
    expect(api).toHaveBeenCalledWith("/outreach/next-up", expect.anything());
    expect(container.textContent).toContain("Next up");
    expect(container.textContent).toContain("Example business");
    expect(container.textContent).toContain("Write a human answer");
    expect(container.querySelector('a[href="/workspace/outreach/search_a?thread=thread_a&view=Conversations"]')?.textContent).toBe("Open conversation");
  });
  it("shows an honest empty state without inventing durable work", async () => {
    api.mockResolvedValue({ items: [] });
    await act(async () => root.render(<NextUpQueue />));
    expect(container.textContent).toContain("You’re caught up.");
    expect(container.querySelector("a")).toBeNull();
  });
});
