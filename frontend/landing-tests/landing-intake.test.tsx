// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingIntake, BUSINESS_SIGN_UP } from "../components/landing-intake";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
let container: HTMLDivElement;
let root: Root;
function field() {
  return container.querySelector<HTMLInputElement>("#business-website")!;
}
async function fill(value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  push.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<LandingIntake />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("landing website handoff", () => {
  it("rejects invalid websites accessibly without leaving the page or saving an intent", async () => {
    for (const value of [
      "",
      "not a website",
      "javascript:alert(1)",
      "http://127.0.0.1",
      "https://secret@example.com",
    ]) {
      await fill(value);
      await submit();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Enter a public business website",
      );
      expect(field().getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(field());
      expect(sessionStorage.getItem("clientrove:business-intake")).toBeNull();
      expect(push).not.toHaveBeenCalled();
    }
  });
  it("passes a normalized website privately to account creation without running analysis", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await fill("Example.com/pricing?private=1#top");
    await submit();
    expect(
      JSON.parse(sessionStorage.getItem("clientrove:business-intake")!),
    ).toMatchObject({
      website: "https://example.com/pricing",
      createdAt: expect.any(Number),
    });
    expect(push).toHaveBeenCalledExactlyOnceWith(BUSINESS_SIGN_UP);
    expect(push.mock.calls[0][0]).not.toContain("example.com");
    expect(request).not.toHaveBeenCalled();
    expect(field().disabled).toBe(true);
    expect(
      container.querySelector('button[type="submit"]')?.textContent,
    ).toContain("Opening setup");
    await submit();
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("gives manual entry its own intent without requiring a website", async () => {
    await fill("unfinished website text");
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[type="button"]')!
        .click(),
    );
    const saved = JSON.parse(
      sessionStorage.getItem("clientrove:business-intake")!,
    );
    expect(saved.manual).toBe(true);
    expect(saved.website).toBeUndefined();
    expect(push).toHaveBeenCalledExactlyOnceWith(BUSINESS_SIGN_UP);
  });
  it("keeps user input and gives a recoverable error if the browser cannot retain the draft", async () => {
    await fill("example.com");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await submit();
    expect(push).not.toHaveBeenCalled();
    expect(field().value).toBe("example.com");
    expect(field().disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Please try again",
    );
  });
});
