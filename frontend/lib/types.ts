export type Profile = {
  company_name: string;
  description: string;
  industries: string[];
  company_sizes: string[];
  geographies: string[];
  buyer_roles: string[];
  keywords: string[];
  exclusions: string[];
};
export type WorkspaceData = {
  id: string;
  name: string;
  website: string | null;
  profile: Profile | null;
  created_at: string;
};
export type Campaign = {
  id: string;
  name: string;
  mode: "demo" | "manual" | "discovery";
  status: "draft" | "researching" | "complete" | "partial" | "failed";
  created_at: string;
  updated_at: string;
  account_count: number;
  qualified_count: number;
  domains: string[];
  errors: string[];
  profile_snapshot?: Profile | null;
  target_count?: number;
  offering_website?: string | null;
};
export type CampaignInput = {
  name: string;
  mode: "discovery" | "manual";
  domains: string[];
  profile_snapshot: Profile;
  target_count: number;
  offering_website: string | null;
};
export type ProviderReadiness = {
  configured: boolean;
  licensed: boolean;
  reason: string;
  max_cost_microusd?: number;
};
export type DiscoveryStatus = {
  enabled: boolean;
  providers: {
    discovery: ProviderReadiness;
    contacts: ProviderReadiness;
    verification: ProviderReadiness;
  };
  max_target_count: number;
  max_cost_microusd: number;
  blockers: string[];
};
export type Evidence = {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  kind: "fit" | "signal" | "company";
  published_at: string | null;
  retrieved_at: string;
  is_demo: boolean;
};
export type Contact = {
  name: string | null;
  role: string;
  email: string | null;
  verification_status: "unverified" | "not_available" | "verified";
  source_url: string | null;
  note: string;
  provider?: string | null;
  retrieved_at?: string | null;
  employment_verified_at?: string | null;
  email_checked_at?: string | null;
  email_status?: "valid" | "invalid" | "catch_all" | "unknown" | "not_checked";
  email_verification_provider?: string | null;
  license_reference?: string | null;
  license_restrictions?: string[];
  license_expires_at?: string | null;
};
export type AccountStatus = "new" | "shortlisted" | "dismissed";
export type Account = {
  id: string;
  campaign_id: string;
  name: string;
  domain: string;
  description: string;
  industry: string | null;
  employee_range: string | null;
  location: string | null;
  score: number;
  confidence: "low" | "medium" | "high";
  decision_engine: "rules" | "jev";
  status: AccountStatus;
  why_fit: string[];
  why_now: string[];
  unknowns: string[];
  evidence: Evidence[];
  contacts: Contact[];
  is_demo: boolean;
  researched_at: string;
  source_provider?: string | null;
  source_url?: string | null;
  retrieved_at?: string | null;
  license_reference?: string | null;
  license_restrictions?: string[];
  license_expires_at?: string | null;
  score_breakdown: {
    label: string;
    points: number;
    max_points: number;
    reason: string;
  }[];
};
export type Draft = {
  subject: string;
  body: string;
  basis: string[];
  engine: "grounded_template";
  warning: string;
};
export type Health = {
  status: string;
  mode: string;
  decision_engine: "rules" | "jev";
  providers: { discovery: string; contacts: string };
};
export type ResearchJob = {
  id: string;
  campaign_id: string;
  status:
    | "queued"
    | "running"
    | "retrying"
    | "succeeded"
    | "partial"
    | "failed"
    | "cancelled";
  attempt: number;
  max_attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  stage?: "discovery" | "contacts" | "verification" | "complete";
  reserved_microusd?: number;
  spent_microusd?: number;
  spend_status?: "reserved" | "settled" | "uncertain";
};
