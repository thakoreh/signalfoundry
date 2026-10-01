import { v, type Infer } from "convex/values";

export const mode = v.union(v.literal("demo"), v.literal("manual"));
export const accountStatus = v.union(
  v.literal("new"),
  v.literal("shortlisted"),
  v.literal("dismissed"),
);
export const campaignStatus = v.union(
  v.literal("draft"),
  v.literal("researching"),
  v.literal("complete"),
  v.literal("partial"),
  v.literal("failed"),
);
export const jobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("retrying"),
  v.literal("succeeded"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("cancelled"),
);
export const profile = v.object({
  company_name: v.string(),
  description: v.string(),
  industries: v.array(v.string()),
  company_sizes: v.array(v.string()),
  geographies: v.array(v.string()),
  buyer_roles: v.array(v.string()),
  keywords: v.array(v.string()),
  exclusions: v.array(v.string()),
});
export type Profile = Infer<typeof profile>;
export const evidence = v.object({
  id: v.string(),
  title: v.string(),
  url: v.string(),
  excerpt: v.string(),
  kind: v.union(v.literal("fit"), v.literal("signal"), v.literal("company")),
  published_at: v.union(v.string(), v.null()),
  retrieved_at: v.string(),
  is_demo: v.boolean(),
});
export const contact = v.object({
  name: v.union(v.string(), v.null()),
  role: v.string(),
  email: v.union(v.string(), v.null()),
  verification_status: v.union(
    v.literal("unverified"),
    v.literal("not_available"),
    v.literal("verified"),
  ),
  source_url: v.union(v.string(), v.null()),
  note: v.string(),
});
export const scoreComponent = v.object({
  label: v.string(),
  points: v.number(),
  max_points: v.number(),
  reason: v.string(),
});
export const accountFields = {
  name: v.string(),
  domain: v.string(),
  description: v.string(),
  industry: v.string(),
  employee_range: v.string(),
  location: v.string(),
  score: v.number(),
  confidence: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  decision_engine: v.union(v.literal("rules"), v.literal("jev")),
  status: accountStatus,
  why_fit: v.array(v.string()),
  why_now: v.array(v.string()),
  unknowns: v.array(v.string()),
  evidence: v.array(evidence),
  contacts: v.array(contact),
  is_demo: v.boolean(),
  researched_at: v.string(),
  score_breakdown: v.array(scoreComponent),
};
export const accountData = v.object(accountFields);
export const account = v.object({
  id: v.id("accounts"),
  campaign_id: v.id("campaigns"),
  ...accountFields,
});
export const workerAccount = v.object({
  id: v.string(),
  campaign_id: v.string(),
  ...accountFields,
});
export type WorkerAccount = Infer<typeof workerAccount>;
export const workspace = v.object({
  id: v.id("workspaces"),
  name: v.string(),
  website: v.union(v.string(), v.null()),
  profile: v.union(profile, v.null()),
  created_at: v.string(),
});
export const campaignFields = {
  name: v.string(),
  mode,
  status: campaignStatus,
  created_at: v.string(),
  updated_at: v.string(),
  account_count: v.number(),
  qualified_count: v.number(),
  domains: v.array(v.string()),
  errors: v.array(v.string()),
};
export const campaign = v.object({ id: v.id("campaigns"), ...campaignFields });
export const job = v.object({
  id: v.id("jobs"),
  campaign_id: v.id("campaigns"),
  status: jobStatus,
  attempt: v.number(),
  max_attempts: v.number(),
  error: v.union(v.string(), v.null()),
  created_at: v.string(),
  updated_at: v.string(),
});
export const draft = v.object({
  subject: v.string(),
  body: v.string(),
  basis: v.array(v.string()),
  engine: v.literal("grounded_template"),
  warning: v.string(),
});
