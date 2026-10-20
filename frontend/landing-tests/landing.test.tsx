import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "../components/landing-page";
import { PRODUCT_NAME } from "../lib/product";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderLanding() {
  const html = renderToStaticMarkup(React.createElement(LandingPage));
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { html, text };
}

describe("website-first customer discovery landing", () => {
  it("explains the product and gives website entry priority over signup and manual entry", () => {
    const { html, text } = renderLanding();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(text).toContain(
      "From your website to your next sales conversation.",
    );
    expect(text).toContain("Your business website");
    expect(text).toContain("For founders selling SaaS to businesses");
    expect(text).toContain("approve an AI introduction");
    expect(text).toContain(
      "Search for up to five businesses in the current test,",
    );
    expect(html).toContain('for="business-website"');
    expect(html).toContain('id="business-website"');
    expect(text).toContain("Get started");
    expect(text).toContain("Enter your business details manually");
    expect(text.indexOf("Get started")).toBeLessThan(
      text.indexOf("Enter your business details manually"),
    );
    expect(text).toContain(
      "Create your account, then review your business profile before searching.",
    );
    for (const step of [
      "Find businesses to approach",
      "Approve your introduction",
      "Keep track of the conversation",
      "Record meetings and outcomes",
    ])
      expect(text).toContain(step);
    expect(text).not.toMatch(
      /Create (?:a )?workspace|Research signal|evidence-led|\bICP\b/i,
    );
    expect(html).toContain('href="/sign-up?redirect_url=/workspace/setup"');
    expect(html).toContain('href="/sign-in?redirect_url=/workspace"');
    expect(html).toContain(`${PRODUCT_NAME} home`);
  });

  it("gives section links unique server-rendered destinations with a focusable skip target", () => {
    const { html } = renderLanding();
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    const destinations = [...html.matchAll(/href="#([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const destination of destinations)
      expect(ids, `Missing section #${destination}`).toContain(destination);
    for (const section of ["main-content", "workflow", "your-list", "faq"])
      expect(destinations).toContain(section);
    expect(html).toMatch(/id="main-content"[^>]*tabindex="-1"/);
  });

  it("shows a complete semantic product example without swipe or autoplay gates", () => {
    const { html, text } = renderLanding();
    expect(text).toContain("Fictional product example");
    expect(text).toContain("Illustrative layout, not live results.");
    expect(text).toContain("The example businesses and email are fictional");
    expect(text).toContain("Unverified");
    expect(text).toContain(
      "Real searches may return fewer than five businesses; contact details vary.",
    );
    expect(html).toContain('<th role="columnheader" scope="col">Company</th>');
    expect(html).not.toMatch(
      /role="tab(?:panel|list)?"|aria-roledescription="carousel"|inert=/,
    );
    expect(text).not.toMatch(
      /trusted by|customers include|guaranteed leads|hot leads|unlimited leads/i,
    );
    expect(html).not.toMatch(/href="https?:/);
  });

  it("explains verification limits, no sending and legal routes", () => {
    const { html, text } = renderLanding();
    expect(text).toContain("Searches may return fewer than five businesses;");
    expect(text).toContain("unverified emails stay clearly marked");
    expect(text).toContain("Verification does not guarantee a reply.");
    expect(text).toContain(
      "Planned next: a connected inbox and automatic follow-ups.",
    );
    expect(text).toContain("They are not connected or sending messages today.");
    expect(text).toContain("A recorded meeting is your report;");
    expect(text).toContain(
      "You review and write your responses; inbox sync and automatic follow-ups are planned.",
    );
    expect(text).toContain("enter your business details manually");
    for (const route of ["privacy", "terms", "contact"])
      expect(html).toContain(`href="/${route}"`);
    expect(html.match(/<details[ >]/g)).toHaveLength(6);
    expect(text).not.toMatch(/\$\d|free trial/i);
  });
});
