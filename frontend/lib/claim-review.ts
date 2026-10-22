export type ClaimSource = { id: string; excerpt: string; url: string; retrieved_at: string };
/** Literal matching is a review aid, never semantic or factual verification. */
export function reviewClaims(body: string, footer: string, offering: string, sources: ClaimSource[]) {
  const text = footer && body.endsWith(footer) ? body.slice(0, -footer.length) : body;
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.!?]$/, "");
  return (text.match(/[^.!?\n]+[.!?]?/g) || []).map(sentence => {
    const value = normalize(sentence);
    const substantive = value.split(" ").length >= 4;
    const source = substantive ? sources.find(item => normalize(item.excerpt).includes(value)) : undefined;
    return { text: sentence.trim(), source,
      label: source ? "Matches saved recipient text" : substantive && normalize(offering).includes(value)
        ? "Matches your saved offer" : "Needs your source review" };
  }).filter(item => item.text);
}
