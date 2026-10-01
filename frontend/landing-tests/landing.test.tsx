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
    expect(output).toContain("/workspace");
    expect(output).toContain("#workflow");
    expect(output).toContain("website");
    expect(output).toContain("ICP");
    expect(output).toContain("CSV");
    expect(output).toContain("public evidence");
    expect(output).toContain("shortlist");
    expect(output).toContain("draft");
    expect(output).toContain("export");
  });

  it("labels live-smoke examples as research examples rather than customer proof", () => {
    const output = html();

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

  it("sets honest product boundaries and links to preview legal pages", () => {
    const output = html();

    expect(output).toContain("does not discover contacts");
    expect(output).toContain("does not verify email addresses");
    expect(output).toContain("does not send campaigns");
    expect(output).toContain("plan and limits are visible in the workspace");
    expect(output).toContain('href="/privacy"');
    expect(output).toContain('href="/terms"');
    expect(output).toContain('href="/contact"');
    expect(output).toContain("staging preview");
  });
});
