"""Auditable rules-only decisions from page text, with grounded draft templates."""
from __future__ import annotations
import re
from urllib.parse import urlsplit
from .fixtures import FIXTURES
from .models import Account, Contact, Draft, Evidence, Profile, ScoreComponent
from .safety import Page
from .primitives import new_id, now

INDUSTRY_TERMS = {
    'B2B SaaS': ['saas', 'b2b', 'software as a service'],
    'Developer tools': ['developer', 'api', 'sdk'],
    'Financial technology': ['fintech', 'payments', 'financial technology'],
    'Healthcare technology': ['healthcare', 'clinical', 'patient'],
    'E-commerce': ['ecommerce', 'e-commerce', 'online store'],
    'Manufacturing': ['manufacturing', 'industrial', 'factory'],
    'Agency': ['agency', 'consultancy'],
}
ROLE_TERMS = ['VP Sales', 'Head of Growth', 'Revenue Operations', 'Marketing', 'Engineering', 'Operations']
KEYWORD_TERMS = ['sales', 'workflow', 'automation', 'pipeline', 'developer', 'analytics', 'data', 'platform', 'customer', 'security', 'integration', 'marketing']
SIGNAL_TERMS = ['hiring', 'new product', 'launch', 'expanding', 'funding', 'partnership']


def matches(term: str, text: str) -> bool:
    return bool(re.search(r'(?<!\w)' + re.escape(term.lower()) + r'(?!\w)', text.lower()))


def excerpt_for(term: str, text: str, size: int = 260) -> str:
    match = re.search(re.escape(term), text, re.I)
    start = max(0, (match.start() if match else 0) - 70)
    return ('…' if start else '') + text[start:start + size] + ('…' if start + size < len(text) else '')


def infer_profile(page: Page) -> Profile:
    industries = [label for label, terms in INDUSTRY_TERMS.items() if any(matches(t, page.text) for t in terms)]
    keywords = [term for term in KEYWORD_TERMS if matches(term, page.text)]
    roles = [term for term in ROLE_TERMS if matches(term, page.text)]
    # These are explicitly draft targeting suggestions, not inferred firmographics.
    description = page.description or page.text[:900]
    return Profile(company_name=re.split(r'\s[|–—]\s', page.title)[0][:240],
                   description=description + '\n\nDraft ICP from website keyword rules; review target industries, roles, and keywords. Company sizes and geographies are unknown until you choose them.',
                   industries=industries[:12], company_sizes=[], geographies=[],
                   buyer_roles=roles, keywords=keywords[:20], exclusions=[])


class RulesDecisionProvider:
    name = 'rules'

    def evaluate(self, profile: Profile, page: Page, *, campaign_id: str,
                 fixture: dict | None = None) -> Account:
        timestamp = now()
        is_demo = fixture is not None
        text = page.text
        matched_keywords = [x for x in profile.keywords if matches(x, text)]
        matched_industries = [x for x in profile.industries if matches(x, text) or
                             any(matches(t, text) for t in INDUSTRY_TERMS.get(x, []))]
        matched_roles = [x for x in profile.buyer_roles if matches(x, text)]
        matched_signals = [x for x in SIGNAL_TERMS if matches(x, text)]
        exclusions = [x for x in profile.exclusions if matches(x, text)]
        def part(label, actual, targets, max_points, cap):
            if not targets:
                return ScoreComponent(label=label, points=0, max_points=max_points,
                                      reason='No targeting rules configured; no points awarded')
            points = round(max_points * min(len(actual) / min(len(targets), cap), 1))
            return ScoreComponent(label=label, points=points, max_points=max_points,
                                  reason=('Website text matches: ' + ', '.join(actual)) if actual else 'No matching website text found')
        breakdown = [part('Keyword fit', matched_keywords, profile.keywords, 40, 4),
                     part('Industry language', matched_industries, profile.industries, 25, 1),
                     part('Buyer-role language', matched_roles, profile.buyer_roles, 15, 2),
                     part('Observable signals', matched_signals, SIGNAL_TERMS, 20, 2)]
        if exclusions:
            breakdown.append(ScoreComponent(label='Exclusion penalty', points=-50, max_points=0,
                                             reason='Excluded website language: ' + ', '.join(exclusions)))
        score = max(0, min(100, sum(x.points for x in breakdown)))
        evidence = [Evidence(id=new_id('ev'), title=('Fictional demo: ' if is_demo else '') + page.title,
                             url=page.url, excerpt=(('Fictional fixture. ' if is_demo else '') + (page.description or text[:400]))[:600],
                             kind='company', published_at=None, retrieved_at=timestamp, is_demo=is_demo)]
        for term in (matched_keywords[:2] + matched_industries[:1]):
            evidence.append(Evidence(id=new_id('ev'), title=f'{"Fictional demo: " if is_demo else ""}Website language: {term}',
                                     url=page.url, excerpt=excerpt_for(term, text), kind='fit', published_at=None,
                                     retrieved_at=timestamp, is_demo=is_demo))
        for term in matched_signals[:2]:
            evidence.append(Evidence(id=new_id('ev'), title=f'{"Fictional demo: " if is_demo else ""}Signal language: {term}',
                                     url=page.url, excerpt=excerpt_for(term, text), kind='signal', published_at=None,
                                     retrieved_at=timestamp, is_demo=is_demo))
        fit = [x.reason for x in breakdown[:3] if x.points > 0]
        if exclusions:
            fit.append('Exclusion penalty applied: ' + ', '.join(exclusions))
        if not fit:
            fit = ['No configured ICP language matched the available page text']
        signals = [f'Website mentions “{x}”; timing and current relevance are unverified' for x in matched_signals[:3]]
        if not signals:
            signals = ['No timely buying signal established from this page']
        unknowns = ['No contact-enrichment provider is configured; people and email addresses are unavailable',
                    'Budget, buying intent, and decision authority are unknown',
                    'Publication dates and the recency of website statements are unknown',
                    'Company size and geography do not contribute to the score in this MVP']
        if is_demo:
            unknowns.insert(0, 'All company details and evidence are fictional demo fixtures')
        else:
            unknowns.extend(['Employee count is unknown', 'Company location is unknown',
                             'Industry is suggested by website language, not independently verified'])
        inferred_industry = next((label for label, terms in INDUSTRY_TERMS.items() if any(matches(t, text) for t in terms)), 'Unknown')
        contacts = [Contact(name=None, role=profile.buyer_roles[0] if profile.buyer_roles else 'Relevant decision-maker',
                            email=None, verification_status='not_available', source_url=None,
                            note='Suggested role to research, not an identified person. Contact provider is not configured.')]
        return Account(id=new_id('acc'), campaign_id=campaign_id,
                       name=fixture['name'] if fixture else re.split(r'\s[|–—]\s', page.title)[0][:240],
                       domain=fixture['domain'] if fixture else urlsplit(page.url).hostname,
                       description=fixture['description'] if fixture else (page.description or text[:400]),
                       industry=fixture['industry'] if fixture else inferred_industry,
                       employee_range=fixture['employee_range'] if fixture else 'Unknown',
                       location=fixture['location'] if fixture else 'Unknown', score=score,
                       confidence='medium' if matched_keywords and matched_industries else 'low',
                       decision_engine='rules', status='new', why_fit=fit, why_now=signals,
                       unknowns=unknowns, evidence=evidence, contacts=contacts, is_demo=is_demo,
                       researched_at=timestamp, score_breakdown=breakdown)


def demo_accounts(profile: Profile, campaign_id: str) -> list[Account]:
    engine = RulesDecisionProvider()
    return [engine.evaluate(profile, Page('https://' + item['domain'] + '/', item['name'],
                                         item['description'], item['text']), campaign_id=campaign_id,
                            fixture=item) for item in FIXTURES]


def make_draft(account: Account, profile: Profile) -> Draft:
    cited = next((x for x in account.evidence if x.kind == 'fit'), account.evidence[0] if account.evidence else None)
    observed = cited.excerpt if cited else account.description
    # Quote a bounded source excerpt instead of manufacturing products, ROI,
    # headcount, funding events, recipient identity, or personalized claims.
    body = (f'Hi {account.name} team,\n\n'
            f'Your website includes this description: “{observed[:220]}”\n\n'
            f'I’m reaching out from {profile.company_name}. Would a short conversation to see whether there is a relevant fit be useful?\n\n'
            '[Your name]')
    basis = [f'{cited.title}: {cited.url}' if cited else 'Account description; no independent source available',
             'Sender company name comes from your editable workspace profile']
    return Draft(subject=f'A question for {account.name}'[:180], body=body, basis=basis,
                 engine='grounded_template',
                 warning=('FICTIONAL DEMO: do not send this sample. ' if account.is_demo else '') +
                         'Draft only; nothing is sent. Review quoted website text, recipient, relevance, and applicable outreach requirements before use. No verified contact is available.')
