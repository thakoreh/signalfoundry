// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useUnsavedChanges } from "../components/use-unsaved-changes";
function Editor({ dirty = true }: { dirty?: boolean }) {
  useUnsavedChanges(dirty);
  return null;
}
it("asks once for nested dirty editors and cancels leave unless discard is chosen", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const link = document.createElement("a");
  link.href = "/workspace/customers";
  document.body.append(link);
  try {
    await act(async () =>
      root.render(
        <>
          <Editor />
          <Editor />
        </>,
      ),
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockClear();
    confirm.mockReturnValue(true);
    // Prevent jsdom's default navigation after observing our handler.
    link.addEventListener("click", (e) => e.preventDefault(), { once: true });
    link.click();
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    confirm.mockClear();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  } finally {
    host.remove();
    link.remove();
    confirm.mockRestore();
    vi.unstubAllGlobals();
  }
});
it("guards browser traversal through Chrome navigation and removes guards after save", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const navigation = new EventTarget();
  vi.stubGlobal("navigation", navigation);
  const host = document.createElement("div");
  const root = createRoot(host);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => root.render(<Editor />));
    const back = new Event("navigate", { cancelable: true });
    Object.assign(back, {
      navigationType: "traverse",
      destination: { url: "http://localhost/previous" },
    });
    navigation.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => root.render(<Editor dirty={false} />));
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await act(async () => root.unmount());
  } finally {
    confirm.mockRestore();
    vi.unstubAllGlobals();
  }
});
