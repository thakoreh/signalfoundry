import { Buffer } from "node:buffer";
/** Bind the server-issued template to this verified Clerk session. This is NOT
 * signature verification: Convex must also verify issuer, audience and signature.
 * Never call with a browser-supplied token or trust the decoded data for identity. */
export function tokenMatchesSession(
  token: string,
  session: {
    userId: string | null;
    orgId: string | null;
    orgRole: string | null;
  },
): boolean {
  try {
    const parts = token.split(".");
    if (
      parts.length !== 3 ||
      parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))
    )
      return false;
    const claims = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    const compactId = claims.o?.id;
    const compactRole =
      typeof claims.o?.rol === "string" ? `org:${claims.o.rol}` : undefined;
    if (
      (compactId !== undefined &&
        claims.org_id !== undefined &&
        compactId !== claims.org_id) ||
      (compactRole !== undefined &&
        claims.org_role !== undefined &&
        compactRole !== claims.org_role)
    )
      return false;
    return (
      claims.sub === session.userId &&
      (compactId ?? claims.org_id) === session.orgId &&
      (compactRole ?? claims.org_role) === session.orgRole &&
      typeof claims.exp === "number" &&
      claims.exp * 1000 > Date.now()
    );
  } catch {
    return false;
  }
}
