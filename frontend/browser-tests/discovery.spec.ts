import {
  expect,
  test as base,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
import { exportAccountsCsv } from "../lib/account-export";
import type {
  Account,
  Campaign,
  CampaignInput,
  DiscoveryStatus,
  Profile,
  WorkspaceData,
} from "../lib/types";

const NOW = "2026-10-02T12:00:00Z";
const PROFILE: Profile = {
  company_name: "Northstar",
  description: "We help B2B SaaS sales teams improve their pipeline.",
  industries: ["B2B SaaS"],
  company_sizes: ["11–50"],
  geographies: ["United States"],
  buyer_roles: ["Head of Sales"],
  keywords: ["sales operations"],
  exclusions: ["Consumer apps"],
};
const READY: DiscoveryStatus = {
  enabled: true,
  max_target_count: 30,
  max_cost_microusd: 1_000_000,
  blockers: [],
  providers: {
    discovery: {
      configured: true,
      licensed: true,
      reason: "Exa configured and licensed",
    },
    contacts: {
      configured: true,
      licensed: true,
      reason: "People Data Labs configured and licensed",
    },
    verification: {
      configured: false,
      licensed: false,
      reason: "Optional verifier not configured; emails remain unverified",
    },
  },
};
const DISABLED: DiscoveryStatus = {
  ...READY,
  enabled: false,
  blockers: [
    "Configure an approved company discovery provider and budget before research.",
  ],
  providers: {
    ...READY.providers,
    discovery: {
      configured: false,
      licensed: false,
      reason: "Exa is not configured",
    },
    contacts: {
      configured: true,
      licensed: false,
      reason: "People Data Labs license approval required",
    },
  },
};

// Fail on uncaught browser errors, even when an assertion otherwise passes.
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
      expect(errors, "Uncaught workspace errors").toEqual([]);
    },
    { auto: true },
  ],
});

type Options = {
  profile?: Profile | null;
  providers?: "ready" | "disabled" | "error" | "company-only";
  maxTargets?: number;
  campaigns?: Campaign[];
  accounts?: Account[];
  createFailures?: number;
  researchFailures?: number;
  suggestionFailures?: number;
  refreshFailuresAfterResearch?: number;
  testData?: boolean;
  statusFailures?: number;
};

async function mockWorkspace(page: Page, options: Options = {}) {
  const workspace: WorkspaceData = {
    id: "workspace-1",
    name: "Northstar",
    website: options.profile === null ? null : "https://northstar.example.com",
    profile:
      options.profile === undefined
        ? structuredClone(PROFILE)
        : options.profile,
    created_at: NOW,
  };
  const state = {
    workspace,
    campaigns: structuredClone(options.campaigns ?? []),
    accounts: structuredClone(options.accounts ?? []),
    creates: [] as CampaignInput[],
    research: [] as string[],
    suggestions: [] as { website: string }[],
    unknown: [] as string[],
    createFailures: options.createFailures ?? 0,
    researchFailures: options.researchFailures ?? 0,
    suggestionFailures: options.suggestionFailures ?? 0,
    refreshFailures: options.refreshFailuresAfterResearch ?? 0,
    researched: false,
    drafts: [] as string[],
    statusChanges: [] as { id: string; status: string }[],
    statusFailures: options.statusFailures ?? 0,
    suppressions: [] as {
      domain: string;
      reason: string | null;
      updated_at: string;
    }[],
    exports: [] as string[],
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice(4);
    const method = request.method();
    const send = (json: unknown, status = 200) =>
      route.fulfill({ status, json });
    if (path === "/workspace" && method === "GET") return send(state.workspace);
    if (path === "/health")
      return send({
        status: "ok",
        mode: "local-demo",
        decision_engine: "rules",
        providers: { discovery: "exa", contacts: "pdl" },
      });
    if (path === "/discovery/status") {
      if (options.providers === "error")
        return send({ detail: "Provider status temporarily unavailable" }, 503);
      const status = {
        ...(options.providers === "disabled" ? DISABLED : READY),
        max_target_count: options.maxTargets ?? 30,
      };
      if (options.providers === "company-only")
        status.providers = {
          ...status.providers,
          contacts: {
            configured: false,
            licensed: false,
            reason: "Optional contacts unavailable",
          },
        };
      return send(
        options.testData && options.providers !== "disabled"
          ? {
              ...status,
              providers: {
                discovery: {
                  ...status.providers.discovery,
                  reason: "TEST DATA: simulated company discovery readiness",
                },
                contacts: {
                  ...status.providers.contacts,
                  reason: "TEST DATA: simulated contact provider readiness",
                },
                verification: {
                  ...status.providers.verification,
                  reason:
                    "TEST DATA: verifier unavailable; addresses remain unverified",
                },
              },
            }
          : status,
      );
    }
    if (path === "/campaigns/suggest-brief" && method === "POST") {
      state.suggestions.push(request.postDataJSON());
      if (state.suggestionFailures-- > 0)
        return send(
          {
            detail:
              "The public website could not be read. Describe your offering instead.",
          },
          422,
        );
      return send({
        profile: {
          ...PROFILE,
          company_name: "Northstar from website",
          buyer_roles: ["Revenue Operations"],
        },
        website: "https://northstar.example.com",
      });
    }
    if (path === "/campaigns" && method === "GET") {
      if (state.researched && state.refreshFailures-- > 0)
        return send(
          { detail: "Campaign refresh unavailable. Try again." },
          503,
        );
      return send(state.campaigns);
    }
    if (path === "/campaigns" && method === "POST") {
      const input = request.postDataJSON() as CampaignInput;
      state.creates.push(input);
      if (state.createFailures-- > 0)
        return send(
          { detail: "Campaign could not be saved. Please retry." },
          503,
        );
      const campaign: Campaign = {
        ...input,
        id: `campaign-${state.campaigns.length + 1}`,
        status: "draft",
        created_at: NOW,
        updated_at: NOW,
        account_count: 0,
        qualified_count: 0,
        errors: [],
      };
      state.campaigns.unshift(campaign);
      return send(campaign, 201);
    }
    const research = path.match(/^\/campaigns\/([^/]+)\/research$/);
    if (research && method === "POST") {
      state.research.push(research[1]);
      if (state.researchFailures-- > 0)
        return send(
          {
            detail:
              "Discovery provider temporarily unavailable. Retry this saved campaign.",
          },
          503,
        );
      const campaign = state.campaigns.find((item) => item.id === research[1]);
      if (!campaign) return send({ detail: "Campaign not found" }, 404);
      campaign.status = "complete";
      campaign.account_count = state.accounts.filter(
        (account) => account.campaign_id === campaign.id,
      ).length;
      campaign.qualified_count = state.accounts.filter(
        (account) => account.campaign_id === campaign.id && account.score >= 65,
      ).length;
      state.researched = true;
      return send(campaign);
    }
    const accounts = path.match(/^\/campaigns\/([^/]+)\/accounts$/);
    if (accounts)
      return send(
        state.accounts.filter((account) => account.campaign_id === accounts[1]),
      );
    const exported = path.match(/^\/campaigns\/([^/]+)\/export\.csv$/);
    if (exported && method === "GET") {
      state.exports.push(exported[1]);
      return route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        body: exportAccountsCsv(
          state.accounts.filter(
            (account) => account.campaign_id === exported[1],
          ),
        ),
      });
    }
    const draft = path.match(/^\/accounts\/([^/]+)\/draft$/);
    if (draft && method === "POST") {
      state.drafts.push(draft[1]);
      return send({
        subject: "TEST DATA: a relevant workflow idea for your sales team",
        body: "Hi TEST DATA Taylor,\n\nYour fictional company homepage describes tools for growing sales teams. TEST DATA Northstar helps B2B SaaS teams improve their pipeline. Would a short conversation about those workflows be useful?\n\nTEST DATA only. This draft has not been sent.",
        basis: [
          "TEST DATA fictional company homepage: tools for growing sales teams",
          "Saved campaign brief: sales operations",
        ],
        engine: "grounded_template",
        warning:
          "TEST DATA mock-backed draft. Review all claims and contact details. Nothing is sent.",
      });
    }
    if (path === "/workspace/suppressions" && method === "GET")
      return send({
        items: state.suppressions,
        is_done: true,
        continue_cursor: null,
      });
    if (path === "/workspace/suppressions/restore" && method === "POST") {
      state.suppressions = state.suppressions.filter(
        (item) => item.domain !== request.postDataJSON().domain,
      );
      return send({ restored: true });
    }
    const account = path.match(/^\/accounts\/([^/]+)$/);
    if (account && method === "GET")
      return send(state.accounts.find((item) => item.id === account[1]));
    if (account && method === "PATCH") {
      const target = state.accounts.find((item) => item.id === account[1]);
      if (!target) return send({ detail: "Account not found" }, 404);
      if (state.statusFailures-- > 0)
        return send(
          { detail: "Review could not be saved. Please retry." },
          503,
        );
      const feedback = request.postDataJSON();
      target.status = feedback.status;
      target.review_reason = feedback.reason ?? null;
      target.reviewed_at = NOW;
      target.suppress_workspace = feedback.preserve_workspace_suppression
        ? target.suppress_workspace
        : Boolean(feedback.suppress_workspace);
      state.suppressions = state.suppressions.filter(
        (item) => item.domain !== target.domain,
      );
      if (target.suppress_workspace)
        state.suppressions.push({
          domain: target.domain,
          reason: target.review_reason ?? null,
          updated_at: NOW,
        });
      state.statusChanges.push({ id: target.id, status: target.status });
      return send(target);
    }
    state.unknown.push(`${method} ${path}`);
    return send(
      { detail: `Unexpected mocked request: ${method} ${path}` },
      404,
    );
  });
  return state;
}

// Scope editable fields by their semantic control role. Radio-card labels also
// mention company websites, so broad getByLabel text matches the wrong control.
async function openCampaign(page: Page, profile = true) {
  const response = await page.goto("/workspace");
  expect(response?.status()).toBe(200);
  await page
    .getByRole("button", {
      name: profile
        ? "Create your first campaign"
        : "Or describe your offering instead",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "New customer campaign" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Campaign name", exact: true })
    .fill("October discovery");
  return dialog;
}

async function review(dialog: Locator) {
  await dialog
    .getByRole("button", { name: "Review campaign", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "A clear brief. A focused search." }),
  ).toBeVisible();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(
    dialog.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    dialogs: [...document.querySelectorAll("dialog[open]")].map((dialog) => ({
      visible: dialog.clientWidth,
      scroll: dialog.scrollWidth,
    })),
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  for (const dialog of dimensions.dialogs)
    expect(dialog.scroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(
      dialog.visible + 1,
    );
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  // Reset only the document scroll; preserve the dialog's own evidence/form position.
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await noOverflow(page);
  const path = testInfo.outputPath(`${testInfo.project.name}-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function clickTwice(button: Locator) {
  // Both clicks share one browser task: a state-only guard is insufficient.
  await button.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
}

test("description-only discovery needs no profile, URL, or prospect list and saves the reviewed snapshot once", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, { profile: null });
  const dialog = await openCampaign(page, false);
  await expect(
    dialog.getByRole("radio", { name: /^Find customers/ }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("textbox", { name: /^Company websites\b/ }),
  ).toHaveCount(0);
  await dialog
    .getByRole("textbox", {
      name: "What does your offering help customers do?",
      exact: true,
    })
    .fill(PROFILE.description);
  await dialog.getByRole("button", { name: "Suggest from offering" }).click();
  await expect(
    dialog.getByText(/Starting suggestions from explicit buyer language/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: /^Buyer roles\b/ }),
  ).toHaveValue("Head of Sales, Revenue Operations");
  await expect(
    dialog.getByRole("textbox", { name: /^Geographies\b/ }),
  ).toHaveValue("");
  await dialog
    .getByRole("textbox", { name: /^Buyer roles\b/ })
    .fill("VP of Sales, Revenue Operations");
  await capture(page, testInfo, "offering-only-editable-brief");
  await review(dialog);
  await expect(
    dialog.getByRole("button", { name: "Find customers", exact: true }),
  ).toBeDisabled();
  expect(state.creates).toHaveLength(0);
  await dialog.getByRole("checkbox").check();
  await capture(page, testInfo, "reviewed-target-brief");
  await clickTwice(
    dialog.getByRole("button", { name: "Save draft", exact: true }),
  );
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(1);
  expect(state.creates[0]).toMatchObject({
    mode: "discovery",
    domains: [],
    offering_website: null,
    target_count: 20,
    profile_snapshot: { buyer_roles: ["VP of Sales", "Revenue Operations"] },
  });
  expect(state.research).toHaveLength(0);
  expect(state.workspace.profile).toBeNull();
  await expect(
    page.getByRole("button", { name: "New campaign", exact: true }).last(),
  ).toBeEnabled();
  await expect(
    page.getByText("Campaign draft saved. No research has started."),
  ).toBeVisible();
  await page.getByText("Saved campaign target brief", { exact: true }).click();
  await expect(page.locator(".campaign-snapshot")).toContainText("VP of Sales");
  await capture(page, testInfo, "saved-campaign-snapshot");
  expect(state.unknown).toEqual([]);
});

test("website suggestions stay editable and back, cancel, escape, and reopen do not create a campaign", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page);
  const dialog = await openCampaign(page);
  await clickTwice(
    dialog.getByRole("button", { name: "Draft brief from website" }),
  );
  await expect(
    dialog.getByRole("textbox", {
      name: "Your company or product name",
      exact: true,
    }),
  ).toHaveValue("Northstar from website");
  expect(state.suggestions).toHaveLength(1);
  await dialog
    .getByRole("textbox", { name: /^Industries\b/ })
    .fill("Financial services");
  await review(dialog);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Back to edit" }).click();
  await expect(
    dialog.getByRole("textbox", { name: /^Industries\b/ }),
  ).toHaveValue("Financial services");
  await review(dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/workspace");
  await page
    .getByRole("button", { name: "Create your first campaign", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Campaign name", exact: true }),
  ).toHaveValue("");
  await expect(
    dialog.getByRole("textbox", { name: /^Industries\b/ }),
  ).toHaveValue("B2B SaaS");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(0);
  expect(state.research).toHaveLength(0);
  await capture(page, testInfo, "cancelled-campaign-workspace");
});

test("unconfigured or unlicensed providers permit drafts but cannot start discovery", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, { providers: "disabled" });
  const dialog = await openCampaign(page);
  await expect(
    dialog.getByText("Discovery unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("People Data Labs license approval required"),
  ).toBeVisible();
  await review(dialog);
  await dialog.getByRole("checkbox").check();
  await expect(
    dialog.getByRole("button", { name: "Find customers", exact: true }),
  ).toHaveCount(0);
  await capture(page, testInfo, "providers-unavailable-draft");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Find customers", exact: true }),
  ).toBeDisabled();
  expect(state.research).toHaveLength(0);
});

test("provider-status failures fail closed and a rejected save can be retried", async ({
  page,
}) => {
  const state = await mockWorkspace(page, {
    providers: "error",
    createFailures: 1,
  });
  const dialog = await openCampaign(page);
  await expect(
    dialog.getByText(/Provider status could not be confirmed/),
  ).toBeVisible();
  await review(dialog);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Campaign could not be saved",
  );
  await expect(
    dialog.getByRole("button", { name: "Back to edit" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(2);
  expect(state.campaigns).toHaveLength(1);
  expect(state.research).toHaveLength(0);
});

test("optional email verification does not block discovery and repeated clicks queue once", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, { maxTargets: 5 });
  const dialog = await openCampaign(page);
  await expect(
    dialog.getByRole("spinbutton", { name: /^Maximum companies to find\b/ }),
  ).toHaveValue("5");
  await expect(
    dialog.getByText("Company discovery ready", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/Optional verifier not configured/),
  ).toBeVisible();
  await review(dialog);
  await dialog.getByRole("checkbox").check();
  await clickTwice(
    dialog.getByRole("button", { name: "Find customers", exact: true }),
  );
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(1);
  expect(state.creates[0].target_count).toBe(5);
  expect(state.research).toEqual(["campaign-1"]);
  await capture(page, testInfo, "discovery-completed-empty-results");
});

test("research failures retain the saved campaign and retry without duplicate creation", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, { researchFailures: 1 });
  const dialog = await openCampaign(page);
  await review(dialog);
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Find customers", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Discovery provider temporarily unavailable",
  );
  await expect(
    dialog.getByText(/Campaign saved. Retrying uses the same campaign/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Back to edit" }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).toBeDisabled();
  await capture(page, testInfo, "saved-campaign-retry");
  await clickTwice(
    dialog.getByRole("button", { name: "Retry research", exact: true }),
  );
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(1);
  expect(state.research).toEqual(["campaign-1", "campaign-1"]);
});

test("a failed workspace refresh never repeats already completed research", async ({
  page,
}) => {
  const state = await mockWorkspace(page, { refreshFailuresAfterResearch: 1 });
  const dialog = await openCampaign(page);
  await review(dialog);
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Find customers", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Campaign refresh unavailable",
  );
  await expect(
    dialog.getByRole("button", { name: "Retry research", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Open saved campaign", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(1);
  expect(state.research).toEqual(["campaign-1"]);
});

test("a website-preview failure preserves edits and allows description-only hypotheses", async ({
  page,
}) => {
  const state = await mockWorkspace(page, { suggestionFailures: 1 });
  const dialog = await openCampaign(page);
  await dialog
    .getByRole("button", { name: "Draft brief from website" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Describe your offering instead",
  );
  await expect(
    dialog.getByRole("textbox", {
      name: "What does your offering help customers do?",
      exact: true,
    }),
  ).toHaveValue(PROFILE.description);
  await dialog.getByRole("button", { name: "Suggest from offering" }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(
    dialog.getByText(/Starting suggestions from explicit buyer language/),
  ).toBeVisible();
  await review(dialog);
  expect(state.suggestions).toHaveLength(1);
  expect(state.creates).toHaveLength(0);
});

test("manual import remains optional, validates input, and works without discovery providers", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, {
    providers: "disabled",
    maxTargets: 1,
  });
  const dialog = await openCampaign(page);
  await dialog.getByRole("radio", { name: /^Manual import/ }).check();
  await dialog
    .getByRole("textbox", { name: /^Company websites\b/ })
    .fill("localhost\nexample.com");
  await dialog
    .getByRole("button", { name: "Review campaign", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "invalid website entries",
  );
  expect(state.creates).toHaveLength(0);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "prospects.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Company,Website\nAlpha,https://alpha.example.com/about\nDuplicate,alpha.example.com\nBeta,beta.example.com\n",
    ),
  });
  await expect(
    dialog.getByText(/2 unique company websites imported/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: /^Company websites\b/ }),
  ).toHaveValue("alpha.example.com\nbeta.example.com");
  await review(dialog);
  await expect(dialog.getByText("2 supplied company websites")).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await capture(page, testInfo, "manual-import-reviewed");
  await dialog
    .getByRole("button", { name: "Create & research", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.creates[0]).toMatchObject({
    mode: "manual",
    domains: ["alpha.example.com", "beta.example.com"],
    target_count: 2,
  });
  expect(state.research).toEqual(["campaign-1"]);
});

test("campaign snapshots and provider provenance remain visible with honest contact verification", async ({
  page,
}, testInfo) => {
  const campaign: Campaign = {
    id: "campaign-1",
    name: "Saved October brief",
    mode: "discovery",
    enrich_contacts: true,
    status: "complete",
    created_at: NOW,
    updated_at: NOW,
    account_count: 1,
    qualified_count: 1,
    domains: [],
    errors: [],
    target_count: 5,
    offering_website: "https://northstar.example.com",
    profile_snapshot: { ...PROFILE, buyer_roles: ["Chief Operations Officer"] },
  };
  const account: Account = {
    id: "account-1",
    campaign_id: campaign.id,
    name: "Acme",
    domain: "acme.example.com",
    description: "A source-backed example company.",
    industry: "B2B SaaS",
    employee_range: "11–50",
    location: "United States",
    score: 72,
    confidence: "medium",
    decision_engine: "rules",
    status: "new",
    why_fit: ["Matching industry"],
    why_now: [],
    unknowns: ["Buying intent is unknown"],
    score_breakdown: [],
    is_demo: false,
    researched_at: NOW,
    source_provider: "exa",
    source_url: "https://acme.example.com/about",
    retrieved_at: NOW,
    license_restrictions: ["Internal research only"],
    evidence: [
      {
        id: "evidence-1",
        title: "Company homepage",
        url: "https://acme.example.com",
        excerpt: "Tools for growing sales teams",
        kind: "company",
        published_at: null,
        retrieved_at: NOW,
        is_demo: false,
      },
    ],
    contacts: [
      {
        name: "Taylor Morgan",
        role: "Head of Sales",
        email: "taylor@acme.example.com",
        verification_status: "unverified",
        source_url: "https://acme.example.com/team",
        note: "Returned by the contact provider",
        provider: "people_data_labs",
        retrieved_at: NOW,
        email_status: "not_checked",
      },
      {
        name: "Jordan Lee",
        role: "Operations Lead",
        email: null,
        verification_status: "not_available",
        source_url: null,
        note: "No email was returned",
        provider: "people_data_labs",
        retrieved_at: NOW,
      },
    ],
  };
  const state = await mockWorkspace(page, {
    campaigns: [campaign],
    accounts: [account],
    profile: { ...PROFILE, buyer_roles: ["Different workspace buyer"] },
  });
  await page.goto("/workspace");
  await page.getByText("Saved campaign target brief", { exact: true }).click();
  await expect(page.locator(".campaign-snapshot")).toContainText(
    "Chief Operations Officer",
  );
  await expect(page.locator(".campaign-snapshot")).not.toContainText(
    "Different workspace buyer",
  );
  await page
    .getByRole("button", { name: "View Acme details", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Acme account details" });
  await expect(
    drawer.getByRole("heading", { name: "Discovery source", exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("link", { name: "Company discovery source" }),
  ).toHaveAttribute("href", "https://acme.example.com/about");
  await expect(
    drawer.getByText("Usage restrictions: Internal research only"),
  ).toBeVisible();
  await drawer
    .getByRole("heading", { name: "Discovery source", exact: true })
    .scrollIntoViewIfNeeded();
  await capture(page, testInfo, "company-discovery-provenance");
  await expect(
    drawer.getByText("Provider-returned · unverified", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Email not available", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText(/Source: people_data_labs/)).toHaveCount(2);
  await expect(
    drawer.getByText("Independently verified", { exact: true }),
  ).toHaveCount(0);
  await expect(drawer.locator('a[href^="mailto:"]')).toHaveCount(0);
  await drawer.locator(".contact-email").scrollIntoViewIfNeeded();
  await capture(page, testInfo, "provider-provenance-unverified-contacts");
  await drawer.getByRole("tab", { name: "Evidence (1)" }).click();
  await expect(
    drawer.getByRole("link", { name: "View source" }),
  ).toHaveAttribute("href", "https://acme.example.com/");
  await capture(page, testInfo, "discovery-source-evidence");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View Acme details", exact: true }),
  ).toBeFocused();
  expect(state.unknown).toEqual([]);
});

// This is an actual rendered-app walkthrough with intercepted REST responses.
// Every company, contact, source, provider response and draft is a fictional
// test fixture. It proves the UI flow, not live discovery or provider licensing.
test("TEST DATA one complete customer discovery campaign with ordered screenshots", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const fictionalAccount: Account = {
    id: "account-walkthrough",
    campaign_id: "campaign-1",
    name: "TEST DATA Acme Cloud",
    domain: "acme.example.com",
    description:
      "TEST DATA: a fictional B2B SaaS company providing tools for growing sales teams.",
    industry: "B2B SaaS",
    employee_range: "11–50",
    location: "United States",
    score: 72,
    confidence: "medium",
    decision_engine: "rules",
    status: "new",
    why_fit: [
      "TEST DATA fixture matches the reviewed B2B SaaS industry and company-size criteria",
    ],
    why_now: [],
    unknowns: [
      "Buying intent is unknown",
      "Email has not been independently verified",
    ],
    score_breakdown: [
      {
        label: "TEST DATA industry match",
        points: 30,
        max_points: 40,
        reason: "Fictional homepage describes software for sales teams",
      },
    ],
    is_demo: true,
    researched_at: NOW,
    source_provider: "TEST DATA simulated Exa",
    source_url: "https://acme.example.com",
    retrieved_at: NOW,
    license_restrictions: [
      "TEST DATA only; no live provider data or licensing claim",
    ],
    evidence: [
      {
        id: "evidence-walkthrough",
        title: "TEST DATA fictional company homepage",
        url: "https://acme.example.com",
        excerpt: "TEST DATA: We build tools for growing sales teams.",
        kind: "fit",
        published_at: null,
        retrieved_at: NOW,
        is_demo: true,
      },
    ],
    contacts: [
      {
        name: "TEST DATA Taylor Morgan",
        role: "Head of Sales",
        email: "fictional-taylor@acme.example.com",
        verification_status: "unverified",
        source_url: null,
        note: "TEST DATA fictional contact. No live lookup was performed.",
        provider: "TEST DATA simulated People Data Labs",
        retrieved_at: NOW,
        email_status: "not_checked",
      },
    ],
  };
  const state = await mockWorkspace(page, {
    profile: null,
    accounts: [fictionalAccount],
    testData: true,
  });
  state.workspace.name = "TEST DATA Northstar";
  const filenames = [
    "01-test-data-offering",
    "02-test-data-editable-brief",
    "03-test-data-reviewed-campaign",
    "04-test-data-discovery-results",
    "05-test-data-evidence",
    "06-test-data-unverified-contact",
    "07-test-data-shortlisted-account",
    "08-test-data-grounded-draft",
    "09-test-data-csv-export-confirmed",
    "10-honest-providers-unavailable",
  ];
  const captured: string[] = [];
  async function record(name: string) {
    await capture(page, testInfo, name);
    captured.push(`${testInfo.project.name}-${name}.png`);
  }
  await testInfo.attach("expected-screenshot-manifest.json", {
    body: JSON.stringify(
      {
        scope:
          "MOCK-BACKED UI VERIFICATION ONLY. All company, contact, provider, evidence and draft data is fictional TEST DATA. No live discovery, licensed-provider access, outreach or paid call is claimed.",
        viewport: testInfo.project.name,
        expected: filenames.map(
          (name) => `${testInfo.project.name}-${name}.png`,
        ),
        expectedExport: "test-data-campaign-export.csv",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });

  const dialog = await openCampaign(page, false);
  await test.step("1. Describe the fictional offering", async () => {
    await dialog
      .getByRole("textbox", { name: "Campaign name", exact: true })
      .fill("TEST DATA October customer discovery");
    await dialog
      .getByRole("textbox", {
        name: "What does your offering help customers do?",
        exact: true,
      })
      .fill(
        "TEST DATA: We help B2B SaaS sales teams improve their pipeline and sales operations.",
      );
    await expect(
      dialog.getByRole("radio", { name: /^Find customers/ }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("textbox", { name: /^Company websites\b/ }),
    ).toHaveCount(0);
    await dialog
      .getByRole("textbox", { name: "Campaign name", exact: true })
      .scrollIntoViewIfNeeded();
    await record(filenames[0]);
  });
  await test.step("2. Generate and edit target hypotheses", async () => {
    await dialog.getByRole("button", { name: "Suggest from offering" }).click();
    await expect(
      dialog.getByText(/Starting suggestions from explicit buyer language/),
    ).toBeVisible();
    await dialog
      .getByRole("textbox", { name: /^Buyer roles\b/ })
      .fill("Head of Sales, Revenue Operations");
    await dialog
      .getByRole("textbox", { name: /^Company size\b/ })
      .fill("11–50");
    await dialog
      .getByRole("textbox", { name: /^Geographies\b/ })
      .fill("United States");
    await dialog
      .getByRole("textbox", { name: /^Exclusions\b/ })
      .fill("Consumer apps");
    await dialog
      .getByRole("spinbutton", { name: /^Maximum companies to find\b/ })
      .fill("5");
    await dialog
      .getByText("Optional contact coverage", { exact: true })
      .click();
    await dialog
      .getByRole("checkbox", { name: /Also request named contacts/ })
      .check();
    await dialog
      .getByText("EDITABLE TARGET BRIEF", { exact: true })
      .scrollIntoViewIfNeeded();
    await record(filenames[1]);
  });
  await test.step("3. Explicitly review before creating or searching", async () => {
    await review(dialog);
    expect(state.creates).toHaveLength(0);
    expect(state.research).toHaveLength(0);
    await expect(
      dialog.getByText("TEST DATA October customer discovery", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("TEST DATA: simulated company discovery readiness"),
    ).toBeVisible();
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("heading", { name: "A clear brief. A focused search." })
      .scrollIntoViewIfNeeded();
    await record(filenames[2]);
  });
  await test.step("4. Find customers and review the resulting account", async () => {
    await dialog
      .getByRole("button", { name: "Find customers", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "View TEST DATA Acme Cloud details",
        exact: true,
      }),
    ).toBeVisible();
    expect(state.creates).toHaveLength(1);
    expect(state.creates[0]).toMatchObject({
      name: "TEST DATA October customer discovery",
      domains: [],
      enrich_contacts: true,
      mode: "discovery",
      target_count: 5,
      profile_snapshot: {
        company_name: "TEST DATA Northstar",
        company_sizes: ["11–50"],
        geographies: ["United States"],
      },
    });
    expect(state.research).toEqual(["campaign-1"]);
    await page.locator(".accounts-panel").scrollIntoViewIfNeeded();
    await record(filenames[3]);
  });
  await page
    .getByRole("button", {
      name: "View TEST DATA Acme Cloud details",
      exact: true,
    })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "TEST DATA Acme Cloud account details",
  });
  await test.step("5. Inspect the source evidence and its fictional-data warning", async () => {
    await drawer.getByRole("tab", { name: "Evidence (1)" }).click();
    await expect(
      drawer.getByText("TEST DATA fictional company homepage", { exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByText("Fictional source · not a live website", {
        exact: true,
      }),
    ).toBeVisible();
    await drawer.locator(".evidence-card").scrollIntoViewIfNeeded();
    await record(filenames[4]);
  });
  await test.step("6. Confirm the contact stays unverified", async () => {
    await drawer.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(
      drawer.getByText("Provider-returned · unverified", { exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByText("Independently verified", { exact: true }),
    ).toHaveCount(0);
    await drawer.locator(".contact-card").scrollIntoViewIfNeeded();
    await record(filenames[5]);
  });
  await test.step("7. Shortlist the account without sending anything", async () => {
    await drawer
      .getByRole("button", { name: "Add to shortlist", exact: true })
      .click();
    await expect(
      drawer.getByRole("button", { name: "Shortlisted", exact: true }),
    ).toBeEnabled();
    expect(state.statusChanges).toEqual([
      { id: "account-walkthrough", status: "shortlisted" },
    ]);
    await drawer.locator(".account-head").scrollIntoViewIfNeeded();
    await record(filenames[6]);
  });
  await test.step("8. Generate an evidence-grounded draft for human review", async () => {
    await drawer
      .getByRole("tab", { name: "Outreach draft", exact: true })
      .click();
    await drawer
      .getByRole("button", { name: "Generate outreach draft", exact: true })
      .click();
    await expect(drawer.locator(".draft-subject")).toHaveText(
      "TEST DATA: a relevant workflow idea for your sales team",
    );
    await expect(drawer.locator(".draft-body")).toContainText(
      "This draft has not been sent",
    );
    expect(state.drafts).toEqual(["account-walkthrough"]);
    await drawer.locator(".outreach-draft").scrollIntoViewIfNeeded();
    await record(filenames[7]);
  });
  await test.step("9. Export the reviewed account and verify its CSV bytes", async () => {
    await drawer
      .getByRole("button", {
        name: "Close TEST DATA Acme Cloud account details",
        exact: true,
      })
      .click();
    await expect(drawer).toHaveCount(0);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export full campaign CSV", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "signalfoundry-test-data-october-customer-discovery.csv",
    );
    const exportPath = testInfo.outputPath("test-data-campaign-export.csv");
    await download.saveAs(exportPath);
    const csv = await readFile(exportPath, "utf8");
    expect(csv).toContain("TEST DATA Acme Cloud");
    expect(csv).toContain("shortlisted");
    expect(csv).toContain("unverified");
    expect(csv).toContain("TEST DATA simulated Exa");
    expect(csv).toContain("https://acme.example.com");
    await testInfo.attach("test-data-campaign-export.csv", {
      path: exportPath,
      contentType: "text/csv",
    });
    expect(state.exports).toEqual(["campaign-1"]);
    expect(state.unknown).toEqual([]);
    await expect(
      page.getByText("Campaign CSV downloaded", { exact: true }),
    ).toBeVisible();
    await record(filenames[8]);
  });
  await test.step("10. Show the honest live-provider limitation separately", async () => {
    await page.unroute("**/api/**");
    const unavailable = await mockWorkspace(page, {
      providers: "disabled",
      profile: null,
      testData: true,
    });
    unavailable.workspace.name = "TEST DATA Northstar";
    const unavailableDialog = await openCampaign(page, false);
    await unavailableDialog
      .getByRole("textbox", { name: "Campaign name", exact: true })
      .fill("TEST DATA provider setup required");
    await unavailableDialog
      .getByRole("textbox", {
        name: "What does your offering help customers do?",
        exact: true,
      })
      .fill("TEST DATA: We help B2B SaaS sales teams improve their pipeline.");
    await unavailableDialog
      .getByRole("button", { name: "Suggest from offering" })
      .click();
    await review(unavailableDialog);
    await unavailableDialog.getByRole("checkbox").check();
    await expect(
      unavailableDialog.getByText("Discovery unavailable", { exact: true }),
    ).toBeVisible();
    await expect(
      unavailableDialog.getByRole("button", {
        name: "Find customers",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      unavailableDialog.getByRole("button", {
        name: "Save draft",
        exact: true,
      }),
    ).toBeEnabled();
    await unavailableDialog
      .locator(".discovery-readiness")
      .scrollIntoViewIfNeeded();
    await record(filenames[9]);
    expect(unavailable.research).toHaveLength(0);
    expect(unavailable.creates).toHaveLength(0);
    expect(unavailable.unknown).toEqual([]);
  });
  await testInfo.attach("completed-screenshot-manifest.json", {
    body: JSON.stringify(
      {
        scope:
          "MOCK-BACKED UI ONLY; all data fictional. No live discovery, outreach or paid provider calls.",
        viewport: testInfo.project.name,
        completedScreenshots: captured,
        csv: "test-data-campaign-export.csv",
        creationRequests: state.creates.length,
        researchRequests: state.research.length,
        shortlistRequests: state.statusChanges.length,
        draftRequests: state.drafts.length,
        exportRequests: state.exports.length,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("buyer planning separates the seller from the direct customer and leaves ambiguous criteria unknown", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, { profile: null });
  const dialog = await openCampaign(page, false);
  const description = dialog.getByRole("textbox", {
    name: "What does your offering help customers do?",
    exact: true,
  });
  for (const [offering, industry, buyer] of [
    [
      "We are an agency building conversion websites for US plumbers.",
      "Plumbing businesses",
      "Owner, Operations Manager",
    ],
    [
      "We sell scheduling software to veterinary clinics.",
      "Veterinary clinics",
      "Practice Manager, Owner",
    ],
    [
      "Agency management software for web agencies.",
      "Professional services",
      "Founder, Head of Operations",
    ],
    [
      "Developer observability for fintech engineering teams.",
      "Financial technology",
      "Engineering Manager, CTO",
    ],
  ]) {
    await description.fill(offering);
    await dialog.getByRole("button", { name: "Suggest from offering" }).click();
    await expect(
      dialog.getByRole("textbox", { name: /^Industries\b/ }),
    ).toHaveValue(industry);
    await expect(
      dialog.getByRole("textbox", { name: /^Buyer roles\b/ }),
    ).toHaveValue(buyer);
  }
  await description.fill(
    "We are a marketing agency that makes beautiful things.",
  );
  await dialog.getByRole("button", { name: "Suggest from offering" }).click();
  await expect(
    dialog.getByRole("textbox", { name: /^Industries\b/ }),
  ).toHaveValue("");
  await expect(
    dialog.getByText(/Which type of business gets the most value/),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: /^Who is this offering for\?/ })
    .fill("plumbers in Canada");
  await dialog.getByRole("button", { name: /Plumbing businesses/ }).click();
  await expect(
    dialog.getByRole("textbox", { name: /^Industries\b/ }),
  ).toHaveValue("Plumbing businesses");
  await expect(
    dialog.getByRole("textbox", { name: /^Geographies\b/ }),
  ).toHaveValue("Canada");
  await dialog.locator(".audience-planner").scrollIntoViewIfNeeded();
  await capture(page, testInfo, "explicit-buyer-audience");
  expect(state.creates).toHaveLength(0);
  expect(state.unknown).toEqual([]);
});

test("company-only readiness does not require contacts and never opts in silently", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page, { providers: "company-only" });
  const dialog = await openCampaign(page);
  await expect(
    dialog.getByText("Company discovery ready", { exact: true }),
  ).toBeVisible();
  await dialog.getByText("Optional contact coverage", { exact: true }).click();
  await expect(
    dialog.getByRole("checkbox", { name: /Also request named contacts/ }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: /Also request named contacts/ }),
  ).toBeDisabled();
  await review(dialog);
  await expect(
    dialog.getByText("Company research only; no contact enrichment", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await capture(page, testInfo, "company-only-approval");
  await dialog
    .getByRole("button", { name: "Find customers", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.creates[0].enrich_contacts).toBe(false);
  expect(state.research).toEqual(["campaign-1"]);
  expect(state.unknown).toEqual([]);
});

function missionFixture(): { campaign: Campaign; account: Account } {
  const campaign: Campaign = {
    id: "campaign-1",
    name: "TEST DATA evidence review",
    mode: "discovery",
    status: "complete",
    created_at: NOW,
    updated_at: NOW,
    account_count: 1,
    qualified_count: 0,
    domains: [],
    errors: [],
    profile_snapshot: PROFILE,
    enrich_contacts: false,
  };
  const account: Account = {
    id: "account-1",
    campaign_id: campaign.id,
    name: "TEST DATA Research Co",
    domain: "research.example.com",
    description: "TEST DATA public-source review fixture",
    industry: "B2B SaaS",
    employee_range: "Unknown",
    location: "Unknown",
    score: 64,
    confidence: "low",
    decision_engine: "rules",
    status: "new",
    why_fit: ["Source language mentions sales operations"],
    why_now: ["Hiring language is undated and unverified"],
    unknowns: ["Location and size are unknown"],
    contacts: [],
    is_demo: false,
    researched_at: NOW,
    score_breakdown: [],
    evidence: [
      {
        id: "e1",
        title: "TEST DATA saved company source",
        url: "https://research.example.com",
        excerpt: "TEST DATA B2B SaaS software for sales operations",
        kind: "company",
        published_at: null,
        retrieved_at: NOW,
        is_demo: false,
      },
    ],
  };
  return { campaign, account };
}

test("mission review shows unknown hard criteria, saves pass scope, retries a failure and supports undo", async ({
  page,
}, testInfo) => {
  const { campaign, account } = missionFixture();
  const state = await mockWorkspace(page, {
    campaigns: [campaign],
    accounts: [account],
    statusFailures: 1,
  });
  await page.goto("/workspace");
  await expect(
    page.getByRole("region", { name: "Customer mission overview" }),
  ).toContainText("1");
  await capture(page, testInfo, "mission-approval-queue");
  await page.getByRole("button", { name: "Review next company" }).click();
  const drawer = page.getByRole("dialog", {
    name: "TEST DATA Research Co account details",
  });
  const criteria = drawer.getByRole("region", {
    name: "Saved criteria assessment",
  });
  await expect(
    criteria.locator(".criterion-row").filter({ hasText: "Geography" }),
  ).toContainText("Unknown");
  await expect(
    criteria.locator(".criterion-row").filter({ hasText: "Company size" }),
  ).toContainText("Unknown");
  await expect(
    criteria
      .getByRole("link", { name: "TEST DATA saved company source" })
      .first(),
  ).toHaveAttribute("href", "https://research.example.com/");
  await criteria.scrollIntoViewIfNeeded();
  await capture(page, testInfo, "criterion-evidence-unknowns");
  await drawer.getByRole("button", { name: "Pass on this company" }).click();
  await drawer
    .getByRole("combobox", { name: "Reason (optional)" })
    .selectOption("competitor");
  await drawer
    .getByRole("checkbox", { name: /Also suppress this domain/ })
    .check();
  await drawer.getByRole("button", { name: "Save pass", exact: true }).click();
  await expect(drawer.getByRole("alert")).toContainText(
    "Review could not be saved",
  );
  await expect(
    drawer.getByRole("combobox", { name: "Reason (optional)" }),
  ).toHaveValue("competitor");
  await drawer.getByRole("button", { name: "Save pass", exact: true }).click();
  await expect(
    drawer.getByText(/This domain is suppressed for future workspace searches/),
  ).toBeVisible();
  expect(state.accounts[0].review_reason).toBe("competitor");
  expect(state.accounts[0].suppress_workspace).toBe(true);
  await capture(page, testInfo, "saved-pass-and-undo");
  await drawer.getByRole("button", { name: "Undo pass", exact: true }).click();
  await expect(
    drawer.getByRole("button", { name: "Pass on this company" }),
  ).toBeVisible();
  expect(state.accounts[0].status).toBe("new");
  expect(state.accounts[0].suppress_workspace).toBe(false);
  expect(state.suppressions).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review next company" }),
  ).toBeFocused();
  expect(state.unknown).toEqual([]);
});

test("suppression management can restore future scope after source rows have expired", async ({
  page,
}, testInfo) => {
  const state = await mockWorkspace(page);
  state.suppressions.push({
    domain: "expired.example.com",
    reason: "existing_customer",
    updated_at: NOW,
  });
  await page.goto("/workspace");
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Customer profile" })
    .click();
  await page.getByRole("button", { name: "Manage suppressions" }).click();
  await expect(page.locator(".suppression-panel")).toContainText(
    "expired.example.com",
  );
  await page.locator(".suppression-panel").scrollIntoViewIfNeeded();
  await capture(page, testInfo, "suppression-management");
  await page.getByRole("button", { name: "Allow in future searches" }).click();
  await expect(
    page.getByText("No domains are suppressed in this workspace."),
  ).toBeVisible();
  expect(state.suppressions).toEqual([]);
  expect(state.unknown).toEqual([]);
});

test("an existing workspace exclusion stays selected when another campaign records a pass", async ({
  page,
}, testInfo) => {
  const { campaign, account } = missionFixture();
  account.suppress_workspace = true;
  const state = await mockWorkspace(page, {
    campaigns: [campaign],
    accounts: [account],
  });
  state.suppressions.push({
    domain: account.domain,
    reason: "competitor",
    updated_at: NOW,
  });
  await page.goto("/workspace");
  await expect(
    page.getByRole("button", { name: "Review next company" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Customer mission overview" }),
  ).toContainText("Your exclusions are respected");
  await page
    .getByRole("button", { name: "View TEST DATA Research Co details" })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "TEST DATA Research Co account details",
  });
  await drawer.getByRole("button", { name: "Pass on this company" }).click();
  await expect(
    drawer.getByRole("checkbox", { name: /Also suppress this domain/ }),
  ).toBeChecked();
  await drawer.getByRole("button", { name: "Save pass", exact: true }).click();
  await expect(
    drawer.getByText(/This domain is suppressed for future workspace searches/),
  ).toBeVisible();
  expect(state.suppressions).toHaveLength(1);
  expect(state.accounts[0].suppress_workspace).toBe(true);
  await drawer.getByRole("button", { name: "Undo pass", exact: true }).click();
  await expect(
    drawer.getByRole("button", { name: "Pass on this company" }),
  ).toBeVisible();
  expect(state.accounts[0].status).toBe("new");
  expect(state.accounts[0].suppress_workspace).toBe(true);
  expect(state.suppressions).toHaveLength(1);
  await drawer.getByRole("tab", { name: "Outreach draft" }).click();
  await expect(
    drawer.getByRole("button", { name: "Generate outreach draft" }),
  ).toBeDisabled();
  await capture(page, testInfo, "suppressed-history-not-actionable");
  expect(state.unknown).toEqual([]);
});

test("failed Undo retains its original shortlisted decision for a safe retry", async ({
  page,
}) => {
  const { campaign, account } = missionFixture();
  account.status = "shortlisted";
  const state = await mockWorkspace(page, {
    campaigns: [campaign],
    accounts: [account],
  });
  await page.goto("/workspace");
  await page
    .getByRole("button", { name: "View TEST DATA Research Co details" })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "TEST DATA Research Co account details",
  });
  await drawer.getByRole("button", { name: "Pass on this company" }).click();
  await drawer.getByRole("button", { name: "Save pass", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "Undo pass" })).toBeVisible();
  state.statusFailures = 1;
  await drawer.getByRole("button", { name: "Undo pass" }).click();
  await expect(drawer.getByRole("alert")).toContainText(
    "Review could not be saved",
  );
  await drawer.getByRole("button", { name: "Undo pass" }).click();
  await expect(
    drawer.getByRole("button", { name: "Shortlisted", exact: true }),
  ).toBeVisible();
  expect(state.accounts[0].status).toBe("shortlisted");
  expect(state.unknown).toEqual([]);
});

test("audience cards are keyboard operable and respect reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await mockWorkspace(page, { profile: null });
  const dialog = await openCampaign(page, false);
  await dialog
    .getByRole("textbox", {
      name: "What does your offering help customers do?",
      exact: true,
    })
    .fill("We build conversion websites for US plumbers.");
  const audience = dialog.getByRole("button", { name: /Plumbing businesses/ });
  await audience.focus();
  await page.keyboard.press("Enter");
  await expect(audience).toHaveAttribute("aria-pressed", "true");
  await expect(
    dialog.getByRole("textbox", { name: /^Industries\b/ }),
  ).toHaveValue("Plumbing businesses");
  const motion = await audience.evaluate((element) => ({
    transition: getComputedStyle(element).transitionDuration,
    transform: getComputedStyle(element).transform,
  }));
  expect(motion.transition).toBe("0s");
  expect(motion.transform).toBe("none");
  await audience.scrollIntoViewIfNeeded();
  await capture(page, testInfo, "audience-keyboard-reduced-motion");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toHaveLength(0);
  expect(state.unknown).toEqual([]);
});
