import { expect, test as base, type Page } from "@playwright/test";
const test = base.extend<{ browserHealth: void }>({
  browserHealth: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      if (errors.length)
        await testInfo.attach("browser-errors", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
      expect(errors, "Uncaught browser exceptions").toEqual([]);
    },
    { auto: true },
  ],
});
const headline = /From your website\s*to your next sales conversation\./;
async function openLanding(page: Page, path = "/") {
  expect((await page.goto(path))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(size.page, JSON.stringify(size)).toBeLessThanOrEqual(
    size.viewport + 1,
  );
  expect(size.body, JSON.stringify(size)).toBeLessThanOrEqual(
    size.viewport + 1,
  );
}

test("responsive landing shows website entry and a complete semantic product example without overflow", async ({
  page,
}, info) => {
  await openLanding(page);
  await expect(
    page.getByRole("textbox", { name: "Your business website" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  await noOverflow(page);
  const preview = page.getByRole("region", {
    name: "From discovery to the next conversation",
  });
  await expect(preview).toBeVisible();
  await expect(preview.locator("ol > li")).toHaveCount(4);
  await expect(preview.getByRole("columnheader")).toHaveCount(3);
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  await expect(preview).toContainText("Illustrative layout, not live results");
  await expect(preview.getByText("Unverified", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("tab")).toHaveCount(0);
  const before = await preview.boundingBox();
  await page.clock.install();
  await page.clock.fastForward(30000);
  expect(await preview.boundingBox()).toEqual(before);
  for (const section of ["#workflow", "#your-list", "#faq", ".sf-final"]) {
    await page.locator(section).scrollIntoViewIfNeeded();
    await noOverflow(page);
  }
  await page.screenshot({
    path: info.outputPath("landing-full.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("website validation is keyboard-accessible and never analyzes invalid input", async ({
  page,
}) => {
  await openLanding(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\//.test(request.url())) requests.push(request.url());
  });
  const website = page.getByRole("textbox", { name: "Your business website" });
  await website.fill("not a website");
  await website.press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "Enter a public business website",
  );
  await expect(website).toBeFocused();
  await expect(website).toHaveAttribute("aria-invalid", "true");
  expect(new URL(page.url()).pathname).toBe("/");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("clientrove:business-intake"),
    ),
  ).toBeNull();
  expect(requests).toEqual([]);
  await website.fill("example.com");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(website).toHaveAttribute("aria-invalid", "false");
});

test("native anchors preserve history and reach intended sections", async ({
  page,
}) => {
  await openLanding(page, "/#your-list");
  await expect(page.locator("#your-list")).toBeInViewport();
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/\/#workflow$/);
  await expect(page.locator("#workflow")).toBeInViewport();
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  if (await nav.isVisible()) {
    await nav.getByRole("link", { name: "FAQ", exact: true }).click();
    await expect(page).toHaveURL(/\/#faq$/);
    await expect(page.locator("#faq")).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/\/#workflow$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/#faq$/);
  }
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);
  await noOverflow(page);
});

test("FAQ works by keyboard and account links retain their intended destinations", async ({
  page,
}) => {
  await openLanding(page);
  const summary = page.locator(".sf-faq-list summary").first();
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".sf-faq-list details").first()).toHaveAttribute(
    "open",
    "",
  );
  await expect(
    page.locator(".sf-faq-list details").first().locator("p"),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".sf-faq-list details").first(),
  ).not.toHaveAttribute("open");
  await expect(
    page.getByRole("link", { name: "Sign up", exact: true }),
  ).toHaveAttribute("href", "/sign-up?redirect_url=/workspace/setup");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in?redirect_url=/workspace");
});

test("legal and contact routes remain reachable", async ({ page }) => {
  await openLanding(page);
  for (const [label, route] of [
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Contact", "/contact"],
  ]) {
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noOverflow(page);
    await openLanding(page);
  }
});

test("motion is finite and reduced motion retains the complete page", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openLanding(page);
  const animationPolicies = await page.locator(".sf-landing").evaluate((root) =>
    [...root.querySelectorAll("*")]
      .flatMap((element) =>
        [null, "::before", "::after"].map((pseudo) => {
          const style = getComputedStyle(element, pseudo);
          return {
            name: style.animationName,
            duration: style.animationDuration,
            delay: style.animationDelay,
            iterations: style.animationIterationCount,
          };
        }),
      )
      .filter((item) => item.name !== "none"),
  );
  expect(animationPolicies.length).toBeGreaterThan(0);
  for (const policy of animationPolicies) {
    expect(policy.iterations).toBe("1");
    expect(parseFloat(policy.duration) + parseFloat(policy.delay)).toBeLessThan(
      5,
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".sf-analyze-button")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await expect(page.locator(".sf-preview-profile")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#hero-title")).toHaveCSS("animation-name", "none");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: page.viewportSize()!,
  });
  const noJs = await context.newPage();
  try {
    await openLanding(noJs);
    await expect(noJs.locator(".sf-preview-path > li")).toHaveCount(4);
    await noJs.locator(".sf-faq-list summary").first().click();
    await expect(
      noJs.locator(".sf-faq-list details").first().locator("p"),
    ).toBeVisible();
    await noOverflow(noJs);
  } finally {
    await context.close();
  }
});

test("small screens reflow the readable customer list and retain the keyboard draft action", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 1000) > 560,
    "Mobile typography and list reflow",
  );
  await openLanding(page);
  for (const [selector, minimum] of [
    [".sf-hero-lede", 14],
    [".sf-intake-form > label", 14],
    ["#business-website", 16],
    [".sf-manual-option", 14],
    [".sf-intake-hint", 12],
    [".sf-preview-profile dd", 14],
    [".sf-preview td > strong", 14],
    [".sf-preview td .sf-email-status", 12],
    [".sf-steps p", 14],
    [".sf-value-grid p", 14],
    [".sf-faq-list summary", 14],
  ] as const) {
    const size = await page
      .locator(selector)
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(size, selector).toBeGreaterThanOrEqual(minimum);
  }
  const preview = page.getByRole("region", {
    name: "From discovery to the next conversation",
  });
  await preview.scrollIntoViewIfNeeded();
  expect(
    await preview
      .locator("table")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  const draft = preview.locator(".sf-demo-draft summary");
  await expect(draft).toBeVisible();
  await draft.focus();
  await expect(draft).toBeFocused();
  await draft.press("Enter");
  await expect(preview.locator(".sf-demo-draft")).not.toHaveAttribute("open");
  await noOverflow(page);
});
