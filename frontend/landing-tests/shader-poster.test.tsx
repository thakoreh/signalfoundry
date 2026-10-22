// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LandingShaderPoster } from "../components/landing-shader-poster";
import { LandingMotionProvider } from "../components/landing-motion-provider";
import { LandingMarketing } from "../components/landing-marketing";
import { installMotionEnvironment } from "./motion-environment";

const { mountGrain, mountFlowPoster } = vi.hoisted(() => ({
  mountGrain: vi.fn(),
  mountFlowPoster: vi.fn(),
}));
vi.mock("../lib/landing-shaders", () => ({ mountGrain, mountFlowPoster }));
let root: Root, container: HTMLDivElement;
let motion: ReturnType<typeof installMotionEnvironment>;
let grain: {
  setActive: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
let flow: typeof grain;
let fine: boolean;
let pointerEvents: EventTarget;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  motion = installMotionEnvironment();
  const matchMotion = window.matchMedia;
  fine = true;
  pointerEvents = new EventTarget();
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("pointer")
      ? {
          get matches() {
            return fine;
          },
          addEventListener: pointerEvents.addEventListener.bind(pointerEvents),
          removeEventListener:
            pointerEvents.removeEventListener.bind(pointerEvents),
        }
      : matchMotion(query),
  );
  vi.stubGlobal("WebGL2RenderingContext", class {});
  grain = { setActive: vi.fn(), dispose: vi.fn() };
  flow = { setActive: vi.fn(), dispose: vi.fn() };
  mountGrain.mockReset().mockResolvedValue(grain);
  mountFlowPoster.mockReset().mockResolvedValue(flow);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const poster = () => container.querySelector("figure")!;
async function render() {
  await act(async () =>
    root.render(
      <LandingMotionProvider>
        <LandingShaderPoster />
        <LandingMarketing />
      </LandingMotionProvider>,
    ),
  );
}
async function enter() {
  await act(async () => motion.intersect(poster(), 1));
}
async function button(label: string) {
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
      .click(),
  );
}

it("uses one shared pause boundary for the poster and the existing workflow", async () => {
  await render();
  await enter();
  expect(container.querySelectorAll(".sf-motion-root")).toHaveLength(1);
  expect(grain.setActive).toHaveBeenLastCalledWith(true);
  await button("Pause visual effects");
  expect(grain.setActive).toHaveBeenLastCalledWith(false);
  expect(flow.setActive).toHaveBeenLastCalledWith(false);
  expect(
    container
      .querySelector(".sf-pipeline-steps")
      ?.getAttribute("data-flow-running"),
  ).toBe("false");
  await button("Resume page motion");
  expect(grain.setActive).toHaveBeenLastCalledWith(true);
  expect(flow.setActive).toHaveBeenLastCalledWith(true);
});

it("stops work offscreen and in hidden tabs without remounting shader contexts", async () => {
  await render();
  await enter();
  await act(async () => motion.intersect(poster(), 0));
  expect(grain.setActive).toHaveBeenLastCalledWith(false);
  await enter();
  await act(async () => motion.setVisibility("hidden"));
  expect(flow.setActive).toHaveBeenLastCalledWith(false);
  await act(async () => motion.setVisibility("visible"));
  expect(flow.setActive).toHaveBeenLastCalledWith(true);
  expect(mountGrain).toHaveBeenCalledTimes(1);
  expect(mountFlowPoster).toHaveBeenCalledTimes(1);
});

it("uses a static grain and readable type on a coarse or phone pointer", async () => {
  fine = false;
  await render();
  await enter();
  expect(mountFlowPoster).not.toHaveBeenCalled();
  expect(grain.setActive).toHaveBeenLastCalledWith(false);
  expect(poster().textContent).toContain("LESSSEARCH.MOREHELLO.");
  expect(poster().textContent).toContain("AI drafts. You review. You send.");
});

it("releases distortion on reduced motion and leaves the grain stopped", async () => {
  await render();
  await enter();
  await act(async () => motion.setReducedMotion(true));
  expect(flow.dispose).toHaveBeenCalledTimes(1);
  expect(grain.setActive).toHaveBeenLastCalledWith(false);
  expect(
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Visual effects reduced by system preference"]',
    )?.disabled,
  ).toBe(true);
});

it("keeps all explanatory content when WebGL is unavailable", async () => {
  vi.stubGlobal("WebGL2RenderingContext", undefined);
  await render();
  await enter();
  expect(mountGrain).not.toHaveBeenCalled();
  expect(mountFlowPoster).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".sf-poster-type > span")).toHaveLength(4);
  expect(poster().textContent).toContain("A message worth starting with.");
});

it("handles rejected effect loading without losing the poster or workflow", async () => {
  mountGrain.mockRejectedValue(new Error("Context denied"));
  mountFlowPoster.mockRejectedValue(new Error("Graphics unavailable"));
  await render();
  await enter();
  expect(
    container
      .querySelector(".sf-grain-surface")
      ?.getAttribute("data-shader-state"),
  ).toBe("static");
  expect(
    container.querySelector(".sf-poster-art")?.getAttribute("data-flow-state"),
  ).toBe("static");
  expect(container.textContent).toContain("Finding a lead is the start.");
});

it("disposes late asynchronous effects after the view has unmounted", async () => {
  let resolve!: (value: typeof grain) => void;
  mountGrain.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render();
  await act(async () => root.render(<p>Another screen</p>));
  await act(async () => resolve(grain));
  expect(grain.dispose).toHaveBeenCalledTimes(1);
  expect(grain.setActive).not.toHaveBeenCalled();
  expect(flow.dispose).toHaveBeenCalledTimes(1);
});
