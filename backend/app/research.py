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
        # A page can describe its customers' industries. Do not treat those
        # navigation/use-case mentions as the company's own business identity.
        inferred_industry = fixture['industry'] if fixture else next(
            (label for source in (page.title, page.description)
             for label, terms in INDUSTRY_TERMS.items()
             if any(matches(t, source) for t in terms)), 'Unknown')
        matched_industries = [x for x in profile.industries if
                             x.casefold() == inferred_industry.casefold() or
                             (inferred_industry == 'Unknown' and matches(x, page.title))]
        matched_roles = [x for x in profile.buyer_roles if matches(x, text)]
        matched_signals = [x for x in SIGNAL_TERMS if matches(x, text)]
        # Category exclusions describe this company, not customers mentioned in
        # its navigation/use cases. Free-form exclusions require identity evidence.
        exclusions = []
        for term in profile.exclusions:
            categories = {label for label, terms in INDUSTRY_TERMS.items()
                          if matches(label, term) or any(matches(t, term) for t in terms)}
            excluded = (inferred_industry in categories) if categories else any(
                matches(term, source) for source in (page.title, page.description))
            if fixture is not None:
                excluded = matches(term, text)
            if excluded:
                exclusions.append(term)
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
        if profile.industries and not matched_industries and score >= 65:
            breakdown.append(ScoreComponent(label='Unconfirmed industry fit',
                points=64-score, max_points=0,
                reason='Company identity does not establish the target industry; score capped below strong fit'))
            score = 64
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
        if profile.industries and not matched_industries:
            unknowns.append('Company identity does not establish the target industry; customer/use-case mentions are not company classification')
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


_NAVIGATION_FRAGMENT = re.compile(r'^(?:(?:back|home|menu|see all|platform|integrations|tools|products?)[\s.!?,:;|-]*)+$', re.I)


def _complete_source_sentence(value: str | None, limit: int = 220) -> str | None:
    if not value:
        return None
    normalized = re.sub(r'\s+', ' ', value).strip()
    normalized = re.sub(r'^(?:…|\.\.\.)\s*', '', normalized)
    normalized = re.sub(r'\s*(?:…|\.\.\.)$', '', normalized).strip()
    if (20 <= len(normalized) <= limit and re.search(r'[.!?]$', normalized)
            and not re.search(r'…|\.{3}', value) and not _NAVIGATION_FRAGMENT.search(normalized)):
        return normalized
    for sentence in re.findall(r'[^.!?]+[.!?]', normalized):
        candidate = sentence.strip(' \'"')
        if len(candidate) >= 20 and len(candidate) <= limit and not _NAVIGATION_FRAGMENT.search(candidate):
            return candidate
    if len(normalized) <= limit and len(normalized) >= 20 and not _NAVIGATION_FRAGMENT.search(normalized):
        return normalized
    return None


def _draft_source(account: Account) -> tuple[Evidence | None, str | None]:
    evidence = sorted(account.evidence, key=lambda item: 0 if item.kind == 'company' else 1)
    for item in evidence:
        excerpt = _complete_source_sentence(item.excerpt)
        if excerpt:
            return item, excerpt
    return None, _complete_source_sentence(account.description)


def _display_name(account: Account) -> str:
    return re.split(r'\s*[:|–—]\s*', account.name, maxsplit=1)[0].strip()[:120] or account.domain


def _fit_unconfirmed(account: Account) -> bool:
    return account.confidence == 'low' or account.score < 65 or any(
        'qualification is unknown' in reason.lower() or 'qualification unknown' in reason.lower()
        for reason in account.why_fit + [part.reason for part in account.score_breakdown]
    )


def make_draft(account: Account, profile: Profile) -> Draft:
    cited, observed = _draft_source(account)
    name = _display_name(account)
    source_line = (f'Your website includes this description: “{observed}”'
                   if observed else
                   'I could not find a complete, citable description on the available page.')
    offer = _complete_source_sentence(re.split(r'(?<=[.!?])\s+', profile.description, maxsplit=1)[0], limit=400)
    sender_line = (f'I’m reaching out from {profile.company_name}. ' +
                   (offer or '[Add your specific offer and its relevance before using this draft.]'))
    body = (f'Hi {name} team,\n\n'
            f'{source_line}\n\n'
            f'{sender_line}\n\nWould it be useful to explore whether this is relevant to your team?\n\n'
            '[Your name]')
    basis = [f'{cited.title}: {cited.url}' if cited else 'Available page content; no complete independent source sentence was found',
             'Sender company and offer come from your editable workspace profile']
    warning = (
        ('FICTIONAL DEMO: do not send this sample. ' if account.is_demo else '') +
        'Draft only; nothing is sent. Review quoted website text, recipient, relevance, and applicable outreach requirements before use. No verified contact is available. Sender offer relevance and geographic applicability are not verified; adapt your offer before using this draft.'
    )
    if _fit_unconfirmed(account):
        warning += ' Fit is unconfirmed; this draft does not establish relevance or buying intent.'
    return Draft(subject=f'A question for {name}'[:180], body=body, basis=basis,
                 engine='grounded_template', warning=warning)
