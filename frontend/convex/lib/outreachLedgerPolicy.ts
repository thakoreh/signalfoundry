import type { Infer } from "convex/values";
import type { Profile } from "../validators";
import type { WorkerAccount } from "../validators";
import { contactBasis } from "./outreachLedgerValidators";
import { appError } from "./errors";
import { normalizeWebsite, text } from "./validation";

export function line(value: string, label: string, max: number, empty = false) {
  if (empty && !value.trim()) return "";
  const result = text(value, label, max);
  if (/[\r\n]/.test(result))
    throw appError("VALIDATION_ERROR", `${label} must be one line`);
  return result;
}
export function email(value: string, empty = false): string {
  const result = line(value, "Recipient", 320, empty);
  if (!result && empty) return "";
  if (
    !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
      result,
    ) ||
    result.split("@")[0].length > 64
  )
    throw appError("VALIDATION_ERROR", "Use one plain public email address");
  normalizeWebsite(`https://${result.split("@")[1]}`);
  return result;
}
export function companyKey(domain: string) {
  return new URL(normalizeWebsite(domain)).hostname.replace(/^www\./, "");
}
export function senderFooter(profile: Profile | null) {
  if (
    !profile?.sender_name?.trim() ||
    !profile.company_name.trim() ||
    !profile.mailing_address?.trim() ||
    !profile.sender_contact?.trim()
  )
    return "";
  try {
    const name = line(profile.sender_name, "Sender name", 240);
    const company = line(profile.company_name, "Company", 240);
    const address = text(profile.mailing_address, "Mailing address", 1000);
    const contact = line(profile.sender_contact, "Sender contact", 320);
    if (contact.startsWith("https://")) normalizeWebsite(contact);
    else if (!(
      /^\+?[0-9 ()-]{7,30}$/.test(contact) &&
      contact.replace(/\D/g, "").length >= 7
    ))
      email(contact);
    return `\n\n--\n${name} | ${company}\n${address}\nContact: ${contact}\nAdvertisement: business outreach.\nTo opt out, reply "unsubscribe".`;
  } catch {
    return "";
  }
}
export function awareInstant(value: string) {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    )
  )
    throw appError(
      "VALIDATION_ERROR",
      "Use a date with an explicit numeric offset",
    );
  const result = Date.parse(value);
  if (!Number.isFinite(result))
    throw appError("VALIDATION_ERROR", "Invalid date");
  // Date.parse normalizes calendar overflows such as February 30 and 24:00.
  // Compare the original wall components at its explicit offset first.
  const offset = value.endsWith("Z")
    ? 0
    : (value.at(-6) === "-" ? -1 : 1) *
      (Number(value.slice(-5, -3)) * 60 + Number(value.slice(-2)));
  const wall = new Date(result + offset * 60_000).toISOString().slice(0, 19);
  const original =
    value.slice(0, 16) +
    (value.slice(16, 19).startsWith(":") ? value.slice(16, 19) : ":00");
  if (wall !== original)
    throw appError("VALIDATION_ERROR", "Invalid original calendar date");
  return result;
}
export function timezone(value: string) {
  line(value, "Timezone", 100);
  // Newer Intl runtimes also accept raw numeric offsets. Those are not the
  // separate IANA zone required to check the original wall time across DST.
  if (!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value))
    throw appError("VALIDATION_ERROR", "Use a named IANA timezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
  } catch {
    throw appError("VALIDATION_ERROR", "Use an IANA timezone");
  }
  return value;
}
export function zonedInstant(value: string, zone: string) {
  const instant = awareInstant(value);
  timezone(zone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  const wall = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
  const original =
    value.slice(0, 16) +
    (value.slice(16, 19).startsWith(":") ? value.slice(16, 19) : ":00");
  if (wall !== original)
    throw appError(
      "VALIDATION_ERROR",
      "The original wall time or offset does not match this timezone",
    );
  return instant;
}
export function validatedBasis(value: Infer<typeof contactBasis> | null) {
  if (!value) return null;
  const captured = value.captured_at ? awareInstant(value.captured_at) : null;
  if (captured !== null && captured > Date.now() + 300_000)
    throw appError(
      "VALIDATION_ERROR",
      "Contact observation cannot be in the future",
    );
  return {
    ...value,
    published_email: email(value.published_email, true),
    source_url: value.source_url ? normalizeWebsite(value.source_url) : "",
    captured_at: captured === null ? "" : new Date(captured).toISOString(),
    recipient_role: line(value.recipient_role, "Recipient role", 300, true),
    message_relevance: value.message_relevance.trim()
      ? text(value.message_relevance, "Role relevance", 2000)
      : "",
    recipient_timezone: value.recipient_timezone
      ? timezone(value.recipient_timezone)
      : null,
  };
}
export function basisReady(
  value: Infer<typeof contactBasis> | null,
  recipient: string,
) {
  return Boolean(
    value &&
    recipient &&
    value.published_email.toLowerCase() === recipient.toLowerCase() &&
    value.source_url &&
    value.captured_at &&
    ["recipient", "caused_by_recipient"].includes(
      value.publisher_attribution,
    ) &&
    value.notice_status === "clear" &&
    value.recipient_role &&
    value.message_relevance &&
    ["US", "CA"].includes(value.recipient_country),
  );
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
export async function fingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  if (bytes.byteLength > 100_000)
    throw appError(
      "VALIDATION_ERROR",
      "Manual request exceeds its encoded allowance",
    );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export function detectedReply(body: string, selected: string) {
  if (
    /\b(unsubscribe|remove me|do not contact|don.t contact|stop emailing|opt[ -]?out)\b/i.test(
      body,
    )
  )
    return "opt_out";
  if (
    /\b(where|how) did you get my (email|address)|how did you find me|source of (your|the) (email|information)/i.test(
      body,
    )
  )
    return "source_question";
  return selected;
}
export function sourceFacts(account: WorkerAccount) {
  return account.evidence
    .flatMap((fact) => {
      if (
        fact.is_demo ||
        !["company", "fit"].includes(fact.kind) ||
        !fact.excerpt.trim()
      )
        return [];
      try {
        return [
          {
            id: line(fact.id, "Source id", 128),
            excerpt: text(fact.excerpt.slice(0, 900), "Company fact", 900),
            url: normalizeWebsite(fact.url),
            retrievedAt: line(fact.retrieved_at, "Source date", 100, true),
          },
        ];
      } catch {
        return [];
      }
    })
    .slice(0, 5);
}
export function bookingLink(value: string) {
  if (!value.trim()) return "";
  const result = normalizeWebsite(line(value, "Booking link", 2048));
  if (!result.startsWith("https://"))
    throw appError("VALIDATION_ERROR", "Use a public HTTPS booking link");
  return result;
}
