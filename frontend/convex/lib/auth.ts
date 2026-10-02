import { appError } from "./errors";
import type { Auth, UserIdentity } from "convex/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { action, mutation, query } from "../_generated/server";

export type Principal = {
  orgId: string;
  userId: string;
  role: "org:admin" | "org:member";
};

// Only identities returned by Convex's verified Clerk JWT provider belong here.
// Never authorize from client arguments, user metadata, an email, or org slug.
export function principalFromIdentity(
  identity: UserIdentity | null,
): Principal {
  if (!identity || !identity.subject)
    throw appError("UNAUTHENTICATED", "Authentication required");
  if (identity.sts === "pending")
    throw appError("UNAUTHENTICATED", "Complete your Clerk session first");
  const compact = identity.o;
  const org =
    compact && typeof compact === "object" && !Array.isArray(compact)
      ? (compact as Record<string, unknown>)
      : undefined;
  if (
    compact !== undefined &&
    (!org || typeof org.id !== "string" || typeof org.rol !== "string")
  ) {
    throw appError("FORBIDDEN", "Malformed organization claims");
  }
  const legacyId = identity.org_id;
  const legacyRole = identity.org_role;
  const compactId = org?.id;
  const compactRole =
    typeof org?.rol === "string" ? `org:${org.rol}` : undefined;
  if (
    (legacyId !== undefined &&
      compactId !== undefined &&
      legacyId !== compactId) ||
    (legacyRole !== undefined &&
      compactRole !== undefined &&
      legacyRole !== compactRole)
  ) {
    throw appError("FORBIDDEN", "Conflicting organization claims");
  }
  const orgId = compactId ?? legacyId;
  const role = compactRole ?? legacyRole;
  if (typeof orgId !== "string" || !/^org_[A-Za-z0-9_-]{1,160}$/.test(orgId)) {
    throw appError(
      "ORGANIZATION_REQUIRED",
      "Select an active Clerk organization",
    );
  }
  if (role !== "org:admin" && role !== "org:member")
    throw appError("FORBIDDEN", "Organization role is not authorized");
  return { orgId, userId: identity.subject, role };
}
export async function requirePrincipal(ctx: {
  auth: Auth;
}): Promise<Principal> {
  return principalFromIdentity(await ctx.auth.getUserIdentity());
}
export function requireAdmin(principal: Principal): void {
  if (principal.role !== "org:admin")
    throw appError("ADMIN_REQUIRED", "Organization admin required");
}
const tenantContext = async (ctx: { auth: Auth }) => ({
  principal: await requirePrincipal(ctx),
});
const adminContext = async (ctx: { auth: Auth }) => {
  const principal = await requirePrincipal(ctx);
  requireAdmin(principal);
  return { principal };
};
export const tenantQuery = customQuery(query, customCtx(tenantContext));
export const tenantMutation = customMutation(
  mutation,
  customCtx(tenantContext),
);
export const tenantAction = customAction(action, customCtx(tenantContext));
export const adminQuery = customQuery(query, customCtx(adminContext));
export const adminMutation = customMutation(mutation, customCtx(adminContext));
export const adminAction = customAction(action, customCtx(adminContext));
