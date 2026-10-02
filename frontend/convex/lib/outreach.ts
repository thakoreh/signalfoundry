import type { Account, Draft, Evidence, Profile } from "../../lib/types";

const navigationFragment = /^(?:(?:back|home|menu|see all|platform|integrations|tools|products?)[\s.!?,:;|-]*)+$/i;

function completeSourceSentence(value: string | null | undefined, limit = 220): string | null {
  if (!value) return null;
  let normalized = value.replace(/\s+/g, " ").trim();
  normalized = normalized.replace(/^(?:…|\.\.\.)\s*/, "");
  normalized = normalized.replace(/\s*(?:…|\.\.\.)$/, "").trim();
  if (normalized.length >= 20 && normalized.length <= limit && /[.!?]$/.test(normalized) && !/[\u2026]|\.{3}/.test(value) && !navigationFragment.test(normalized)) return normalized;
  const sentences = normalized.match(/[^.!?]+[.!?]/g) ?? [];
  for (const sentence of sentences) {
    const candidate = sentence.trim().replace(/^['"]|['"]$/g, "");
    if (
      candidate.length >= 20 &&
      candidate.length <= limit &&
      !navigationFragment.test(candidate)
    ) {
      return candidate;
    }
  }
  if (
    normalized.length >= 20 &&
    normalized.length <= limit &&
    !navigationFragment.test(normalized)
  ) {
    return normalized;
  }
  return null;
}

function draftSource(account: Account): { cited?: Evidence; observed: string | null } {
  const evidence = [...account.evidence].sort(
    (left, right) => Number(left.kind !== "company") - Number(right.kind !== "company"),
  );
  for (const item of evidence) {
    const observed = completeSourceSentence(item.excerpt);
    if (observed) return { cited: item, observed };
  }
  return { observed: completeSourceSentence(account.description) };
}

function displayName(account: Account): string {
  return account.name.split(/\s*[:|–—]\s*/, 2)[0].trim().slice(0, 120) || account.domain;
}

function fitUnconfirmed(account: Account): boolean {
  return (
    account.confidence === "low" ||
    account.score < 65 ||
    [...account.why_fit, ...account.score_breakdown.map((part) => part.reason)].some(
      (reason) => /qualification (?:is )?unknown/i.test(reason),
    )
  );
}

export function makeGroundedDraft(account: Account, profile: Profile): Draft {
  const { cited, observed } = draftSource(account);
  const name = displayName(account);
  const sourceLine = observed
    ? `Your website includes this description: “${observed}”`
    : "I could not find a complete, citable description on the available page.";
  const offer = completeSourceSentence(profile.description, 400);
  const senderLine = `I’m reaching out from ${profile.company_name}. ${offer ?? "[Add your specific offer and its relevance before using this draft.]"}`;
  const body =
    `Hi ${name} team,\n\n` +
    `${sourceLine}\n\n` +
    `${senderLine}\n\nWould it be useful to explore whether this is relevant to your team?\n\n` +
    "[Your name]";
  const basis = [
    cited
      ? `${cited.title}: ${cited.url}`
      : "Available page content; no complete independent source sentence was found",
    "Sender company and offer come from your editable workspace profile",
  ];
  let warning =
    (account.is_demo ? "FICTIONAL DEMO: do not send this sample. " : "") +
    "Draft only; nothing is sent. Review quoted website text, recipient, relevance, and applicable outreach requirements before use. No verified contact is available. Sender offer relevance and geographic applicability are not verified; adapt your offer before using this draft.";
  if (fitUnconfirmed(account)) {
    warning += " Fit is unconfirmed; this draft does not establish relevance or buying intent.";
  }
  return {
    subject: `A question for ${name}`.slice(0, 180),
    body,
    basis,
    engine: "grounded_template",
    warning,
  };
}
