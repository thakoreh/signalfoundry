import type { Account, Campaign, Profile, ResearchJob } from "@/lib/types";
import { activeJob } from "@/lib/jobs";
import { needsResearch } from "@/lib/account-assessment";
import { Icon } from "./icons";

export function MissionBoard({
  campaign,
  accounts,
  profile,
  job,
  onReview,
}: {
  campaign: Campaign;
  accounts: Account[];
  profile?: Profile | null;
  job: ResearchJob | null;
  onReview: (account: Account) => void;
}) {
  const waiting = accounts.filter(
    (account) => account.status === "new" && !account.suppress_workspace,
  );
  const kept = accounts.filter(
    (account) =>
      account.status === "shortlisted" && !account.suppress_workspace,
  );
  const suppressed = accounts.filter((account) => account.suppress_workspace);
  const passed = accounts.filter((account) => account.status === "dismissed");
  const unknown = waiting.filter((account) => needsResearch(account, profile));
  const next = waiting[0];
  const evidenceCount = accounts.reduce(
    (total, account) => total + account.evidence.length,
    0,
  );
  const running = activeJob(job) || campaign.status === "researching";
  const stages = [
    {
      label: "Offering",
      detail: profile?.company_name || "Your business",
      done: Boolean(profile),
    },
    {
      label: "Audience",
      detail:
        profile?.industries.join(", ") ||
        profile?.buyer_roles[0] ||
        "Choose a buyer",
      done: Boolean(profile?.industries.length || profile?.buyer_roles.length),
    },
    {
      label: "Research",
      detail: running
        ? "Working within your limits"
        : accounts.length
          ? `${accounts.length} ${accounts.length === 1 ? "company" : "companies"} researched`
          : "Awaiting your start",
      done: Boolean(accounts.length),
    },
    {
      label: "Your review",
      detail: kept.length
        ? `${kept.length} kept for next steps`
        : "Every decision stays yours",
      done: Boolean(kept.length || passed.length),
    },
  ];
  return (
    <section
      className={`mission-board ${running ? "running" : ""}`}
      aria-label="Customer mission overview"
    >
      <div className="mission-board-heading">
        <div>
          <span className="eyebrow">YOUR CUSTOMER MISSION</span>
          <h2>
            {running
              ? "Finding evidence. Keeping you in control."
              : next
                ? "Your next opportunity needs your judgment."
                : kept.length
                  ? "A focused shortlist. A thoughtful next step."
                  : suppressed.length
                    ? "Your exclusions are respected."
                    : "A clear audience is your starting point."}
          </h2>
          <p>
            {running
              ? "Research is bounded by the approved criteria and budget. You can cancel while completed results stay available."
              : next
                ? "Review the company, its source evidence, and the gaps before you keep it. Your feedback carries into the next run."
                : kept.length
                  ? "Open a kept company to prepare an unsent draft. Verify relevance and contact details before using it."
                  : suppressed.length
                    ? "Suppressed companies remain in your history and stay out of your review queue. Restore a domain deliberately in Customer profile before considering it again."
                    : "Approve a search when you’re ready. Company discovery does not require a contact provider or a prospect list."}
          </p>
        </div>
        <span className="mission-control-badge">
          <Icon name="shield" size={15} />
          Approval-led
        </span>
      </div>
      <ol className="mission-path">
        {stages.map((stage, index) => (
          <li key={stage.label} className={stage.done ? "done" : ""}>
            <span className="mission-step">
              {stage.done ? (
                <Icon name="check" size={15} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <div>
              <strong>{stage.label}</strong>
              <span>{stage.detail}</span>
            </div>
          </li>
        ))}
      </ol>
      {accounts.length > 0 && (
        <div className="mission-review-strip">
          <div className="mission-review-count">
            <strong>{waiting.length}</strong>
            <span>waiting for review</span>
          </div>
          <div className="mission-review-count">
            <strong>{unknown.length}</strong>
            <span>waiting with criteria unknown</span>
          </div>
          <div className="mission-review-count">
            <strong>{kept.length}</strong>
            <span>kept</span>
          </div>
          <div className="mission-review-count">
            <strong>{passed.length}</strong>
            <span>passed</span>
          </div>
          {next && (
            <button
              className="btn primary small"
              id="review-next-company"
              onClick={() => onReview(next)}
            >
              Review next company
              <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      )}
      <p className="mission-footnote">
        <Icon name="info" size={13} />
        <span>
          {evidenceCount > 0
            ? `${evidenceCount} saved evidence ${evidenceCount === 1 ? "record" : "records"}. `
            : ""}
          Runs start when you approve them. This workspace does not run an
          unattended agent, send messages, or verify buying intent.
        </span>
      </p>
    </section>
  );
}
