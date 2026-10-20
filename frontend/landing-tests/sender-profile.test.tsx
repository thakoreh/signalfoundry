// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ProfileEditor } from "../components/profile-editor";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: "local-demo", isAdmin: true }),
}));
it("opens an old profile with empty sender controls and saves only entered identity", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const profile = {
    company_name: "Fixture company",
    description: "A factual offer",
    industries: [],
    company_sizes: [],
    geographies: [],
    buyer_roles: [],
    keywords: [],
    exclusions: [],
  };
  api.mockResolvedValue({ profile });
  try {
    await act(async () =>
      root.render(
        <ProfileEditor profile={profile} onSaved={() => {}} onboarding />,
      ),
    );
    expect(container.textContent).toContain("mailing address");
    for (const label of [
      "Sender name",
      "Mailing address",
      "Reachable contact",
    ]) {
      const field = [...container.querySelectorAll("label")]
        .find((node) => node.textContent?.startsWith(label))
        ?.querySelector("input,textarea") as HTMLInputElement;
      expect(field).toBeTruthy();
      expect(field.value).toBe("");
    }
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    const body = JSON.parse(api.mock.calls[0][1].body);
    expect(body).toMatchObject({
      company_name: "Fixture company",
      sender_name: "",
      mailing_address: "",
      sender_contact: "",
    });
    expect(api.mock.calls.map((call) => call[0])).toEqual([
      "/workspace/profile",
    ]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
