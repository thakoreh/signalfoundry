/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as billing from "../billing.js";
import type * as campaigns from "../campaigns.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billingPolicy from "../lib/billingPolicy.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_fixtures from "../lib/fixtures.js";
import type * as lib_records from "../lib/records.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_worker from "../lib/worker.js";
import type * as research from "../research.js";
import type * as stripe from "../stripe.js";
import type * as validators from "../validators.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  billing: typeof billing;
  campaigns: typeof campaigns;
  http: typeof http;
  jobs: typeof jobs;
  "lib/auth": typeof lib_auth;
  "lib/billingPolicy": typeof lib_billingPolicy;
  "lib/errors": typeof lib_errors;
  "lib/fixtures": typeof lib_fixtures;
  "lib/records": typeof lib_records;
  "lib/validation": typeof lib_validation;
  "lib/worker": typeof lib_worker;
  research: typeof research;
  stripe: typeof stripe;
  validators: typeof validators;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
