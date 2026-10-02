import { describe, expect, it } from "vitest";
import { drawerFocusBoundaryTarget } from "../lib/utils";

type FocusStub = HTMLElement & { focus: () => void };

function focusStub(id: string): FocusStub {
  return { id, focus: () => undefined } as FocusStub;
}

describe("account drawer keyboard access", () => {
  it("wraps forward Tab from the last control to the first", () => {
    const first = focusStub("first");
    const last = focusStub("last");

    expect(drawerFocusBoundaryTarget([first, last], last, false)).toBe(first);
  });

  it("wraps reverse Tab from the first control to the last", () => {
    const first = focusStub("first");
    const last = focusStub("last");

    expect(drawerFocusBoundaryTarget([first, last], first, true)).toBe(last);
  });

  it("keeps focus recoverable when focus is outside the drawer", () => {
    const first = focusStub("first");
    const last = focusStub("last");
    const outside = focusStub("outside");

    expect(drawerFocusBoundaryTarget([first, last], outside, false)).toBe(first);
    expect(drawerFocusBoundaryTarget([first, last], outside, true)).toBe(last);
  });
});
