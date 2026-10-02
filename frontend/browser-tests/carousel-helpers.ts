import {
  expect,
  test as base,
  type Page,
  type Locator,
} from "@playwright/test";

export const test = base.extend<{ carouselHealth: void }>({
  carouselHealth: [
    async ({ page }, use, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      if (errors.length)
        await info.attach("browser-errors", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
      expect(errors, "Uncaught carousel browser exceptions").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function openCarousel(page: Page, reduced = false) {
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  expect((await page.goto("/"))?.status()).toBe(200);
  await expect(page.locator(".sf-landing")).toHaveAttribute(
    "data-js-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1, 1);
  await page.locator(".sf-demo").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("region", { name: "Research walkthrough", exact: true }),
  ).toHaveAttribute("aria-roledescription", "carousel");
}

export async function expectActive(page: Page, index: number) {
  await expect(page.locator(".sf-demo")).toHaveAttribute(
    "data-active-step",
    String(index),
  );
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "id",
    `research-panel-${index}`,
  );
  await expect(
    page.locator('.sf-demo-panel[aria-hidden="true"][inert]'),
  ).toHaveCount(3);
}

export async function waitForCarouselSettled(page: Page) {
  await expect
    .poll(
      async () =>
        page.locator(".sf-demo-track").evaluate((element) => {
          const active = Number(
            element.closest(".sf-demo")!.getAttribute("data-active-step"),
          );
          const x = new DOMMatrixReadOnly(getComputedStyle(element).transform)
            .m41;
          const atEndpoint =
            Math.abs(x + active * element.getBoundingClientRect().width) <= 1;
          const moving = element
            .getAnimations({ subtree: true })
            .some(
              (animation) =>
                animation.pending || animation.playState === "running",
            );
          return atEndpoint && !moving;
        }),
      {
        message:
          "Carousel must reach its active slide and finish entrance animations before the next gesture",
      },
    )
    .toBe(true);
}

export async function activateCenteredDecision(
  page: Page,
  decision: Locator,
  touch: boolean,
) {
  await waitForCarouselSettled(page);
  await decision.evaluate((element) =>
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    }),
  );
  await expect(decision).toBeInViewport({ ratio: 1 });
  const geometry = await decision.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      width: box.width,
      height: box.height,
      y,
      screenHeight: window.innerHeight,
      hit: hit === element || Boolean(hit && element.contains(hit)),
    };
  });
  expect(
    Math.abs(geometry.y - geometry.screenHeight / 2),
    "Decision target should be centered, not touching a viewport edge",
  ).toBeLessThanOrEqual(2);
  expect(
    geometry.hit,
    "The visible decision button must receive the touch",
  ).toBe(true);
  const position = { x: geometry.width / 2, y: geometry.height / 2 };
  if (touch) await decision.tap({ position });
  else await decision.click({ position });
}

export async function swipeCarousel(
  page: Page,
  direction: "left" | "right",
  touch: boolean,
) {
  await waitForCarouselSettled(page);
  const viewport = page.locator(".sf-demo-viewport");
  await viewport.scrollIntoViewIfNeeded();
  const box = (await viewport.boundingBox())!;
  const from = box.x + box.width * (direction === "left" ? 0.76 : 0.24);
  const to = box.x + box.width * (direction === "left" ? 0.24 : 0.76);
  // Stay near the top copy/card heading, away from the shortlist action.
  const screen = page.viewportSize()!;
  const y = Math.max(16, Math.min(box.y + 80, screen.height - 16));
  expect(y).toBeGreaterThan(box.y);
  expect(y).toBeLessThan(box.y + Math.min(140, box.height));
  expect(from).toBeGreaterThan(0);
  expect(from).toBeLessThan(screen.width);
  expect(to).toBeGreaterThan(0);
  expect(to).toBeLessThan(screen.width);
  const target = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        withinViewport: Boolean(element?.closest(".sf-demo-viewport")),
        interactive: Boolean(element?.closest("a, button, input, summary")),
      };
    },
    { x: from, y },
  );
  expect(
    target,
    "Swipe must start on visible noninteractive carousel content",
  ).toEqual({ withinViewport: true, interactive: false });
  if (touch) {
    // Actual Chromium touch input verifies touch-action/pointer event integration.
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from, y }],
      });
      for (let step = 1; step <= 5; step++)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: from + ((to - from) * step) / 5, y }],
        });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 8 });
    await page.mouse.up();
  }
}
