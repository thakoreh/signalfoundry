import type { DiscoveryStatus, Profile } from "@/lib/types";
import { discoveryReady } from "@/lib/api";
import { safeUrl } from "@/lib/utils";
import { Icon } from "./icons";

export const targetFields = [
  ["industries", "Industries", "B2B SaaS, Financial services"],
  ["company_sizes", "Company size", "11–50, 51–200"],
  ["buyer_roles", "Buyer roles", "VP of Sales, Head of Operations"],
  ["geographies", "Geographies", "United States, United Kingdom"],
  ["keywords", "Observable match criteria", "scaling sales, new funding"],
  ["exclusions", "Exclusions", "agencies, consumer apps"],
] as const;

export function DiscoveryReadiness({
  status,
  loading = false,
}: {
  status: DiscoveryStatus | null;
  loading?: boolean;
}) {
  const ready = discoveryReady(status);
  return (
    <div
      className={`discovery-readiness ${ready ? "ready" : ""}`}
      role="status"
    >
      <div className="readiness-heading">
        <Icon name={ready ? "check" : "shield"} size={18} />
        <strong>
          {loading
            ? "Checking discovery availability…"
            : ready
              ? "Company discovery ready"
              : "Discovery unavailable"}
        </strong>
      </div>
      <p>
        {loading
          ? "Your brief can be reviewed while we check the service."
          : ready
            ? "Research uses the saved criteria and a bounded provider budget. Results still need your review. Email verification is a separate step."
            : "You can save a campaign draft now. Company research needs an approved discovery provider and budget. Contact enrichment is optional."}
      </p>
      {!loading &&
        (status ? (
          <>
            <ul className="provider-readiness">
              {(["discovery", "contacts", "verification"] as const).map(
                (key) => {
                  const provider = status.providers?.[key];
                  const available = provider?.configured && provider.licensed;
                  return (
                    <li key={key}>
                      <span
                        className={`small-dot ${available ? "mint" : "gray"}`}
                      />
                      <span>
                        <strong>
                          {key === "contacts"
                            ? "Contacts (optional)"
                            : key === "verification"
                              ? "Email verification (optional)"
                              : "Company discovery"}
                        </strong>
                        <span>
                          {provider?.reason ||
                            (available
                              ? "Configured and licensed"
                              : "Provider not configured or licensed")}
                        </span>
                      </span>
                    </li>
                  );
                },
              )}
            </ul>
            {status.blockers.length > 0 && (
              <ul className="readiness-blockers">
                {status.blockers.map((blocker, i) => (
                  <li key={i}>{blocker}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="input-hint">
            Provider status could not be confirmed. Research stays disabled
            until availability is verified.
          </p>
        ))}
    </div>
  );
}

export function TargetBrief({
  profile,
  website,
  targetCount,
  manual = false,
}: {
  profile: Profile;
  website?: string | null;
  targetCount?: number;
  manual?: boolean;
}) {
  const url = safeUrl(website || "");
  return (
    <div className="target-brief">
      <div className="brief-offering">
        <span className="eyebrow">
          {profile.company_name || "YOUR OFFERING"}
        </span>
        <p>{profile.description}</p>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {website}
            <Icon name="external" size={12} />
          </a>
        )}
      </div>
      <dl className="brief-criteria">
        {targetFields.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {profile[key].length ? profile[key].join(", ") : "Not specified"}
            </dd>
          </div>
        ))}
      </dl>
      {targetCount != null && (
        <p className="brief-limit">
          <Icon name="accounts" size={15} />
          {manual
            ? `${targetCount} supplied company ${targetCount === 1 ? "website" : "websites"}`
            : `Find up to ${targetCount} companies`}
          <span>Fewer matches may be returned</span>
        </p>
      )}
    </div>
  );
}
