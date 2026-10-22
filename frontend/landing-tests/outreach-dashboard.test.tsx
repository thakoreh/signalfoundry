// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OutreachDashboard } from "../components/outreach-dashboard";
import Workspace from "../components/workspace";
import { PrepareOutreach } from "../components/prepare-outreach";
import { fixtureWorkspace } from "./customer-fixtures";

const { api, session } = vi.hoisted(() => ({
  api: vi.fn(),
  session: { mode: "local-demo", isAdmin: true },
}));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({ api, ...session }),
}));
vi.mock("../components/business-onboarding", () => ({
  BusinessOnboarding: ({ home }: { home: React.ReactNode }) => (
    <div>{home}</div>
  ),
}));
const thread = (id: string, extra: object = {}) => ({
  id,
  search_id: "search_a",
  account_id: `account_${id}`,
  company_name: `Business ${id}`,
  recipient: `person@${id}.example`,
  domain: `${id}.example`,
  recipient_status: "published_unverified",
  paused: false,
  suppressed: false,
  reply_state: null,
  messages: [],
  approval: null,
  meeting_state: "not_recorded",
  updated_at: "2026-10-21",
  ...extra,
});
const activity = {
  funnel: { contacted: 2, replied: 1, meetings_held: 0 },
  excluded_example_companies: 1,
  provenance: "Local reports by you.",
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  session.mode = "local-demo";
  session.isAdmin = true;
  api.mockReset();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.mockImplementation(async (path: string) =>
    path === "/workspace"
      ? fixtureWorkspace
      : path === "/outreach"
        ? {
            threads: [
              thread("alpha"),
              thread("bravo", {
                messages: [{ direction: "inbound" }],
                reply_state: "question",
              }),
              thread("charlie", {
                meeting_state: "booked_reported",
                meeting_at: "2026-11-05T15:00:00Z",
                meeting_timezone: "America/Toronto",
              }),
            ],
          }
        : path === "/outreach/insights"
          ? activity
          : {
              items: [
                {
                  thread_id: "bravo",
                  search_id: "search_a",
                  action: "answer_reply",
                },
              ],
            },
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const click = async (text: string) => {
  const button = [...container.querySelectorAll("button")].find(
    (el) => el.textContent === text,
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
};

it("uses one dashboard with reported numbers, exact actions, and GET-only reads", async () => {
  await act(async () => root.render(<OutreachDashboard />));
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.textContent).not.toMatch(
    /RETURNING WORK|Saved conversations|Your local data|Before you leave/,
  );
  expect(
    [...container.querySelectorAll("dd")].map((el) => el.textContent),
  ).toEqual(["2", "1", "0"]);
  expect(container.textContent).toContain("Nothing sends automatically");
  expect(
    container.querySelector('a[href="/workspace/settings"]'),
  ).not.toBeNull();
  expect(
    container.querySelector(
      'a[href="/workspace/outreach/search_a?thread=bravo&view=Conversations"]',
    )?.textContent,
  ).toBe("Reply");
  expect(
    api.mock.calls.every(([, options]) => !options.method && !options.body),
  ).toBe(true);
  expect(api).toHaveBeenCalledTimes(3);
});
it("filters and searches existing rows without generating work or counting a meeting as a sale", async () => {
  await act(async () => root.render(<OutreachDashboard />));
  await click("Replies");
  expect(
    container.querySelectorAll(".outreach-dashboard-activity li"),
  ).toHaveLength(1);
  expect(
    container.querySelector(".outreach-dashboard-activity")?.textContent,
  ).toContain("Business bravo");
  await click("Meetings");
  expect(
    container.querySelector(".outreach-dashboard-activity")?.textContent,
  ).toContain("Business charlie");
  expect(
    container.querySelector(
      'a[href="/workspace/outreach/search_a?thread=charlie&view=Meetings"]',
    ),
  ).not.toBeNull();
  expect(
    container.querySelector(".outreach-dashboard-activity")?.textContent,
  ).toContain("GMT-05:00");
  expect(api).toHaveBeenCalledTimes(3);
});
it("keeps failed reads unknown rather than presenting zero success metrics", async () => {
  api.mockRejectedValue(new Error("Activity is unavailable"));
  await act(async () => root.render(<OutreachDashboard />));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Activity is unavailable",
  );
  expect(container.querySelector("dd")).toBeNull();
});
it("does not read or expose local records in hosted mode", async () => {
  session.mode = "saas";
  await act(async () => root.render(<OutreachDashboard />));
  expect(api).not.toHaveBeenCalled();
  expect(container.textContent).toContain("not available for hosted");
  expect(container.querySelector("dd")).toBeNull();
});
it("moves local data controls to Settings rather than the home screen", async () => {
  await act(async () => root.render(<Workspace />));
  expect(container.textContent).not.toContain("Your local data");
  expect(container.querySelector("h1")?.textContent).toBe("Your outreach.");
  await act(async () => root.render(<Workspace settings />));
  expect(container.querySelector("h1")?.textContent).toBe("Settings");
  expect(container.textContent).toContain("Your local data");
  expect(api.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it("starts only the selected company and focuses that company on review without sending", async () => {
  const navigate = vi.fn();
  api.mockResolvedValue({
    threads: [
      { id: "old_thread", account_id: "other", search_id: "search_a" },
      { id: "chosen_thread", account_id: "chosen", search_id: "search_a" },
    ],
  });
  await act(async () =>
    root.render(
      <PrepareOutreach
        searchId="search_a"
        accountIds={["chosen"]}
        companyName="Chosen company"
        onPrepared={navigate}
      />,
    ),
  );
  expect(api).not.toHaveBeenCalled();
  await click("Start outreach");
  expect(JSON.parse(api.mock.calls[0][1].body).account_ids).toEqual(["chosen"]);
  expect(navigate).toHaveBeenCalledWith(
    "/workspace/outreach/search_a?thread=chosen_thread&view=Review",
  );
  expect(api.mock.calls.map(([path]) => path)).toEqual(["/outreach"]);
});
