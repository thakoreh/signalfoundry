"""Entirely fictional examples: reserved .example domains, no real people/email."""
from .models import Profile

DEMO_PROFILE = Profile(
    company_name='SignalFoundry Demo',
    description='Fictional demo company helping B2B SaaS teams research qualified accounts. Edit these starter ICP rules to explore scoring.',
    industries=['B2B SaaS', 'Developer tools'], company_sizes=['11–50', '51–200'],
    geographies=['United States', 'United Kingdom'], buyer_roles=['VP Sales', 'Head of Growth', 'Revenue Operations'],
    keywords=['sales', 'workflow', 'automation', 'pipeline', 'developer'],
    exclusions=['consumer retail', 'agency'],
)

# Every string below is fixture content, not a claim about a real business.
FIXTURES = [
    dict(name='Atlas Workflow', domain='atlasworkflow.example', industry='B2B SaaS', employee_range='51–200', location='United States',
         description='Fictional B2B SaaS company building workflow automation for sales and revenue teams.',
         text='Atlas Workflow: B2B SaaS workflow automation for sales pipeline teams. VP Sales, Head of Growth, Revenue Operations. We are hiring and expanding our developer platform.'),
    dict(name='RelayStack', domain='relaystack.example', industry='Developer tools', employee_range='11–50', location='United Kingdom',
         description='Fictional developer platform for integrating revenue workflows.',
         text='RelayStack developer tools connect workflow automation to sales pipeline data. Built for Head of Growth and Revenue Operations. Our new product launch helps developer teams.'),
    dict(name='Northstar Metrics', domain='northstarmetrics.example', industry='B2B SaaS', employee_range='51–200', location='United States',
         description='Fictional B2B SaaS analytics workspace for go-to-market teams.',
         text='Northstar Metrics B2B SaaS sales pipeline analytics and workflow collaboration. Built for VP Sales and Revenue Operations. Explore our platform.'),
    dict(name='Harbor API', domain='harborapi.example', industry='Developer tools', employee_range='11–50', location='Canada',
         description='Fictional developer tools business offering API monitoring.',
         text='Harbor API developer tools provide workflow automation and API monitoring. Our team is hiring engineers for a new product launch.'),
    dict(name='Clearpath Ops', domain='clearpathops.example', industry='B2B SaaS', employee_range='201–500', location='Germany',
         description='Fictional operations software for service teams.',
         text='Clearpath Ops B2B SaaS workflow automation for service organizations and Revenue Operations teams. Learn about our services.'),
    dict(name='Fern Studio', domain='fernstudio.example', industry='Agency', employee_range='11–50', location='United Kingdom',
         description='Fictional creative agency serving local consumer brands.',
         text='Fern Studio is a creative agency focused on consumer retail design. Branding, identity and retail experiences.'),
    dict(name='Cedar Market', domain='cedarmarket.example', industry='Consumer retail', employee_range='11–50', location='United States',
         description='Fictional consumer retail business selling home accessories.',
         text='Cedar Market consumer retail accessories for your home. Shop kitchen, garden and interior collections.'),
    dict(name='Summit Supply', domain='summitsupply.example', industry='Manufacturing', employee_range='201–500', location='Australia',
         description='Fictional industrial components supplier.',
         text='Summit Supply manufactures durable industrial parts. Explore our catalog and services for factory maintenance teams.'),
]
