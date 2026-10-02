import Link from "next/link";
import LandingMotion from "./landing-motion";
import "../app/landing.css";

const SIGN_UP_HREF = "/sign-up?redirect_url=/workspace";
const SIGN_IN_HREF = "/sign-in?redirect_url=/workspace";

function Arrow({ direction = "right" }: { direction?: "right" | "down" }) {
  return (
    <svg
      className={`sf-arrow sf-arrow-${direction}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {direction === "right" ? (
        <>
          <path d="M2 8h11" />
          <path d="m8.5 3.5 4.5 4.5-4.5 4.5" />
        </>
      ) : (
        <>
          <path d="M8 2v11" />
          <path d="m3.5 8.5 4.5 4.5 4.5-4.5" />
        </>
      )}
    </svg>
  );
}

function SignalMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`sf-brand-mark ${compact ? "sf-brand-mark-compact" : ""}`}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </span>
  );
}

function CheckMark() {
  return (
    <svg className="sf-check" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m3 8.5 3.2 3L13 4.8" />
    </svg>
  );
}

function SectionMarker({ number, children }: { number: string; children: string }) {
  return (
    <div className="sf-section-marker">
      <span>{number}</span>
      <span className="sf-marker-line" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function ProductOutput() {
  return (
    <figure className="sf-output" data-reveal="hero-art" aria-labelledby="output-caption">
      <figcaption className="sf-output-caption" id="output-caption">
        <span>WORKSPACE / RESEARCH EXAMPLES</span>
        <span className="sf-live-label">
          <span className="sf-live-dot" aria-hidden="true" />
          saved public research
        </span>
      </figcaption>
      <div className="sf-output-frame">
        <div className="sf-output-topbar" aria-hidden="true">
          <span className="sf-window-dots"><i /><i /><i /></span>
          <span className="sf-window-address">signalfoundry / campaign / review</span>
          <span className="sf-window-status">ILLUSTRATION</span>
        </div>
        <div className="sf-output-grid">
          <aside className="sf-output-sidebar" aria-label="Research pass summary">
            <span className="sf-output-eyebrow">CAMPAIGN BRIEF</span>
            <strong>Founder-led B2B teams</strong>
            <p>Clear proof, lean motion, visible buying context.</p>
            <div className="sf-output-divider" />
            <span className="sf-output-eyebrow">INPUTS</span>
            <span className="sf-input-chip"><span aria-hidden="true">↗</span> yoursite.com</span>
            <span className="sf-input-chip"><span aria-hidden="true">↗</span> accounts.csv</span>
            <div className="sf-sidebar-foot">
              <span className="sf-live-dot" aria-hidden="true" />
              Review mode
            </div>
          </aside>
          <div className="sf-output-main">
            <div className="sf-output-main-head">
              <div>
                <span className="sf-output-eyebrow">PUBLIC WEBSITE EXAMPLES</span>
                <h3>Keep the reason attached.</h3>
              </div>
              <span className="sf-export-chip">CSV ready</span>
            </div>
            <div className="sf-research-card sf-research-card-featured">
              <div className="sf-research-card-head">
                <span className="sf-company-token">LA</span>
                <div>
                  <strong>Lowcode Agency</strong>
                  <span>agency · reviewed</span>
                </div>
                <span className="sf-review-state">Shortlist</span>
              </div>
              <p>Builds custom internal tools for growing teams.</p>
              <div className="sf-evidence-row">
                <span>source: homepage</span>
                <span>ICP match: audience + offer</span>
              </div>
            </div>
            <div className="sf-research-card">
              <div className="sf-research-card-head">
                <span className="sf-company-token sf-company-token-muted">AT</span>
                <div>
                  <strong>Airtable</strong>
                  <span>software vendor · review</span>
                </div>
                <span className="sf-review-state sf-review-state-muted">Review</span>
              </div>
              <p>Flexible database platform for teams.</p>
              <div className="sf-evidence-row">
                <span>source: homepage</span>
                <span>reason attached</span>
              </div>
            </div>
            <div className="sf-output-note">
              <span className="sf-note-mark" aria-hidden="true"><CheckMark /></span>
              <span>Evidence stays with the account when you draft or export.</span>
            </div>
          </div>
        </div>
      </div>
      <p className="sf-output-footnote">Illustrative output shape from saved public research. Not a live account list.</p>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <main
      className="sf-landing"
      data-motion-policy="prefers-reduced-motion"
    >
      <Link className="sf-skip-link" href="#workflow">
        Skip to workflow
      </Link>

      <header className="sf-nav sf-shell">
        <Link className="sf-brand" href="/" aria-label="SignalFoundry home">
          <SignalMark />
          <span>
            Signal<span className="sf-brand-light">Foundry</span>
            <b>.</b>
          </span>
        </Link>
        <nav className="sf-nav-links" id="sf-mobile-menu" aria-label="Primary navigation">
          <Link href="#workflow">Workflow</Link>
          <Link href="#output">Product output</Link>
          <Link href="#plans">Scope &amp; plans</Link>
          <Link href="#faq">FAQ</Link>
          <Link href={SIGN_IN_HREF}>Sign in</Link>
        </nav>
        <div className="sf-nav-actions">
          <Link className="sf-button sf-button-accent sf-nav-cta" href={SIGN_UP_HREF}>
            Create workspace <Arrow />
          </Link>
          <LandingMotion />
        </div>
      </header>

      <section className="sf-hero sf-shell" aria-labelledby="hero-title">
        <div className="sf-hero-copy" data-reveal="hero">
          <p className="sf-kicker">
            <span className="sf-kicker-dot" aria-hidden="true" />
            Public-web research / reviewable by design
          </p>
          <h1 id="hero-title">
            Research signal,
            <br />
            <span>not noise.</span>
          </h1>
          <p className="sf-hero-lede">
            Turn a clear customer point of view into an evidence-backed shortlist
            your team can explain, review, and export.
          </p>
          <div className="sf-hero-actions">
            <Link className="sf-button sf-button-dark" href={SIGN_UP_HREF}>
              Create a workspace <Arrow />
            </Link>
            <Link className="sf-text-link" href="#workflow">
              Explore the workflow <Arrow />
            </Link>
          </div>
          <div className="sf-hero-login">
            Already have a workspace? <Link href={SIGN_IN_HREF}>Sign in</Link>
          </div>
          <div className="sf-hero-meta" aria-label="Product scope">
            <span><CheckMark /> Company research</span>
            <span><CheckMark /> Public evidence you can review</span>
            <span><CheckMark /> Drafts and CSV export</span>
          </div>
        </div>
        <ProductOutput />
      </section>

      <section className="sf-signal-gap sf-shell" aria-labelledby="signal-gap-title" data-reveal="intro">
        <div className="sf-signal-gap-label">
          <SectionMarker number="01">THE SIGNAL GAP</SectionMarker>
          <span className="sf-vertical-note">POINT OF VIEW → PROOF</span>
        </div>
        <div>
          <h2 id="signal-gap-title">The best account list is not the longest one. It is the one you can defend.</h2>
          <p>
            Start with an ICP you can recognize. SignalFoundry keeps the brief,
            public evidence, and decision trail together so the shortlist stays
            useful after the research pass ends.
          </p>
        </div>
      </section>

      <section className="sf-workflow sf-shell" id="workflow" aria-labelledby="workflow-title">
        <div className="sf-section-heading" data-reveal="workflow">
          <div>
            <SectionMarker number="02">THE WORKFLOW</SectionMarker>
            <h2 id="workflow-title">A point of view in. A usable shortlist out.</h2>
          </div>
          <p>
            Bring the brief and the company domains you already have. Move from
            research to review without losing the why.
          </p>
        </div>
        <div className="sf-workflow-track" aria-hidden="true"><span /></div>
        <ol className="sf-step-list">
          <li className="sf-step" data-reveal="workflow-step" style={{ "--sf-reveal-delay": "60ms" } as React.CSSProperties}>
            <span className="sf-step-number">01</span>
            <span className="sf-step-icon sf-step-icon-input" aria-hidden="true">↗</span>
            <h3>Define the ICP</h3>
            <p>Describe audience, offer, language, and the public signals worth checking.</p>
          </li>
          <li className="sf-step" data-reveal="workflow-step" style={{ "--sf-reveal-delay": "140ms" } as React.CSSProperties}>
            <span className="sf-step-number">02</span>
            <span className="sf-step-icon" aria-hidden="true"><span /></span>
            <h3>Import accounts</h3>
            <p>Bring real company domains or CSV rows. Research starts from what you provide.</p>
          </li>
          <li className="sf-step" data-reveal="workflow-step" style={{ "--sf-reveal-delay": "220ms" } as React.CSSProperties}>
            <span className="sf-step-number">03</span>
            <span className="sf-step-icon sf-step-icon-evidence" aria-hidden="true"><span /><span /><span /></span>
            <h3>Review evidence</h3>
            <p>Read public-homepage findings, citations, and explicit unknowns before deciding.</p>
          </li>
          <li className="sf-step sf-step-last" data-reveal="workflow-step" style={{ "--sf-reveal-delay": "300ms" } as React.CSSProperties}>
            <span className="sf-step-number">04</span>
            <span className="sf-step-icon sf-step-icon-output" aria-hidden="true"><CheckMark /></span>
            <h3>Shortlist or export</h3>
            <p>Keep the strongest accounts, draft a human-reviewed template, or preserve the CSV.</p>
          </li>
        </ol>
      </section>

      <section className="sf-output-proof sf-shell" id="output" aria-labelledby="output-proof-title">
        <div className="sf-proof-ledger" data-reveal="proof">
          <div className="sf-ledger-header">
            <span>ACCOUNT RESEARCH / PUBLIC SOURCES</span>
            <span>VISIBLE BY DESIGN</span>
          </div>
          <div className="sf-ledger-columns" aria-hidden="true">
            <span>Account</span><span>Observed signal</span><span>Next move</span>
          </div>
          <div className="sf-ledger-row sf-ledger-row-featured">
            <span className="sf-ledger-account"><span className="sf-ledger-badge">LA</span><strong>Lowcode Agency</strong></span>
            <span>Custom internal tools for growing teams</span>
            <span className="sf-ledger-action">Shortlist</span>
          </div>
          <div className="sf-ledger-row">
            <span className="sf-ledger-account"><span className="sf-ledger-badge sf-ledger-badge-muted">AT</span><strong>Airtable</strong></span>
            <span>Flexible database platform for teams</span>
            <span className="sf-ledger-action sf-ledger-action-muted">Review</span>
          </div>
          <div className="sf-ledger-row">
            <span className="sf-ledger-account"><span className="sf-ledger-badge sf-ledger-badge-muted">XR</span><strong>XRay</strong></span>
            <span>Consultancy-led operating model</span>
            <span className="sf-ledger-action sf-ledger-action-muted">Review</span>
          </div>
          <div className="sf-ledger-footer"><span className="sf-live-dot" aria-hidden="true" />Evidence stays attached to the decision</div>
        </div>
        <div className="sf-proof-copy" data-reveal="proof-copy">
          <p className="sf-kicker">03 / PRODUCT OUTPUT</p>
          <h2 id="output-proof-title">Not a magic score. A research trail.</h2>
          <p>
            See the public language, offer, and audience clues behind a shortlist
            decision. Keep useful context when the next move is a draft, a review,
            or an evidence-preserving CSV export.
          </p>
          <ul className="sf-check-list">
            <li><CheckMark /> Citations and source excerpts</li>
            <li><CheckMark /> Confidence kept separate from verified contacts</li>
            <li><CheckMark /> Unknowns called out instead of filled in</li>
          </ul>
          <Link className="sf-text-link" href="#examples">See the public research example <Arrow /></Link>
        </div>
      </section>

      <section className="sf-examples sf-shell" id="examples" aria-labelledby="examples-title">
        <div className="sf-examples-copy" data-reveal="examples-copy">
          <SectionMarker number="04">SHOW YOUR WORK</SectionMarker>
          <h2 id="examples-title">Classify what is in front of you before you write to it.</h2>
          <p>
            These examples show the shape of a public website research pass. They
            are not invented leads, customer logos, or a claim that these companies
            use SignalFoundry.
          </p>
          <p className="sf-example-disclaimer">Public website research example</p>
        </div>
        <div className="sf-example-table" role="table" aria-label="Public website research examples" data-reveal="examples-table">
          <div className="sf-example-table-head" role="row">
            <span role="columnheader">Company</span>
            <span role="columnheader">Classification</span>
            <span role="columnheader">Read</span>
          </div>
          <div className="sf-example-table-row" role="row">
            <span role="cell" className="sf-example-company"><span className="sf-example-dot" aria-hidden="true" />Lowcode Agency</span>
            <span role="cell">agency</span>
            <span role="cell" className="sf-example-read">Services-led</span>
          </div>
          <div className="sf-example-table-row" role="row">
            <span role="cell" className="sf-example-company"><span className="sf-example-dot" aria-hidden="true" />Airtable</span>
            <span role="cell">software vendor</span>
            <span role="cell" className="sf-example-read">Product-led</span>
          </div>
          <div className="sf-example-table-row" role="row">
            <span role="cell" className="sf-example-company"><span className="sf-example-dot" aria-hidden="true" />XRay</span>
            <span role="cell">consultancy</span>
            <span role="cell" className="sf-example-read">Expertise-led</span>
          </div>
          <div className="sf-example-table-footer">
            <span>Input: public websites you provide</span>
            <span>Output: reviewable classification</span>
          </div>
        </div>
      </section>

      <section className="sf-scope sf-shell" id="plans" aria-labelledby="scope-title">
        <div className="sf-scope-copy" data-reveal="scope-copy">
          <SectionMarker number="05">SCOPE &amp; PLANS</SectionMarker>
          <h2 id="scope-title">The paywall is around workspace capacity, not clarity.</h2>
          <p>
            You should know what the product can do before a plan appears. The
            workspace shows the current plan, limits, and any paid boundary before
            research runs. No invented price is printed on this preview.
          </p>
          <Link className="sf-button sf-button-dark" href={SIGN_UP_HREF}>See the workspace plan <Arrow /></Link>
        </div>
        <div className="sf-scope-grid" data-reveal="scope-grid">
          <article className="sf-scope-card sf-scope-card-primary">
            <span className="sf-scope-card-label">IN THE WORKSPACE</span>
            <h3>Start with the work you can review.</h3>
            <ul className="sf-scope-list">
              <li><CheckMark /> Editable ICP and campaign brief</li>
              <li><CheckMark /> Up to 10 real domains per campaign</li>
              <li><CheckMark /> Saved public research with citations</li>
              <li><CheckMark /> Human-reviewed drafts and CSV export</li>
            </ul>
          </article>
          <article className="sf-scope-card">
            <span className="sf-scope-card-label">CLEAR BOUNDARY</span>
            <h3>Research stops before risky automation.</h3>
            <ul className="sf-scope-list sf-scope-list-muted">
              <li><span className="sf-scope-minus" aria-hidden="true">—</span> No automatic discovery</li>
              <li><span className="sf-scope-minus" aria-hidden="true">—</span> No contact enrichment or verification</li>
              <li><span className="sf-scope-minus" aria-hidden="true">—</span> No sending, replies, or meeting booking</li>
              <li><span className="sf-scope-minus" aria-hidden="true">—</span> No claim that confidence means buying intent</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="sf-boundaries sf-shell" id="faq" aria-labelledby="faq-title">
        <div className="sf-boundaries-heading" data-reveal="faq-heading">
          <SectionMarker number="06">THE FINE PRINT</SectionMarker>
          <h2 id="faq-title">Useful because it knows where to stop.</h2>
          <p>
            The honest boundary is part of the product. Here is what a public
            research workspace does and does not promise.
          </p>
        </div>
        <div className="sf-faq-list" data-reveal="faq-list">
          <details open>
            <summary>Where does research come from?</summary>
            <p>From the public websites and company domains you provide. Each pass keeps citations, explicit unknowns, and the observed language available for review.</p>
          </details>
          <details>
            <summary>Does SignalFoundry discover contacts or send outreach?</summary>
            <p>No. It does not discover contacts, verify email addresses, send campaigns, manage replies, or book meetings. It stops at account research, shortlisting, human-reviewed drafts, and export.</p>
          </details>
          <details>
            <summary>Are the named companies customers or sample leads?</summary>
            <p>No. Lowcode Agency, Airtable, and XRay are shown only as a public website research example so you can see classification language and output shape.</p>
          </details>
          <details>
            <summary>How do plans and limits work?</summary>
            <p>The current plan and limits are shown in the workspace before a research run or paid boundary. This public preview does not hardcode a price, trial, refund, or credit promise.</p>
          </details>
          <details>
            <summary>What does a confidence label mean?</summary>
            <p>Confidence describes uncertainty in an automated classification or fit assessment. It is not a verified contact, a guarantee of buying intent, or a performance claim.</p>
          </details>
        </div>
      </section>

      <section className="sf-final sf-shell" aria-labelledby="final-title" data-reveal="final">
        <div className="sf-final-mark" aria-hidden="true"><SignalMark compact /></div>
        <div>
          <p className="sf-kicker">READY WHEN YOUR BRIEF IS</p>
          <h2 id="final-title">Make your next account list easier to believe.</h2>
          <p className="sf-final-note">Create the workspace. Bring the signal. Keep the reasons.</p>
        </div>
        <Link className="sf-button sf-button-light" href={SIGN_UP_HREF}>Create a workspace <Arrow /></Link>
      </section>

      <footer className="sf-footer sf-shell">
        <div className="sf-footer-brand">
          <Link className="sf-brand" href="/" aria-label="SignalFoundry home">
            <SignalMark />
            <span>Signal<span className="sf-brand-light">Foundry</span><b>.</b></span>
          </Link>
          <p>Evidence-led account research for founders and sales teams.</p>
        </div>
        <div className="sf-footer-links" aria-label="Footer navigation">
          <Link href="#workflow">Workflow</Link>
          <Link href="#output">Product output</Link>
          <Link href="#plans">Scope &amp; plans</Link>
          <Link href="#faq">FAQ</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <p className="sf-footer-note">Staging preview. Not a production service.</p>
      </footer>
    </main>
  );
}
