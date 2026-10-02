import unittest
from app.models import Profile
from app.research import RulesDecisionProvider
from app.safety import Page

class CustomerValueTests(unittest.TestCase):
    def profile(self):
        return Profile(company_name='Grand River AI', description='Automation delivery', industries=['Agency'], buyer_roles=['Founder','Operations'], keywords=['workflow','automation','integrations','AI'], company_sizes=[], geographies=[], exclusions=[])

    def test_customer_industry_language_is_not_company_identity(self):
        page=Page('https://www.airtable.com/','Airtable: Build Enterprise-ready AI Workflows, Apps & Agents','500,000+ brands use Airtable to enable collaboration and streamline business processes.','AI workflow automation integrations. Operations Founder. Agency & Professional Services: streamline coordination. Product launch template. Partnership tools.')
        account=RulesDecisionProvider().evaluate(self.profile(),page,campaign_id='customer-test')
        self.assertLess(account.score,65)
        self.assertNotEqual(account.confidence,'medium')
        self.assertEqual(next(p.points for p in account.score_breakdown if p.label=='Industry language'),0)

    def test_company_title_identifies_agency_before_its_saas_customer_language(self):
        page=Page('https://www.lowcode.agency/','LOW/CODE Agency | AI Engineering & Software Development','We build custom AI software that replaces off-the-shelf SaaS.','We build SaaS products for startups. Agency workflow automation integrations AI. Operations Founder.')
        account=RulesDecisionProvider().evaluate(self.profile(),page,campaign_id='customer-test')
        self.assertEqual(account.industry,'Agency')
        self.assertGreaterEqual(account.score,65)

    def test_software_customer_segment_does_not_trigger_agency_exclusion(self):
        profile=self.profile().model_copy(update={'industries':['B2B SaaS'],'exclusions':['Agency']})
        page=Page('https://vendor.example/','Software Vendor','A software platform for collaboration.','Agency customer stories. Workflow automation.')
        result=RulesDecisionProvider().evaluate(profile,page,campaign_id='test')
        self.assertFalse(any(p.label=='Exclusion penalty' for p in result.score_breakdown))

    def test_agency_saas_customer_segment_is_not_its_company_category(self):
        profile=self.profile().model_copy(update={'exclusions':['SaaS']})
        page=Page('https://agency.example/','Example Agency','We develop tools for SaaS customers.','Agency workflow automation for SaaS customers.')
        result=RulesDecisionProvider().evaluate(profile,page,campaign_id='test')
        self.assertFalse(any(p.label=='Exclusion penalty' for p in result.score_breakdown))

    def test_draft_preserves_coherent_company_paragraph(self):
        from app.research import make_draft
        excerpt="Your workflows break. Your team waits. Your tools don't talk to each other. We build automations that fix this. Real systems. Real results. Fast."
        account=RulesDecisionProvider().evaluate(self.profile(),Page('https://www.xray.tech/','XRAY',excerpt,excerpt),campaign_id='test')
        draft=make_draft(account,self.profile())
        self.assertIn(f'“{excerpt}”',draft.body)

    def test_draft_warns_sender_offer_applicability_is_not_verified(self):
        from app.research import make_draft
        account=RulesDecisionProvider().evaluate(self.profile(),Page('https://agency.example/','Example Agency','We build workflow automation for teams.','Agency workflow automation AI.'),campaign_id='test')
        self.assertIn('Sender offer relevance and geographic applicability are not verified',make_draft(account,self.profile()).warning)

    def test_draft_keeps_profile_instructions_out_of_sender_offer(self):
        from app.research import make_draft
        profile=self.profile().model_copy(update={'description':'We help agencies automate workflows. Draft ICP from website keyword rules; review target industries.'})
        account=RulesDecisionProvider().evaluate(profile,Page('https://agency.example/','Agency','We build workflow automation.','Agency workflow automation.'),campaign_id='test')
        self.assertNotIn('Draft ICP',make_draft(account,profile).body)

    def test_explicit_company_category_exclusion_is_preserved(self):
        profile=self.profile().model_copy(update={'exclusions':['SaaS']})
        page=Page('https://vendor.example/','Example SaaS vendor','We sell a SaaS platform.','Workflow automation SaaS platform.')
        result=RulesDecisionProvider().evaluate(profile,page,campaign_id='test')
        self.assertTrue(any(p.label=='Exclusion penalty' for p in result.score_breakdown))
