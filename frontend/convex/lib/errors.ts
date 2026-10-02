import { ConvexError } from "convex/values";
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ADMIN_REQUIRED"
  | "ORGANIZATION_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "BILLING_REQUIRED"
  | "CONFIGURATION_ERROR"
  | "WORKSPACE_REQUIRED"
  | "CONFLICT"
  | "DATA_EXPIRED"
  | "EXPORT_BLOCKED"
  | "RESEARCH_FAILED"
  | "BILLING_UNAVAILABLE";
export const appError = (code: ErrorCode, message: string) =>
  new ConvexError({ code, message });
