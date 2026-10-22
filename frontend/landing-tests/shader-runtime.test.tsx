// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountGrain, mountFlowPoster } from "../lib/landing-shaders";

const mock = vi.hoisted(() => ({
  speed: vi.fn(),
  dispose: vi.fn(),
  paper: vi.fn(),
  render: vi.fn(),
  size: vi.fn(),
  lose: vi.fn(),
  removeGeometry: vi.fn(),
  removeProgram: vi.fn(),
  float: true,
  paperFails: false,
}));
vi.mock("@paper-design/shaders", () => ({
  getShaderNoiseTexture: () => undefined,
  getShaderColorFromString: (s: string) => s,
  grainGradientFragmentShader: "fixture shader",
  GrainGradientShapes: { corners: 4 },
  ShaderFitOptions: { cover: 2 },
  ShaderMount: class {
    canvasElement = document.createElement("canvas");
    constructor(host: HTMLElement, ...args: unknown[]) {
      mock.paper(...args);
      host.append(this.canvasElement);
      if (mock.paperFails) throw new Error("GPU initialization failed");
    }
    setSpeed = mock.speed;
    dispose() {
      mock.dispose();
      this.canvasElement.remove();
    }
  },
}));
vi.mock("ogl", () => {
  class Vec2 {
    x = 0;
    y = 0;
    constructor(x = 0, y = x) {
      this.set(x, y);
    }
    set(x: number, y = x) {
      this.x = x;
      this.y = y;
      return this;
    }
    copy(v: Vec2) {
      return this.set(v.x, v.y);
    }
    lerp(v: Vec2) {
      return this.copy(v);
    }
    len() {
      return Math.hypot(this.x, this.y);
    }
  }
  return {
    Vec2,
    Renderer: class {
      isWebgl2 = true;
      dpr = 1;
      gl = {
        canvas: document.createElement("canvas"),
        clearColor: vi.fn(),
        deleteTexture: vi.fn(),
        getExtension: (name: string) =>
          name === "EXT_color_buffer_float"
            ? mock.float
            : { loseContext: mock.lose },
      };
      constructor({ dpr }: { dpr: number }) {
        this.dpr = dpr;
      }
      setSize(w: number, h: number) {
        mock.size(w, h, this.dpr);
      }
      render = mock.render;
    },
    Texture: class {
      texture = {};
    },
    Triangle: class {
      remove = mock.removeGeometry;
    },
    Program: class {
      remove = mock.removeProgram;
    },
    Mesh: class {},
    Flowmap: class {
      mouse = new Vec2();
      velocity = new Vec2();
      uniform = {};
      aspect = 1;
      update() {}
    },
  };
});
let host: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  vi.clearAllMocks();
  mock.float = true;
  mock.paperFails = false;
  host = document.createElement("div");
  document.body.append(host);
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 1000,
    height: 1100,
    right: 1000,
    bottom: 1100,
    toJSON() {},
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function pointer(x = 25) {
  host.dispatchEvent(
    new MouseEvent("pointermove", { clientX: x, clientY: 50 }),
  );
}
function tick() {
  const [id, callback] = frames.entries().next().value!;
  frames.delete(id);
  callback(16 * id);
}

it("caps grain pixels and starts with zero recurring animation work", async () => {
  const controller = await mountGrain(host, new AbortController().signal);
  expect(mock.paper.mock.calls[0].slice(3)).toEqual([0, 18_000, 1, 280_000]);
  controller!.setActive(true);
  expect(mock.speed).toHaveBeenLastCalledWith(0.14);
  controller!.setActive(false);
  expect(mock.speed).toHaveBeenLastCalledWith(0);
  controller!.dispose();
  controller!.dispose();
  expect(mock.dispose).toHaveBeenCalledTimes(1);
  expect(host.querySelector("canvas")).toBeNull();
});

it("falls back and cleans up when the grain context is lost", async () => {
  const controller = await mountGrain(host, new AbortController().signal);
  host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost"));
  expect(host.dataset.shaderState).toBe("static");
  controller!.dispose();
  expect(mock.dispose).toHaveBeenCalledTimes(1);
});

it("releases an attached GPU context when initialization fails before a controller exists", async () => {
  mock.paperFails = true;
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
    getExtension: () => ({ loseContext: mock.lose }),
  } as unknown as WebGL2RenderingContext);
  expect(await mountGrain(host, new AbortController().signal)).toBeNull();
  expect(mock.lose).toHaveBeenCalledTimes(1);
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.dataset.shaderState).toBe("static");
});

it("avoids mounting either GPU effect after a cancelled import", async () => {
  const scope = new AbortController();
  scope.abort();
  expect(await mountGrain(host, scope.signal)).toBeNull();
  expect(await mountFlowPoster(host, scope.signal)).toBeNull();
  expect(mock.paper).not.toHaveBeenCalled();
  expect(mock.render).not.toHaveBeenCalled();
});

it("bounds distortion to pointer activity and a finite decay", async () => {
  const controller = await mountFlowPoster(host, new AbortController().signal);
  expect(frames.size).toBe(0);
  controller!.setActive(true);
  pointer();
  pointer(60);
  pointer(90);
  expect(frames.size).toBe(1);
  let ticks = 0;
  while (frames.size && ticks < 60) {
    tick();
    ticks++;
  }
  expect(ticks).toBe(48);
  expect(frames.size).toBe(0);
  expect(mock.size.mock.calls[0][2] ** 2 * 1000 * 1100).toBeLessThanOrEqual(
    600_001,
  );
  controller!.dispose();
});

it("cancels queued work while paused and removes listeners/resources on disposal", async () => {
  const controller = await mountFlowPoster(host, new AbortController().signal);
  controller!.setActive(true);
  pointer();
  controller!.setActive(false);
  expect(frames.size).toBe(0);
  expect(host.dataset.flowState).toBe("static");
  pointer();
  expect(frames.size).toBe(0);
  controller!.dispose();
  controller!.dispose();
  pointer();
  expect(mock.lose).toHaveBeenCalledTimes(1);
  expect(mock.removeGeometry).toHaveBeenCalledTimes(1);
  expect(mock.removeProgram).toHaveBeenCalledTimes(1);
  expect(host.querySelector("canvas")).toBeNull();
});

it("keeps the HTML fallback on GPUs without float render targets", async () => {
  mock.float = false;
  expect(await mountFlowPoster(host, new AbortController().signal)).toBeNull();
  expect(host.dataset.flowState).toBe("static");
  expect(host.querySelector("canvas")).toBeNull();
  expect(frames.size).toBe(0);
});
