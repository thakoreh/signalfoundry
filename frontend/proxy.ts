import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { hasTrustedHeaders } from "./lib/local-host";
import { runtimeConfig, trustedSaasHost } from "./lib/runtime-config";

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const state = runtimeConfig();
  if (!state.ready) {
    if (request.nextUrl.pathname.startsWith("/api/"))
      return NextResponse.json(
        { detail: "Application configuration is incomplete." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.next(); // The server layout displays a non-interactive setup state.
  }
  if (state.mode === "local-demo") {
    if (!hasTrustedHeaders(request.headers))
      return NextResponse.json(
        {
          detail:
            "This local demo accepts only its configured host and trusted proxy headers.",
        },
        { status: 403 },
      );
    return NextResponse.next();
  }
  if (!trustedSaasHost(request.headers, state.appOrigin!))
    return NextResponse.json(
      { detail: "Untrusted application host." },
      { status: 403 },
    );
  const middleware = clerkMiddleware({
    authorizedParties: [state.appOrigin!],
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "img-src": ["data:", "blob:"],
      },
    },
  });
  return middleware(request, event);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|readyz$).*)"],
};
