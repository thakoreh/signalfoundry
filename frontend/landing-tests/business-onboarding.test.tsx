// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BusinessOnboarding } from "../components/business-onboarding";
import type { Profile } from "../lib/types";

const { api, push } = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn() }));
vi.mock("../components/workspace-session", () => ({
  useWorkspaceSession: () => ({
    api,
    mode: "local-demo",
    isAdmin: true,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const profile: Profile = {
  company_name: "Saved business",
  description: "A useful product for sales teams.",
  industries: ["B2B SaaS"],
  company_sizes: [],
  geographies: [],
  buyer_roles: [],
  keywords: [],
  exclusions: [],
  sender_name: "Alex Founder",
  mailing_address: "100 Example Street",
  sender_contact: "alex@example.com",
};

let container: HTMLDivElement;
let root: Root;

function input(label: string) {
  const field = [...container.querySelectorAll("label")].find((element) =>
    element.textContent?.trim().startsWith(label),
  );
  if (!field) throw new Error(`Missing field: ${label}`);
  const element = field.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input,textarea",
  );
  if (!element) throw new Error(`Missing control: ${label}`);
  return element;
}

async function change(label: string, value: string) {
  const element = input(label);
  await act(async () => {
    const prototype =
      element.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function button(text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent?.trim() === text,
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.mockReset();
  push.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(changeWebsite = vi.fn()) {
  return act(async () =>
    root.render(
      <BusinessOnboarding
        website="https://saved.example"
        setWebsite={vi.fn()}
        analyze={vi.fn()}
        analyzing={false}
        loading={false}
        error=""
        profile={profile}
        review
        changeWebsite={changeWebsite}
        onSaved={vi.fn()}
      />,
    ),
  );
}

it("keeps a dirty setup profile until the founder explicitly discards it", async () => {
  const changeWebsite = vi.fn();
  await mount(changeWebsite);
  await change("Business name", "Unsaved business name");

  await act(async () => button("← Change website")!.click());
  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(container.textContent).toContain("Discard unsaved business changes?");
  expect(input("Business name").value).toBe("Unsaved business name");
  expect(changeWebsite).not.toHaveBeenCalled();

  await act(async () => button("Cancel")!.click());
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  expect(input("Business name").value).toBe("Unsaved business name");
  expect(changeWebsite).not.toHaveBeenCalled();

  await act(async () => button("← Change website")!.click());
  await act(async () => button("Discard changes")!.click());
  expect(changeWebsite).toHaveBeenCalledOnce();
});

it("surfaces the saved next step before optional targeting and sender details", async () => {
  await mount();
  const summary = container.querySelector(".business-onboarding-next-step")!;
  const details = container.querySelector(".business-onboarding-targeting")!;
  const sender = container.querySelector("fieldset")!;
  expect(summary).not.toBeNull();
  expect(summary.textContent).toContain("Next: find customers");
  expect(summary.textContent).toContain("Optional targeting and sender details can be added below");
  expect(summary.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(summary.compareDocumentPosition(sender) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(summary.querySelector('button[type="submit"]')?.textContent).toContain("Find customers");
});

it("keeps the brand and saved seller above returning work without repeating setup fields", async () => {
  await act(async () => root.render(<BusinessOnboarding website="https://saved.example" setWebsite={vi.fn()}
    analyze={vi.fn()} analyzing={false} loading={false} error="" profile={profile} review
    changeWebsite={vi.fn()} onSaved={vi.fn()} home={<section><h1>Next up fixture</h1></section>} />));
  const header = container.querySelector("header")!;
  const heading = container.querySelector("h1")!;
  expect(header.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.textContent).toContain("Saved business");
  expect(heading.textContent).toBe("Next up fixture");
  expect(container.querySelector("input")).toBeNull();
  expect(container.querySelector("main")?.className).toContain("--customers");
});
