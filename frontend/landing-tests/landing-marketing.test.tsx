// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingMarketing } from "../components/landing-marketing";
import { installMotionEnvironment } from "./motion-environment";

let container: HTMLDivElement;
let root: Root;
let motion: ReturnType<typeof installMotionEnvironment>;
async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector)!;
  await act(async () => button.click());
  return button;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  motion = installMotionEnvironment();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<LandingMarketing />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("illustrated marketing journey", () => {
  it("keeps every selling step readable and labels examples without a dashboard", () => {
    expect(container.querySelectorAll(".sf-tour-story li")).toHaveLength(3);
    expect(container.querySelectorAll(".sf-tour-copy")).toHaveLength(3);
    for (const copy of container.querySelectorAll(".sf-tour-copy")) {
      expect(copy.textContent!.length).toBeGreaterThan(70);
      expect(copy.closest("[hidden], [aria-hidden='true']")).toBeNull();
    }
    expect(container.textContent).toContain(
      "Illustrative workflow · not live results",
    );
    expect(container.textContent).toContain("send using your own email tool");
    expect(container.textContent).toContain(
      "A connected inbox and automatic sending are not available",
    );
    expect(
      container.querySelector("table, form, input, .sf-demo-draft"),
    ).toBeNull();
    expect(container.querySelector("[role='status']")!.textContent).toBe("");
  });
  it("cycles original illustrated scenes with explicit controls and announces only user navigation", async () => {
    const next = await click('[aria-label="Next journey illustration"]');
    expect(container.querySelector(".sf-illustration-message")).not.toBeNull();
    expect(
      container.querySelector('[aria-pressed="true"]')!.textContent,
    ).toContain("Make the first message personal");
    expect(container.querySelector("[role='status']")!.textContent).toContain(
      "Illustration 2 of 3",
    );
    await act(async () => next.click());
    expect(
      container.querySelector(".sf-illustration-conversation"),
    ).not.toBeNull();
    await act(async () => next.click());
    expect(container.querySelector(".sf-illustration-buyers")).not.toBeNull();
    await click('[aria-label="Previous journey illustration"]');
    expect(
      container.querySelector(".sf-illustration-conversation"),
    ).not.toBeNull();
    await click(".sf-tour-story li:first-child button");
    expect(container.querySelector(".sf-illustration-buyers")).not.toBeNull();
  });
  it("pauses all scene motion through the shared control and suspends it on hidden pages", async () => {
    const motionRoot = container.querySelector<HTMLElement>(".sf-motion-root")!;
    expect(motionRoot.dataset.motionPaused).toBe("false");
    await click('[aria-label="Pause page motion"]');
    expect(motionRoot.dataset.motionPaused).toBe("true");
    expect(
      container.querySelector('[aria-label="Resume page motion"]'),
    ).not.toBeNull();
    await act(async () => motion.setVisibility("hidden"));
    expect(motionRoot.dataset.motionSuspended).toBe("true");
    await act(async () => motion.setVisibility("visible"));
    expect(motionRoot.dataset.motionSuspended).toBe("false");
    expect(motionRoot.dataset.motionPaused).toBe("true");
    await click('[aria-label="Resume page motion"]');
    expect(motionRoot.dataset.motionPaused).toBe("false");
  });
  it("respects system reduced motion while keeping manual scene controls available", async () => {
    await act(async () => motion.setReducedMotion(true));
    expect(
      container.querySelector<HTMLElement>(".sf-motion-root")!.dataset
        .motionReduced,
    ).toBe("true");
    const toggle = container.querySelector<HTMLButtonElement>(
      '[aria-label="Motion reduced by system preference"]',
    )!;
    expect(toggle.disabled).toBe(true);
    await click('[aria-label="Next journey illustration"]');
    expect(container.querySelector(".sf-illustration-message")).not.toBeNull();
    expect(container.querySelectorAll(".sf-tour-copy")).toHaveLength(3);
  });
});
