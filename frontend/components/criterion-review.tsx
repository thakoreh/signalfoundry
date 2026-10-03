import type { Account, Profile } from "@/lib/types";
import { assessAccount } from "@/lib/account-assessment";
import { safeUrl } from "@/lib/utils";
import { Icon } from "./icons";

export function CriterionReview({
  account,
  profile,
}: {
  account: Account;
  profile?: Profile | null;
}) {
  const rows = assessAccount(account, profile);
  if (!rows.length) return null;
  return (
    <section
      className="detail-section criterion-review"
      aria-label="Saved criteria assessment"
    >
      <div className="criterion-heading">
        <span className="eyebrow">YOUR CRITERIA, CHECKED AGAINST EVIDENCE</span>
        <h3>What matches. What’s still unknown.</h3>
        <p>
          Matched means the saved source supports the wording shown here. It
          does not establish buying intent, verified contact details, or
          permission to contact.
        </p>
      </div>
      <div className="criterion-list">
        {rows.map((row) => (
          <article key={row.key} className={`criterion-row ${row.state}`}>
            <div className="criterion-top">
              <strong>{row.label}</strong>
              <span className={`criterion-state ${row.state}`}>
                <Icon
                  name={
                    row.state === "matched"
                      ? "check"
                      : row.state === "not_matched"
                        ? "close"
                        : "info"
                  }
                  size={12}
                />
                {row.state === "matched"
                  ? "Matched"
                  : row.state === "not_matched"
                    ? "Not matched"
                    : "Unknown"}
              </span>
            </div>
            <p className="criterion-expected">{row.expected}</p>
            <p>{row.explanation}</p>
            {row.evidence &&
            !row.evidence.is_demo &&
            safeUrl(row.evidence.url) ? (
              <a
                className="source-link"
                href={safeUrl(row.evidence.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.evidence.title}
                <Icon name="external" size={12} />
              </a>
            ) : row.evidence?.is_demo ? (
              <small>Fictional source · test evidence</small>
            ) : (
              <small>No supporting source captured</small>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
