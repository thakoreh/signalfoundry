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
          <p>This preview does not have a published support inbox or production contact address yet. We are keeping that explicit rather than inventing one.</p>
          <h2>For preview feedback</h2>
          <p>Use the project owner’s established support channel for the environment where you received this preview. Include the route, the workspace mode, and a short description of what you saw. Do not include passwords, private contact data, or confidential company information.</p>
          <h2>Before production</h2>
          <p>A production release will publish a support contact, privacy request path, and service status expectations before asking teams to rely on SignalFoundry.</p>
          <p className="sf-legal-back"><Link href="/">Back to SignalFoundry</Link></p>
        </div>
      </article>
    </main>
  );
}
