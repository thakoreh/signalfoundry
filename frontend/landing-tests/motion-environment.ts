import { vi } from "vitest";

/** Deterministic browser signals for carousel tests; no layout engine is faked. */
export function installMotionEnvironment({ reducedMotion = false } = {}) {
  let reduced = reducedMotion;
  let visibility: DocumentVisibilityState = "visible";
  const mediaEvents = new EventTarget();
  const media = {
    get matches() {
      return reduced;
    },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
    removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
    dispatchEvent: mediaEvents.dispatchEvent.bind(mediaEvents),
  } as MediaQueryList;

  const observers: MotionIntersectionObserver[] = [];
  class MotionIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0, 0.35, 1];
    readonly targets = new Set<Element>();
    constructor(private readonly callback: IntersectionObserverCallback) {
      observers.push(this);
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    emit(target: Element, ratio: number) {
      if (!this.targets.has(target)) return;
      this.callback(
        [
          {
            target,
            intersectionRatio: ratio,
            isIntersecting: ratio > 0,
            time: 0,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
          },
        ],
        this,
      );
    }
  }

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  vi.stubGlobal("IntersectionObserver", MotionIntersectionObserver);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
  vi.spyOn(document, "hidden", "get").mockImplementation(
    () => visibility === "hidden",
  );

  return {
    setReducedMotion(value: boolean) {
      reduced = value;
      mediaEvents.dispatchEvent(
        Object.assign(new Event("change"), {
          matches: reduced,
          media: media.media,
        }),
      );
    },
    setVisibility(value: DocumentVisibilityState) {
      visibility = value;
      document.dispatchEvent(new Event("visibilitychange"));
    },
    intersect(target: Element, ratio = 1) {
      for (const observer of observers) observer.emit(target, ratio);
    },
  };
}
