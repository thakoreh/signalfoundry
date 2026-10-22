"use client";

import { Icon } from "./icons";
import { useLandingMotion } from "./landing-motion-provider";
import "./landing-pipeline.css";

const steps = [
  { icon: "globe", title: "Your website", detail: "Your offer, understood" },
  {
    icon: "target",
    title: "Relevant businesses",
    detail: "Contacts with sources",
  },
  {
    icon: "mail",
    title: "A personal message",
    detail: "AI drafts. You approve.",
  },
  {
    icon: "users",
    title: "The next conversation",
    detail: "Replies you record",
  },
] as const;

export function LandingPipeline() {
  const { motionAllowed } = useLandingMotion();
  return (
    <section
      className="sf-pipeline sf-shell"
      aria-label="One connected customer workflow"
    >
      <div className="sf-pipeline-heading">
        <span className="sf-kicker">One starting point. Every next step.</span>
        <span className="sf-pipeline-caption">
          An illustration of your workflow
        </span>
      </div>
      <ol className="sf-pipeline-steps" data-flow-running={motionAllowed}>
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="sf-pipeline-icon" aria-hidden="true">
              <Icon name={step.icon} size={21} />
            </span>
            <span className="sf-pipeline-number" aria-hidden="true">
              0{index + 1}
            </span>
            <strong>{step.title}</strong>
            <span className="sf-pipeline-detail">{step.detail}</span>
            {index < steps.length - 1 && (
              <span className="sf-pipeline-connector" aria-hidden="true">
                <span />
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="sf-pipeline-note">
        <Icon name="check" size={14} /> You approve the words. Sending and reply
        tracking are manual today.
      </p>
    </section>
  );
}
