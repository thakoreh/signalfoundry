import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { proxyTimeout: 180_000, proxyClientMaxBodySize: "64kb" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.APP_URL?.startsWith("https://")
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
  async rewrites() {
    // Build-time opt-in. SaaS never falls through to the unauthenticated local API.
    if (
      process.env.SIGNALFOUNDRY_MODE !== "local-demo" ||
      process.env.NEXT_PUBLIC_SIGNALFOUNDRY_MODE !== "local-demo"
    )
      return [];
    const backend = (
      process.env.API_BASE_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${backend}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};
export default config;
