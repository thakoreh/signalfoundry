import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { runtimeConfig } from "@/lib/runtime-config";
import { SetupState } from "@/components/setup-state";
import "./globals.css";
export const metadata: Metadata = {
  title: "SignalFoundry | Prospect research that earns your next conversation",
  description:
    "Turn company websites into an evidence-backed prospect shortlist. Define your ideal customer, qualify accounts, and prepare outreach you can review.",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = runtimeConfig();
  return (
    <html lang="en">
      <body>
        {!config.ready ? (
          <SetupState issues={config.issues} />
        ) : config.mode === "saas" ? (
          <ClerkProvider
            dynamic
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/workspace"
            signUpFallbackRedirectUrl="/workspace"
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
