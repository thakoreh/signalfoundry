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

    def test_seller_industry_is_not_inferred_as_buyer(self):
        from app.research import infer_profile
        for description, industry, role in [
            ('We are an agency building conversion websites for US plumbers.', 'Plumbing businesses', 'Owner'),
            ('We sell scheduling software to veterinary clinics.', 'Veterinary clinics', 'Practice Manager'),
            ('Agency management software for web agencies.', 'Professional services', 'Founder'),
            ('Developer observability for fintech engineering teams.', 'Financial technology', 'Engineering Manager'),
        ]:
            profile = infer_profile(Page('https://seller.example/', 'Our Company', description, description))
            self.assertEqual(profile.industries, [industry])
            self.assertEqual(profile.buyer_roles[0], role)

    def test_ambiguous_seller_and_negative_buyer_are_not_targets(self):
        from app.research import infer_profile
        description = 'We are a marketing agency with developers. Not agencies.'
        profile = infer_profile(Page('https://seller.example/', 'Our Company', description, description))
        self.assertEqual(profile.industries, [])
        self.assertEqual(profile.buyer_roles, [])
        self.assertEqual(profile.exclusions, ['agencies'])

    def test_undated_signal_words_do_not_add_urgency_points(self):
        page = Page('https://agency.example/', 'Example Agency', 'Agency workflow automation.', 'Agency workflow automation integrations AI. Founder Operations. Hiring launch funding expanding partnership.')
        result = RulesDecisionProvider().evaluate(self.profile(), page, campaign_id='test')
        self.assertEqual(next(p.points for p in result.score_breakdown if p.label == 'Observable signals'), 0)
        self.assertTrue(all('unverified' in text for text in result.why_now))

    def test_unknown_required_geography_and_size_prevent_high_rank(self):
        page = Page('https://agency.example/', 'Example Agency', 'Agency workflow automation.', 'Agency workflow automation integrations AI. Founder Operations. Hiring launch funding.')
        for constraints in [{'geographies': ['United States']}, {'company_sizes': ['11-50']}]:
            profile = self.profile().model_copy(update=constraints)
            result = RulesDecisionProvider().evaluate(profile, page, campaign_id='test')
            self.assertLess(result.score, 65)
            self.assertEqual(result.confidence, 'low')
            self.assertTrue(any(p.label == 'Unverified required criteria' for p in result.score_breakdown))

    def test_hard_exclusion_cannot_be_overcome_by_keyword_score(self):
        profile = self.profile().model_copy(update={'exclusions': ['Agency']})
        page = Page('https://agency.example/', 'Example Agency', 'Agency workflow automation.', 'Agency workflow automation integrations AI. Founder Operations. Hiring launch funding.')
        result = RulesDecisionProvider().evaluate(profile, page, campaign_id='test')
        self.assertEqual(result.score, 0)
        self.assertEqual(result.confidence, 'low')

    def test_suggested_audiences_match_actual_evaluation_taxonomy(self):
        from app.research import infer_profile
        for offering, title, description in [
            ('Agency management software for web agencies.', 'Acme Agency', 'Agency client services and projects.'),
            ('We sell scheduling software to veterinary clinics.', 'Acme Veterinary Clinic', 'Veterinary appointment scheduling software.'),
            ('We build websites for plumbing businesses.', 'Acme Plumbing', 'Local plumbing services and appointments.'),
        ]:
            profile = infer_profile(Page('https://seller.example/', 'Seller', offering, offering))
            account = RulesDecisionProvider().evaluate(profile, Page('https://buyer.example/', title, description, description), campaign_id='test')
            industry = next(part for part in account.score_breakdown if part.label == 'Industry language')
            self.assertEqual(industry.points, 25, (profile.industries, account.industry))

    def test_pronoun_us_is_not_country_and_direct_buyer_is_not_its_customer(self):
        from app.research import infer_profile
        text = 'Our tools help teams collaborate with us.'
        self.assertEqual(infer_profile(Page('https://seller.example/', 'Seller', text, text)).geographies, [])
        text = 'We help agencies serve plumbers more effectively.'
        self.assertEqual(infer_profile(Page('https://seller.example/', 'Seller', text, text)).industries, ['Professional services'])

    def test_generated_plural_exclusion_blocks_canonical_company_category(self):
        from app.research import infer_profile
        offer = 'We build websites for plumbers, not agencies.'
        profile = infer_profile(Page('https://seller.example/', 'Seller', offer, offer))
        profile.keywords = ['workflow', 'automation', 'integrations', 'AI']
        profile.buyer_roles = ['Founder', 'Operations']
        text = 'Agency workflow automation integrations AI. Founder Operations. Hiring launch funding.'
        result = RulesDecisionProvider().evaluate(profile, Page('https://agency.example/', 'Acme Agency', text, text), campaign_id='test')
        self.assertEqual(result.score, 0)
        self.assertTrue(any(part.label == 'Exclusion penalty' for part in result.score_breakdown))

    def test_veterinary_software_vendor_is_not_its_customer_category(self):
        profile = self.profile().model_copy(update={'industries': ['Veterinary clinics'], 'keywords': ['veterinary', 'appointments'], 'buyer_roles': ['Practice Manager', 'Owner']})
        description = 'Our software helps veterinary clinics manage appointments. Practice Manager and Owner tools.'
        for title in ['Acme | Scheduling Software for Veterinary Clinics', 'Acme']:
            account = RulesDecisionProvider().evaluate(profile, Page('https://software.example/', title, description, description), campaign_id='test')
            self.assertNotEqual(account.industry, 'Veterinary clinics')
            self.assertLess(account.score, 65)
            self.assertEqual(next(part.points for part in account.score_breakdown if part.label == 'Industry language'), 0)
        clinic = RulesDecisionProvider().evaluate(profile, Page('https://clinic.example/', 'Acme Veterinary Clinic', 'Veterinary care and appointments.', 'Practice Manager and Owner. Veterinary care and appointments.'), campaign_id='test')
        self.assertEqual(clinic.industry, 'Veterinary clinics')
        self.assertEqual(next(part.points for part in clinic.score_breakdown if part.label == 'Industry language'), 25)

    def test_no_code_and_not_only_are_not_hard_exclusions(self):
        from app.research import infer_profile
        text = 'We build no code workflows for agencies.'
        brief = infer_profile(Page('https://seller.example/', 'Seller', text, text))
        self.assertEqual(brief.industries, ['Professional services'])
        self.assertEqual(brief.exclusions, [])
        text = 'We make websites for plumbers, not just agencies.'
        self.assertEqual(infer_profile(Page('https://seller.example/', 'Seller', text, text)).exclusions, [])
