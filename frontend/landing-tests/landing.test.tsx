import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../components/landing-page";

function renderLanding() {
  const html = renderToStaticMarkup(React.createElement(LandingPage));
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { html, text };
}

describe("SignalFoundry public landing page", () => {
  it("server-renders the complete research journey and workspace entry points", () => {
    const { html, text } = renderLanding();

    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(text).toMatch(/research/i);
    expect(html).toContain('href="/sign-up?redirect_url=/workspace"');
    expect(html).toContain('href="/sign-in?redirect_url=/workspace"');
    for (const stage of [
      "Define the ICP",
      "Import accounts",
      "Review evidence",
      "Shortlist or export",
    ]) {
      expect(text).toContain(stage);
    }
    expect(text).toMatch(/company domains/i);
    expect(text).toMatch(/public evidence/i);
    expect(text).toContain("CSV export");
  });

  it("gives every section link a unique server-rendered destination", () => {
    const { html } = renderLanding();
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    const destinations = [...html.matchAll(/href="#([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(destinations.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const destination of destinations) {
      expect(ids, `Missing section #${destination}`).toContain(destination);
    }
    for (const section of ["workflow", "examples", "plans", "faq"]) {
      expect(destinations).toContain(section);
    }
  });

  it("labels concrete saved research as examples rather than customers or live output", () => {
    const { html, text } = renderLanding();

    expect(text).toMatch(/saved public research/i);
    expect(text).toMatch(/source: homepage/i);
    expect(text).toMatch(/public website research example/i);
    for (const company of ["Lowcode Agency", "Airtable", "XRay"]) {
      expect(text).toContain(company);
    }
    for (const classification of ["agency", "software vendor", "consultancy"]) {
      expect(text.toLowerCase()).toContain(classification);
    }
    expect(text).toContain("not invented leads, customer logos");
    expect(text).toContain("not a live account list");
    expect(text).toContain(
      "No accounts are imported, researched, saved, or exported here.",
    );
    expect(html).toContain('href="https://www.lowcode.agency/"');
    expect(text).not.toMatch(/trusted by|customers include/i);
  });

  it("keeps the first demo stage and a complete no-JavaScript explanation in SSR", () => {
    const { html } = renderLanding();
    const tabs = html.match(/<button\b[^>]*role="tab"[^>]*>/g) ?? [];
    const panels = html.match(/<div\b[^>]*role="tabpanel"[^>]*>/g) ?? [];
    const noScript = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)]
      .map((match) => match[1])
      .join(" ");

    expect(tabs).toHaveLength(4);
    expect(
      tabs.filter((tab) => tab.includes('aria-selected="true"')),
    ).toHaveLength(1);
    expect(tabs[0]).toContain('aria-selected="true"');
    expect(panels).toHaveLength(4);
    expect(
      panels.filter((panel) => panel.includes('aria-hidden="false"')),
    ).toHaveLength(1);
    expect(panels[0]).toContain('aria-hidden="false"');
    expect(panels.slice(1).every((panel) => panel.includes(" inert="))).toBe(
      true,
    );
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('data-playing="false"');
    for (const stage of [
      "Define the ICP",
      "Import accounts",
      "Review evidence",
      "Shortlist or export",
    ]) {
      expect(noScript).toContain(stage);
    }
    expect(html).toContain('data-reveal="hero"');
    expect(html).toContain('data-reveal="workflow"');
    expect(html).toContain('aria-controls="sf-mobile-menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-motion-policy="prefers-reduced-motion"');
  });

  it("states product and paid boundaries and retains the legal/support routes", () => {
    const { html, text } = renderLanding();

    for (const boundary of [
      "Up to 10 real domains per campaign",
      "Discovery requires approved providers",
      "Emails remain unverified",
      "No sending, replies, or meeting booking",
      "Provider-returned emails are not independently verified",
      "current plan and limits are shown in the workspace",
      "not a verified contact",
      "Staging preview",
    ]) {
      expect(text).toContain(boundary);
    }
    for (const route of ["privacy", "terms", "contact"]) {
      expect(html).toContain(`href="/${route}"`);
    }
    expect(text).not.toMatch(/\$\d/);
  });
});
