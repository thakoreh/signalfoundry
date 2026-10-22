// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CustomerSearchResults } from "../components/customer-search-results";
import { BusinessOnboarding } from "../components/business-onboarding";
import { LandingMarketing } from "../components/landing-marketing";
import { fixtureRun, fixtureWorkspace } from "./customer-fixtures";
import { installMotionEnvironment } from "./motion-environment";
import type { OutreachThread } from "../lib/outreach";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, mode: "local-demo", isAdmin: true }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../components/outreach-insights", () => ({
  OutreachInsights: () => null,
}));
let root: Root, container: HTMLDivElement;
let motion: ReturnType<typeof installMotionEnvironment>;
const thread = (id: string): OutreachThread => ({
  id: `thread_${id}`,
  account_id: id,
  search_id: "search_a",
  company_name: id,
  domain: `${id}.company.com`,
  recipient: `info@${id}.example`,
  recipient_status: "published_unverified",
  subject: "A specific introduction",
  body: "A saved factual message.",
  booking_link: "",
  paused: false,
  suppressed: false,
  suppression_reason: null,
  reply_state: "awaiting_review",
  revision: 1,
  approval: null,
  ready_for_manual_action: false,
  messages: [],
  meeting_state: "not_recorded",
  sale_state: "not_recorded",
  created_at: "2026-10-22",
  updated_at: "2026-10-22",
});
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  motion = installMotionEnvironment();
  api.mockReset();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/workspace") return fixtureWorkspace;
    if (path === "/outreach/insights") return { company_flags: [] };
    if (path === "/outreach" && options?.method === "POST") {
      const id = JSON.parse(String(options.body)).account_ids[0];
      return { threads: [thread(id)] };
    }
    if (path === "/outreach?search_id=search_a")
      return { threads: [thread("verified"), thread("unverified")] };
    return fixtureRun();
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const dialog = () =>
  document.querySelector<HTMLDialogElement>("#selected-outreach-review")!;
async function open(name = "verified") {
  const trigger = container.querySelector<HTMLButtonElement>(
    `[aria-label="Start outreach for ${name}"]`,
  )!;
  await act(async () => trigger.click());
  return trigger;
}
const message = () =>
  [...dialog().querySelectorAll("label")]
    .find(
      (e) =>
        [...e.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join("")
          .trim() === "Message",
    )!
    .querySelector<HTMLTextAreaElement>("textarea")!;
async function close() {
  await act(async () =>
    dialog().querySelector<HTMLButtonElement>(".customer-draft-close")!.click(),
  );
}

it("opens exactly the selected company's existing review in place without generating or sending", async () => {
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
  await open();
  expect(dialog().open).toBe(true);
  expect(dialog().querySelector("h2")?.textContent).toBe("verified");
  expect(dialog().querySelector("#outreach-company")?.textContent).toBe(
    "verified",
  );
  expect(dialog().querySelector(".outreach-leads")).toBeNull();
  expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
  expect(
    api.mock.calls
      .filter(([, options]) => options?.method)
      .map(([path]) => path),
  ).toEqual(["/outreach"]);
  expect(dialog().textContent).toContain("No mailbox is connected");
  expect(dialog().querySelector(".outreach-return-summary")).toBeNull();
});

it("retains private edits across close, another company, and reopen; restores trigger focus", async () => {
  const confirm = vi.spyOn(window, "confirm");
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
  const trigger = await open();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(message(), "Private unsaved wording");
    message().dispatchEvent(new Event("input", { bubbles: true }));
  });
  await close();
  expect(dialog().open).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("");
  await open("unverified");
  expect(dialog().querySelector("#outreach-company")?.textContent).toBe(
    "unverified",
  );
  expect(message().value).not.toBe("Private unsaved wording");
  await close();
  await open();
  expect(message().value).toBe("Private unsaved wording");
  expect(confirm).not.toHaveBeenCalled();
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  expect(
    api.mock.calls
      .filter(([, options]) => options?.method)
      .every(([path]) => path === "/outreach"),
  ).toBe(true);
});

it("refuses to show another company's editor if the selected thread disappears", async () => {
  const original = api.getMockImplementation()!;
  api.mockImplementation((path: string, options?: RequestInit) =>
    path === "/outreach?search_id=search_a"
      ? Promise.resolve({ threads: [thread("unverified")] })
      : original(path, options),
  );
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
  await open();
  expect(dialog().textContent).toContain(
    "The selected business is unavailable",
  );
  expect(dialog().querySelector(".outreach-editor")).toBeNull();
});

it("keeps Escape safe and retains focus inside the review while open", async () => {
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
  const trigger = await open();
  expect(dialog().contains(document.activeElement)).toBe(true);
  expect(trigger.disabled).toBe(false);
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(dialog().open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("falls back to the same safe review if native view transitions fail", async () => {
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: () => {
      throw new Error("Transition unavailable");
    },
  });
  try {
    await act(async () =>
      root.render(<CustomerSearchResults searchId="search_a" />),
    );
    await open();
    expect(dialog().open).toBe(true);
    expect(dialog().querySelector("#outreach-company")?.textContent).toBe(
      "verified",
    );
    expect(
      container.querySelector(".customer-lead-company")?.getAttribute("style"),
    ).not.toContain("outreach-company");
  } finally {
    Reflect.deleteProperty(document, "startViewTransition");
  }
});

it("does not carry an old search's retained review into another search", async () => {
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
  await open();
  await close();
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_b" />),
  );
  expect(dialog()).toBeNull();
});

it("keeps pipeline copy readable while motion pauses and follows system preference", async () => {
  await act(async () => root.render(<LandingMarketing />));
  expect(container.querySelectorAll(".sf-pipeline-steps li")).toHaveLength(4);
  expect(container.textContent).toContain(
    "Sending and reply tracking are manual today",
  );
  const pause = container.querySelector<HTMLButtonElement>(
    '[aria-label="Pause page motion"]',
  )!;
  await act(async () => pause.click());
  expect(
    container
      .querySelector(".sf-pipeline-steps")
      ?.getAttribute("data-flow-running"),
  ).toBe("false");
  expect(container.querySelectorAll(".sf-pipeline-steps strong")).toHaveLength(
    4,
  );
  await act(async () => motion.setReducedMotion(true));
  expect(
    container
      .querySelector(".sf-pipeline-steps")
      ?.getAttribute("data-flow-running"),
  ).toBe("false");
});

it("shows the analysis halo only for actual analysis, never workspace loading or an error", async () => {
  const render = async (analyzing: boolean, loading: boolean, error = "") =>
    act(async () =>
      root.render(
        <BusinessOnboarding
          website="example.org"
          setWebsite={vi.fn()}
          analyze={async () => {}}
          analyzing={analyzing}
          loading={loading}
          error={error}
          profile={null}
          review={false}
          changeWebsite={vi.fn()}
          onSaved={vi.fn()}
        />,
      ),
    );
  await render(true, false);
  expect(
    container
      .querySelector("[data-analysis-active]")
      ?.getAttribute("data-analysis-active"),
  ).toBe("true");
  await render(true, true);
  expect(
    container
      .querySelector("[data-analysis-active]")
      ?.getAttribute("data-analysis-active"),
  ).toBe("false");
  await render(true, false, "Could not read the website");
  expect(
    container
      .querySelector("[data-analysis-active]")
      ?.getAttribute("data-analysis-active"),
  ).toBe("false");
});
