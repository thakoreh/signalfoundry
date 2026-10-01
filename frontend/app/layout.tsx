import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { runtimeConfig } from "@/lib/runtime-config";
import { SetupState } from "@/components/setup-state";
import "./globals.css";
export const metadata: Metadata = {
  title: "SignalFoundry — Find your next right customer",
  description:
    "Evidence-led account research. Build your ideal customer profile, prioritize accounts, and turn public signals into thoughtful outreach.",
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
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
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
