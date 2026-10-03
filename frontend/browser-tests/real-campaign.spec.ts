import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Account, Campaign, Draft, Health } from "../lib/types";

const OPT_IN = "ontario-plumbers-20261002";
const CAMPAIGN_NAME = "REAL BUSINESSES - Ontario plumbing - manual research";
const DOMAINS = [
  "tidalplumbing.ca",
  "plumbdog.ca",
  "hunterplumbing.ca",
  "drainsrusplumbing.ca",
];
const OFFERING =
  "A hypothetical AI receptionist and appointment assistant concept for small plumbing businesses: answer incoming calls and capture job requests. This is a concept, not a claim of deployed ERA features. Missed calls, employee count, budget, demand and buying intent have not been established.";
const SCOPE = {
  campaign: CAMPAIGN_NAME,
  offering: OFFERING,
  sourceAttribution:
    "Assistant-curated official public business websites supplied for manual research, not automatic app discovery.",
  inputSources: DOMAINS.map((domain) => `https://${domain}`),
  intendedGeography:
    "Brantford and Paris, Ontario, Canada; review fetched evidence rather than assuming each location is confirmed.",
  exclusions:
    "No mocked responses, fictional replacement accounts, paid discovery/contact calls, outreach, email verification claims, or assumed size/budget/intent.",
  environment:
    "Disposable isolated local-demo app database and real public-web research; desktop and responsive-mobile views of the same campaign.",
};

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}
async function attachJson(info: TestInfo, name: string, value: unknown) {
  await info.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
async function getActual<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(path);
  expect(
    response.ok(),
    `Actual service GET ${path}: ${response.status()}`,
  ).toBeTruthy();
  return response.json() as Promise<T>;
}

// This test has NO request interception. It makes bounded real public-web
// requests through the app's own backend, only under the exact explicit opt-in.
test("one real manually curated Ontario plumbing campaign", async ({
  page,
}, info) => {
  test.skip(
    process.env.SIGNALFOUNDRY_REAL_CASE !== OPT_IN,
    "Real public-web research requires the exact explicit opt-in",
  );
  const errors: string[] = [];
  const mutations: { method: string; path: string }[] = [];
  const screenshots: string[] = [];
  let created: Campaign | null = null;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
    ) {
      mutations.push({ method: request.method(), path: url.pathname });
    }
  });
  async function record(name: string) {
    await capture(page, info, name);
    screenshots.push(`${name}.png`);
  }
  await attachJson(info, "00-task-scope-and-real-sources.json", SCOPE);
  try {
    const health = await getActual<Health>(page, "/api/health");
    await attachJson(info, "00-actual-service-health.json", health);
    expect(
      health.mode,
      "This case must use the isolated unauthenticated local backend",
    ).toBe("local-demo");
    expect(
      health.decision_engine,
      "No paid decision provider may be activated",
    ).toBe("rules");
    await attachJson(
      info,
      "00-actual-discovery-provider-status.json",
      await getActual(page, "/api/discovery/status"),
    );
    const existing = await getActual<Campaign[]>(page, "/api/campaigns");
    expect(
      existing,
      "Workflow must supply a fresh disposable database; do not touch existing campaigns",
    ).toHaveLength(0);
    const response = await page.goto("/workspace");
    expect(response?.status()).toBe(200);
    const newCampaign = page
      .getByRole("button", { name: "New campaign", exact: true })
      .first();
    await expect(newCampaign).toBeEnabled();
    await newCampaign.click();
    const dialog = page.getByRole("dialog", {
      name: "New customer campaign",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /^Manual import/ }).check();
    await dialog
      .getByRole("textbox", { name: "Campaign name", exact: true })
      .fill(CAMPAIGN_NAME);
    await dialog
      .getByRole("textbox", { name: /^Your app or offering website/ })
      .fill("");
    await dialog
      .getByRole("textbox", {
        name: "Your company or product name",
        exact: true,
      })
      .fill("AI receptionist and appointment assistant concept");
    await dialog
      .getByRole("textbox", {
        name: "What does your offering help customers do?",
        exact: true,
      })
      .fill(OFFERING);
    await dialog
      .getByRole("textbox", { name: /^Industries\b/ })
      .fill("Plumbing");
    await dialog.getByRole("textbox", { name: /^Company size\b/ }).fill("");
    await dialog
      .getByRole("textbox", { name: /^Buyer roles\b/ })
      .fill("Owner, Operations manager");
    await dialog
      .getByRole("textbox", { name: /^Geographies\b/ })
      .fill("Brantford Ontario, Paris Ontario");
    await dialog
      .getByRole("textbox", { name: /^Observable match criteria\b/ })
      .fill("plumbing, emergency, repair, residential, appointment");
    await dialog.getByRole("textbox", { name: /^Exclusions\b/ }).fill("");
    await dialog
      .getByRole("textbox", { name: /^Company websites\b/ })
      .fill(DOMAINS.join("\n"));
    await dialog
      .getByRole("textbox", { name: "Campaign name", exact: true })
      .scrollIntoViewIfNeeded();
    await record("01-real-campaign-offering-manual-mode");
    await dialog
      .getByRole("button", { name: "Review campaign", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "A clear brief. A focused search." }),
    ).toBeVisible();
    await expect(
      dialog.getByText("4 supplied company websites", { exact: false }),
    ).toBeVisible();
    await expect(dialog.locator(".review-domains")).toContainText(
      DOMAINS.join(", "),
    );
    await expect(
      dialog.getByRole("button", { name: "Create & research", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("heading", { name: "A clear brief. A focused search." })
      .scrollIntoViewIfNeeded();
    await record("02-real-campaign-reviewed-offering-and-domains");

    const creationResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/campaigns" &&
        response.request().method() === "POST",
    );
    const researchResponse = page.waitForResponse(
      (response) =>
        /^\/api\/campaigns\/[^/]+\/research$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "POST",
      { timeout: 180_000 },
    );
    await dialog
      .getByRole("button", { name: "Create & research", exact: true })
      .click();
    const creation = await creationResponse;
    const creationBody = await creation.json();
    await attachJson(info, "03-actual-created-campaign.json", creationBody);
    expect(
      creation.ok(),
      `Actual create returned ${creation.status()}`,
    ).toBeTruthy();
    created = creationBody as Campaign;
    expect(created.mode).toBe("manual");
    const researchedResponse = await researchResponse;
    const researchedBody = await researchedResponse.json();
    await attachJson(info, "03-actual-research-response.json", researchedBody);
    expect(
      researchedResponse.ok(),
      `Actual research returned ${researchedResponse.status()}; inspect preserved response`,
    ).toBeTruthy();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    const accounts = await getActual<Account[]>(
      page,
      `/api/campaigns/${created.id}/accounts`,
    );
    const campaign = await getActual<Campaign>(
      page,
      `/api/campaigns/${created.id}`,
    );
    await attachJson(
      info,
      "03-actual-researched-campaign-and-errors.json",
      campaign,
    );
    await attachJson(info, "03-actual-accounts-and-evidence.json", accounts);
    await page.locator(".accounts-panel").scrollIntoViewIfNeeded();
    await record("03-real-public-web-research-results");
    if (campaign.errors.length) {
      await page.locator(".campaign-errors summary").click();
      await page.locator(".campaign-errors").scrollIntoViewIfNeeded();
      await record("03-real-public-web-fetch-limitations");
    }
    expect(
      accounts.length,
      "At least one real site must produce an account; preserve failures without replacing data",
    ).toBeGreaterThan(0);
    for (const account of accounts) {
      expect(account.is_demo).toBe(false);
      expect(DOMAINS).toContain(account.domain.replace(/^www\./, ""));
      expect(account.evidence.every((evidence) => !evidence.is_demo)).toBe(
        true,
      );
    }
    const selected = accounts.find((account) =>
      account.evidence.some(
        (evidence) => evidence.excerpt.trim() && !evidence.is_demo,
      ),
    );
    expect(
      selected,
      "A real fetched account with actual source evidence is required",
    ).toBeDefined();
    if (!selected)
      throw new Error(
        "No real sourced account available; no substitute will be created.",
      );
    await attachJson(info, "04-selected-real-account.json", selected);
    await page
      .getByRole("button", {
        name: `View ${selected.name} details`,
        exact: true,
      })
      .click();
    const drawer = page.getByRole("dialog", {
      name: `${selected.name} account details`,
      exact: true,
    });
    await expect(
      drawer.getByText("Fictional demo", { exact: true }),
    ).toHaveCount(0);
    await drawer.getByRole("tab", { name: /^Evidence \(/ }).click();
    await expect(drawer.locator(".evidence-card")).toHaveCount(
      selected.evidence.length,
    );
    await expect(
      drawer.getByRole("link", { name: "View source", exact: true }).first(),
    ).toHaveAttribute("href", /^https?:\/\//);
    await drawer.locator(".evidence-card").first().scrollIntoViewIfNeeded();
    await record("04-real-source-evidence-desktop");
    await drawer
      .getByRole("button", { name: "Add to shortlist", exact: true })
      .click();
    await expect(
      drawer.getByRole("button", { name: "Shortlisted", exact: true }),
    ).toBeEnabled();
    const shortlisted = await getActual<Account>(
      page,
      `/api/accounts/${selected.id}`,
    );
    expect(shortlisted.status).toBe("shortlisted");
    await attachJson(info, "05-actual-shortlisted-account.json", shortlisted);
    await drawer.locator(".account-head").scrollIntoViewIfNeeded();
    await record("05-real-account-shortlisted");
    await drawer
      .getByRole("tab", { name: "Outreach draft", exact: true })
      .click();
    const draftResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/accounts/${selected.id}/draft` &&
        response.request().method() === "POST",
    );
    await drawer
      .getByRole("button", { name: "Generate outreach draft", exact: true })
      .click();
    const actualDraftResponse = await draftResponse;
    const actualDraft = (await actualDraftResponse.json()) as Draft;
    await attachJson(
      info,
      "06-actual-grounded-outreach-draft.json",
      actualDraft,
    );
    expect(actualDraftResponse.ok()).toBeTruthy();
    await expect(drawer.locator(".draft-subject")).toHaveText(
      actualDraft.subject,
    );
    await expect(drawer.locator(".draft-body")).toHaveText(actualDraft.body);
    expect(actualDraft.warning).toContain("nothing is sent");
    await drawer.locator(".outreach-draft").scrollIntoViewIfNeeded();
    await record("06-real-grounded-draft-not-sent");
    await drawer
      .getByRole("button", {
        name: `Close ${selected.name} account details`,
        exact: true,
      })
      .click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export full campaign CSV", exact: true })
      .click();
    const download = await downloadPromise;
    const csvPath = info.outputPath("07-real-ontario-plumbing-campaign.csv");
    await download.saveAs(csvPath);
    const csv = await readFile(csvPath, "utf8");
    expect(csv).toContain(selected.domain);
    expect(csv).toContain("shortlisted");
    expect(csv).toContain("evidence_urls");
    expect(csv).toContain("false");
    await info.attach("07-real-ontario-plumbing-campaign.csv", {
      path: csvPath,
      contentType: "text/csv",
    });
    await expect(
      page.getByText("Campaign CSV downloaded", { exact: true }),
    ).toBeVisible();
    await record("07-real-campaign-csv-downloaded");

    // Responsive rendering of the very same real results, never another run.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".accounts-panel").scrollIntoViewIfNeeded();
    await record("08-real-campaign-results-mobile-390");
    await page
      .getByRole("button", {
        name: `View ${selected.name} details`,
        exact: true,
      })
      .click();
    await drawer.getByRole("tab", { name: /^Evidence \(/ }).click();
    await drawer.locator(".evidence-card").first().scrollIntoViewIfNeeded();
    await record("09-real-source-evidence-mobile-390");
    await drawer
      .getByRole("button", {
        name: `Close ${selected.name} account details`,
        exact: true,
      })
      .click();
    const finalCampaigns = await getActual<Campaign[]>(page, "/api/campaigns");
    expect(finalCampaigns).toHaveLength(1);
    expect(
      mutations.filter((request) => request.path.endsWith("/research")),
    ).toHaveLength(1);
    expect(
      mutations.filter((request) => request.path === "/api/campaigns"),
    ).toHaveLength(1);
    expect(errors, "Uncaught browser errors").toEqual([]);
    await attachJson(info, "10-real-case-completed-manifest.json", {
      ...SCOPE,
      campaignId: created.id,
      retrievedAccounts: accounts.length,
      inaccessibleSources: campaign.errors,
      selectedAccount: {
        id: selected.id,
        name: selected.name,
        domain: selected.domain,
      },
      screenshots,
      researchRequests: 1,
      mutations,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    await capture(page, info, "failure-actual-app-state").catch(() => {});
    await attachJson(info, "failure-details.json", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: created?.id,
      browserErrors: errors,
      mutations,
      completedScreenshots: screenshots,
    });
    if (created) {
      const responses = await Promise.allSettled([
        getActual(page, `/api/campaigns/${created.id}`),
        getActual(page, `/api/campaigns/${created.id}/accounts`),
      ]);
      await attachJson(info, "failure-actual-server-state.json", responses);
    }
    throw error;
  }
});
