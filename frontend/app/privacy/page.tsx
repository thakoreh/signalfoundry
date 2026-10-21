import Link from "next/link";
import "../landing.css";
import { SignalBrand } from "@/components/signal-brand";
import { PRODUCT_NAME } from "@/lib/product";
import { publicPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return publicPageMetadata(
    "/privacy",
    "Privacy",
    "What the Clientrove preview may receive and which production privacy processes still need to be finalized.",
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

export default function PrivacyPage() {
  return (
    <main className="sf-legal">
      <LegalNav />
      <article className="sf-legal-inner">
        <header className="sf-legal-header">
          <p className="sf-legal-eyebrow">Staging preview / privacy</p>
          <h1>Privacy, plainly.</h1>
        </header>
        <div className="sf-legal-body">
          <p>
            This is a staging preview of Clientrove, not a production service.
            This page describes the intended direction of the preview, not a
            completed production privacy program.
          </p>
          <h2>What this preview may receive</h2>
          <p>
            If you use the workspace, you may provide a website, company
            domains, CSV rows, profile notes, shortlist decisions, and research
            output, contact details, drafted messages, pasted replies and
            manually reported meeting or customer outcomes. Local mode saves
            these records on the computer running the app. The preview may also receive basic technical information
            needed to operate a session.
          </p>
          <h2>How to use this preview safely</h2>
          <p>
            Use public company information and relevant public professional
            contact details. Avoid confidential, regulated or unnecessary private
            personal information when pasting replies. Research output is for review and
            should be checked before it is used elsewhere.
          </p>
          <h2>Optional AI message drafts</h2>
          <p>
            When you request an AI draft, the preview sends your saved business
            name and offering, the selected company name, and limited excerpts
            of its public research to DeepSeek. Contact-list fields are not
            included in the draft-generation request. Generated drafts are saved
            with your workspace so reopening the same research can reuse them.
            Drafts are editable, and this feature does not send messages.
          </p>
          <h2>Retention and requests</h2>
          <p>
            Local mode offers a saved-workspace JSON export. The owner can
            logically erase and close a local workspace with the documented
            offline data tool. Minimal suppression, financial audit and closure
            facts remain so deletion cannot reopen stopped outreach or reset
            spending. This does not securely wipe disk remnants or delete
            separate backups, exports or messages in an external email app.
          </p>
          <p>
            Retention, deletion, subprocessors, and production support processes
            have not been finalized for this staging preview. No production
            privacy commitment is made here.
          </p>
          <p className="sf-legal-back">
            <Link href="/">Back to Clientrove</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
