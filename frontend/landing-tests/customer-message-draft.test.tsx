// @vitest-environment jsdom
import React, { StrictMode, act } from "react";
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
const original = {
  subject: "A thought for your developer teams",
  body: "Hello,\n\nYour homepage describes B2B software for developer teams. Our product may be useful for the way your team works.\n\nWould a short conversation be useful?",
  evidence_ids: ["verified-source"],
  warnings: ["Review the facts before using this draft."],
  generation_engine: "deepseek",
  created_at: "2026-10-19",
};
function row() {
  return container.querySelector<HTMLElement>('tr[aria-label="verified"]')!;
}
function editor() {
  return document.querySelector<HTMLDialogElement>(".customer-draft-dialog")!;
}
function posts() {
  return api.mock.calls.filter(([, options]) => options?.method === "POST");
}
async function mount() {
  await act(async () =>
    root.render(<CustomerSearchResults searchId="search_a" />),
  );
}
async function draft() {
  await act(async () =>
    row().querySelector<HTMLButtonElement>(".customer-draft-action")!.click(),
  );
}
async function change(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.mockReset();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.mockImplementation(async (path: string) =>
    path.endsWith("/draft")
      ? original
      : path === "/workspace"
        ? fixtureWorkspace
        : fixtureRun(),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("compact customer message drafts", () => {
  it("uses native modal lifecycle safely in StrictMode and restores each company opener and prior scroll styles", async () => {
    const prototype = HTMLDialogElement.prototype;
    const previousShow = Object.getOwnPropertyDescriptor(
      prototype,
      "showModal",
    );
    const previousClose = Object.getOwnPropertyDescriptor(prototype, "close");
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      if (this.open)
        throw new DOMException("Dialog already open", "InvalidStateError");
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    Object.defineProperty(prototype, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(prototype, "close", {
      configurable: true,
      value: close,
    });
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "scroll";
    api.mockImplementation(async (path: string) =>
      path.endsWith("/draft")
        ? {
            ...original,
            evidence_ids: [
              path.includes("/unverified/")
                ? "unverified-source"
                : "verified-source",
            ],
          }
        : path === "/workspace"
          ? fixtureWorkspace
          : fixtureRun(),
    );
    try {
      await act(async () =>
        root.render(
          <StrictMode>
            <CustomerSearchResults searchId="search_a" />
          </StrictMode>,
        ),
      );
      const first = row().querySelector<HTMLButtonElement>(
        ".customer-draft-action",
      )!;
      first.focus();
      await draft();
      expect(editor().open).toBe(true);
      expect(showModal.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(posts()).toHaveLength(1);
      const firstClose = editor().querySelector<HTMLButtonElement>(
        ".customer-draft-close",
      )!;
      await act(async () =>
        firstClose.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(editor()).toBeNull();
      expect(document.activeElement).toBe(first);
      expect(document.body.style.overflow).toBe("auto");
      expect(document.documentElement.style.overflow).toBe("scroll");
      const second = container.querySelector<HTMLButtonElement>(
        'tr[aria-label="unverified"] .customer-draft-action',
      )!;
      second.focus();
      await act(async () => second.click());
      expect(
        document.getElementById(editor().getAttribute("aria-labelledby")!)
          ?.textContent,
      ).toBe("Draft for unverified");
      expect(editor().open).toBe(true);
      expect(posts()).toHaveLength(2);
      await act(async () =>
        editor().dispatchEvent(new Event("cancel", { cancelable: true })),
      );
      expect(editor()).toBeNull();
      expect(document.activeElement).toBe(second);
      expect(document.body.style.overflow).toBe("auto");
      expect(document.documentElement.style.overflow).toBe("scroll");
      first.focus();
      await draft();
      expect(posts()).toHaveLength(2);
      expect(document.body.style.overflow).toBe("hidden");
      await act(async () => root.render(null));
      expect(editor()).toBeNull();
      expect(document.body.style.overflow).toBe("auto");
      expect(document.documentElement.style.overflow).toBe("scroll");
    } finally {
      await act(async () => root.render(null));
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      if (previousShow)
        Object.defineProperty(prototype, "showModal", previousShow);
      else Reflect.deleteProperty(prototype, "showModal");
      if (previousClose)
        Object.defineProperty(prototype, "close", previousClose);
      else Reflect.deleteProperty(prototype, "close");
    }
  });
  it("opens outside table flow, traps focus and scrolling, and restores the row action on Escape", async () => {
    await mount();
    const trigger = row().querySelector<HTMLButtonElement>(
      ".customer-draft-action",
    )!;
    const count = container.querySelectorAll("tbody tr").length;
    trigger.focus();
    await draft();
    const dialog = editor();
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("Draft for verified");
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(count);
    expect(row().children).toHaveLength(5);
    expect(
      row().querySelector(".customer-draft-action")?.getAttribute("aria-label"),
    ).toBe("Draft message for verified");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    const close = dialog.querySelector<HTMLButtonElement>(
      ".customer-draft-close",
    )!;
    const copy = [...dialog.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes("Copy message"),
    )!;
    expect(copy.closest(".customer-draft-dialog-actions")).not.toBeNull();
    expect(copy.closest(".customer-draft-dialog-scroll")).toBeNull();
    expect(
      dialog
        .querySelector("textarea")
        ?.closest(".customer-draft-dialog-scroll"),
    ).not.toBeNull();
    expect(document.activeElement).toBe(close);
    copy.focus();
    const next = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => copy.dispatchEvent(next));
    expect(next.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    const previous = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => close.dispatchEvent(previous));
    expect(previous.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(copy);
    container
      .querySelector<HTMLInputElement>('[aria-label="Select absent"]')!
      .focus();
    expect(document.activeElement).toBe(close);
    await change(
      dialog.querySelector<HTMLTextAreaElement>("textarea")!,
      "Keep my local edits",
    );
    await act(async () =>
      close.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(editor()).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
    await draft();
    expect(editor().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
      "Keep my local edits",
    );
    expect(posts()).toHaveLength(1);
  });
  it("keeps the row compact and only generates a cited editable AI draft after an explicit click", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });
    await mount();
    expect(posts()).toEqual([]);
    expect(row().querySelector(".customer-search-score")).toBeNull();
    expect(row().querySelector(".customer-compact-reason")).toBeNull();
    expect(row().querySelector("details")).toBeNull();
    expect(container.textContent).not.toContain("Research details");
    expect(row().children).toHaveLength(5);
    await draft();
    expect(posts()).toHaveLength(1);
    expect(posts()[0][0]).toBe(
      "/customers/searches/search_a/accounts/verified/draft",
    );
    expect(JSON.parse(posts()[0][1].body)).toEqual({
      idempotency_key: expect.any(String),
    });
    expect(editor().textContent).toContain("Your AI draft");
    expect(
      editor().querySelector<HTMLInputElement>(".customer-draft-field input")!
        .value,
    ).toBe(original.subject);
    expect(editor().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
      original.body,
    );
    expect(
      editor().querySelector<HTMLAnchorElement>(".customer-draft-sources a")!
        .href,
    ).toBe("https://verified.company.com/");
    expect(clipboard.writeText).not.toHaveBeenCalled();
    await change(
      editor().querySelector<HTMLTextAreaElement>("textarea")!,
      "My edited message",
    );
    await act(async () =>
      [...editor().querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Copy message"))!
        .click(),
    );
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      `Subject: ${original.subject}\n\nMy edited message`,
    );
    expect(editor().textContent).toContain("Message copied to your clipboard.");
    await act(async () =>
      [...editor().querySelectorAll("button")]
        .find((button) => button.textContent === "Reset edits")!
        .click(),
    );
    expect(editor().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
      original.body,
    );
    expect(posts()).toHaveLength(1);
    expect(editor().textContent).not.toContain("Regenerate");
  });
  it("keeps an uncertain attempt's idempotency key on explicit retry and never retries automatically", async () => {
    let attempts = 0;
    api.mockImplementation(async (path: string) => {
      if (path.endsWith("/draft")) {
        if (++attempts === 1)
          throw new Error(
            "The AI service could not be reached. Please try again.",
          );
        return original;
      }
      return path === "/workspace" ? fixtureWorkspace : fixtureRun();
    });
    await mount();
    await draft();
    expect(editor().querySelector('[role="alert"]')?.textContent).toContain(
      "AI service could not be reached",
    );
    expect(posts()).toHaveLength(1);
    await act(async () =>
      [...editor().querySelectorAll("button")]
        .find((button) => button.textContent === "Try draft again")!
        .click(),
    );
    expect(posts()).toHaveLength(2);
    expect(JSON.parse(posts()[0][1].body).idempotency_key).toBe(
      JSON.parse(posts()[1][1].body).idempotency_key,
    );
  });
  it("uses a new key only for an explicit retry after a confirmed terminal failure", async () => {
    let attempts = 0;
    api.mockImplementation(async (path: string) => {
      if (path.endsWith("/draft")) {
        if (++attempts === 1)
          throw Object.assign(new Error("Draft generation did not complete."), {
            code: "DRAFT_FAILED",
          });
        return original;
      }
      return path === "/workspace" ? fixtureWorkspace : fixtureRun();
    });
    await mount();
    await draft();
    expect(editor().textContent).toContain("may use your drafting allowance");
    expect(posts()).toHaveLength(1);
    await act(async () =>
      [...editor().querySelectorAll("button")]
        .find((button) => button.textContent === "Retry AI draft")!
        .click(),
    );
    expect(posts()).toHaveLength(2);
    expect(JSON.parse(posts()[0][1].body).idempotency_key).not.toBe(
      JSON.parse(posts()[1][1].body).idempotency_key,
    );
  });
  it("reports unconfigured drafting clearly and never labels a template as AI", async () => {
    api.mockImplementation(async (path: string) => {
      if (path.endsWith("/draft"))
        throw new Error("AI drafting isn’t connected yet.");
      return path === "/workspace" ? fixtureWorkspace : fixtureRun();
    });
    await mount();
    await draft();
    expect(editor().querySelector('[role="alert"]')?.textContent).toContain(
      "AI drafting isn’t connected yet",
    );
    expect(editor().textContent).not.toContain("Your AI draft");
    api.mockImplementation(async (path: string) =>
      path.endsWith("/draft")
        ? { ...original, generation_engine: "grounded_template" }
        : path === "/workspace"
          ? fixtureWorkspace
          : fixtureRun(),
    );
    await act(async () =>
      [...editor().querySelectorAll("button")]
        .find((button) => button.textContent === "Try draft again")!
        .click(),
    );
    expect(editor().textContent).not.toContain("Your AI draft");
    expect(editor().querySelector("textarea")).toBeNull();
  });
  it("filters weak saved candidates without mutating the stored run or exporting their selected IDs", async () => {
    const run = fixtureRun();
    run.accounts[0].score_breakdown[0].points = 30;
    sessionStorage.setItem(
      "clientrove:customer-results:local-demo:workspace_a:search_a",
      JSON.stringify({ ids: ["absent"], sort: "contacts" }),
    );
    api.mockImplementation(async (path: string) =>
      path === "/workspace" ? fixtureWorkspace : run,
    );
    await mount();
    expect(container.querySelector('tr[aria-label="absent"]')).toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.textContent).toContain("1 candidate left out");
    expect(container.textContent).toContain("Export selected (0)");
    expect(run.accounts).toHaveLength(3);
    expect(posts()).toHaveLength(0);
  });
  it("aborts a pending draft on route/session unmount and ignores its late response", async () => {
    let resolveDraft!: (value: unknown) => void;
    let signal: AbortSignal | undefined;
    api.mockImplementation((path: string, options: RequestInit) => {
      if (path.endsWith("/draft")) {
        signal = options.signal!;
        return new Promise((resolve) => {
          resolveDraft = resolve;
        });
      }
      return Promise.resolve(
        path === "/workspace" ? fixtureWorkspace : fixtureRun(),
      );
    });
    await mount();
    await draft();
    expect(editor().querySelector('[role="status"]')?.textContent).toContain(
      "Writing your draft",
    );
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(signal?.aborted).toBe(true);
    await act(async () => resolveDraft(original));
    expect(container.textContent).toBe("");
    expect(document.querySelector(".customer-draft-dialog")).toBeNull();
    expect(posts()).toHaveLength(1);
  });
});
