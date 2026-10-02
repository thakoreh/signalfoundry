import Link from "next/link";
import LandingMotion from "./landing-motion";
import LandingDemo from "./landing-demo";
import "../app/landing.css";

const SIGN_UP_HREF = "/sign-up?redirect_url=/workspace";
const SIGN_IN_HREF = "/sign-in?redirect_url=/workspace";

function Arrow() {
  return (
    <svg
      className="sf-arrow"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 10h13M11 4l6 6-6 6" />
    </svg>
  );
}
function Brand() {
  return (
    <>
      <span className="sf-brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        Signal<span className="sf-brand-light">Foundry</span>
        <b>.</b>
      </span>
    </>
  );
}
function Check() {
  return (
    <svg
      className="sf-check"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="sf-landing" data-motion-policy="prefers-reduced-motion">
      <noscript>
        <style>{`@media (max-width: 900px) { .sf-landing .sf-nav-links { display: flex !important; } .sf-landing .sf-mobile-toggle { display: none !important; } }`}</style>
      </noscript>
      <a className="sf-skip-link" href="#workflow">
        Skip to workflow
      </a>
      <header className="sf-nav sf-shell">
        <Link className="sf-brand" href="/" aria-label="SignalFoundry home">
          <Brand />
        </Link>
        <LandingMotion />
        <nav
          className="sf-nav-links"
          id="sf-mobile-menu"
          aria-label="Primary navigation"
        >
          <a href="#workflow">How it works</a>
          <a href="#examples">The evidence</a>
          <a href="#plans">Scope &amp; plans</a>
          <a href="#faq">FAQ</a>
          <Link href={SIGN_IN_HREF} className="sf-mobile-signin">
            Sign in
          </Link>
        </nav>
        <div className="sf-nav-actions">
          <Link className="sf-nav-signin" href={SIGN_IN_HREF}>
            Sign in
          </Link>
          <Link
            className="sf-button sf-button-dark sf-nav-cta"
            href={SIGN_UP_HREF}
          >
            Create workspace <Arrow />
          </Link>
        </div>
      </header>

      <section className="sf-hero sf-shell" aria-labelledby="hero-title">
        <div className="sf-hero-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="sf-hero-copy" data-reveal="hero">
          <p className="sf-kicker">
            <span className="sf-kicker-dot" aria-hidden="true" /> EVIDENCE-LED
            ACCOUNT RESEARCH
          </p>
          <h1 id="hero-title">
            Research signal,
            <br />
            <span>not noise.</span>
          </h1>
          <p className="sf-hero-lede">
            Turn the company domains you bring into a shortlist you can stand
            behind. Every source, observation, and unknown stays attached.
          </p>
          <div className="sf-hero-actions">
            <Link className="sf-button sf-button-dark" href={SIGN_UP_HREF}>
              Create a workspace <Arrow />
            </Link>
            <a className="sf-button sf-button-outline" href="#workflow">
              <span className="sf-play" aria-hidden="true">
                ▷
              </span>{" "}
              Explore the research
            </a>
          </div>
          <p className="sf-hero-note">
            Your accounts. Public evidence. Your call.
          </p>
        </div>
        <section
          className="sf-workflow"
          id="workflow"
          aria-labelledby="workflow-title"
          data-reveal="workflow"
        >
          <div className="sf-demo-label">
            <span>
              <span className="sf-status-dot" aria-hidden="true" /> INSIDE
              SIGNALFOUNDRY
            </span>
            <span>Interactive product walkthrough</span>
          </div>
          <h2 id="workflow-title" className="sf-sr-only">
            From your ICP to an evidence-backed shortlist
          </h2>
          <LandingDemo />
        </section>
      </section>

      <section
        className="sf-principles sf-shell"
        aria-label="What stays with your research"
      >
        <p>
          A better list starts
          <br />
          <strong>with a better reason.</strong>
        </p>
        <div>
          <Check />
          <span>
            Research the domains
            <br />
            <strong>you choose</strong>
          </span>
        </div>
        <div>
          <Check />
          <span>
            Keep public evidence
            <br />
            <strong>in plain sight</strong>
          </span>
        </div>
        <div>
          <Check />
          <span>
            Make the final call
            <br />
            <strong>with your team</strong>
          </span>
        </div>
      </section>

      <section
        className="sf-evidence sf-shell"
        id="examples"
        aria-labelledby="examples-title"
      >
        <div className="sf-evidence-copy" data-reveal="evidence">
          <p className="sf-kicker">01 / SHOW YOUR WORK</p>
          <h2 id="examples-title">
            A shortlist with
            <br />
            <span>receipts.</span>
          </h2>
          <p>
            Go beyond a label. See what a company says, why it might fit, and
            what you still need to find out.
          </p>
          <ul className="sf-benefits">
            <li>
              <Check />
              <span>
                <strong>Sources you can open</strong>Follow the public website
                behind an observation.
              </span>
            </li>
            <li>
              <Check />
              <span>
                <strong>Unknowns that stay unknown</strong>No invented contacts
                or buying intent.
              </span>
            </li>
            <li>
              <Check />
              <span>
                <strong>Context that travels</strong>Keep the reason when you
                shortlist, draft, or export.
              </span>
            </li>
          </ul>
          <a className="sf-text-link" href="#workflow">
            Walk through an example <Arrow />
          </a>
        </div>
        <div
          className="sf-evidence-visual"
          id="output"
          data-reveal="evidence-card"
        >
          <div className="sf-source-card">
            <div className="sf-source-head">
              <span className="sf-account-token">LA</span>
              <div>
                <strong>Lowcode Agency</strong>
                <span>Public website research example</span>
              </div>
              <span className="sf-tag">Agency</span>
            </div>
            <div className="sf-source-observation">
              <span className="sf-overline">SAVED HOMEPAGE SUMMARY</span>
              <p>Builds custom internal tools for growing teams.</p>
              <a
                href="https://www.lowcode.agency/"
                target="_blank"
                rel="noreferrer"
              >
                lowcode.agency <span aria-hidden="true">↗</span>
                <span className="sf-sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            <div className="sf-source-reason">
              <Check />
              <p>
                <strong>The reason to review</strong>A services-led offer is
                relevant to this illustrative brief.
              </p>
            </div>
            <div className="sf-source-unknown">
              <span aria-hidden="true">?</span>
              <p>
                <strong>Still unknown</strong>Current buying intent and verified
                contact details.
              </p>
            </div>
            <p className="sf-card-footnote">
              Illustrative interpretation of saved public research. Recheck the
              source before using it.
            </p>
          </div>
          <div className="sf-source-caption">
            <span className="sf-caption-line" />
            <span>Evidence first. Decision second.</span>
          </div>
        </div>
      </section>

      <section
        className="sf-classification sf-shell"
        aria-labelledby="classification-title"
      >
        <div className="sf-section-heading">
          <p className="sf-kicker">SAME QUESTION. DIFFERENT ANSWERS.</p>
          <h2 id="classification-title">Know what you’re looking at.</h2>
          <p>
            A software vendor and a services business can use the same words.
            The difference matters.
          </p>
        </div>
        <div className="sf-company-grid">
          <article>
            <div className="sf-company-heading">
              <span className="sf-account-token">LA</span>
              <span className="sf-tag">Agency</span>
            </div>
            <h3>Lowcode Agency</h3>
            <p>Custom internal tools for growing teams.</p>
            <div className="sf-company-bottom">
              <span>Services-led</span>
              <a
                className="sf-company-source"
                href="https://www.lowcode.agency/"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit Lowcode Agency public website (opens in a new tab)"
              >
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
          <article>
            <div className="sf-company-heading">
              <span className="sf-account-token sf-token-blue">AT</span>
              <span className="sf-tag sf-tag-neutral">Software vendor</span>
            </div>
            <h3>Airtable</h3>
            <p>A flexible database platform for teams.</p>
            <div className="sf-company-bottom">
              <span>Product-led</span>
              <a
                className="sf-company-source"
                href="https://www.airtable.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit Airtable public website (opens in a new tab)"
              >
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
          <article>
            <div className="sf-company-heading">
              <span className="sf-account-token sf-token-lilac">XR</span>
              <span className="sf-tag sf-tag-neutral">Consultancy</span>
            </div>
            <h3>XRay</h3>
            <p>A consultancy-led operating model.</p>
            <div className="sf-company-bottom">
              <span>Expertise-led</span>
              <a
                className="sf-company-source"
                href="https://www.xray.tech/"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit XRay public website (opens in a new tab)"
              >
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        </div>
        <p className="sf-classification-note">
          Public website research examples, not invented leads, customer logos,
          or a claim that these companies use SignalFoundry.
        </p>
      </section>

      <section
        className="sf-scope sf-shell"
        id="plans"
        aria-labelledby="scope-title"
      >
        <div className="sf-scope-copy">
          <p className="sf-kicker">02 / CLEAR SCOPE</p>
          <h2 id="scope-title">
            Built for the research.
            <br />
            <span>You own the next move.</span>
          </h2>
          <p>
            Bring a brief and real company domains. Review the work before it
            becomes your shortlist.
          </p>
          <p className="sf-scope-plan">
            Your current plan, limits, and any paid boundary appear in the
            workspace before a research run.
          </p>
          <Link className="sf-text-link" href={SIGN_UP_HREF}>
            See the workspace plan <Arrow />
          </Link>
        </div>
        <div className="sf-scope-card">
          <p className="sf-overline">IN YOUR WORKSPACE</p>
          <ul>
            <li>
              <Check />
              Editable ICP and campaign brief
            </li>
            <li>
              <Check />
              Up to 10 real domains per campaign
            </li>
            <li>
              <Check />
              Saved public research with citations
            </li>
            <li>
              <Check />
              Human-reviewed drafts and CSV export
            </li>
          </ul>
          <div className="sf-boundary">
            <span className="sf-overline">THE BOUNDARY</span>
            <p>
              No automatic discovery
              <br />
              No contact enrichment or verification
              <br />
              No sending, replies, or meeting booking
            </p>
          </div>
        </div>
      </section>

      <section className="sf-faq sf-shell" id="faq" aria-labelledby="faq-title">
        <div>
          <p className="sf-kicker">A FEW GOOD QUESTIONS</p>
          <h2 id="faq-title">
            Clarity comes <br />
            standard.
          </h2>
        </div>
        <div className="sf-faq-list">
          <details open>
            <summary>Where does research come from?</summary>
            <p>
              From the public websites and company domains you provide. Each
              pass keeps citations, explicit unknowns, and the observed language
              available for review.
            </p>
          </details>
          <details>
            <summary>
              Does SignalFoundry discover contacts or send outreach?
            </summary>
            <p>
              No. It does not discover contacts, verify email addresses, send
              campaigns, manage replies, or book meetings. It stops at account
              research, shortlisting, human-reviewed drafts, and export.
            </p>
          </details>
          <details>
            <summary>Is the walkthrough a live research run?</summary>
            <p>
              No. It is a local, illustrative walkthrough using saved public
              research. Clicking through it does not import accounts, run
              research, save a shortlist, or export a file. Lowcode Agency,
              Airtable, and XRay are examples, not customers or recommended
              leads.
            </p>
          </details>
          <details>
            <summary>How do plans and limits work?</summary>
            <p>
              The current plan and limits are shown in the workspace before a
              research run or paid boundary. This public preview does not
              promise a price, trial, refund, or credit.
            </p>
          </details>
          <details>
            <summary>What does a confidence label mean?</summary>
            <p>
              Confidence describes uncertainty in a classification or fit
              assessment. It is not a verified contact, a guarantee of buying
              intent, or a performance claim.
            </p>
          </details>
        </div>
      </section>

      <section className="sf-final sf-shell" aria-labelledby="final-title">
        <div className="sf-final-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p className="sf-kicker">FROM A LIST TO A POINT OF VIEW</p>
        <h2 id="final-title">
          Make your next account <br />
          list worth believing.
        </h2>
        <p>Bring the companies. Keep the reasons.</p>
        <Link className="sf-button sf-button-light" href={SIGN_UP_HREF}>
          Create a workspace <Arrow />
        </Link>
      </section>
      <footer className="sf-footer sf-shell">
        <div>
          <Link className="sf-brand" href="/" aria-label="SignalFoundry home">
            <Brand />
          </Link>
          <p>
            Evidence-led account research
            <br />
            for founders and sales teams.
          </p>
        </div>
        <nav className="sf-footer-links" aria-label="Footer navigation">
          <a href="#workflow">How it works</a>
          <a href="#examples">The evidence</a>
          <a href="#plans">Scope &amp; plans</a>
          <a href="#faq">FAQ</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className="sf-footer-note">
          Staging preview.
          <br />
          Not a production service.
        </p>
      </footer>
    </main>
  );
}
