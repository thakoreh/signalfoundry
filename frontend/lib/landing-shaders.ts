/** Decorative, local-only GPU effects. No product content or controls live in a shader. */
export type VisualController = {
  setActive: (active: boolean) => void;
  dispose: () => void;
};

export async function mountGrain(
  host: HTMLElement,
  signal: AbortSignal,
): Promise<VisualController | null> {
  const paper = await import("@paper-design/shaders");
  const noise = paper.getShaderNoiseTexture();
  if (noise && !noise.complete) await noise.decode();
  if (signal.aborted) return null;
  let mount: InstanceType<typeof paper.ShaderMount> | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    mount?.canvasElement.removeEventListener("webglcontextlost", lost);
    mount?.dispose();
    host.replaceChildren();
    host.dataset.shaderState = "static";
  };
  const lost = () => dispose();
  try {
    mount = new paper.ShaderMount(
      host,
      paper.grainGradientFragmentShader,
      {
        u_colorBack: paper.getShaderColorFromString("#eeeaf8"),
        u_colors: ["#b6a5ec", "#eed3cd", "#c6d8ec"].map(
          paper.getShaderColorFromString,
        ),
        u_colorsCount: 3,
        u_softness: 0.72,
        u_intensity: 0.24,
        u_noise: 0.15,
        u_shape: paper.GrainGradientShapes.corners,
        ...(noise ? { u_noiseTexture: noise } : {}),
        u_fit: paper.ShaderFitOptions.cover,
        u_scale: 1.35,
        u_rotation: 28,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
      },
      { alpha: false, powerPreference: "low-power" },
      0,
      18_000,
      1,
      280_000,
    );
    mount.canvasElement.setAttribute("aria-hidden", "true");
    mount.canvasElement.addEventListener("webglcontextlost", lost);
    host.dataset.shaderState = "ready";
    return {
      setActive: (active) => {
        if (!disposed) mount?.setSpeed(active ? 0.14 : 0);
      },
      dispose,
    };
  } catch {
    // A blocked context or unsupported GPU must leave the solid poster intact.
    dispose();
    return null;
  }
}

const vertex = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;
const fragment = `
precision highp float;
uniform sampler2D tPoster;
uniform sampler2D tFlow;
varying vec2 vUv;
void main() {
  vec2 displacement = texture2D(tFlow, vUv).xy;
  vec2 sampleUv = clamp(vUv - displacement * 0.035, 0.0, 1.0);
  gl_FragColor = texture2D(tPoster, sampleUv);
}
`;

export async function mountFlowPoster(
  host: HTMLElement,
  signal: AbortSignal,
): Promise<VisualController | null> {
  const ogl = await import("ogl");
  if (signal.aborted) return null;
  const source = document.createElement("canvas");
  source.width = 1000;
  source.height = 1100;
  const ink = source.getContext("2d");
  if (!ink) return null;
  // Original typographic poster, matching the live HTML fallback underneath.
  ink.fillStyle = "#252238";
  ink.font = '800 182px "Arial", sans-serif';
  ink.textBaseline = "top";
  ["LESS", "SEARCH.", "MORE", "HELLO."].forEach((line, index) => {
    ink.fillText(line, 54, 50 + index * 248);
  });
  let renderer: InstanceType<typeof ogl.Renderer> | undefined;
  let frame = 0;
  let remaining = 0;
  let enabled = false;
  let disposed = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let observer: ResizeObserver | undefined;
  let program: InstanceType<typeof ogl.Program> | undefined;
  let geometry: InstanceType<typeof ogl.Triangle> | undefined;
  let texture: InstanceType<typeof ogl.Texture> | undefined;
  const mouse = new ogl.Vec2(-1);
  const velocity = new ogl.Vec2();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    host.removeEventListener("pointermove", pointer);
    host.removeEventListener("pointerleave", leave);
    const gl = renderer?.gl;
    gl?.canvas.removeEventListener("webglcontextlost", lost);
    geometry?.remove();
    program?.remove();
    if (gl && texture) gl.deleteTexture(texture.texture);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    gl?.canvas.remove();
    host.dataset.flowState = "static";
  };
  const lost = () => dispose();
  const leave = () => {
    lastTime = 0;
    mouse.set(-1);
    velocity.set(0);
  };
  function pointer(event: PointerEvent) {
    if (!enabled || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = performance.now();
    const elapsed = Math.max(16, now - lastTime);
    mouse.set(x / rect.width, 1 - y / rect.height);
    velocity.set(
      lastTime ? Math.max(-1, Math.min(1, (x - lastX) / elapsed)) : 0,
      lastTime ? Math.max(-1, Math.min(1, (lastY - y) / elapsed)) : 0,
    );
    lastX = x;
    lastY = y;
    lastTime = now;
    moved = true;
    remaining = 48;
    if (!frame) frame = requestAnimationFrame(draw);
  }
  let flow: InstanceType<typeof ogl.Flowmap>;
  let mesh: InstanceType<typeof ogl.Mesh>;
  function draw() {
    frame = 0;
    if (!enabled || disposed || !renderer) return;
    if (!moved) {
      mouse.set(-1);
      velocity.set(0);
    }
    moved = false;
    flow.mouse.copy(mouse);
    flow.velocity.lerp(velocity, velocity.len() ? 0.4 : 0.2);
    flow.update();
    renderer.render({ scene: mesh });
    if (--remaining > 0) frame = requestAnimationFrame(draw);
  }
  try {
    const box = host.getBoundingClientRect();
    renderer = new ogl.Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: "low-power",
      dpr: Math.min(window.devicePixelRatio || 1, 1.25),
    });
    const gl = renderer.gl;
    if (
      !gl ||
      !renderer.isWebgl2 ||
      !gl.getExtension("EXT_color_buffer_float")
    ) {
      dispose();
      return null;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.canvas.setAttribute("aria-hidden", "true");
    gl.canvas.addEventListener("webglcontextlost", lost);
    host.append(gl.canvas);
    geometry = new ogl.Triangle(gl);
    texture = new ogl.Texture(gl, { image: source, generateMipmaps: false });
    flow = new ogl.Flowmap(gl, {
      size: 128,
      falloff: 0.22,
      dissipation: 0.88,
      alpha: 0.45,
    });
    program = new ogl.Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { tPoster: { value: texture }, tFlow: flow.uniform },
    });
    mesh = new ogl.Mesh(gl, { geometry, program });
    const resize = () => {
      if (!renderer || disposed) return;
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width || box.width);
      const height = Math.max(1, rect.height || box.height);
      renderer.dpr = Math.min(
        window.devicePixelRatio || 1,
        1.25,
        Math.sqrt(600_000 / (width * height)),
      );
      renderer.setSize(width, height);
      flow.aspect = width / height;
      renderer.render({ scene: mesh });
    };
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener("pointermove", pointer, { passive: true });
    host.addEventListener("pointerleave", leave);
    host.dataset.flowState = "ready";
    return {
      setActive(active) {
        enabled = active && !disposed;
        host.dataset.flowState = enabled ? "ready" : "static";
        if (renderer)
          renderer.gl.canvas.style.visibility = enabled ? "visible" : "hidden";
        if (!enabled) {
          cancelAnimationFrame(frame);
          frame = 0;
          remaining = 0;
          leave();
          flow.velocity.set(0);
          flow.mouse.set(-1);
        }
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}
