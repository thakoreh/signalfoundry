"""Pure manual lifecycle policies; never dispatch, schedule a job, or call a provider."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def cold_followups_sent(thread):
    before_inbound = []
    for message in thread.messages:
        if message.direction == 'inbound':
            break
        if message.direction == 'outbound':
            before_inbound.append(message)
    # Legacy unlabelled outbound records still count, preventing a migration bypass.
    return max(0, len(before_inbound) - 1)


def weekday_gap(start, end, zone):
    timezone = ZoneInfo(zone)
    cursor = start.astimezone(timezone).date()
    final = end.astimezone(timezone).date()
    days = 0
    while cursor < final and days < 4:
        cursor += timedelta(days=1)
        days += cursor.weekday() < 5
    return days


def manual_action_block(thread, current):
    inbound = any(message.direction == 'inbound' for message in thread.messages)
    outbound = [message for message in thread.messages if message.direction == 'outbound']
    if thread.outbound_purpose == 'cold_followup':
        if inbound:
            return 'A received reply permanently stops this cold followup sequence.'
        if not outbound or cold_followups_sent(thread) >= 2:
            return 'Only two cold followups are allowed after a reported first send.'
        if not thread.next_followup_at:
            return 'Confirm the followup date and timezone first.'
        if datetime.fromisoformat(thread.next_followup_at) > current:
            return 'The confirmed followup is not due yet. Return when it is due and approve it then.'
    elif thread.outbound_purpose == 'meeting_confirmation':
        if thread.meeting_state != 'booked_reported' or not thread.meeting_at:
            return 'A confirmation needs a current timed booking reported by you.'
        if datetime.fromisoformat(thread.meeting_at) <= current:
            return 'The meeting time has passed. Report its outcome instead.'
        if any(getattr(message, 'outbound_purpose', None) == 'meeting_confirmation'
               and getattr(message, 'meeting_version', None) == thread.meeting_version for message in outbound):
            return 'A confirmation has already been recorded for this meeting version.'
    elif outbound and not inbound:
        return 'Schedule and review a dated followup before another cold message.'
    return None
