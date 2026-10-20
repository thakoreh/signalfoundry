// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerSearchResults } from "../components/customer-search-results";
import { fixtureRun, fixtureWorkspace } from "./customer-fixtures";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: "local-demo" }),
}));
let container: HTMLDivElement;
let root: Root;
async function mount() {
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}
function ids() {
  return [...container.querySelectorAll("tbody tr")].map((row) =>
    row.getAttribute("aria-label"),
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  api.mockReset();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.mockImplementation(async (path: string) =>
    path === "/workspace" ? fixtureWorkspace : fixtureRun(),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dedicated customer results", () => {
  it("uses a semantic lead table and a mixed select-all checkbox without exposing research copy", async () => {
    await mount();
    expect(container.querySelector("table caption")?.textContent).toContain(
      "Your customer list",
    );
    expect(
      [...container.querySelectorAll('thead th[scope="col"]')].map(
        (cell) => cell.textContent,
      ),
    ).toEqual([
      "Select all businesses",
      "Company",
      "Email",
      "Verification",
      "Message action",
    ]);
    expect(container.querySelectorAll('tbody th[scope="row"]')).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(container.textContent).not.toMatch(
      /Research details|Fit observations|homepage describes|Buying intent is unknown|A test business/,
    );
    const all = container.querySelector<HTMLInputElement>(
      '[aria-label="Select all businesses"]',
    )!;
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('[aria-label="Select verified"]')!
        .click(),
    );
    expect(all.indeterminate).toBe(true);
    expect(all.checked).toBe(false);
    await act(async () => all.click());
    expect(all.indeterminate).toBe(false);
    expect(all.checked).toBe(true);
    expect(container.textContent).toContain("Export selected (3)");
    await act(async () => all.click());
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(false);
    expect(container.textContent).toContain("Export selected (0)");
  });
  it("progresses using GET-only same-job reads even when optional history lookup hangs", async () => {
    let reads = 0;
    api.mockImplementation((path: string) =>
      path === "/workspace"
        ? new Promise(() => undefined)
        : Promise.resolve(
            fixtureRun(
              ++reads === 1 ? "queued" : reads === 2 ? "running" : "complete",
            ),
          ),
    );
    await mount();
    expect(container.querySelector("h1")?.textContent).toBe(
      "Your search is queued.",
    );
    await advance(1500);
    expect(container.querySelector("h1")?.textContent).toBe(
      "Finding businesses for you.",
    );
    await advance(1500);
    expect(ids()).toEqual(["verified", "unverified", "absent"]);
    expect(container.querySelector("form")).toBeNull();
    for (const [path, options] of api.mock.calls) {
      expect(path).not.toBe("/customers/search");
      expect(options.method).toBeUndefined();
    }
    expect(reads).toBe(3);
  });
  it("keeps verification labels and selections while sorting, and restores those choices on refresh", async () => {
    await mount();
    expect(ids()).toEqual(["verified", "unverified", "absent"]);
    expect(container.textContent).toContain("Provider verified");
    expect(container.textContent).toContain("Unverified email");
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('[aria-label="Select verified"]')!
        .click(),
    );
    const sort = container.querySelector<HTMLSelectElement>("#customer-sort")!;
    await act(async () => {
      sort.value = "score";
      sort.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(ids()).toEqual(["absent", "unverified", "verified"]);
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Select verified"]',
      )!.checked,
    ).toBe(true);
    expect(container.textContent).toContain("Export selected (1)");
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(ids()).toEqual(["absent", "unverified", "verified"]);
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Select verified"]',
      )!.checked,
    ).toBe(true);
  });
  it("shows only a quiet partial summary without research expanders or raw HTTP instructions", async () => {
    api.mockImplementation(async (path: string) =>
      path === "/workspace"
        ? fixtureWorkspace
        : {
            ...fixtureRun("partial"),
            errors: [
              "candidate.example HTTP403 Forbidden. Try another public page.",
            ],
          },
    );
    await mount();
    expect(container.textContent).toContain("Some research is incomplete.");
    expect(container.textContent).not.toMatch(
      /HTTP403|Try another public page/,
    );
    expect(container.querySelector(".customer-run-partial details")).toBeNull();
    expect(container.textContent).not.toContain("Research details");
  });
  it("retries status without starting a job and cancels outstanding polling after leaving", async () => {
    let reads = 0;
    api.mockImplementation(async (path: string) => {
      if (path === "/workspace") return fixtureWorkspace;
      if (++reads <= 3) throw new Error("Status temporarily unavailable");
      return fixtureRun("running");
    });
    await mount();
    await advance(3000);
    await advance(3000);
    expect(reads).toBe(3);
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Check status again")!
        .click(),
    );
    expect(reads).toBe(4);
    expect(container.textContent).toContain("Finding businesses for you.");
    await act(async () => root.unmount());
    root = createRoot(container);
    await advance(10000);
    expect(reads).toBe(4);
    expect(
      api.mock.calls.every(
        ([path, options]) =>
          path !== "/customers/search" && options.method === undefined,
      ),
    ).toBe(true);
  });
  it("preserves saved selected IDs when the first refreshed status is still queued", async () => {
    sessionStorage.setItem(
      "clientrove:customer-results:local-demo:workspace_a:search_a",
      JSON.stringify({ ids: ["verified"], sort: "contacts" }),
    );
    let reads = 0;
    api.mockImplementation(async (path: string) =>
      path === "/workspace"
        ? fixtureWorkspace
        : fixtureRun(++reads === 1 ? "queued" : "complete"),
    );
    await mount();
    await advance(1500);
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Select verified"]',
      )!.checked,
    ).toBe(true);
  });
});
