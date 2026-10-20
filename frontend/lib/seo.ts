import type { Metadata } from "next";
import { runtimeConfig, exactOrigin } from "./runtime-config.ts";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "./product.ts";

export const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/contact"] as const;
export const PRIVATE_PATHS = [
  "/workspace",
  "/sign-in",
  "/sign-up",
  "/recover",
  "/api",
  "/readyz",
];
export const NO_INDEX = { index: false, follow: false } as const;

/** Public indexing is a launch decision, never a side effect of next build. */
export function productionOrigin(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (
    env.NODE_ENV !== "production" ||
    env.SEO_ALLOW_INDEXING !== "true" ||
    (env.VERCEL_ENV && env.VERCEL_ENV !== "production") ||
    (env.CONTEXT && env.CONTEXT !== "production")
  )
    return null;
  const config = runtimeConfig(env, env.NEXT_PUBLIC_SIGNALFOUNDRY_MODE);
  const origin = exactOrigin(env.APP_URL);
  if (
    !config.ready ||
    config.mode !== "saas" ||
    !origin ||
    !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") ||
    !env.CLERK_SECRET_KEY?.startsWith("sk_live_")
  )
    return null;
  const url = new URL(origin);
  const host = url.hostname;
  if (
    url.protocol !== "https:" ||
    url.port ||
    host.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      host,
    ) ||
    /^[\d.]+$/.test(host) ||
    /(^|[.-])(localhost|local|internal|test|dev|development|stage|staging|preview)([.-]|$)/.test(
      host,
    ) ||
    /(^|\.)(example\.(com|org|net)|vercel\.app|netlify\.app|invalid)$/.test(
      host,
    )
  )
    return null;
  return origin;
}

export function publicPageMetadata(
  path: (typeof PUBLIC_PATHS)[number],
  title: string,
  description = PRODUCT_DESCRIPTION,
  env: Record<string, string | undefined> = process.env,
): Metadata {
  const origin = productionOrigin(env);
  return {
    title,
    description,
    robots: origin ? { index: true, follow: true } : NO_INDEX,
    ...(origin
      ? {
          alternates: { canonical: new URL(path, origin).href },
          openGraph: {
            type: "website",
            siteName: PRODUCT_NAME,
            title,
            description,
            url: new URL(path, origin).href,
            images: [
              {
                url: `${origin}/social-card`,
                width: 1200,
                height: 630,
                alt: `${PRODUCT_NAME}: Find businesses that need what you sell`,
              },
            ],
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [`${origin}/social-card`],
          },
        }
      : {}),
  };
}

/** Reuse the nonce in Clerk's forwarded CSP; never relax the script policy. */
export function cspNonce(policy: string | null): string | null {
  const scripts = policy
    ?.split(";")
    .find((part) => /^\s*script-src\s/.test(part));
  return (
    scripts?.match(/(?:^|\s)'nonce-([A-Za-z0-9+/_=-]+)'(?:\s|$)/)?.[1] ?? null
  );
}

export function websiteSchema(origin: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PRODUCT_NAME,
    url: origin,
    description: PRODUCT_DESCRIPTION,
  }).replace(/</g, "\\u003c");
}
