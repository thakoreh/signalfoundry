import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { runtimeConfig } from "@/lib/runtime-config";
import { AuthShell } from "@/components/setup-state";
export default function SignUpPage() {
  const config = runtimeConfig();
  if (!config.ready) return null;
  if (config.mode !== "saas") redirect("/");
  return (
    <AuthShell>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  );
}
