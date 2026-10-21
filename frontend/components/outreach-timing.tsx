import type { OutreachThread } from "../lib/outreach";

export type TimingInput = { at: string; zone: string };
export function TimingFields({ value, onChange, kind, disabled }: {
  value: TimingInput; onChange: (value: TimingInput) => void; kind: string; disabled: boolean;
}) {
  return <div className="outreach-timing-fields">
    <label>{kind} date and time with numeric offset
      <input value={value.at} disabled={disabled} placeholder="2026-11-05T10:00:00-05:00"
        onChange={event => onChange({ ...value, at: event.target.value })} />
    </label>
    <label>{kind} IANA timezone
      <input value={value.zone} disabled={disabled} placeholder="America/Toronto"
        onChange={event => onChange({ ...value, zone: event.target.value })} />
    </label>
    <small>Confirm the local time, its UTC offset, and timezone together. Nothing is scheduled to send.</small>
  </div>;
}

export function SavedMeeting({ thread }: { thread: OutreachThread }) {
  if (!thread.meeting_at) return <p>No meeting time recorded. A booking link is not a booking.</p>;
  let time = thread.meeting_at;
  try {
    time = new Intl.DateTimeFormat(undefined, { timeZone: thread.meeting_timezone || "UTC", dateStyle: "full", timeStyle: "short" }).format(new Date(time));
  } catch { /* Show the saved ISO value if a legacy zone is unreadable. */ }
  return <p><strong>Reported meeting:</strong> {time} ({thread.meeting_timezone || "timezone unknown"}). Reported by you; no calendar is connected.</p>;
}
