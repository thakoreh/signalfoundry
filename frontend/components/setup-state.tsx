import Link from "next/link";
export function SetupState({ issues }: { issues: string[] }) {
  return (
    <main className="auth-shell">
      <section className="setup-card">
        <span className="eyebrow">SIGNALFOUNDRY SETUP</span>
        <h1>This workspace isn’t configured yet</h1>
        <p>
          Access is paused until an administrator completes the application
          configuration.
        </p>
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
        <p>
          Local demo and authenticated SaaS are separate modes. No
          authentication or billing connection is active on this screen.
        </p>
      </section>
    </main>
  );
}
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-heading">
        <Link href="/" className="auth-brand">
          SignalFoundry.
        </Link>
        <h1>Evidence for your next opportunity</h1>
        <p>Private research, organized around your team.</p>
      </section>
      {children}
    </main>
  );
}
