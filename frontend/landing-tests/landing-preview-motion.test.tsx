// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPreviewMotion } from "../components/landing-preview-motion";
let container: HTMLDivElement;
let root: Root;
let callback: IntersectionObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
let observer: IntersectionObserver;

async function intersect(
  target: Element,
  isIntersecting: boolean,
  intersectionRatio = isIntersecting ? 1 : 0,
) {
  await act(async () =>
    callback(
      [
        {
          target,
          isIntersecting,
          intersectionRatio,
        } as IntersectionObserverEntry,
      ],
      observer,
    ),
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  observe.mockReset();
  unobserve.mockReset();
  disconnect.mockReset();
  class MockIntersectionObserver {
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
    constructor(handler: IntersectionObserverCallback) {
      callback = handler;
      observer = this as unknown as IntersectionObserver;
    }
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  container = document.createElement("div");
  container.innerHTML =
    '<section class="sf-preview"><div class="sf-preview-body"><p>Always accessible example content</p></div></section><div id="motion-root"></div>';
  document.body.appendChild(container);
  root = createRoot(container.querySelector("#motion-root")!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("once-only preview entry motion", () => {
  it("leaves content visible offscreen, then activates only on the first preview intersection", async () => {
    await act(async () => root.render(<LandingPreviewMotion />));
    const preview = container.querySelector<HTMLElement>(".sf-preview")!;
    const content = preview.querySelector(".sf-preview-body")!;
    expect(observe).toHaveBeenCalledExactlyOnceWith(content);
    expect(preview.dataset.motionEntered).toBeUndefined();
    expect(preview.textContent).toBe("Always accessible example content");
    expect(preview.hasAttribute("hidden")).toBe(false);
    await intersect(content, false);
    expect(preview.dataset.motionEntered).toBeUndefined();
    await intersect(container, true);
    expect(preview.dataset.motionEntered).toBeUndefined();
    await intersect(content, true, 0.01);
    expect(preview.dataset.motionEntered).toBeUndefined();
    await intersect(content, true, 0.15);
    expect(preview.dataset.motionEntered).toBe("true");
    expect(unobserve).toHaveBeenCalledExactlyOnceWith(content);
    expect(disconnect).toHaveBeenCalledTimes(1);
    await intersect(content, false);
    await intersect(content, true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(unobserve).toHaveBeenCalledTimes(1);
  });
  it("disconnects when unmounted before entry and never replays an already-entered preview", async () => {
    await act(async () => root.render(<LandingPreviewMotion />));
    await act(async () => root.render(null));
    expect(disconnect).toHaveBeenCalledTimes(1);
    const preview = container.querySelector<HTMLElement>(".sf-preview")!;
    await intersect(preview.querySelector(".sf-preview-body")!, true);
    expect(preview.dataset.motionEntered).toBeUndefined();
    preview.dataset.motionEntered = "true";
    await act(async () => root.render(<LandingPreviewMotion />));
    expect(observe).toHaveBeenCalledTimes(1);
    expect(unobserve).not.toHaveBeenCalled();
  });
  it("keeps the static content available when the observer API is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    await act(async () => root.render(<LandingPreviewMotion />));
    const preview = container.querySelector<HTMLElement>(".sf-preview")!;
    expect(preview.dataset.motionEntered).toBeUndefined();
    expect(preview.textContent).toBe("Always accessible example content");
    expect(observe).not.toHaveBeenCalled();
  });
  it("reveals the marketing journey once without hiding server-rendered stages", async () => {
    const preview = container.querySelector<HTMLElement>(".sf-preview")!;
    preview.className = "sf-story";
    const content = preview.querySelector<HTMLElement>(".sf-preview-body")!;
    content.className = "sf-story-stages";
    await act(async () => root.render(<LandingPreviewMotion />));
    expect(observe).toHaveBeenCalledExactlyOnceWith(content);
    expect(preview.textContent).toBe("Always accessible example content");
    expect(preview.hasAttribute("hidden")).toBe(false);
    await intersect(content, true, 0.15);
    expect(preview.dataset.motionEntered).toBe("true");
    await intersect(content, true);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
