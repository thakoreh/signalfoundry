"""Read-only company metrics and departure reminders from manual local records."""
from datetime import datetime


def project_insights(threads, excluded_ids, canonical, current):
    companies = {}
    upcoming = []
    approvals = 0
    for thread in threads:
        company = companies.setdefault(canonical(thread.domain), [])
        company.append(thread)
        if thread.body and not thread.approval and not thread.paused and not thread.suppressed and not thread.manual_action_block and not thread.company_conflict:
            approvals += 1
        dates = []
        if thread.next_followup_at and not thread.paused and not thread.suppressed:
            dates.append(('Review a followup', thread.next_followup_at, thread.followup_timezone, 'Review'))
        if thread.revisit_at and thread.reply_state in ('not_now', 'auto_reply'):
            dates.append(('Review the snoozed contact', thread.revisit_at, thread.revisit_timezone, 'Conversations'))
        if thread.meeting_state == 'booked_reported' and thread.meeting_at:
            dates.append(('Report the meeting outcome', thread.meeting_at, thread.meeting_timezone, 'Meetings'))
        upcoming.extend({'thread_id': thread.id, 'search_id': thread.search_id, 'company_name': thread.company_name,
                         'action': action, 'at': at, 'timezone': zone, 'view': view}
                        for action, at, zone, view in dates if datetime.fromisoformat(at.replace('Z', '+00:00')) > datetime.fromisoformat(current.replace('Z', '+00:00')))
    counts = dict(companies=0, contacted=0, replied=0, interested=0, meetings_held=0, customers=0)
    flags = []
    excluded = 0
    nonhuman = {'auto_reply', 'bounce', 'uncertain', 'awaiting_review'}
    for key, group in companies.items():
        flags.append({'domain': key.removeprefix('domain:'), 'contacted': any(
            message.direction == 'outbound' for thread in group for message in thread.messages),
            'suppressed': any(thread.suppressed for thread in group),
            'paused': any(thread.paused for thread in group)})
        eligible = [thread for thread in group if thread.id not in excluded_ids]
        if not eligible:
            excluded += 1
            continue
        counts['companies'] += 1
        counts['contacted'] += any(message.direction == 'outbound' for thread in eligible for message in thread.messages)
        inbound = [message for thread in eligible for message in thread.messages if message.direction == 'inbound']
        counts['replied'] += any(message.reply_state and message.reply_state not in nonhuman for message in inbound)
        latest = max(inbound, key=lambda message: message.created_at, default=None)
        counts['interested'] += bool(latest and latest.reply_state == 'interested')
        counts['meetings_held'] += any(thread.meeting_state == 'attended_reported' for thread in eligible)
        counts['customers'] += any(thread.sale_state == 'won_reported' for thread in eligible)
    return {'funnel': counts, 'excluded_example_companies': excluded, 'company_flags': flags,
            'departure': {'approvals_pending': approvals, 'upcoming': sorted(upcoming, key=lambda item: item['at'])[:20]},
            'provenance': 'Local reports by you; not inbox, calendar, delivery or revenue verification.'}
