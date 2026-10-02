import Link from "next/link";
import "../landing.css";

function LegalNav() {
  return (
    <header className="sf-nav">
      <Link className="sf-brand" href="/" aria-label="SignalFoundry home">
        <span className="sf-brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>Signal<span className="sf-brand-light">Foundry</span><b>.</b></span>
      </Link>
      <Link className="sf-button sf-button-dark sf-nav-button" href="/workspace">Open workspace</Link>
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
          <p>This is a staging preview of SignalFoundry, not a production service. This page describes the intended direction of the preview, not a completed production privacy program.</p>
          <h2>What this preview may receive</h2>
          <p>If you use the workspace, you may provide a website, company domains, CSV rows, profile notes, shortlist decisions, and research output. The preview may also receive basic technical information needed to operate a session.</p>
          <h2>How to use this preview safely</h2>
          <p>Do not upload confidential, regulated, or personal contact data. Use public company information only. Research output is for review and should be checked before it is used elsewhere.</p>
          <h2>Retention and requests</h2>
          <p>Retention, deletion, subprocessors, and production support processes have not been finalized for this staging preview. No production privacy commitment is made here.</p>
          <p className="sf-legal-back"><Link href="/">Back to SignalFoundry</Link></p>
        </div>
      </article>
    </main>
  );
}
