import Link from "next/link";
import { PRODUCT_NAME } from "../lib/product";
import { LandingIntake } from "./landing-intake";
import { LandingMarketing } from "./landing-marketing";
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
        <div className="sf-hero-art" aria-hidden="true">
          <svg
            className="sf-hero-flow"
            viewBox="0 0 1440 640"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
          >
            <path d="M-80 540C210 540 160 100 435 180S870 640 1520 120" />
            <path d="M-80 190C240 190 270 590 610 490S1110 40 1520 350" />
            <path d="M-80 370C260 700 410 0 810 200S1150 660 1520 480" />
          </svg>
          <span className="sf-flow-dot sf-flow-dot-one" />
          <span className="sf-flow-dot sf-flow-dot-two" />
          <span className="sf-flow-dot sf-flow-dot-three" />
        </div>
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
            Your next customer starts with the right conversation.
            <br className="sf-desktop-break" /> Find businesses, approve an AI
            introduction, and keep the next step in view.
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

      <LandingMarketing />

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
        <p className="sf-kicker">Start with a website. Build from there.</p>
        <h2 id="final-title">
          Your next customer
          <br />
          starts with a conversation.
        </h2>
        <p>Bring your business. Keep the context. Take the next step.</p>
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
