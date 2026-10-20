import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { runtimeConfig } from "@/lib/runtime-config";
import { AuthShell } from "@/components/setup-state";
import { PRODUCT_NAME } from "@/lib/product";
export const metadata = { title: "Sign in" };
export default function SignInPage() {
  const config = runtimeConfig();
  if (!config.ready) return null;
  if (config.mode !== "saas")
    return (
      <AuthShell>
        <section className="setup-card">
          <h2>Continue to {PRODUCT_NAME}</h2>
          <p>
            You’re reviewing the app on this computer. No account is created
            here.
          </p>
          <Link className="btn primary" href="/workspace">
            Open your workspace
          </Link>
        </section>
      </AuthShell>
    );
  return (
    <AuthShell>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      <Link href="/recover">Need help recovering your account?</Link>
    </AuthShell>
  );
}
