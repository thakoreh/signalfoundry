"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const preference = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(preference);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

const MotionContext = createContext({
  paused: false,
  reduced: true,
  pageVisible: true,
  motionAllowed: false,
  togglePause: () => {},
});

export function useLandingMotion() {
  return useContext(MotionContext);
}

export function LandingMotionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(preference).matches,
    () => true,
  );
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
  return (
    <MotionContext.Provider
      value={{
        paused,
        reduced,
        pageVisible,
        motionAllowed: !paused && !reduced && pageVisible,
        togglePause: () => setPaused((value) => !value),
      }}
    >
      <div
        className="sf-motion-root"
        data-motion-paused={paused || !pageVisible}
        data-motion-reduced={reduced}
      >
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export function MotionToggle() {
  const { paused, reduced, togglePause } = useLandingMotion();
  return (
    <button
      className="sf-motion-toggle"
      type="button"
      onClick={togglePause}
      disabled={reduced}
      aria-label={
        reduced
          ? "Motion reduced by system preference"
          : paused
            ? "Resume page motion"
            : "Pause page motion"
      }
    >
      <span aria-hidden="true">{reduced || paused ? "▷" : "Ⅱ"}</span>
      {reduced ? "Reduced motion" : paused ? "Resume motion" : "Pause motion"}
    </button>
  );
}
