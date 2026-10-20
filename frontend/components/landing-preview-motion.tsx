"use client";

import { useEffect } from "react";

/** Content stays visible without JavaScript; entering view adds one finite reveal. */
export function LandingPreviewMotion() {
  useEffect(() => {
    const preview = document.querySelector<HTMLElement>(".sf-preview");
    if (
      !preview ||
      preview.dataset.motionEntered === "true" ||
      typeof IntersectionObserver === "undefined"
    )
      return;

    const content = preview.querySelector(".sf-preview-body") || preview;
    let entered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entered ||
          !entries.some(
            (entry) =>
              entry.target === content &&
              entry.isIntersecting &&
              entry.intersectionRatio >= 0.15,
          )
        )
          return;
        entered = true;
        preview.dataset.motionEntered = "true";
        observer.unobserve(content);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(content);
    return () => {
      entered = true;
      observer.disconnect();
    };
  }, []);
  return null;
}
