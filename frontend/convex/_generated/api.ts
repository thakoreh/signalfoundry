/* Typed local bootstrap. Regenerate with `convex codegen` for deployment. */
import type * as accounts from "../accounts";
import type * as billing from "../billing";
import type * as campaigns from "../campaigns";
import type * as jobs from "../jobs";
import type * as research from "../research";
import type * as stripe from "../stripe";
import type * as workspaces from "../workspaces";
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi } from "convex/server";
type FullApi = ApiFromModules<{
  accounts: typeof accounts;
  billing: typeof billing;
  campaigns: typeof campaigns;
  jobs: typeof jobs;
  research: typeof research;
  stripe: typeof stripe;
  workspaces: typeof workspaces;
}>;
export const api: FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "public">
> = anyApi as never;
export const internal: FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "internal">
> = anyApi as never;
