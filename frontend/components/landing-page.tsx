import Link from "next/link";
import "../app/landing.css";

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
    <span className={`sf-brand-mark ${compact ? "sf-brand-mark-compact" : ""}`} aria-hidden="true">
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

export default function LandingPage() {
  return (
    <main className="sf-landing">
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
        <nav className="sf-nav-links" aria-label="Primary navigation">
          <Link href="#workflow">Workflow</Link>
          <Link href="#examples">Research examples</Link>
          <Link href="#faq">FAQ</Link>
        </nav>
        <Link className="sf-button sf-button-dark sf-nav-button" href="/workspace">
          Open workspace <Arrow />
        </Link>
      </header>

      <section className="sf-hero sf-shell" aria-labelledby="hero-title">
        <div className="sf-hero-copy">
          <p className="sf-kicker">
            <span className="sf-kicker-dot" aria-hidden="true" />
            Public preview / evidence-led account research
          </p>
          <h1 id="hero-title">
            Research signal,
            <br />
            <em>not noise.</em>
          </h1>
          <p className="sf-hero-lede">
            SignalFoundry helps founders and sales teams turn a clear customer
            point of view into a shortlist they can actually explain.
          </p>
          <div className="sf-hero-actions">
            <Link className="sf-button sf-button-dark" href="/workspace">
              Start in the workspace <Arrow />
            </Link>
            <Link className="sf-text-link" href="#workflow">
              See the workflow <Arrow />
            </Link>
          </div>
          <div className="sf-hero-meta" aria-label="Product scope">
            <span>
              <CheckMark /> Company research
            </span>
            <span>
              <CheckMark /> Evidence you can review
            </span>
            <span>
              <CheckMark /> Draft or export when ready
            </span>
          </div>
        </div>

        <div
          className="sf-hero-art"
          role="img"
          aria-label="A SignalFoundry research board connecting a customer profile to public website evidence and a shortlist"
        >
          <div className="sf-art-caption">
            <span>RESEARCH BOARD</span>
            <span className="sf-art-caption-status">
              <span className="sf-status-dot" aria-hidden="true" />
              reviewable output
            </span>
          </div>
          <div className="sf-art-stage">
            <svg className="sf-signal-map" viewBox="0 0 600 490" aria-hidden="true">
              <path className="sf-map-line sf-map-line-muted" d="M105 88C178 88 168 180 242 180" />
              <path className="sf-map-line sf-map-line-muted" d="M105 88C177 88 190 302 242 302" />
              <path className="sf-map-line" d="M358 180c50 0 45-92 129-92" />
              <path className="sf-map-line" d="M358 180c57 0 46 122 129 122" />
              <path className="sf-map-line sf-map-line-muted" d="M358 302c48 0 54 0 129 0" />
              <path className="sf-map-line-dash" d="M242 180h116" />
              <path className="sf-map-line-dash" d="M242 302h116" />
              <circle className="sf-map-node sf-map-node-root" cx="105" cy="88" r="9" />
              <circle className="sf-map-node sf-map-node-mid" cx="242" cy="180" r="7" />
              <circle className="sf-map-node sf-map-node-mid" cx="242" cy="302" r="7" />
              <circle className="sf-map-node sf-map-node-end" cx="487" cy="88" r="7" />
              <circle className="sf-map-node sf-map-node-end" cx="487" cy="302" r="7" />
            </svg>
            <div className="sf-art-profile sf-art-panel">
              <span className="sf-panel-index">01 / BRIEF</span>
              <strong>Modern sales teams</strong>
              <span className="sf-panel-note">Lean motion, clear proof</span>
              <div className="sf-panel-rule" />
              <span className="sf-panel-label">ICP signal</span>
              <span className="sf-panel-value">Founder-led B2B</span>
            </div>
            <div className="sf-art-evidence sf-art-panel">
              <span className="sf-panel-index">02 / EVIDENCE</span>
              <strong>Public website signals</strong>
              <span className="sf-panel-note">Language, offer, audience</span>
              <div className="sf-signal-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="sf-art-shortlist sf-art-panel">
              <span className="sf-panel-index">03 / SHORTLIST</span>
              <div className="sf-shortlist-row">
                <span className="sf-mini-avatar sf-mini-avatar-one">L</span>
                <span>
                  <strong>Lowcode Agency</strong>
                  <small>agency</small>
                </span>
                <span className="sf-mini-tag">strong fit</span>
              </div>
              <div className="sf-shortlist-row">
                <span className="sf-mini-avatar sf-mini-avatar-two">A</span>
                <span>
                  <strong>Airtable</strong>
                  <small>software vendor</small>
                </span>
                <span className="sf-mini-tag sf-mini-tag-muted">review</span>
              </div>
            </div>
            <div className="sf-art-stamp">SIGNAL / FOUND</div>
          </div>
          <p className="sf-art-footnote">
            A visual sample of the output shape — not a live account list.
          </p>
        </div>
      </section>

      <section className="sf-intro sf-shell" aria-labelledby="intro-title">
        <div className="sf-section-marker">
          <span>01</span>
          <span className="sf-marker-line" aria-hidden="true" />
          <span>THE SIGNAL GAP</span>
        </div>
        <div className="sf-intro-content">
          <h2 id="intro-title">
            The best account list is not the longest one. It is the one you can
            defend.
          </h2>
          <p>
            Start with a point of view, not a blank search box. SignalFoundry
            keeps your ideal customer profile close to the research so every
            shortlist decision has a visible reason behind it.
          </p>
        </div>
      </section>

      <section className="sf-proof sf-shell" aria-labelledby="proof-title">
        <div className="sf-proof-visual" aria-label="Evidence ledger product proof">
          <div className="sf-ledger-topline">
            <span>ACCOUNT RESEARCH / PUBLIC SOURCES</span>
            <span>VISIBLE BY DESIGN</span>
          </div>
          <div className="sf-ledger-head">
            <span>Account</span>
            <span>Observed signal</span>
            <span>Next move</span>
          </div>
          <div className="sf-ledger-row sf-ledger-row-featured">
            <span className="sf-ledger-account">
              <span className="sf-ledger-badge">LA</span>
              <strong>Lowcode Agency</strong>
            </span>
            <span>Builds custom internal tools for growing teams</span>
            <span className="sf-ledger-action">Shortlist</span>
          </div>
          <div className="sf-ledger-row">
            <span className="sf-ledger-account">
              <span className="sf-ledger-badge sf-ledger-badge-blue">AT</span>
              <strong>Airtable</strong>
            </span>
            <span>Flexible database platform for teams</span>
            <span className="sf-ledger-action sf-ledger-action-muted">Review</span>
          </div>
          <div className="sf-ledger-row">
            <span className="sf-ledger-account">
              <span className="sf-ledger-badge sf-ledger-badge-amber">XR</span>
              <strong>XRay</strong>
            </span>
            <span>Consultancy-led operating model</span>
            <span className="sf-ledger-action sf-ledger-action-muted">Review</span>
          </div>
          <div className="sf-ledger-footer">
            <span className="sf-ledger-pulse" aria-hidden="true" />
            Evidence stays attached to the decision
          </div>
        </div>
        <div className="sf-proof-copy">
          <p className="sf-kicker">PRODUCT PROOF / NO BLACK BOX</p>
          <h2 id="proof-title">The output is a research trail, not a magic score.</h2>
          <p>
            See the source-shaped clues behind a recommendation: what a company
            says, who it serves, and how that maps to your brief. Keep the useful
            context when you move from research to a draft or CSV export.
          </p>
          <Link className="sf-text-link" href="#examples">
            See a public website research example <Arrow />
          </Link>
        </div>
      </section>

      <section className="sf-workflow sf-shell" id="workflow" aria-labelledby="workflow-title">
        <div className="sf-section-heading">
          <div>
            <div className="sf-section-marker">
              <span>02</span>
              <span className="sf-marker-line" aria-hidden="true" />
              <span>THE WORKFLOW</span>
            </div>
            <h2 id="workflow-title">A point of view in. A usable shortlist out.</h2>
          </div>
          <p>
            Move from website to ICP to company domains or CSV, then decide what
            deserves a closer look.
          </p>
        </div>
        <ol className="sf-step-list">
          <li className="sf-step">
            <span className="sf-step-number">01</span>
            <div>
              <h3>Start with your website</h3>
              <p>Use your own site as a starting signal for the customer profile you want to test.</p>
            </div>
            <Arrow direction="down" />
          </li>
          <li className="sf-step">
            <span className="sf-step-number">02</span>
            <div>
              <h3>Shape the ICP</h3>
              <p>Review the profile: audience, offer, language, and the evidence that should matter.</p>
            </div>
            <Arrow direction="down" />
          </li>
          <li className="sf-step">
            <span className="sf-step-number">03</span>
            <div>
              <h3>Import company domains or CSV</h3>
              <p>Bring the accounts you already have. Research works from the companies you give it.</p>
            </div>
            <Arrow direction="down" />
          </li>
          <li className="sf-step sf-step-last">
            <span className="sf-step-number">04</span>
            <div>
              <h3>Rank, shortlist, draft or export</h3>
              <p>Review public evidence, keep the strongest accounts, then draft or export the next pass.</p>
            </div>
            <span className="sf-step-end" aria-hidden="true"><CheckMark /></span>
          </li>
        </ol>
      </section>

      <section className="sf-examples sf-shell" id="examples" aria-labelledby="examples-title">
        <div className="sf-examples-copy">
          <div className="sf-section-marker">
            <span>03</span>
            <span className="sf-marker-line" aria-hidden="true" />
            <span>SHOW YOUR WORK</span>
          </div>
          <h2 id="examples-title">Classify what is in front of you before you write to it.</h2>
          <p>
            These are live-smoke classifications used to show the shape of a
            research pass. They are not invented leads, customer logos, or a claim
            that these companies use SignalFoundry.
          </p>
          <p className="sf-example-disclaimer">Public website research example</p>
        </div>
        <div className="sf-example-table" role="table" aria-label="Public website research examples">
          <div className="sf-example-table-head" role="row">
            <span role="columnheader">Company</span>
            <span role="columnheader">Classification</span>
            <span role="columnheader">Read</span>
          </div>
          <div className="sf-example-table-row" role="row">
            <span role="cell" className="sf-example-company"><span className="sf-example-dot sf-example-dot-green" aria-hidden="true" />Lowcode Agency</span>
            <span role="cell">agency</span>
            <span role="cell" className="sf-example-read">Services-led</span>
          </div>
          <div className="sf-example-table-row" role="row">
            <span role="cell" className="sf-example-company"><span className="sf-example-dot sf-example-dot-blue" aria-hidden="true" />Airtable</span>
            <span role="cell">software vendor</span>
            <span role="cell" className="sf-example-read">Product-led</span>
          </div>
          <div className="sf-example-table-row" role="row">
            <span role="cell" className="sf-example-company"><span className="sf-example-dot sf-example-dot-amber" aria-hidden="true" />XRay</span>
            <span role="cell">consultancy</span>
            <span role="cell" className="sf-example-read">Expertise-led</span>
          </div>
          <div className="sf-example-table-footer">
            <span>Input: public websites you provide</span>
            <span>Output: reviewable classification</span>
          </div>
        </div>
      </section>

      <section className="sf-boundaries sf-shell" id="faq" aria-labelledby="faq-title">
        <div className="sf-boundaries-heading">
          <div className="sf-section-marker">
            <span>04</span>
            <span className="sf-marker-line" aria-hidden="true" />
            <span>THE FINE PRINT</span>
          </div>
          <h2 id="faq-title">Useful because it knows where to stop.</h2>
          <p>
            SignalFoundry is an account-research workspace, not a complete outbound
            stack. The honest boundary is part of the product.
          </p>
        </div>
        <div className="sf-faq-list">
          <details open>
            <summary>Where does research come from?</summary>
            <p>From the public websites and company domains you provide. Review the evidence before you decide what to keep.</p>
          </details>
          <details>
            <summary>Does it discover contacts or send outreach?</summary>
            <p>No. The preview does not discover contacts, does not verify email addresses, and does not send campaigns. It stops at account research, shortlisting, and draft or export.</p>
          </details>
          <details>
            <summary>Are the named companies customers or sample leads?</summary>
            <p>No. Lowcode Agency, Airtable, and XRay are shown only as a public website research example so you can see classification language.</p>
          </details>
          <details>
            <summary>How do plans and limits work?</summary>
            <p>There is no arbitrary price or credit promise on this staging preview. Your plan and limits are visible in the workspace.</p>
          </details>
        </div>
      </section>

      <section className="sf-final sf-shell" aria-labelledby="final-title">
        <div className="sf-final-mark" aria-hidden="true"><SignalMark compact /></div>
        <div>
          <p className="sf-kicker">READY WHEN YOUR BRIEF IS</p>
          <h2 id="final-title">Make your next account list easier to believe.</h2>
        </div>
        <Link className="sf-button sf-button-light" href="/workspace">
          Open the workspace <Arrow />
        </Link>
      </section>

      <footer className="sf-footer sf-shell">
        <div className="sf-footer-brand">
          <Link className="sf-brand" href="/" aria-label="SignalFoundry home">
            <SignalMark />
            <span>
              Signal<span className="sf-brand-light">Foundry</span>
              <b>.</b>
            </span>
          </Link>
          <p>Evidence-led account research for founders and sales teams.</p>
        </div>
        <div className="sf-footer-links" aria-label="Footer navigation">
          <Link href="#workflow">Workflow</Link>
          <Link href="#faq">FAQ</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <p className="sf-footer-note">Staging preview — not a production service.</p>
      </footer>
    </main>
  );
}
