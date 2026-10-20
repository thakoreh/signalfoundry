import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/product";
import { SignalBrand } from "@/components/signal-brand";
export function SetupState({ issues }: { issues: string[] }) {
  return (
    <main className="auth-shell">
      <section className="setup-card">
        <span className="eyebrow">{PRODUCT_NAME.toUpperCase()} SETUP</span>
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
        <Link
          href="/"
          className="auth-brand sf-brand"
          aria-label={`${PRODUCT_NAME} home`}
        >
          <SignalBrand />
        </Link>
        <h1>Find your next customers</h1>
        <p>Start with your website. Find businesses worth contacting.</p>
      </section>
      {children}
    </main>
  );
}
