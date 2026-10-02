// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingDemo from "../components/landing-demo";
import {
  LandingMotionProvider,
  MotionToggle,
} from "../components/landing-motion-provider";
import { installMotionEnvironment } from "./motion-environment";

let container: HTMLDivElement;
let root: Root;
let environment: ReturnType<typeof installMotionEnvironment>;

const carousel = () => container.querySelector<HTMLElement>(".sf-demo")!;
const viewport = () =>
  container.querySelector<HTMLElement>(".sf-demo-viewport")!;
const play = () => container.querySelector<HTMLButtonElement>(".sf-demo-play")!;
const motion = () =>
  container.querySelector<HTMLButtonElement>(".sf-motion-toggle")!;
const next = () =>
  container.querySelector<HTMLButtonElement>(
    '[aria-label="Next research step"]',
  )!;
const active = () => Number(carousel().getAttribute("data-active-step"));
const running = () => carousel().getAttribute("data-playing") === "true";
const step = (index: number) =>
  container.querySelector<HTMLButtonElement>(`#research-tab-${index}`)!;

async function render() {
  await act(async () =>
    root.render(
      <LandingMotionProvider>
        <MotionToggle />
        <LandingDemo />
      </LandingMotionProvider>,
    ),
  );
}
async function advance(milliseconds = 7000) {
  await act(async () => vi.advanceTimersByTime(milliseconds));
}
async function click(target: HTMLElement) {
  await act(async () => target.click());
}
async function intersect(ratio = 1) {
  await act(async () => environment.intersect(carousel(), ratio));
}
async function visibility(value: DocumentVisibilityState) {
  await act(async () => environment.setVisibility(value));
}
async function pointer(
  target: HTMLElement,
  type: string,
  x = 100,
  y = 100,
  options: {
    pointerType?: string;
    pointerId?: number;
    isPrimary?: boolean;
    button?: number;
  } = {},
) {
  const event = Object.assign(
    new MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: options.button ?? 0,
    }),
    {
      pointerType: options.pointerType ?? "touch",
      pointerId: options.pointerId ?? 1,
      isPrimary: options.isPrimary ?? true,
    },
  );
  await act(async () => target.dispatchEvent(event));
}
async function swipe(fromX: number, toX: number) {
  await pointer(viewport(), "pointerdown", fromX);
  await pointer(viewport(), "pointerup", toX);
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  environment = installMotionEnvironment();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("safe carousel playback", () => {
  it("advances at seven seconds only after the 35% visibility threshold and wraps", async () => {
    expect(active()).toBe(0);
    expect(running()).toBe(false);
    await intersect(0.34);
    await advance(14000);
    expect(active()).toBe(0);
    await intersect(0.35);
    expect(running()).toBe(true);
    await advance(6999);
    expect(active()).toBe(0);
    await advance(1);
    expect(active()).toBe(1);
    for (const index of [2, 3, 0]) {
      await advance();
      expect(active()).toBe(index);
    }
  });

  it("pauses mouse hover and restarts a full interval after leaving", async () => {
    await intersect();
    await advance(3500);
    await pointer(carousel(), "pointerover", 100, 100, {
      pointerType: "mouse",
    });
    expect(running()).toBe(false);
    await advance(20000);
    expect(active()).toBe(0);
    await pointer(carousel(), "pointerout", 100, 100, { pointerType: "mouse" });
    expect(running()).toBe(true);
    await advance(6999);
    expect(active()).toBe(0);
    await advance(1);
    expect(active()).toBe(1);
  });

  it("does not treat touch entry as hover", async () => {
    await intersect();
    await pointer(carousel(), "pointerover");
    expect(running()).toBe(true);
    await advance();
    expect(active()).toBe(1);
  });

  it("cancels pending advancement offscreen and while the document is hidden", async () => {
    await intersect();
    await advance(6000);
    await intersect(0);
    await advance(14000);
    expect(active()).toBe(0);
    await intersect();
    await advance(6999);
    expect(active()).toBe(0);
    await visibility("hidden");
    expect(running()).toBe(false);
    await advance(14000);
    expect(active()).toBe(0);
    await visibility("visible");
    await advance();
    expect(active()).toBe(1);
  });

  it("stops when focus enters and stays stopped after blur until explicit Play", async () => {
    await intersect();
    await act(async () => step(0).focus());
    expect(running()).toBe(false);
    await act(async () => step(0).blur());
    await advance(14000);
    expect(active()).toBe(0);
    await act(async () => play().focus());
    await click(play());
    expect(running()).toBe(true);
    await advance();
    expect(active()).toBe(1);
  });

  it("stops on playback-control focus and preserves pointer intent across focus and two clicks", async () => {
    await intersect();
    await act(async () => play().focus());
    expect(running()).toBe(false);
    expect(play().getAttribute("aria-label")).toBe("Play walkthrough");
    await click(play());
    expect(running()).toBe(true);
    await act(async () => play().blur());
    for (const expected of [false, true]) {
      await pointer(play(), "pointerdown", 100, 100, { pointerType: "mouse" });
      await act(async () => play().focus());
      await pointer(play(), "pointerup", 100, 100, { pointerType: "mouse" });
      await click(play());
      expect(running()).toBe(expected);
    }
  });

  it("clears abandoned playback pointer intent before keyboard activation", async () => {
    await intersect();
    await pointer(play(), "pointerdown", 100, 100, { pointerType: "mouse" });
    await act(async () => play().focus());
    await act(async () => play().blur());
    await act(async () => play().focus());
    await act(async () =>
      play().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    await click(play());
    expect(running()).toBe(true);
  });

  it("stops before a held gesture can advance, including after pointer cancellation", async () => {
    await intersect();
    await advance(6500);
    await pointer(viewport(), "pointerdown", 200);
    expect(running()).toBe(false);
    await advance(14000);
    expect(active()).toBe(0);
    await pointer(viewport(), "pointercancel");
    await pointer(viewport(), "pointerup", 100);
    await advance(14000);
    expect(active()).toBe(0);
    expect(running()).toBe(false);
  });

  it("stops on manual navigation and honors an explicit pause across visibility changes", async () => {
    await intersect();
    await click(next());
    expect(active()).toBe(1);
    expect(running()).toBe(false);
    await advance(14000);
    expect(active()).toBe(1);
    await click(play());
    expect(running()).toBe(true);
    await click(play());
    expect(running()).toBe(false);
    await intersect(0);
    await visibility("hidden");
    await visibility("visible");
    await intersect();
    await advance(14000);
    expect(active()).toBe(1);
    expect(play().getAttribute("aria-label")).toBe("Play walkthrough");
  });

  it("global motion pause disables playback and preserves a manually stopped carousel", async () => {
    await intersect();
    await click(motion());
    expect(running()).toBe(false);
    expect(play().disabled).toBe(true);
    expect(play().title).toContain("Resume page motion");
    await advance(14000);
    expect(active()).toBe(0);
    await click(motion());
    expect(play().disabled).toBe(false);
    await advance();
    expect(active()).toBe(1);
    await click(next());
    await click(motion());
    await click(motion());
    await advance(14000);
    expect(active()).toBe(2);
    expect(running()).toBe(false);
  });

  it("starts static under reduced motion and never allows Play to override it", async () => {
    await act(async () => root.unmount());
    environment.setReducedMotion(true);
    root = createRoot(container);
    await render();
    await intersect();
    expect(play().disabled).toBe(true);
    expect(play().title).toContain("reduced motion");
    expect(motion().disabled).toBe(true);
    await click(play());
    await advance(14000);
    expect(active()).toBe(0);
    expect(running()).toBe(false);
    await click(next());
    expect(active()).toBe(1);
  });

  it("reacts immediately when the OS enables reduced motion during playback", async () => {
    await intersect();
    await advance(6000);
    await act(async () => environment.setReducedMotion(true));
    expect(running()).toBe(false);
    expect(play().disabled).toBe(true);
    await advance(14000);
    expect(active()).toBe(0);
  });

  it("accepts horizontal swipes, wraps, and permanently stops autoplay", async () => {
    await intersect();
    await swipe(200, 100);
    expect(active()).toBe(1);
    expect(running()).toBe(false);
    await swipe(100, 200);
    expect(active()).toBe(0);
    await swipe(100, 200);
    expect(active()).toBe(3);
    await advance(14000);
    expect(active()).toBe(3);
  });

  it("ignores short, vertical, cancelled, secondary, and interactive-target gestures", async () => {
    await swipe(120, 100);
    await pointer(viewport(), "pointerdown", 200, 100);
    await pointer(viewport(), "pointerup", 100, 250);
    await pointer(viewport(), "pointerdown", 200);
    await pointer(viewport(), "pointercancel");
    await pointer(viewport(), "pointerup", 100);
    await pointer(viewport(), "pointerdown", 200, 100, { isPrimary: false });
    await pointer(viewport(), "pointerup", 100);
    await pointer(viewport(), "pointerdown", 200, 100, { button: 2 });
    await pointer(viewport(), "pointerup", 100);
    await pointer(viewport(), "pointerdown", 200, 100, { pointerId: 7 });
    await pointer(viewport(), "pointerup", 100, 100, { pointerId: 8 });
    expect(active()).toBe(0);
    await click(step(2));
    const link = container.querySelector<HTMLAnchorElement>(
      "#research-panel-2 a",
    )!;
    await pointer(link, "pointerdown", 200);
    await pointer(link, "pointerup", 100);
    expect(active()).toBe(2);
  });

  it("keeps decisions through auto rotation without requests or persistence and cleans up its timer", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await click(step(3));
    const decision =
      container.querySelector<HTMLButtonElement>(".sf-demo-shortlist")!;
    await click(decision);
    await intersect();
    await click(play());
    for (let count = 0; count < 4; count++) await advance();
    expect(active()).toBe(3);
    expect(decision.getAttribute("aria-pressed")).toBe("true");
    expect(fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(container);
  });
});
