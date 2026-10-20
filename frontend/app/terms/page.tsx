import Link from "next/link";
import "../landing.css";
import { SignalBrand } from "@/components/signal-brand";
import { PRODUCT_NAME } from "@/lib/product";
import { publicPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return publicPageMetadata(
    "/terms",
    "Terms",
    "Plain-language terms and limitations for using the Clientrove preview.",
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

export default function TermsPage() {
  return (
    <main className="sf-legal">
      <LegalNav />
      <article className="sf-legal-inner">
        <header className="sf-legal-header">
          <p className="sf-legal-eyebrow">Staging preview / terms</p>
          <h1>Terms for a preview.</h1>
        </header>
        <div className="sf-legal-body">
          <p>
            Clientrove is currently a staging preview. These plain-language
            notes explain the boundaries of that preview; they are not a
            finalized production agreement.
          </p>
          <h2>Use and responsibility</h2>
          <p>
            Use the preview only with information you are allowed to provide.
            You are responsible for reviewing research, classifications, drafts,
            and exports before relying on them.
          </p>
          <h2>What the product does not promise</h2>
          <p>
            The preview does not promise contact discovery, verified email
            addresses, automated outreach, a particular research result,
            uninterrupted availability, or a production-ready service.
          </p>
          <h2>Plans and limits</h2>
          <p>
            There is no published price or credit promise on this preview. Any
            plan and limits shown in the workspace are subject to change before
            production release.
          </p>
          <h2>Changes and production release</h2>
          <p>
            These notes may change as the product is built. A production launch
            would publish a complete agreement before paid or consequential use.
          </p>
          <p className="sf-legal-back">
            <Link href="/">Back to Clientrove</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
