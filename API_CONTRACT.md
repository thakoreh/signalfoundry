# SignalFoundry MVP API contract
All frontend requests go to `/api/...`, Next.js rewrites to FastAPI. JSON snake_case. Errors `{detail: string}`. Local demo instance: no real authentication, one fixed tenant enforced in queries; localhost-only server. All research input public business URLs only. Never label simulated data as verified.

GET /api/health -> {status:'ok', mode:'local-demo', decision_engine:'rules'|'jev', providers:{discovery:'demo'|'...', contacts:'not_configured'}}
GET /api/workspace -> {id,name,website,profile,created_at}; absent profile null.
POST /api/workspace/analyze {website:string} -> workspace. Safely fetch website; if inaccessible return actionable 422, preserve previous profile. Infer draft profile from page content (rules clearly shown); editable.
PUT /api/workspace/profile {company_name,description,industries:string[],company_sizes:string[],geographies:string[],buyer_roles:string[],keywords:string[],exclusions:string[]} -> workspace
POST /api/demo/reset {} -> workspace with fixture profile; explicitly fictional demo mode.
GET /api/campaigns -> Campaign[]
POST /api/campaigns {name,mode:'demo'|'manual',domains:string[]} -> Campaign. Manual researches supplied public business domains; demo uses fictional fixtures.
GET /api/campaigns/{id} -> Campaign
POST /api/campaigns/{id}/research {} -> Campaign. Atomic bounded synchronous research MVP.
GET /api/campaigns/{id}/accounts -> Account[] (ranked)
GET /api/accounts/{id} -> Account
PATCH /api/accounts/{id} {status:'new'|'shortlisted'|'dismissed'} -> Account
POST /api/accounts/{id}/draft {} -> {subject,body,basis:string[],engine:'grounded_template',warning:string}
GET /api/campaigns/{id}/export.csv -> CSV download, formula-safe

Campaign: {id,name,mode,status:'draft'|'researching'|'complete'|'partial'|'failed',created_at,updated_at,account_count,qualified_count,domains:string[],errors:string[]}
Account: {id,campaign_id,name,domain,description,industry,employee_range,location,score:number,confidence:'low'|'medium'|'high',decision_engine:'rules'|'jev',status,why_fit:string[],why_now:string[],unknowns:string[],evidence:Evidence[],contacts:Contact[],is_demo:boolean,researched_at:string,score_breakdown:{label:string,points:number,max_points:number,reason:string}[]}
Evidence: {id,title,url,excerpt,kind:'fit'|'signal'|'company',published_at:string|null,retrieved_at:string,is_demo:boolean}
Contact: {name:string|null,role,email:string|null,verification_status:'unverified'|'not_available'|'verified',source_url:string|null,note:string}
Fixtures use .example domains and conspicuous demo=true. Fictional person emails must be null. Real research provides no invented people/employee numbers/geography/dates; unknowns stay unknown.


## SaaS contract additions

In explicit `saas` mode the same-origin Next API routes use verified Clerk sessions and a server-side Convex client. The FastAPI routes below remain local-demo only. Organization identity is never accepted in a request body. SaaS research returns HTTP202 with a durable Job, not a completed Campaign; poll `/api/jobs/{id}` or `/api/campaigns/{id}/job`, and POST `/api/jobs/{id}/cancel`. Start with an `idempotencyKey`. Billing uses GET `/api/billing`, POST `/api/billing/checkout` and `/api/billing/portal` with `requestId`; commercial access comes only from signed Stripe reconciliation. See adapter tests and `frontend/convex` validators for the authoritative implemented contract.
