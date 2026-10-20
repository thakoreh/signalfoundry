// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerSearch } from "../components/customer-search";
import { fixtureRun, fixtureWorkspace } from "./customer-fixtures";
const { api, push } = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn() }));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: "local-demo" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
let container: HTMLDivElement;
let root: Root;
const engine = {
  discovery: { status: "ready", detail: "Ready", provider: "mock" },
  contacts: { status: "ready", detail: "Ready", provider: "mock" },
  max_results: 5,
};
async function mount() {
  await act(async () =>
    root.render(<CustomerSearch onBack={() => undefined} />),
  );
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.mockReset();
  push.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.mockImplementation(async (path: string) =>
    path === "/customers/engine"
      ? engine
      : path === "/workspace"
        ? fixtureWorkspace
        : fixtureRun("queued"),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("customer search form handoff", () => {
  it("uses the saved actual target, defaults to five and lets users request one through five results", async () => {
    await mount();
    expect(container.querySelector<HTMLInputElement>("input")!.value).toBe(
      "B2B SaaS, Developer tools, Agencies",
    );
    const select = container.querySelector("select")!;
    expect(select.value).toBe("5");
    expect([...select.options].map((option) => option.value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    await act(async () => {
      select.value = "3";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await submit();
    const request = api.mock.calls.find(
      ([path]) => path === "/customers/search",
    )!;
    expect(request[1].method).toBe("POST");
    expect(JSON.parse(request[1].body)).toMatchObject({
      target: "B2B SaaS, Developer tools, Agencies",
      geography: "Canada",
      limit: 3,
    });
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/workspace/customers/search_a",
    );
    expect(container.querySelector("article")).toBeNull();
  });
  it("reuses the same idempotency key after uncertain failures and retains the user draft", async () => {
    let attempts = 0;
    api.mockImplementation(async (path: string) => {
      if (path === "/customers/search") {
        if (++attempts === 1) throw new Error("Connection interrupted");
        return fixtureRun("queued");
      }
      return path === "/customers/engine" ? engine : fixtureWorkspace;
    });
    await mount();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Connection interrupted",
    );
    await submit();
    const requests = api.mock.calls
      .filter(([path]) => path === "/customers/search")
      .map(([, options]) => JSON.parse(options.body));
    expect(requests[0].idempotency_key).toBe(requests[1].idempotency_key);
    expect(requests[0].idempotency_key).toBeTruthy();
    expect(
      JSON.parse(
        sessionStorage.getItem(
          "clientrove:customer-search:local-demo:workspace_a:draft",
        )!,
      ),
    ).toMatchObject({
      target: "B2B SaaS, Developer tools, Agencies",
      limit: 5,
    });
  });
});
