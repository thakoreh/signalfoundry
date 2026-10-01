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
