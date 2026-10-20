import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { runtimeConfig } from "@/lib/runtime-config";
import { AuthShell } from "@/components/setup-state";
import { PRODUCT_NAME } from "@/lib/product";
export const metadata = { title: "Sign up" };
export default function SignUpPage() {
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
          <Link className="btn primary" href="/workspace/setup">
            Continue to business setup
          </Link>
        </section>
      </AuthShell>
    );
  return (
    <AuthShell>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  );
}
