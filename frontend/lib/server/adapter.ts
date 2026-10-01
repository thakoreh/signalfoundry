import type { RuntimeConfig } from "../runtime-config.ts";

export type FunctionName =
  | "workspaces.get"
  | "workspaces.analyze"
  | "workspaces.provision"
  | "workspaces.saveProfile"
  | "workspaces.loadDemo"
  | "campaigns.list"
  | "campaigns.create"
  | "campaigns.get"
  | "campaigns.accounts"
  | "accounts.get"
  | "accounts.setStatus"
  | "accounts.draft"
  | "jobs.start"
  | "jobs.get"
  | "jobs.cancel"
  | "jobs.forCampaign"
  | "billing.status"
  | "stripe.checkout"
  | "stripe.portal";
export type Session = {
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
  getToken: () => Promise<string | null>;
};
export type AdapterDependencies = {
  config: RuntimeConfig;
  session: () => Promise<Session>;
  invoke: (
    name: FunctionName,
    args: Record<string, unknown>,
    token: string,
  ) => Promise<unknown>;
};
export const MAX_BODY_BYTES = 32 * 1024;
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
function keys(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail(400, "Unexpected request fields.");
}
function string(value: unknown, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(400, "A required text field is missing or too long.");
  return value.trim();
}
function list(value: unknown, max = 30): string[] {
  if (!Array.isArray(value) || value.length > max)
    fail(400, "Invalid list size.");
  return value.map((item) => string(item, 300));
}
function profile(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "A customer profile is required.");
  const p = value as Record<string, unknown>;
  const fields = [
    "industries",
    "company_sizes",
    "geographies",
    "buyer_roles",
    "keywords",
    "exclusions",
  ];
  keys(p, ["company_name", "description", ...fields]);
  return {
    company_name: string(p.company_name),
    description: string(p.description, 4000),
    ...Object.fromEntries(fields.map((name) => [name, list(p[name])])),
  };
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    fail(415, "Use application/json.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES))
    fail(413, "Request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "A JSON object is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      fail(413, "Request body is too large.");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    fail(400, "Invalid JSON body.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    fail(400, "A JSON object is required.");
  return parsed as Record<string, unknown>;
}
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function safeProviderError(error: unknown): {
  status: number;
  detail: string;
} {
  const data =
    typeof error === "object" && error !== null && "data" in error
      ? error.data
      : null;
  const code =
    typeof data === "string"
      ? data
      : data && typeof data === "object" && "code" in data
        ? String(data.code)
        : "";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Your session expired. Sign in again."],
    UNAUTHORIZED: [403, "Your organization role cannot perform this action."],
    FORBIDDEN: [403, "Your organization role cannot perform this action."],
    ADMIN_REQUIRED: [
      403,
      "An organization administrator must perform this action.",
    ],
    ORGANIZATION_REQUIRED: [403, "Select an active organization."],
    NOT_FOUND: [404, "This item was not found in your active organization."],
    VALIDATION_ERROR: [400, "Some request fields are invalid."],
    INVALID_ARGUMENT: [400, "Some request fields are invalid."],
    RATE_LIMITED: [429, "Too many requests. Please wait before trying again."],
    QUOTA_EXCEEDED: [429, "Your workspace has reached its research allowance."],
    BILLING_REQUIRED: [
      402,
      "An active research subscription is required. Ask your administrator to review billing.",
    ],
    BILLING_UNAVAILABLE: [
      503,
      "Billing is temporarily unavailable. Please retry shortly.",
    ],
    RESEARCH_FAILED: [
      503,
      "Research could not be completed. Check the campaign status or try again later.",
    ],
    CONFIGURATION_ERROR: [
      503,
      "This service is not configured. Contact your administrator.",
    ],
    WORKSPACE_REQUIRED: [
      409,
      "An administrator must initialize this workspace.",
    ],
    CONFLICT: [
      409,
      "This operation is already in progress. Refresh its status.",
    ],
  };
  const result = known[code];
  return result
    ? { status: result[0], detail: result[1] }
    : {
        status: 503,
        detail:
          "The service could not complete this request. Try again shortly.",
      };
}

/** A closed REST adapter. Paths, function names, roles, and arguments are never browser-controlled dispatch. */
export async function handleApi(
  request: Request,
  path: string[],
  deps: AdapterDependencies,
): Promise<Response> {
  try {
    if (deps.config.mode !== "saas" || !deps.config.ready)
      fail(
        503,
        "SaaS configuration is incomplete. No local data service is available in this mode.",
      );
    const method = request.method;
    if (!["GET", "POST", "PUT", "PATCH"].includes(method))
      fail(405, "Method not allowed.");
    if (
      path.length > 3 ||
      path.some((part) => !/^[A-Za-z0-9._-]{1,128}$/.test(part))
    )
      fail(404, "Route not found.");
    if (new URL(request.url).search)
      fail(400, "Query parameters are not supported.");
    const mutation = method !== "GET";
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (mutation && request.headers.get("origin") !== deps.config.appOrigin)
    )
      fail(403, "Requests must originate from this application.");
    const session = await deps.session();
    if (!session.userId) fail(401, "Sign in to access your workspace.");
    if (!session.orgId) fail(403, "Select an active organization.");
    // Intent binding only: the header never grants tenant access. A cookie can
    // switch organizations before React remounts; reject the old view’s intent.
    if (request.headers.get("x-signalfoundry-organization") !== session.orgId)
      fail(
        409,
        "Your active organization changed. Reload this workspace before continuing.",
      );
    if (!["org:admin", "org:member"].includes(session.orgRole || ""))
      fail(403, "Your organization role is not supported.");
    const token = await session.getToken();
    if (!token)
      fail(
        401,
        "Your database session is unavailable. Sign in again or ask your administrator to check the Clerk Convex integration.",
      );
    const body = mutation ? await readBody(request) : {};
    const route = `${method} /${path.join("/")}`;
    const invoke = (name: FunctionName, args: Record<string, unknown> = {}) =>
      deps.invoke(name, args, token);
    const admin = () => {
      if (session.orgRole !== "org:admin")
        fail(403, "An organization administrator must perform this action.");
    };
    if (route === "GET /workspace") return json(await invoke("workspaces.get"));
    if (route === "POST /workspace") {
      admin();
      keys(body, []);
      return json(await invoke("workspaces.provision"), 201);
    }
    if (route === "PUT /workspace/profile") {
      admin();
      const args: Record<string, unknown> = { profile: profile(body) };
      return json(await invoke("workspaces.saveProfile", args));
    }
    if (route === "POST /workspace/analyze") {
      admin();
      keys(body, ["website"]);
      return json(
        await invoke("workspaces.analyze", {
          website: string(body.website, 2048),
        }),
      );
    }
    if (route === "POST /demo/reset") {
      admin();
      keys(body, []);
      return json(await invoke("workspaces.loadDemo"));
    }
    if (route === "GET /health") {
      await invoke("workspaces.get");
      return json({
        status: "ok",
        mode: "saas",
        decision_engine: "rules",
        providers: { discovery: "Public websites", contacts: "Not connected" },
      });
    }
    if (route === "GET /campaigns") return json(await invoke("campaigns.list"));
    if (route === "POST /campaigns") {
      keys(body, ["name", "mode", "domains"]);
      if (body.mode !== "manual" && body.mode !== "demo")
        fail(400, "Choose a valid research mode.");
      return json(
        await invoke("campaigns.create", {
          name: string(body.name),
          mode: body.mode,
          domains: list(body.domains, 10),
        }),
        201,
      );
    }
    if (path[0] === "campaigns" && path[1]) {
      const id = path[1];
      if (method === "GET" && path.length === 2)
        return json(await invoke("campaigns.get", { id }));
      if (method === "GET" && path[2] === "accounts")
        return json(await invoke("campaigns.accounts", { id }));
      if (method === "GET" && path[2] === "job")
        return json(await invoke("jobs.forCampaign", { campaignId: id }));
      if (method === "POST" && path[2] === "research") {
        keys(body, ["idempotencyKey"]);
        return json(
          await invoke("jobs.start", {
            campaignId: id,
            idempotencyKey: string(body.idempotencyKey, 100),
          }),
          202,
        );
      }
      if (method === "GET" && path[2] === "export.csv") {
        const accounts = (await invoke("campaigns.accounts", { id })) as Array<
          Record<string, unknown>
        >;
        const fields = [
          "name",
          "domain",
          "industry",
          "score",
          "confidence",
          "status",
          "description",
          "is_demo",
        ];
        const csv = [
          fields.map(csvCell).join(","),
          ...accounts.map((account) =>
            fields.map((field) => csvCell(account[field])).join(","),
          ),
        ].join("\r\n");
        return new Response(csv, {
          headers: {
            ...privateHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="signalfoundry-accounts.csv"',
          },
        });
      }
    }
    if (path[0] === "accounts" && path[1]) {
      const id = path[1];
      if (method === "GET" && path.length === 2)
        return json(await invoke("accounts.get", { id }));
      if (method === "PATCH" && path.length === 2) {
        keys(body, ["status"]);
        if (!["new", "shortlisted", "dismissed"].includes(String(body.status)))
          fail(400, "Invalid account status.");
        return json(
          await invoke("accounts.setStatus", { id, status: body.status }),
        );
      }
      if (method === "POST" && path[2] === "draft") {
        keys(body, []);
        return json(await invoke("accounts.draft", { id }));
      }
    }
    if (path[0] === "jobs" && path[1]) {
      if (method === "GET" && path.length === 2)
        return json(await invoke("jobs.get", { id: path[1] }));
      if (method === "POST" && path[2] === "cancel") {
        keys(body, []);
        return json(await invoke("jobs.cancel", { id: path[1] }));
      }
    }
    if (route === "GET /billing") return json(await invoke("billing.status"));
    if (
      route === "POST /billing/checkout" ||
      route === "POST /billing/portal"
    ) {
      admin();
      keys(body, ["requestId"]);
      return json(
        await invoke(
          route.endsWith("checkout") ? "stripe.checkout" : "stripe.portal",
          { requestId: string(body.requestId, 100) },
        ),
      );
    }
    fail(404, "Route not found.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ detail: error.message }, error.status);
    const safe = safeProviderError(error);
    return json({ detail: safe.detail }, safe.status);
  }
}
