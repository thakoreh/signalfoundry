// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingDemo from "../components/landing-demo";

const STAGES = [
  "Define the ICP",
  "Import accounts",
  "Review evidence",
  "Shortlist or export",
];

let container: HTMLDivElement;
let root: Root;

function tabs() {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
}

function panels() {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
  );
}

function button(label: string) {
  const result = container.querySelector<HTMLButtonElement>(
    `[aria-label="${label}"]`,
  );
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

function shortlistButton() {
  const result = container.querySelector<HTMLButtonElement>(
    "button[aria-pressed]",
  );
  if (!result) throw new Error("Missing sample shortlist control");
  return result;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function pressKey(element: HTMLElement, key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => element.dispatchEvent(event));
  return event;
}

function expectStage(index: number) {
  const allTabs = tabs();
  const allPanels = panels();
  expect(allTabs).toHaveLength(4);
  expect(allPanels).toHaveLength(4);
  expect(
    allTabs.filter((tab) => tab.getAttribute("aria-selected") === "true"),
  ).toEqual([allTabs[index]]);
  expect(allTabs.filter((tab) => tab.tabIndex === 0)).toEqual([allTabs[index]]);
  expect(allPanels.filter((panel) => !panel.hidden)).toEqual([
    allPanels[index],
  ]);
  allTabs.forEach((tab, tabIndex) => {
    expect(tab.textContent).toContain(STAGES[tabIndex]);
    expect(tab.getAttribute("aria-controls")).toBe(allPanels[tabIndex].id);
    expect(allPanels[tabIndex].getAttribute("aria-labelledby")).toBe(tab.id);
    expect(tab.tabIndex).toBe(tabIndex === index ? 0 : -1);
  });
  expect(button("Previous research step").disabled).toBe(index === 0);
  expect(button("Next research step").disabled).toBe(index === 3);
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<LandingDemo />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("interactive sample research walkthrough", () => {
  it("starts with one visible panel and connected, roving-focus tabs", () => {
    expect(
      container.querySelector('[role="tablist"]')?.getAttribute("aria-label"),
    ).toBe("Research walkthrough");
    expectStage(0);
    expect(panels()[0].textContent).toContain("Ideal customer profile");
    expect(container.textContent).toContain("Illustrative example");
    expect(container.textContent).toContain(
      "No accounts are imported, researched, saved, or exported here.",
    );
  });

  it("includes each compact visible label in the accessible tab name", () => {
    for (const tab of tabs()) {
      const compactLabel = tab
        .querySelector(".sf-tab-short")
        ?.textContent?.trim();
      expect(compactLabel).toBeTruthy();
      const accessibleCopy = tab.cloneNode(true) as HTMLElement;
      accessibleCopy
        .querySelectorAll('[aria-hidden="true"]')
        .forEach((element) => element.remove());
      const accessibleName =
        tab.getAttribute("aria-label") ?? accessibleCopy.textContent ?? "";
      expect(accessibleName.toLowerCase()).toContain(
        compactLabel!.toLowerCase(),
      );
    }
  });

  it("supports direct stage selection in any order, including repeated clicks", async () => {
    for (const index of [2, 0, 3, 1, 1, 2, 3, 0]) {
      await click(tabs()[index]);
      expectStage(index);
    }
  });

  it("moves and wraps keyboard focus with arrows, Home, and End", async () => {
    tabs()[0].focus();
    for (const [key, destination] of [
      ["ArrowLeft", 3],
      ["ArrowRight", 0],
      ["ArrowRight", 1],
      ["End", 3],
      ["Home", 0],
    ] as const) {
      const event = await pressKey(document.activeElement as HTMLElement, key);
      expect(event.defaultPrevented).toBe(true);
      expectStage(destination);
      expect(document.activeElement).toBe(tabs()[destination]);
    }

    const unrelated = await pressKey(tabs()[0], "Tab");
    expect(unrelated.defaultPrevented).toBe(false);
    expectStage(0);
  });

  it("moves forward and backward without crossing either endpoint", async () => {
    await click(button("Previous research step"));
    expectStage(0);
    for (const index of [1, 2, 3]) {
      await click(button("Next research step"));
      expectStage(index);
    }
    await click(button("Next research step"));
    expectStage(3);
    for (const index of [2, 1, 0]) {
      await click(button("Previous research step"));
      expectStage(index);
    }
    await click(button("Previous research step"));
    expectStage(0);
  });

  it("reverses the sample decision and retains it when changing stages", async () => {
    await click(tabs()[3]);
    expect(shortlistButton().getAttribute("aria-pressed")).toBe("false");
    expect(shortlistButton().textContent).toContain("Shortlist this example");

    await click(shortlistButton());
    expect(shortlistButton().getAttribute("aria-pressed")).toBe("true");
    expect(shortlistButton().textContent).toContain(
      "Remove from sample shortlist",
    );
    expect(
      panels()[3].querySelector('[aria-live="polite"]')?.textContent,
    ).toContain(
      "1 sample account shortlisted. Nothing is saved to a workspace.",
    );

    await click(button("Previous research step"));
    expectStage(2);
    await click(tabs()[0]);
    await click(tabs()[3]);
    expectStage(3);
    expect(shortlistButton().getAttribute("aria-pressed")).toBe("true");
    await click(shortlistButton());
    expect(shortlistButton().getAttribute("aria-pressed")).toBe("false");
    expect(
      panels()[3].querySelector('[aria-live="polite"]')?.textContent,
    ).toContain("This example never saves real accounts.");

    await click(shortlistButton());
    await click(shortlistButton());
    expect(shortlistButton().getAttribute("aria-pressed")).toBe("false");
  });

  it("performs the entire sample flow without requests, persistence, or downloads", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    const storage = vi.spyOn(Storage.prototype, "setItem");

    // Re-render from a fresh mount so the assertions also cover initialization.
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<LandingDemo />));
    for (const index of [1, 2, 3]) {
      await click(tabs()[index]);
    }
    await click(shortlistButton());
    await click(shortlistButton());
    await click(tabs()[0]);
    await click(tabs()[3]);

    expect(fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(
      container.querySelector("form, input[type=file], a[download]"),
    ).toBeNull();
    const source = panels()[2].querySelector<HTMLAnchorElement>("a");
    expect(source?.href).toBe("https://www.lowcode.agency/");
    expect(source?.target).toBe("_blank");
    expect(source?.rel).toMatch(/noreferrer|noopener/);
    expect(source?.textContent).toContain("opens in a new tab");
  });
});
