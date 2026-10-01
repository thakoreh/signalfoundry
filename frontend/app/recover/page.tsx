import Link from "next/link";
import { AuthShell } from "@/components/setup-state";
export default function RecoveryPage() {
  return (
    <AuthShell>
      <section className="setup-card">
        <h2>Recover your account</h2>
        <p>
          On the sign-in screen, enter your email and choose “Forgot password?”
          when prompted. Clerk handles the verification and reset securely.
        </p>
        <p>
          If your team uses single sign-on, recover access through your identity
          provider. If you cannot access a required verification method, contact
          your organization administrator.
        </p>
        <Link className="btn primary" href="/sign-in">
          Continue to secure sign-in
        </Link>
      </section>
    </AuthShell>
  );
}
