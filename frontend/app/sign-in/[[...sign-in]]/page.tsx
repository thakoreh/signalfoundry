import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { runtimeConfig } from "@/lib/runtime-config";
import { AuthShell } from "@/components/setup-state";
export default function SignInPage() {
  const config = runtimeConfig();
  if (!config.ready) return null;
  if (config.mode !== "saas") redirect("/");
  return (
    <AuthShell>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      <Link href="/recover">Need help recovering your account?</Link>
    </AuthShell>
  );
}
