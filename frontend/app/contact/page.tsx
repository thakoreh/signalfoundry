import Link from "next/link";
import "../landing.css";
import { SignalBrand } from "@/components/signal-brand";
import { PRODUCT_NAME } from "@/lib/product";
import { publicPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return publicPageMetadata(
    "/contact",
    "Contact",
    "How to provide feedback on the Clientrove preview and the current availability of support.",
  );
}

function LegalNav() {
  return (
    <header className="sf-nav">
      <Link className="sf-brand" href="/" aria-label={`${PRODUCT_NAME} home`}>
        <SignalBrand />
      </Link>
      <Link className="sf-button sf-button-dark sf-nav-button" href="/sign-up">
        Sign up
      </Link>
    </header>
  );
}

export default function ContactPage() {
  return (
    <main className="sf-legal">
      <LegalNav />
      <article className="sf-legal-inner">
        <header className="sf-legal-header">
          <p className="sf-legal-eyebrow">Staging preview / contact</p>
          <h1>Keep the loop open.</h1>
        </header>
        <div className="sf-legal-body">
          <p>
            This preview does not have a published support inbox or production
            contact address yet. We are keeping that explicit rather than
            inventing one.
          </p>
          <h2>For preview feedback</h2>
          <p>
            Use the project owner’s established support channel for the
            environment where you received this preview. Include the route, the
            workspace mode, and a short description of what you saw. Do not
            include passwords, private contact data, or confidential company
            information.
          </p>
          <h2>Before production</h2>
          <p>
            A production release will publish a support contact, privacy request
            path, and service status expectations before asking teams to rely on
            Clientrove.
          </p>
          <p className="sf-legal-back">
            <Link href="/">Back to Clientrove</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
