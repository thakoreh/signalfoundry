"use client";

import { useEffect, useRef, useState } from "react";

export default function LandingMotion() {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuOpenRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const toggle = toggleRef.current;
    const root = toggle?.closest<HTMLElement>(".sf-landing");
    if (!root) return;

    root.dataset.jsReady = "true";
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;

    const revealAll = () => {
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        element.classList.add("is-visible");
      });
    };

    const setupReveal = () => {
      root.dataset.motionReady = "true";
      root.dataset.motionReduced = String(media.matches);
      if (media.matches || typeof IntersectionObserver === "undefined") {
        revealAll();
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const element = entry.target as HTMLElement;
            element.classList.add("is-visible");
            observer?.unobserve(element);
          });
        },
        { rootMargin: "0px 0px -10%", threshold: 0.12 },
      );

      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        observer?.observe(element);
      });
    };

    const closeMenu = () => {
      menuOpenRef.current = false;
      setMenuOpen(false);
    };
    const onMotionPreferenceChange = () => {
      root.dataset.motionReduced = String(media.matches);
      if (media.matches) revealAll();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menuOpenRef.current) return;
      closeMenu();
      toggle?.focus();
    };

    setupReveal();
    media.addEventListener("change", onMotionPreferenceChange);
    document.addEventListener("keydown", onKeyDown);

    const navLinks = root.querySelectorAll<HTMLAnchorElement>("#sf-mobile-menu a");
    navLinks.forEach((link) => link.addEventListener("click", closeMenu));

    return () => {
      observer?.disconnect();
      media.removeEventListener("change", onMotionPreferenceChange);
      document.removeEventListener("keydown", onKeyDown);
      navLinks.forEach((link) => link.removeEventListener("click", closeMenu));
    };
  }, []);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
    const root = toggleRef.current?.closest<HTMLElement>(".sf-landing");
    if (root) root.dataset.menuOpen = String(menuOpen);
  }, [menuOpen]);

  return (
    <button
      ref={toggleRef}
      className="sf-mobile-toggle"
      type="button"
      aria-controls="sf-mobile-menu"
      aria-expanded={menuOpen}
      aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
      onClick={() => setMenuOpen((open) => !open)}
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </button>
  );
}
