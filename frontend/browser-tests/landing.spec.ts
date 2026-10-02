import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

const STAGES = [
  "Define the ICP",
  "Import accounts",
  "Review evidence",
  "Shortlist or export",
];

// Every test fails on uncaught browser exceptions, including the hash-navigation
// regression. The fixture also makes errors available in failed CI artifacts.
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

async function openLanding(page: Page, path = "/") {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator(".sf-landing")).toHaveAttribute(
    "data-js-ready",
    "true",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const filename = `${testInfo.project.name}-${name}.png`;
  const path = testInfo.outputPath(filename);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(filename, { path, contentType: "image/png" });
}

async function expectStage(page: Page, index: number) {
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "id",
    `research-panel-${index}`,
  );
  for (let position = 0; position < STAGES.length; position++) {
    const tab = page.getByRole("tab", { name: STAGES[position], exact: true });
    await expect(tab).toHaveAttribute(
      "aria-selected",
      String(position === index),
    );
    await expect(tab).toHaveAttribute(
      "tabindex",
      position === index ? "0" : "-1",
    );
    await expect(tab).toHaveAttribute(
      "aria-controls",
      `research-panel-${position}`,
    );
    await expect(page.locator(`#research-panel-${position}`)).toHaveAttribute(
      "aria-labelledby",
      `research-tab-${position}`,
    );
  }
  const previous = page.getByRole("button", { name: "Previous research step" });
  const next = page.getByRole("button", { name: "Next research step" });
  await expect(previous).toBeEnabled();
  await expect(next).toBeEnabled();
}

async function navigateSection(page: Page, name: string, hash: string) {
  const toggle = page.locator(".sf-mobile-toggle");
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  ) {
    await toggle.click();
  }
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name, exact: true })
    .click();
  await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).hash).toBe(hash);
  await expect(page.locator(hash)).toBeInViewport();
  if (await toggle.isVisible())
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
}

test("responsive landing has no horizontal overflow and stable walkthrough dimensions", async ({
  page,
}, testInfo) => {
  await openLanding(page);
  await noOverflow(page);
  await expect(page.locator("#faq-title")).toHaveText(
    "Clarity comes standard.",
  );
  await expect(page.locator("#final-title")).toHaveText(
    "Make your next account list worth believing.",
  );
  await capture(page, testInfo, "landing");
  const sizes: { stage: string; width: number; height: number }[] = [];
  for (let index = 0; index < STAGES.length; index++) {
    await page.getByRole("tab", { name: STAGES[index], exact: true }).click();
    await expectStage(page, index);
    await noOverflow(page);
    const panel = page.getByRole("tabpanel");
    // offset dimensions exclude the entry transform and measure layout stability.
    sizes.push(
      await panel.evaluate(
        (element, stage) => ({
          stage,
          width: (element as HTMLElement).offsetWidth,
          height: (element as HTMLElement).offsetHeight,
        }),
        STAGES[index],
      ),
    );
  }
  await testInfo.attach("panel-dimensions", {
    body: JSON.stringify(sizes, null, 2),
    contentType: "application/json",
  });
  expect(
    Math.max(...sizes.map((size) => size.width)) -
      Math.min(...sizes.map((size) => size.width)),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.max(...sizes.map((size) => size.height)) -
      Math.min(...sizes.map((size) => size.height)),
  ).toBeLessThanOrEqual(2);
  await capture(page, testInfo, "shortlist");
});

test("mobile menu opens, closes after a link, and restores focus on Escape", async ({
  page,
}) => {
  await openLanding(page);
  const toggle = page.locator(".sf-mobile-toggle");
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  if ((page.viewportSize()?.width ?? 1440) > 900) {
    await expect(toggle).toBeHidden();
    await expect(navigation).toBeVisible();
    await navigateSection(page, "How it works", "#workflow");
    return;
  }

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await toggle.focus();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.keyboard.press("Enter");
    await expect(navigation).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const name of [
      "How it works",
      "The evidence",
      "Scope & plans",
      "FAQ",
      "Sign in",
    ]) {
      await page.keyboard.press("Tab");
      await expect(
        navigation.getByRole("link", { name, exact: true }),
      ).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await expect(navigation).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  }
  await navigateSection(page, "How it works", "#workflow");
  await expect(navigation).toBeHidden();
  await noOverflow(page);
});

test("tabs support keyboard wrap, repeated selection, wrapping controls, and reversible shortlist", async ({
  page,
}) => {
  await openLanding(page);
  await expectStage(page, 0);
  await page.getByRole("tab", { name: STAGES[0], exact: true }).focus();
  for (const [key, index] of [
    ["ArrowLeft", 3],
    ["ArrowRight", 0],
    ["ArrowRight", 1],
    ["End", 3],
    ["Home", 0],
  ] as const) {
    await page.keyboard.press(key);
    await expectStage(page, index);
    await expect(
      page.getByRole("tab", { name: STAGES[index], exact: true }),
    ).toBeFocused();
  }
  for (const index of [1, 2, 3, 0, 1]) {
    await page.getByRole("button", { name: "Next research step" }).click();
    await expectStage(page, index);
  }
  for (const index of [0, 3, 2, 1, 0]) {
    await page.getByRole("button", { name: "Previous research step" }).click();
    await expectStage(page, index);
  }
  for (const index of [3, 1, 1, 2, 0, 3]) {
    await page.getByRole("tab", { name: STAGES[index], exact: true }).click();
    await expectStage(page, index);
  }
  const decision = page.locator(".sf-demo-shortlist");
  for (const pressed of [true, false, true, false, true]) {
    await decision.click();
    await expect(decision).toHaveAttribute("aria-pressed", String(pressed));
    await expect(decision).toHaveText(
      pressed ? "Remove from sample shortlist" : "Shortlist this example",
    );
  }
  await page.getByRole("tab", { name: STAGES[0], exact: true }).click();
  await page.getByRole("tab", { name: STAGES[3], exact: true }).click();
  await expect(decision).toHaveAttribute("aria-pressed", "true");
  await decision.click();
  await expect(decision).toHaveAttribute("aria-pressed", "false");
  await noOverflow(page);
});

test("hash navigation survives entry at examples, workflow and FAQ clicks, reload, and history", async ({
  page,
}) => {
  await openLanding(page, "/#examples");
  await expect(page.locator("#examples")).toBeInViewport();
  await navigateSection(page, "How it works", "#workflow");
  await navigateSection(page, "FAQ", "#faq");
  await page.reload();
  await expect(page.locator(".sf-landing")).toHaveAttribute(
    "data-js-ready",
    "true",
  );
  await expect(page).toHaveURL(/\/#faq$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/#workflow$/);
  await expect(page.locator("#workflow")).toBeInViewport();
  await page.goForward();
  await expect(page).toHaveURL(/\/#faq$/);
  await navigateSection(page, "How it works", "#workflow");
  await navigateSection(page, "The evidence", "#examples");
  await expect(
    page.getByRole("tab", { name: STAGES[0], exact: true }),
  ).toBeEnabled();
});

test("legal and contact links resolve while auth links preserve the workspace destination", async ({
  page,
}) => {
  await openLanding(page);
  for (const route of ["sign-up", "sign-in"]) {
    const links = page.locator(`a[href^="/${route}"]`);
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all())
      await expect(link).toHaveAttribute(
        "href",
        `/${route}?redirect_url=/workspace`,
      );
  }
  // Local-demo intentionally redirects auth routes home. Inspect their exact
  // destinations here rather than interacting with real identity providers.
  for (const [label, route, title] of [
    ["Privacy", "/privacy", "Privacy, plainly."],
    ["Terms", "/terms", "Terms for a preview."],
    ["Contact", "/contact", "Keep the loop open."],
  ]) {
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await page
      .getByRole("link", { name: "Back to SignalFoundry", exact: true })
      .click();
    await expect(page.locator(".sf-landing")).toHaveAttribute(
      "data-js-ready",
      "true",
    );
  }
});

test("reduced motion disables computed animation and transition during stage changes", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLanding(page);
  await expect(page.locator(".sf-landing")).toHaveAttribute(
    "data-motion-reduced",
    "true",
  );
  await capture(page, testInfo, "reduced-motion-icp");
  for (let index = 0; index < STAGES.length; index++) {
    const tab = page.getByRole("tab", { name: STAGES[index], exact: true });
    await tab.click();
    await expect(page.getByRole("tabpanel")).toHaveCSS(
      "animation-name",
      "none",
    );
    await expect(tab).toHaveCSS("transition-duration", "0s");
    if (index === 2) await capture(page, testInfo, "reduced-motion-evidence");
  }
  await expect(page.locator('[data-reveal="hero"]')).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator('[data-reveal="workflow"]')).toHaveCSS(
    "animation-name",
    "none",
  );
  await capture(page, testInfo, "reduced-motion-shortlist");
});

test("demo interactions make no requests, downloads, or persistent mutations", async ({
  page,
  context,
}, testInfo) => {
  await page.addInitScript(() => {
    const state = window as unknown as { sampleWrites: string[] };
    state.sampleWrites = [];
    for (const method of ["setItem", "removeItem", "clear"] as const) {
      const original = Storage.prototype[method];
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value: function (...args: string[]) {
          state.sampleWrites.push(`storage.${method}`);
          return Reflect.apply(original, this, args);
        },
      });
    }
    for (const method of ["add", "put", "delete", "clear"] as const) {
      const original = IDBObjectStore.prototype[method];
      Object.defineProperty(IDBObjectStore.prototype, method, {
        configurable: true,
        value: function (...args: unknown[]) {
          state.sampleWrites.push(`indexedDB.${method}`);
          return Reflect.apply(original, this, args);
        },
      });
    }
    const cookie = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie",
    );
    if (cookie?.get && cookie.set)
      Object.defineProperty(Document.prototype, "cookie", {
        configurable: true,
        get: cookie.get,
        set(value: string) {
          state.sampleWrites.push("document.cookie");
          cookie.set!.call(this, value);
        },
      });
  });
  await openLanding(page);
  await page.locator(".sf-demo").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  const beforeCookies = await context.cookies();
  await page.evaluate(() => {
    (window as unknown as { sampleWrites: string[] }).sampleWrites = [];
  });
  const requests: string[] = [];
  const downloads: string[] = [];
  page.on("request", (request) =>
    requests.push(`${request.method()} ${request.url()}`),
  );
  page.on("websocket", (socket) => requests.push(`WebSocket ${socket.url()}`));
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  for (const index of [1, 2, 3, 0, 3])
    await page.getByRole("tab", { name: STAGES[index], exact: true }).click();
  await page.locator(".sf-demo-shortlist").click();
  await page.locator(".sf-demo-shortlist").click();
  await page.getByRole("button", { name: "Previous research step" }).click();
  await page.getByRole("button", { name: "Next research step" }).click();
  // Observe past a browser task/paint boundary and any in-flight activity.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForLoadState("networkidle");
  const writes = await page.evaluate(
    () => (window as unknown as { sampleWrites: string[] }).sampleWrites,
  );
  await testInfo.attach("sample-side-effects", {
    body: JSON.stringify({ requests, writes, downloads }, null, 2),
    contentType: "application/json",
  });
  expect(requests).toEqual([]);
  expect(writes).toEqual([]);
  expect(downloads).toEqual([]);
  expect(await context.cookies()).toEqual(beforeCookies);
  await expect(
    page.locator(".sf-demo form, .sf-demo input, .sf-demo a[download]"),
  ).toHaveCount(0);
  await expect(page.locator(".sf-demo-disclaimer")).toContainText(
    "No accounts are imported, researched, saved, or exported here.",
  );
});

test("small research labels retain readable foreground contrast", async ({
  page,
}) => {
  await openLanding(page);
  await page.getByRole("tab", { name: "Import accounts", exact: true }).click();
  const results = await page.evaluate(() => {
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((part) => {
          const value = part / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    return [
      ".sf-domain-list > div > span",
      ".sf-demo-bottom > p",
      ".sf-demo-disclaimer",
      ".sf-hero-lede",
    ].map((selector) => {
      const element = document.querySelector(selector)!;
      let ancestor: Element | null = element;
      let background = "rgb(255, 255, 255)";
      while (ancestor) {
        const color = getComputedStyle(ancestor).backgroundColor;
        if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
          background = color;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const foreground = getComputedStyle(element).color;
      const levels = [luminance(foreground), luminance(background)].sort(
        (a, b) => a - b,
      );
      return {
        selector,
        foreground,
        background,
        contrast: (levels[1] + 0.05) / (levels[0] + 0.05),
      };
    });
  });
  for (const result of results)
    expect(result.contrast, JSON.stringify(result)).toBeGreaterThanOrEqual(4.5);
});
