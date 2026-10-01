export type AppMode = "local-demo" | "saas";
export type RuntimeConfig = {
  mode: AppMode | null;
  ready: boolean;
  issues: string[];
  appOrigin: string | null;
  convexUrl: string | null;
};

export function exactOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      url.origin !== value ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** No implicit demo fallback: both deployment and browser build must opt in. */
export function runtimeConfig(
  env: Record<string, string | undefined> = process.env,
  compiledMode = process.env.NEXT_PUBLIC_SIGNALFOUNDRY_MODE,
): RuntimeConfig {
  const mode = env.SIGNALFOUNDRY_MODE;
  const issues: string[] = [];
  if (mode !== "local-demo" && mode !== "saas")
    issues.push("Set SIGNALFOUNDRY_MODE to local-demo or saas.");
  if (env.NEXT_PUBLIC_SIGNALFOUNDRY_MODE !== mode || !mode)
    issues.push(
      "NEXT_PUBLIC_SIGNALFOUNDRY_MODE must match the server mode. Rebuild after changing it.",
    );
  if (compiledMode !== mode)
    issues.push(
      "The built application mode differs from the server mode. Rebuild with matching modes.",
    );
  const appOrigin = exactOrigin(env.APP_URL);
  const convexUrl = exactOrigin(env.CONVEX_URL);
  if (mode === "saas") {
    if (
      !/^pk_(test|live)_[A-Za-z0-9]+$/.test(
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
      )
    )
      issues.push("Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.");
    if (!/^sk_(test|live)_\S+$/.test(env.CLERK_SECRET_KEY || ""))
      issues.push("Configure CLERK_SECRET_KEY on the server.");
    if (!convexUrl || !/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(convexUrl))
      issues.push(
        "Configure CONVEX_URL with your HTTPS Convex deployment URL.",
      );
    if (!appOrigin)
      issues.push("Configure APP_URL with the exact application origin.");
    if (
      env.CLERK_JWT_TEMPLATE &&
      !/^[a-zA-Z0-9_-]{1,100}$/.test(env.CLERK_JWT_TEMPLATE)
    )
      issues.push("CLERK_JWT_TEMPLATE is invalid.");
  }
  return {
    mode: mode === "local-demo" || mode === "saas" ? mode : null,
    ready: issues.length === 0,
    issues,
    appOrigin,
    convexUrl,
  };
}

export function trustedSaasHost(
  headers: Pick<Headers, "get">,
  appOrigin: string,
): boolean {
  const url = new URL(appOrigin);
  const host = headers.get("host")?.toLowerCase();
  if (host !== url.host) return false;
  const forwarded = headers.get("x-forwarded-host");
  if (forwarded && forwarded.toLowerCase() !== host) return false;
  if (headers.get("forwarded")) return false;
  const proto = headers.get("x-forwarded-proto");
  return !proto || proto === url.protocol.slice(0, -1);
}
