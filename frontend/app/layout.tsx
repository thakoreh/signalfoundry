import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { runtimeConfig } from "@/lib/runtime-config";
import { SetupState } from "@/components/setup-state";
import { headers } from "next/headers";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/product";
import { cspNonce, NO_INDEX, productionOrigin, websiteSchema } from "@/lib/seo";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} | Find businesses to contact`,
    template: `%s | ${PRODUCT_NAME}`,
  },
  applicationName: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
  robots: NO_INDEX,
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = runtimeConfig();
  const origin = productionOrigin();
  const nonce = origin
    ? cspNonce((await headers()).get("content-security-policy"))
    : null;
  return (
    <html lang="en">
      <head>
        {/* Paper's style marker prevents nonce-less runtime style insertion.
            All actual shader surface styles are in the bundled stylesheets. */}
        <style data-paper-shader nonce={nonce ?? undefined} />
      </head>
      <body>
        {origin && nonce ? (
          <script
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: websiteSchema(origin) }}
          />
        ) : null}
        {!config.ready ? (
          <SetupState issues={config.issues} />
        ) : config.mode === "saas" ? (
          <ClerkProvider
            appearance={{
              variables: {
                colorPrimary: "var(--brand-primary)",
                colorForeground: "var(--ink)",
                colorBackground: "var(--white)",
                colorInput: "var(--white)",
                colorMutedForeground: "var(--muted)",
                colorBorder: "var(--line)",
                fontFamily: "var(--font)",
                borderRadius: "10px",
              },
            }}
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
