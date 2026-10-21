import { reviewClaims, type ClaimSource } from "../lib/claim-review";
import { publicSourceUrl } from "../lib/customer-search";

export function DraftClaimReview({ body, footer, offering, sources }: {
  body: string; footer: string; offering: string; sources: ClaimSource[];
}) {
  const claims = reviewClaims(body, footer, offering, sources);
  if (!claims.length) return null;
  const needsReview = claims.filter(item => item.label === "Needs your source review").length;
  return <details className="outreach-claims">
    <summary>Check the claims · {needsReview} {needsReview === 1 ? "part needs" : "parts need"} your review</summary>
    <p>Literal matches show where saved wording came from. Paraphrases and other claims need your judgment; none of these labels verifies facts, permission or buying intent.</p>
    <ul>{claims.slice(0, 12).map((claim, index) => <li key={index}>
      <strong>{claim.label}</strong><p>{claim.text}</p>
      {claim.source && publicSourceUrl(claim.source.url) && <a href={publicSourceUrl(claim.source.url)!} target="_blank" rel="noreferrer">Saved source · {claim.source.retrieved_at}</a>}
    </li>)}</ul>
    {claims.length > 12 && <p>Additional text also needs manual review; this summary shows the first twelve parts.</p>}
  </details>;
}
