import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../components/landing-page";

describe("SignalFoundry public landing page", () => {
  const html = () => renderToStaticMarkup(React.createElement(LandingPage));

  it("renders the product journey from a brief to an evidence-backed shortlist", () => {
    const output = html();
    const text = output.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    expect(text).toContain("Research signal, not noise.");
    expect(output).toContain("/sign-up?redirect_url=/workspace");
    expect(output).toContain("/sign-in?redirect_url=/workspace");
    expect(output).toContain("#workflow");
    expect(output).toContain("website");
    expect(output).toContain("ICP");
    expect(output).toContain("CSV");
    expect(output).toContain("public evidence");
    expect(output).toContain("shortlist");
    expect(output).toContain("draft");
    expect(output).toContain("export");
  });

  it("keeps the product output concrete and labels examples honestly", () => {
    const output = html();

    expect(output).toContain("saved public research");
    expect(output).toContain("source: homepage");
    expect(output).toContain("public website research example");
    expect(output).toContain("Lowcode Agency");
    expect(output).toContain("agency");
    expect(output).toContain("Airtable");
    expect(output).toContain("software vendor");
    expect(output).toContain("XRay");
    expect(output).toContain("consultancy");
    expect(output).not.toContain("Trusted by");
    expect(output).not.toContain("customers include");
  });

  it("ships a no-js-safe motion hook and accessible mobile navigation control", () => {
    const output = html();

    expect(output).toContain('data-reveal="hero"');
    expect(output).toContain('data-reveal="workflow"');
    expect(output).toContain('aria-controls="sf-mobile-menu"');
    expect(output).toContain('aria-expanded="false"');
    expect(output).toContain("prefers-reduced-motion");
  });

  it("explains scope and paywall boundaries without inventing pricing", () => {
    const output = html();

    expect(output).toContain("Up to 10 real domains");
    expect(output).toContain("does not discover contacts");
    expect(output).toContain("No contact enrichment or verification");
    expect(output).toContain("No sending, replies, or meeting booking");
    expect(output).toContain("current plan and limits are shown in the workspace");
    expect(output).toContain('href="/privacy"');
    expect(output).toContain('href="/terms"');
    expect(output).toContain('href="/contact"');
    expect(output).toContain("Staging preview");
    expect(output).not.toMatch(/\$\d/);
  });
});
