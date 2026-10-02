import { expect, test, expectActive, swipeCarousel } from "./carousel-helpers";

// Keep successful video evidence for the two focused projects, not just failures.
test.use({ video: "on" });

test("record the real carousel and ambient motion at normal speed", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect((await page.goto("/"))?.status()).toBe(200);
  await expect(page.locator(".sf-landing")).toHaveAttribute(
    "data-js-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1, 1);
  // Record the ambient hero scene at its real CSS speed before scrolling.
  await page.waitForTimeout(1500);
  await page.locator(".sf-demo").scrollIntoViewIfNeeded();
  const carousel = page.locator(".sf-demo");
  await expect(carousel).toHaveAttribute("data-playing", "true");
  await expectActive(page, 0);
  await expect(carousel).toHaveAttribute("data-active-step", "1", {
    timeout: 9500,
  });
  // These short observation intervals intentionally record the full transitions.
  await page.waitForTimeout(1100);
  await page.getByRole("tab", { name: "Review evidence", exact: true }).click();
  await expectActive(page, 2);
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Next research step" }).click();
  await expectActive(page, 3);
  await page.locator(".sf-demo-shortlist").click();
  await page.waitForTimeout(1100);
  await swipeCarousel(page, "left", Boolean(info.project.use.isMobile));
  await expectActive(page, 0);
  await page.waitForTimeout(1100);
  await page.locator(".sf-signal-ribbon").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  const video = page.video();
  await page.close();
  if (video)
    await info.attach(`${info.project.name}-carousel-motion`, {
      path: await video.path(),
      contentType: "video/webm",
    });
});
