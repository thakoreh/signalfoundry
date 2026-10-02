import type { AuthConfig } from "convex/server";

// Configure the real Clerk issuer on each Convex deployment. No fallback issuer.
export default {
  providers: [
    { domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" },
  ],
} satisfies AuthConfig;
