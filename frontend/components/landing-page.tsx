import Link from "next/link";
import { PRODUCT_NAME } from "../lib/product";
import { LandingIntake } from "./landing-intake";
import LandingDemo from "./landing-demo";
import { LandingPreviewMotion } from "./landing-preview-motion";
import { SignalBrand } from "./signal-brand";
import { Icon } from "./icons";
import "../app/landing.css";

const SIGN_IN_HREF = "/sign-in?redirect_url=/workspace";
const SIGN_UP_HREF = "/sign-up?redirect_url=/workspace/setup";

export default function LandingPage() {
  return (
    <main className="sf-landing">
      <a className="sf-skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="sf-nav sf-shell">
        <Link className="sf-brand" href="/" aria-label={`${PRODUCT_NAME} home`}>
          <SignalBrand />
        </Link>
        <nav className="sf-nav-links" aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#your-list">Your sales workflow</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="sf-nav-actions">
          <Link className="sf-signin" href={SIGN_IN_HREF}>
            Sign in
          </Link>
          <Link
            className="sf-button sf-button-dark sf-nav-cta"
            href={SIGN_UP_HREF}
          >
            Sign up <Icon name="arrow" size={16} />
          </Link>
        </div>
      </header>

      <section
        id="main-content"
        tabIndex={-1}
        className="sf-hero"
        aria-labelledby="hero-title"
      >
        <div className="sf-hero-art" aria-hidden="true" />
        <div className="sf-hero-copy sf-shell">
          <p className="sf-hero-eyebrow">
            <span aria-hidden="true" /> For founders selling SaaS to businesses
          </p>
          <h1 id="hero-title">
            From your website
            <br />
            <span>to your next sales conversation.</span>
          </h1>
          <p className="sf-hero-lede">
            Find businesses, approve an AI introduction, and keep your
            <br className="sf-desktop-break" /> outreach, replies, and meetings
            in one place.
          </p>
          <LandingIntake />
          <ul
            className="sf-hero-assurances"
            aria-label="What you stay in control of"
          >
            <li>
              <Icon name="check" size={14} />
              AI drafts you approve
            </li>
            <li>
              <Icon name="check" size={14} />
              Replies and meetings you record
            </li>
            <li>
              <Icon name="check" size={14} />
              CSV when you need it
            </li>
          </ul>
          <a className="sf-hero-explore" href="#workflow">
            See how it works <Icon name="down" size={15} />
          </a>
        </div>
      </section>

      <section
        className="sf-workflow sf-shell"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <div className="sf-section-intro">
          <p className="sf-kicker">Less switching. A clearer next step.</p>
          <h2 id="workflow-title">
            A list is the beginning.
            <br />
            Keep the conversation moving.
          </h2>
          <p>
            From choosing a business to recording a meeting, keep the company,
            message, and next step together. You send using your own email tool
            and update replies and outcomes yourself.
          </p>
        </div>
        <LandingDemo />
        <LandingPreviewMotion />
        <ol className="sf-steps">
          <li>
            <span className="sf-step-number">01</span>
            <div>
              <h3>Find businesses to approach</h3>
              <p>
                Add your website and review your customer profile. Search for up
                to five businesses in the current test, then choose who to
                approach or export a CSV.
              </p>
            </div>
          </li>
          <li>
            <span className="sf-step-number">02</span>
            <div>
              <h3>Approve your introduction</h3>
              <p>
                Edit the AI draft and approve the exact message. Copy it to your
                email tool, send it yourself, then record that you sent it.
              </p>
            </div>
          </li>
          <li>
            <span className="sf-step-number">03</span>
            <div>
              <h3>Keep track of the conversation</h3>
              <p>
                Add replies manually, review your response, and record who is
                interested or has opted out. Keep a clear next step for each
                business.
              </p>
            </div>
          </li>
          <li>
            <span className="sf-step-number">04</span>
            <div>
              <h3>Record meetings and outcomes</h3>
              <p>
                Record a booked meeting, update whether it happened, and mark a
                customer outcome when you know it. These are your updates, not
                automatic calendar or sales confirmations.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section
        className="sf-list-section"
        id="your-list"
        aria-labelledby="list-title"
      >
        <div className="sf-shell sf-list-grid">
          <div className="sf-list-copy">
            <p className="sf-kicker">Make the next conversation count</p>
            <h2 id="list-title">
              Less scattered work.
              <br />
              <span>A clearer path to a conversation.</span>
            </h2>
            <p>
              The list, the approved message, the replies you add, and the
              meetings you report belong to the same business. See where you
              left off without piecing the story together across notes and
              spreadsheets.
            </p>
            <a className="sf-text-link" href="#main-content">
              Start with your website <Icon name="arrow" size={18} />
            </a>
          </div>
          <div className="sf-value-grid">
            <article>
              <span className="sf-value-icon">
                <Icon name="accounts" size={21} />
              </span>
              <h3>Choose a business</h3>
              <p>
                Review your target buyer and available contacts. Missing or
                unverified emails stay clearly marked.
              </p>
            </article>
            <article>
              <span className="sf-value-icon">
                <Icon name="external" size={20} />
              </span>
              <h3>Approve the exact message</h3>
              <p>
                AI starts the introduction from your offering and saved company
                facts. You edit, approve, and send using your own email tool.
              </p>
            </article>
            <article>
              <span className="sf-value-icon">
                <Icon name="mail" size={21} />
              </span>
              <h3>Keep replies in context</h3>
              <p>
                Paste a received reply and update its status. Prepare your
                response, pause outreach, or record an opt-out in the same
                place.
              </p>
            </article>
            <article>
              <span className="sf-value-icon">
                <Icon name="download" size={21} />
              </span>
              <h3>Follow the outcome</h3>
              <p>
                Record meetings and attendance, then mark a customer outcome.
                Your reported progress stays attached to the business.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        className="sf-availability sf-shell"
        aria-label="Current availability"
      >
        <Icon name="info" size={17} />
        <p>
          <strong>Available workflow:</strong> discovery, AI introductions you
          approve, and manually updated conversations and meetings. Searches may
          return fewer than five businesses; email availability varies.
          <br />
          <strong>Planned next:</strong> a connected inbox and automatic
          follow-ups. They are not connected or sending messages today.
        </p>
      </section>

      <section className="sf-faq sf-shell" id="faq" aria-labelledby="faq-title">
        <div>
          <p className="sf-kicker">A few useful answers</p>
          <h2 id="faq-title">Before you start.</h2>
          <p>
            Clear expectations.
            <br />A simpler first step.
          </p>
        </div>
        <div className="sf-faq-list">
          <details>
            <summary>Do I need a website?</summary>
            <p>
              A website is the easiest starting point. We use its public pages
              to draft your business profile, which you can review and edit. You
              can also enter your business details manually.
            </p>
          </details>
          <details>
            <summary>Will every business have a verified email?</summary>
            <p>
              No. Contact details depend on what’s available. An email is marked
              verified only when a verification service confirms its status;
              missing and unverified details stay clearly marked. Verification
              does not guarantee a reply.
            </p>
          </details>
          <details>
            <summary>Can I export my list?</summary>
            <p>
              Yes. Select the businesses you want to keep and export a CSV with
              their research and available contact information. Review the facts
              and email status before reaching out.
            </p>
          </details>
          <details>
            <summary>Does it send email or read my inbox?</summary>
            <p>
              No. Create and approve your introduction here, then copy it into
              your email tool and send it yourself. Record the send and paste
              received replies into Conversations. You review and write your
              responses; inbox sync and automatic follow-ups are planned.
            </p>
          </details>
          <details>
            <summary>
              How do meetings and customer outcomes get recorded?
            </summary>
            <p>
              Add your booking link and record meetings yourself. Update them as
              booked, attended, no-show, or cancelled, and mark won or lost when
              you know the customer outcome. A recorded meeting is your report;
              there is no calendar connection or guarantee of a booking or sale.
            </p>
          </details>
        </div>
      </section>

      <section className="sf-final sf-shell" aria-labelledby="final-title">
        <p className="sf-kicker">For your next B2B sales conversation</p>
        <h2 id="final-title">
          Start with your business.
          <br />
          Keep the next conversation in view.
        </h2>
        <p>Discover. Review. Record the reply. Follow the outcome.</p>
        <a className="sf-button sf-button-light" href="#main-content">
          Start with your website <Icon name="arrow" size={18} />
        </a>
      </section>
      <footer className="sf-footer sf-shell">
        <div>
          <Link
            className="sf-brand"
            href="/"
            aria-label={`${PRODUCT_NAME} home`}
          >
            <SignalBrand />
          </Link>
          <p>From finding a business to following the conversation.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </main>
  );
}
