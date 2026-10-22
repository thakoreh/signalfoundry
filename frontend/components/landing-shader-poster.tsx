"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLandingMotion } from "./landing-motion-provider";
import {
  mountGrain,
  mountFlowPoster,
  type VisualController,
} from "../lib/landing-shaders";
import "./landing-shader-poster.css";

const desktopPointer =
  "(hover: hover) and (pointer: fine) and (min-width: 900px)";
function subscribePointer(notify: () => void) {
  const media = window.matchMedia(desktopPointer);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

export function LandingShaderPoster() {
  const { paused, reduced, motionAllowed, togglePause } = useLandingMotion();
  const finePointer = useSyncExternalStore(
    subscribePointer,
    () => window.matchMedia(desktopPointer).matches,
    () => false,
  );
  const [inView, setInView] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const grainHost = useRef<HTMLDivElement>(null);
  const flowHost = useRef<HTMLDivElement>(null);
  const grain = useRef<VisualController | null>(null);
  const flow = useRef<VisualController | null>(null);
  const active = motionAllowed && inView && finePointer;
  const activeRef = useRef(active);
  useLayoutEffect(() => {
    activeRef.current = active;
    grain.current?.setActive(active);
    flow.current?.setActive(active);
  }, [active]);
  useEffect(() => {
    const target = figure.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const host = grainHost.current;
    if (!host || typeof WebGL2RenderingContext === "undefined") return;
    const scope = new AbortController();
    let controller: VisualController | null = null;
    mountGrain(host, scope.signal)
      .then((value) => {
        if (scope.signal.aborted) {
          value?.dispose();
          return;
        }
        controller = value;
        grain.current = value;
        value?.setActive(activeRef.current);
      })
      .catch(() => {
        host.dataset.shaderState = "static";
      });
    return () => {
      scope.abort();
      controller?.dispose();
      grain.current = null;
    };
  }, []);
  useEffect(() => {
    const host = flowHost.current;
    if (
      !host ||
      !finePointer ||
      reduced ||
      typeof WebGL2RenderingContext === "undefined"
    )
      return;
    const scope = new AbortController();
    let controller: VisualController | null = null;
    mountFlowPoster(host, scope.signal)
      .then((value) => {
        if (scope.signal.aborted) {
          value?.dispose();
          return;
        }
        controller = value;
        flow.current = value;
        value?.setActive(activeRef.current);
      })
      .catch(() => {
        host.dataset.flowState = "static";
      });
    return () => {
      scope.abort();
      controller?.dispose();
      flow.current = null;
    };
  }, [finePointer, reduced]);
  return (
    <figure
      ref={figure}
      className="sf-shader-poster"
      aria-label="From less searching to a personal introduction"
      data-visual-active={active}
    >
      <div ref={grainHost} className="sf-grain-surface" aria-hidden="true" />
      <div className="sf-poster-topline">
        <span>Clientrove / The first move</span>
        <span>01—03</span>
      </div>
      <div className="sf-poster-art" ref={flowHost} aria-hidden="true">
        <div className="sf-poster-type">
          <span>LESS</span>
          <span>SEARCH.</span>
          <span>MORE</span>
          <span>HELLO.</span>
        </div>
      </div>
      <figcaption>
        <p>
          Your website. The right businesses.
          <br />A message worth starting with.
        </p>
        <span>AI drafts. You review. You send.</span>
      </figcaption>
      <div className="sf-poster-controls">
        <span>
          {reduced
            ? "A quieter view, by preference"
            : "Move across the poster to explore"}
        </span>
        <button
          type="button"
          onClick={togglePause}
          disabled={reduced}
          aria-label={
            reduced
              ? "Visual effects reduced by system preference"
              : paused
                ? "Resume visual effects"
                : "Pause visual effects"
          }
        >
          {reduced
            ? "Motion reduced"
            : paused
              ? "Resume motion"
              : "Pause motion"}
        </button>
      </div>
    </figure>
  );
}
