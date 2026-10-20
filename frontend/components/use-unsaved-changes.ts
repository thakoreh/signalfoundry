"use client";
import { useEffect } from "react";

/** Deliberately memory-only: no prospect text in storage or across sessions. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      const href = link?.getAttribute("href");
      if (!href || href.startsWith("#") || href === "/workspace/setup") return;
      if (!window.confirm("Discard unsaved edits and leave this workspace?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
}
