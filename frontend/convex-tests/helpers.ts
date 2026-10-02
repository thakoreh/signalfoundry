// Offline unit-test setup only. These helpers are never deployed as Convex functions.
import { vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { DEMO_PROFILE, demoAccounts } from '../convex/lib/fixtures';
import type { Profile } from '../convex/validators';
type Test = ReturnType<typeof convexTest<typeof schema.tables>>;
export function manualAccounts(profile: Profile, campaignId: string, now: string, domains: string[] = ["acme.com"]) {
  const a=demoAccounts(profile,campaignId,now)[0];
  return domains.map(domain => ({...a,
    name:"Unit test business", domain:domain.replace(/^https?:\/\//, "").replace(/\/$/, ""), is_demo:false,
    contacts:a.contacts.map(c=>({...c,email:null})),
    evidence:a.evidence.map(e=>({...e,url:domain.startsWith('https://') ? domain : `https://${domain}/`,is_demo:false}))}));
}
export async function grantTestSubscription(t: Test, orgId='org_one') {
  await t.run(ctx=>ctx.db.insert('billingAccounts',{orgId,status:'active',priceId:'price_test',currentPeriodEnd:Date.now()+86_400_000,cancelAtPeriodEnd:false,updatedAt:Date.now()}));
}
export function configureTestWorker() {
  vi.stubEnv('SIGNALFOUNDRY_WORKER_URL','https://worker.example.com');
  vi.stubEnv('SIGNALFOUNDRY_WORKER_TOKEN','test-only-worker-token-not-a-real-secret');
  vi.stubEnv('SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT','5'); vi.stubEnv('SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT','3');
  vi.stubEnv('STRIPE_PRICE_ID','price_test');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_fixture_only');vi.stubEnv('APP_URL','https://app.example.com');
  vi.stubGlobal('fetch',vi.fn(async (_url:string,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));return Response.json({accounts:manualAccounts(body.profile,body.campaign_id,new Date().toISOString(),body.domains),errors:[]});}));
}
export { DEMO_PROFILE };
