import {
  expect,
  test,
  openCarousel,
  expectActive,
  swipeCarousel,
  activateCenteredDecision,
} from "./carousel-helpers";

test("autoplay runs only in view and pauses on hover and offscreen", async ({
  page,
}) => {
  await page.clock.install();
  await openCarousel(page);
  const carousel = page.locator(".sf-demo");
  await expect(carousel).toHaveAttribute("data-playing", "true");
  await page.clock.fastForward(7001);
  await expectActive(page, 1);

  const visibleGeometry = () =>
    carousel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const left = Math.max(0, rect.left);
      const right = Math.min(window.innerWidth, rect.right);
      const top = Math.max(0, rect.top);
      const bottom = Math.min(window.innerHeight, rect.bottom);
      return {
        ratio:
          (Math.max(0, right - left) * Math.max(0, bottom - top)) /
          (rect.width * rect.height),
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        scrollY: window.scrollY,
      };
    });
  const beforeHover = await visibleGeometry();
  expect(beforeHover.ratio).toBeGreaterThanOrEqual(0.35);
  // Locator.hover() can scroll a tall mobile carousel below its visibility
  // threshold. Move into its already-visible intersection without scrolling.
  await page.mouse.move(beforeHover.x, beforeHover.y);
  expect(
    await page.evaluate(
      ({ x, y }) =>
        Boolean(document.elementFromPoint(x, y)?.closest(".sf-demo")),
      beforeHover,
    ),
  ).toBe(true);
  await expect(carousel).toHaveAttribute("data-playing", "false");
  await page.clock.fastForward(14000);
  await expectActive(page, 1);
  const whileHovered = await visibleGeometry();
  expect(whileHovered.ratio).toBeGreaterThanOrEqual(0.35);
  expect(
    Math.abs(whileHovered.scrollY - beforeHover.scrollY),
  ).toBeLessThanOrEqual(1);
  await page.mouse.move(1, 1);
  const afterLeave = await visibleGeometry();
  expect(afterLeave.ratio).toBeGreaterThanOrEqual(0.35);
  expect(
    Math.abs(afterLeave.scrollY - beforeHover.scrollY),
  ).toBeLessThanOrEqual(1);
  await expect(carousel).toHaveAttribute("data-playing", "true");

  await page.locator("#faq").scrollIntoViewIfNeeded();
  await expect(carousel).toHaveAttribute("data-playing", "false");
  await page.clock.fastForward(14000);
  await expectActive(page, 1);
  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel).toHaveAttribute("data-playing", "true");
  await page.clock.fastForward(7001);
  await expectActive(page, 2);
});

test("playback focus, pointer clicks, and the page motion control stop and resume safely", async ({
  page,
}) => {
  await page.clock.install();
  await openCarousel(page);
  const carousel = page.locator(".sf-demo");
  const playback = page.locator(".sf-demo-play");
  await expect(carousel).toHaveAttribute("data-playing", "true");
  await playback.focus();
  await expect(playback).toHaveAccessibleName("Play walkthrough");
  await page.clock.fastForward(14000);
  await expectActive(page, 0);
  await page.keyboard.press("Enter");
  await expect(carousel).toHaveAttribute("data-playing", "true");
  // Blur before a pointer click so this covers pointerdown + focus + click order.
  await page
    .locator(".sf-demo-play")
    .evaluate((element) => (element as HTMLElement).blur());
  await playback.click();
  await expect(playback).toHaveAccessibleName("Play walkthrough");
  await page.mouse.move(1, 1);
  await expect(carousel).toHaveAttribute("data-playing", "false");
  await playback.click();
  await page.mouse.move(1, 1);
  await expect(carousel).toHaveAttribute("data-playing", "true");

  await page
    .getByRole("button", { name: "Pause page motion", exact: true })
    .click();
  await expect(page.locator(".sf-motion-root")).toHaveAttribute(
    "data-motion-paused",
    "true",
  );
  await expect(playback).toBeDisabled();
  await expect(page.locator(".sf-demo-track")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.clock.fastForward(14000);
  await expectActive(page, 0);
  await page
    .getByRole("button", { name: "Resume page motion", exact: true })
    .click();
  await carousel.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await expect(carousel).toHaveAttribute("data-playing", "true");
  await page.clock.fastForward(7001);
  await expectActive(page, 1);
});

test("slides interpolate horizontally, inactive content is inert, and real swipes retain decisions", async ({
  page,
}, info) => {
  await openCarousel(page);
  const samples = await page.evaluate(async () => {
    const track = document.querySelector<HTMLElement>(".sf-demo-track")!;
    const width = track.offsetWidth;
    const frames: { time: number; x: number }[] = [];
    const start = performance.now();
    document.querySelector<HTMLButtonElement>("#research-tab-1")!.click();
    await new Promise<void>((resolve) => {
      function sample(now: number) {
        frames.push({
          time: now - start,
          x: new DOMMatrixReadOnly(getComputedStyle(track).transform).m41,
        });
        if (now - start >= 1100) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    return { width, frames };
  });
  await info.attach("horizontal-transition", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  expect(
    samples.frames.some(
      (frame) => frame.x < -2 && frame.x > -samples.width + 2,
    ),
    "A real intermediate horizontal frame must exist",
  ).toBe(true);
  expect(
    Math.abs(samples.frames.at(-1)!.x + samples.width),
  ).toBeLessThanOrEqual(2);
  await expectActive(page, 1);
  const inactiveLink = page.locator("#research-panel-2 a");
  await inactiveLink.evaluate((element) => (element as HTMLElement).focus());
  await expect(inactiveLink).not.toBeFocused();

  await swipeCarousel(page, "right", Boolean(info.project.use.isMobile));
  await expectActive(page, 0);
  await swipeCarousel(page, "right", Boolean(info.project.use.isMobile));
  await expectActive(page, 3);
  await expect(page.locator(".sf-demo")).toHaveAttribute(
    "data-playing",
    "false",
  );
  const decision = page.locator(".sf-demo-shortlist");
  await activateCenteredDecision(
    page,
    decision,
    Boolean(info.project.use.isMobile),
  );
  await expect(decision).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next research step" }).click();
  await expectActive(page, 0);
  await page.getByRole("button", { name: "Previous research step" }).click();
  await expectActive(page, 3);
  await expect(decision).toHaveAttribute("aria-pressed", "true");
  // Three swipe-to-decision cycles must work; a successful retry is insufficient.
  for (const pressed of [false, true]) {
    await swipeCarousel(page, "left", Boolean(info.project.use.isMobile));
    await expectActive(page, 0);
    await swipeCarousel(page, "right", Boolean(info.project.use.isMobile));
    await expectActive(page, 3);
    await expect(decision).toHaveAttribute("aria-pressed", String(!pressed));
    await activateCenteredDecision(
      page,
      decision,
      Boolean(info.project.use.isMobile),
    );
    await expect(decision).toHaveAttribute("aria-pressed", String(pressed));
  }
  await swipeCarousel(page, "left", Boolean(info.project.use.isMobile));
  await expectActive(page, 0);
});

test("reduced motion stays static and readable while manual carousel controls work", async ({
  page,
}) => {
  await page.clock.install();
  await openCarousel(page, true);
  await expect(page.locator(".sf-demo")).toHaveAttribute(
    "data-playing",
    "false",
  );
  await expect(page.locator(".sf-demo-play")).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Motion reduced by system preference",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".sf-demo-track")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.clock.fastForward(28000);
  await expectActive(page, 0);
  await page.getByRole("button", { name: "Next research step" }).click();
  await expectActive(page, 1);
  await expect(page.locator(".sf-ribbon-track")).toHaveCSS(
    "animation-name",
    "none",
  );
  const ribbon = await page
    .locator(".sf-signal-ribbon")
    .evaluate((element) => ({
      width: element.clientWidth,
      content: element.scrollWidth,
    }));
  expect(ribbon.content).toBeLessThanOrEqual(ribbon.width + 1);
});
