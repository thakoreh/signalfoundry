import { NextResponse, type NextRequest } from "next/server";
import { hasTrustedHeaders } from "./lib/local-host";
export function proxy(request: NextRequest) {
  if (!hasTrustedHeaders(request.headers))
    return NextResponse.json(
      {
        detail:
          "This workspace accepts only its configured host and trusted proxy headers.",
      },
      { status: 403 },
    );
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
