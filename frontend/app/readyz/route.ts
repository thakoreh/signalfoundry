import { runtimeConfig } from "@/lib/runtime-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Configuration readiness only; provider acceptance is a separate launch gate. */
export function GET() {
  const state = runtimeConfig();
  return Response.json(
    { status: state.ready ? "configured" : "not_configured" },
    {
      status: state.ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
