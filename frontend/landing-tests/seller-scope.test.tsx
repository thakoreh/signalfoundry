// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SaasCustomerWorkspace } from "../components/saas-customer-workspace";
const { auth } = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: true,
    userId: "user_a",
    orgId: "org_a",
    orgRole: "org:admin",
  },
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth,
  OrganizationList: () => null,
  OrganizationSwitcher: () => null,
  UserButton: () => null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../components/customer-search", () => ({
  CustomerSearch: () => <p>Search fixture</p>,
}));
const profile = {
  company_name: "Old seller",
  description: "Factual offer",
  industries: [],
  company_sizes: [],
  geographies: [],
  buyer_roles: [],
  keywords: [],
  exclusions: [],
};
it.each(["user", "workspace", "logout", "unmount"])(
  "isolates pending profile load/save on %s replacement, ignoring late transport",
  async (kind) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.assign(auth, { isSignedIn: true, userId: "user_a", orgId: "org_a" });
    const pending: { resolve: (v: Response) => void; signal: AbortSignal }[] =
      [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_p, opts) =>
          new Promise<Response>((resolve) =>
            pending.push({ resolve, signal: opts.signal }),
          ),
      ),
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(<SaasCustomerWorkspace />));
      // Complete first load, begin save, then begin a new scope's pending load.
      await act(async () =>
        pending[0].resolve(Response.json({ id: "workspace_a", profile })),
      );
      await act(async () =>
        [...host.querySelectorAll("button")]
          .find((b) => b.textContent === "Edit business")!
          .click(),
      );
      await act(async () =>
        host
          .querySelector("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          ),
      );
      expect(pending).toHaveLength(2);
      if (kind === "user") auth.userId = "user_b";
      if (kind === "workspace") auth.orgId = "org_b";
      if (kind === "logout") auth.isSignedIn = false;
      await act(async () =>
        root.render(kind === "unmount" ? null : <SaasCustomerWorkspace />),
      );
      expect(pending[1].signal.aborted).toBe(true);
      await act(async () =>
        pending[1].resolve(
          Response.json({
            id: "workspace_a",
            profile: { ...profile, company_name: "Obsolete saved seller" },
          }),
        ),
      );
      expect(host.textContent).not.toContain("Obsolete saved seller");
      expect(host.textContent).not.toContain("Old seller");
      if (kind === "user" || kind === "workspace") {
        expect(pending).toHaveLength(3);
        // Replace once more while load is still pending; old completion must not restore seller.
        auth.userId = "user_c";
        await act(async () => root.render(<SaasCustomerWorkspace />));
        expect(pending[2].signal.aborted).toBe(true);
        await act(async () =>
          pending[2].resolve(Response.json({ id: "workspace_a", profile })),
        );
        expect(host.textContent).not.toContain("Old seller");
        await act(async () =>
          pending[3].resolve(
            Response.json({
              id: "workspace_c",
              profile: { ...profile, company_name: "Current seller" },
            }),
          ),
        );
        expect(host.textContent).toContain("Current seller");
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  },
);
