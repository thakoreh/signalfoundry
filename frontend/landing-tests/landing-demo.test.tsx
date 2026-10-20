// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingDemo from "../components/landing-demo";
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("complete product example", () => {
  it("keeps every stage and result accessible without autoplay or interaction gates", async () => {
    vi.useFakeTimers();
    await act(async () => root.render(<LandingDemo />));
    const preview = container.querySelector(".sf-preview")!;
    expect(preview.getAttribute("aria-labelledby")).toBe("preview-title");
    expect(container.querySelectorAll("ol > li")).toHaveLength(4);
    for (const label of ["Discover", "Review", "Conversations", "Meetings"])
      expect(preview.textContent).toContain(label);
    expect(container.querySelectorAll("th[scope=col]")).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.querySelector("caption")?.textContent).toContain(
      "not live results",
    );
    const before = preview.innerHTML;
    await act(async () => vi.advanceTimersByTime(60000));
    expect(preview.innerHTML).toBe(before);
    expect(container.querySelector('button, [role="tab"], [inert]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cannot submit example data, create contacts, persist state or download a pretend export", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await act(async () => root.render(<LandingDemo />));
    expect(
      container.querySelector("form, input, button, a[download], a[href]"),
    ).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(container.textContent).toContain("yourbusiness.example");
    expect(container.textContent).toContain("Unverified");
    expect(container.textContent).toContain(
      "The example businesses and email are fictional",
    );
    expect(container.textContent).toContain(
      "Illustrative layout, not live results",
    );
    expect(
      [...container.querySelectorAll(".sf-demo-email")]
        .map((element) => element.textContent)
        .filter((value) => value?.includes("@")),
    ).toEqual(["hello@studio.example"]);
    expect(container.textContent).toContain("Nothing is sent here.");
    expect(
      container.querySelector("details[open] summary")?.textContent,
    ).toContain("Review your introduction");
    expect(container.textContent).not.toContain("Why it fits");
    expect(container.querySelectorAll("td[data-label]")).toHaveLength(6);
    expect(container.textContent).toContain(
      "Fictional progress · entered by the user",
    );
    expect(container.textContent).toContain(
      "Interested reply · added manually",
    );
    expect(container.textContent).toContain("Booked · reported by the user");
    expect(container.textContent).toContain(
      "There is no inbox or calendar connection.",
    );
  });
});
