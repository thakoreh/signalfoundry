import "./selling-as.css";
import type { Profile } from "../lib/types";

/** Saved identity only: never a recipient or an unsaved profile preview. */
export function SellingAs({
  profile,
  onEdit,
}: {
  profile: Profile | null;
  onEdit?: () => void;
}) {
  return (
    <section className="selling-as" aria-label="Saved seller">
      <div>
        <span>Selling as </span>
        <strong>
          {[profile?.sender_name, profile?.company_name]
            .filter(Boolean)
            .join(" · ") || "Business not confirmed"}
        </strong>
        {profile && !profile.mailing_address?.trim() && (
          <small>
            Mailing address needed — outreach must legally include your saved
            address.
          </small>
        )}
        {profile && !profile.sender_contact?.trim() && (
          <small>Reachable contact needed before approval.</small>
        )}
      </div>
      {onEdit && (
        <button className="btn" type="button" onClick={onEdit}>
          Edit business
        </button>
      )}
    </section>
  );
}
