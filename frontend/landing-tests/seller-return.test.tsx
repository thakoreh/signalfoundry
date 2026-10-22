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
vi.mock("../components/customer-search", () => ({
  CustomerSearch: () => (
    <input aria-label="Search draft" defaultValue="unsaved search" />
  ),
}));
vi.mock("../components/customer-search-results", () => ({
  CustomerSearchResults: () => <p>Dense results</p>,
}));
vi.mock("../components/outreach-workspace", () => ({
  OutreachWorkspace: () => (
    <textarea
      aria-label="Message draft"
      defaultValue="unsaved message and inbound"
    />
  ),
}));
const profile = {
  company_name: "Fictional Co",
  sender_name: "Alex Example",
  description: "Factual offer",
  industries: [],
  company_sizes: [],
  geographies: [],
  buyer_roles: [],
  keywords: [],
  exclusions: [],
};
it.each([
  {},
  { searchId: "search_a" },
  { searchId: "search_a", outreach: true },
])(
  "shows the saved seller and repairs missing address without unmounting work: %s",
  async (props) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.mockResolvedValue({ id: "workspace_a", profile });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(<CustomerWorkspaceScreen {...props} />),
      );
      expect(host.textContent).toContain("Selling as");
      expect(host.textContent).toContain("Alex Example · Fictional Co");
      expect(host.textContent).toContain("Mailing address needed");
      const work = host.querySelector(
        '[aria-label="Message draft"], [aria-label="Search draft"]',
      );
      const edit = [...host.querySelectorAll("button")].find(
        (b) => b.textContent === "Edit business",
      )!;
      await act(async () => edit.click());
      expect(host.querySelector('input[maxlength="1000"]')).toBeTruthy();
      expect(host.textContent).toContain("legally");
      await act(async () =>
        [...host.querySelectorAll("button")]
          .find((b) => b.textContent === "Back to saved work")!
          .click(),
      );
      if (work)
        expect(
          host.querySelector(
            '[aria-label="Message draft"], [aria-label="Search draft"]',
          ),
        ).toBe(work);
      expect(api.mock.calls.every(([path]) => path === "/workspace")).toBe(
        true,
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
      api.mockClear();
    }
  },
);
