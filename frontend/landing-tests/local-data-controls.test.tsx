// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalDataControls } from "../components/local-data-controls";
const { api, session } = vi.hoisted(() => ({ api: vi.fn(), session: { mode: "local-demo" } }));
vi.mock("../components/workspace-session", () => ({ useWorkspaceSession: () => ({ api, mode: session.mode }) }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); api.mockReset(); session.mode = "local-demo"; });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("does not export until requested and keeps failed downloads honest", async () => {
  api.mockRejectedValue(new Error("Export unavailable"));
  await act(async () => root.render(<LocalDataControls />));
  expect(api).not.toHaveBeenCalled();
  await act(async () => container.querySelector("button")!.click());
  expect(api).toHaveBeenCalledExactlyOnceWith("/privacy/export", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Export unavailable");
  expect(container.querySelector('[role="status"]')).toBeNull();
});
it("ignores an export completing after unmount and makes no hosted request", async () => {
  let finish!: (data: { format: string }) => void;
  api.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<LocalDataControls />));
  await act(async () => container.querySelector("button")!.click());
  await act(async () => root.render(<div />));
  await act(async () => finish({ format: "clientrove-local-export-v1" }));
  expect(container.querySelector("a")).toBeNull();
  api.mockClear(); session.mode = "saas";
  await act(async () => root.render(<LocalDataControls />));
  expect(api).not.toHaveBeenCalled(); expect(container.textContent).toBe("");
});
