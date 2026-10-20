"use client";
import { useEffect } from "react";

// One guard for nested profile/message editors. Deliberately no prospect storage.
const editors = new Set<symbol>();
let removeListeners: (() => void) | undefined;
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const id = Symbol();
    editors.add(id);
    if (!removeListeners) {
      let approvedClick = false;
      const discard = () =>
        window.confirm("Discard unsaved edits and leave this workspace?");
      const unload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
      };
      const navigate = (event: MouseEvent) => {
        const link = (event.target as Element).closest?.("a[href]");
        const href = link?.getAttribute("href");
        if (!href || href.startsWith("#") || href === "/workspace/setup")
          return;
        if (!discard()) {
          event.preventDefault();
          event.stopPropagation();
        } else {
          approvedClick = true;
          // Navigation API fires synchronously for the corresponding link.
          queueMicrotask(() => {
            approvedClick = false;
          });
        }
      };
      const navigation = (window as Window & { navigation?: EventTarget })
        .navigation;
      const traverse = (event: Event) => {
        const change = event as Event & { navigationType?: string };
        if (
          change.navigationType === "traverse" &&
          event.cancelable &&
          !approvedClick &&
          !discard()
        )
          event.preventDefault();
      };
      window.addEventListener("beforeunload", unload);
      document.addEventListener("click", navigate, true);
      navigation?.addEventListener("navigate", traverse);
      removeListeners = () => {
        window.removeEventListener("beforeunload", unload);
        document.removeEventListener("click", navigate, true);
        navigation?.removeEventListener("navigate", traverse);
      };
    }
    return () => {
      editors.delete(id);
      if (!editors.size) {
        removeListeners?.();
        removeListeners = undefined;
      }
    };
  }, [dirty]);
}
