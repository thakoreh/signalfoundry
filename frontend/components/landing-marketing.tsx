"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { LandingMotionProvider, MotionToggle } from "./landing-motion-provider";

const scenes = [
  {
    label: "Find the right businesses",
    title: "Start with who you can help.",
    copy: "Add your website, confirm your offer and buyer, then find businesses to approach. Available contacts and unverified emails stay clearly labeled.",
    caption:
      "Illustration: your offering and buyer criteria guide a small business shortlist.",
  },
  {
    label: "Make the first message personal",
    title: "Give them a reason to reply.",
    copy: "Turn saved company facts and your offering into an AI introduction. Edit it, approve the exact words, then send using your own email tool.",
    caption:
      "Illustration: a saved company fact, your relevant offer and one low-pressure question form an opening.",
  },
  {
    label: "Follow the conversation through",
    title: "Keep the opportunity in motion.",
    copy: "Record replies, prepare your next message and keep follow-ups in view. Add meetings and report what happened, without losing the conversation's context.",
    caption:
      "Illustration: a reply you add leads to a next step and a meeting you record. No automatic inbox or calendar connection.",
  },
];

function BuyerScene() {
  return (
    <div className="sf-illustration sf-illustration-buyers" aria-hidden="true">
      <div className="sf-orbit sf-orbit-one" />
      <div className="sf-orbit sf-orbit-two" />
      <div className="sf-offer-card">
        <span className="sf-mini-icon">
          <Icon name="globe" size={21} />
        </span>
        <span className="sf-illustration-overline">Your starting point</span>
        <strong>Your business</strong>
        <div className="sf-illustration-line" />
        <div className="sf-illustration-line sf-short-line" />
        <span className="sf-offer-chip">
          <Icon name="check" size={13} /> Offer + buyer confirmed
        </span>
      </div>
      <div className="sf-buyer-chip sf-buyer-chip-one">
        <span className="sf-buyer-symbol">A</span>
        <div>
          <strong>Example studio</strong>
          <span>Available contact · Unverified</span>
        </div>
        <Icon name="arrow" size={16} />
      </div>
      <div className="sf-buyer-chip sf-buyer-chip-two">
        <span className="sf-buyer-symbol">B</span>
        <div>
          <strong>Example clinic</strong>
          <span>Review before approaching</span>
        </div>
        <Icon name="arrow" size={16} />
      </div>
      <span className="sf-scene-tag">
        <Icon name="target" size={14} /> A starting point for a real
        conversation
      </span>
    </div>
  );
}

function MessageScene() {
  return (
    <div className="sf-illustration sf-illustration-message" aria-hidden="true">
      <div className="sf-paper-shadow" />
      <div className="sf-letter">
        <div className="sf-letter-heading">
          <span className="sf-mini-icon">
            <Icon name="mail" size={22} />
          </span>
          <span>Your introduction</span>
          <span className="sf-letter-dot" />
        </div>
        <div className="sf-letter-line sf-letter-fact">
          <span>01</span>
          <p>One specific company fact.</p>
          <span className="sf-letter-highlight" />
        </div>
        <div className="sf-letter-line sf-letter-offer">
          <span>02</span>
          <p>How your business can help.</p>
          <span className="sf-letter-highlight" />
        </div>
        <div className="sf-letter-line sf-letter-question">
          <span>03</span>
          <p>One easy question to answer.</p>
          <span className="sf-letter-highlight" />
        </div>
        <div className="sf-letter-footer">
          <Icon name="check" size={15} /> Your words. Your approval.
        </div>
      </div>
      <div className="sf-evidence-chip">
        <Icon name="bookmark" size={15} /> Based on saved company facts
      </div>
    </div>
  );
}

function ConversationScene() {
  return (
    <div
      className="sf-illustration sf-illustration-conversation"
      aria-hidden="true"
    >
      <div className="sf-conversation-orbit" />
      <div className="sf-message-bubble sf-message-bubble-out">
        <span>You send</span>
        <p>Would it be useful to talk about fit?</p>
        <Icon name="check" size={14} />
      </div>
      <div className="sf-message-bubble sf-message-bubble-in">
        <span>A reply you add</span>
        <p>Let&apos;s find a time to talk.</p>
        <span className="sf-bubble-dot" />
      </div>
      <div className="sf-meeting-chip">
        <span className="sf-mini-icon">
          <Icon name="clock" size={24} />
        </span>
        <div>
          <strong>A meeting to follow through</strong>
          <span>You record the time and outcome</span>
        </div>
      </div>
      <span className="sf-scene-tag">
        Fictional conversation · Illustration only
      </span>
    </div>
  );
}

const benefits = [
  "Less tab switching",
  "A personal first message",
  "Your approval, every time",
  "A next step to come back to",
  "Conversations in context",
  "Outcomes you can follow",
];

export function LandingMarketing() {
  const [scene, setScene] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const selectScene = (index: number) => {
    setScene(index);
    setAnnouncement(
      `Illustration ${index + 1} of ${scenes.length}: ${scenes[index].label}`,
    );
  };
  return (
    <LandingMotionProvider>
      <section
        className="sf-workflow sf-shell sf-marketing-workflow"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <div className="sf-section-intro">
          <p className="sf-kicker">
            Your business. Your next customer. One connected journey.
          </p>
          <h2 id="workflow-title">
            Finding a lead is the start.
            <br />
            <span>Build on what happens next.</span>
          </h2>
          <p>
            From the first business you discover to the meeting you follow
            through, keep the people, the message and the next step together.
          </p>
        </div>
        <section
          className="sf-walkthrough"
          aria-roledescription="carousel"
          aria-label="Illustrated customer journey"
        >
          <div className="sf-tour-toolbar">
            <span>
              <span className="sf-tour-dot" /> See the journey, one step at a
              time
            </span>
            <MotionToggle />
          </div>
          <div className="sf-tour-layout">
            <ol
              className="sf-tour-story"
              aria-label="Customer acquisition journey"
            >
              {scenes.map((item, index) => (
                <li key={item.label}>
                  <button
                    type="button"
                    aria-pressed={scene === index}
                    aria-controls="customer-journey-illustration"
                    onClick={() => selectScene(index)}
                  >
                    <span className="sf-tour-number">0{index + 1}</span>
                    <span className="sf-tour-step-content">
                      <span className="sf-tour-label">{item.label}</span>
                      <strong>{item.title}</strong>
                      <span className="sf-tour-copy">{item.copy}</span>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                </li>
              ))}
            </ol>
            <div className="sf-tour-visual-stack">
              <div
                className="sf-tour-back-card sf-tour-back-card-two"
                aria-hidden="true"
              />
              <div
                className="sf-tour-back-card sf-tour-back-card-one"
                aria-hidden="true"
              />
              <div
                className="sf-tour-canvas"
                id="customer-journey-illustration"
                role="group"
                aria-label={`${scenes[scene].label} illustration`}
              >
                <span className="sf-illustration-badge">
                  Illustrative workflow · not live results
                </span>
                <div className="sf-scene-frame" key={scene}>
                  {scene === 0 ? (
                    <BuyerScene />
                  ) : scene === 1 ? (
                    <MessageScene />
                  ) : (
                    <ConversationScene />
                  )}
                </div>
                <p className="sf-tour-caption">{scenes[scene].caption}</p>
              </div>
              <div className="sf-tour-controls">
                <button
                  type="button"
                  aria-label="Previous journey illustration"
                  onClick={() =>
                    selectScene((scene + scenes.length - 1) % scenes.length)
                  }
                >
                  <span aria-hidden="true">←</span>
                </button>
                <span aria-hidden="true">
                  0{scene + 1} <span>/ 03</span>
                </span>
                <button
                  type="button"
                  aria-label="Next journey illustration"
                  onClick={() => selectScene((scene + 1) % scenes.length)}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
          <p className="sf-sr-only" role="status" aria-live="polite">
            {announcement}
          </p>
        </section>
        <p className="sf-tour-under-note">
          You approve every message. You send from your own email tool.
        </p>
      </section>
      <section
        className="sf-momentum-section"
        id="your-list"
        aria-labelledby="list-title"
      >
        <div className="sf-benefit-marquee" aria-hidden="true">
          <div className="sf-benefit-track">
            {[...benefits, ...benefits].map((benefit, index) => (
              <span key={`${benefit}-${index}`}>
                <Icon name="spark" size={16} />
                {benefit}
              </span>
            ))}
          </div>
        </div>
        <div className="sf-shell sf-momentum-grid">
          <div className="sf-momentum-copy">
            <p className="sf-kicker">Make progress in the time you have</p>
            <h2 id="list-title">
              A next step.
              <br />
              <span>Not another tool to manage.</span>
            </h2>
            <p>
              Your work should still make sense when you come back tomorrow.
              Pick up the reply to answer, the message to approve or the meeting
              to update, with the business context beside it.
            </p>
            <ul>
              <li>
                <Icon name="check" size={16} /> Saved work you can reopen
              </li>
              <li>
                <Icon name="check" size={16} /> Follow-ups that stay on your
                radar
              </li>
              <li>
                <Icon name="check" size={16} /> Meetings and customer outcomes
                kept separate
              </li>
            </ul>
            <a className="sf-text-link" href="#main-content">
              Start with your website <Icon name="arrow" size={18} />
            </a>
          </div>
          <div className="sf-momentum-art" aria-hidden="true">
            <div className="sf-momentum-ring" />
            <div className="sf-momentum-center">
              <Icon name="bookmark" size={28} />
              <strong>Your next step</strong>
              <span>Right where you left it.</span>
            </div>
            <div className="sf-momentum-token sf-token-reply">
              <Icon name="mail" size={17} />
              <span>Answer a reply</span>
            </div>
            <div className="sf-momentum-token sf-token-approve">
              <Icon name="check" size={17} />
              <span>Review a message</span>
            </div>
            <div className="sf-momentum-token sf-token-meeting">
              <Icon name="clock" size={17} />
              <span>Update a meeting</span>
            </div>
            <span className="sf-momentum-label">
              An illustration of the workflow
            </span>
          </div>
        </div>
      </section>
      <section
        className="sf-availability sf-shell"
        aria-label="Current availability"
      >
        <Icon name="info" size={17} />
        <p>
          <strong>What you can use today:</strong> search for up to five
          businesses in the current test, review AI introductions, and manually
          record sends, replies and meetings. Searches may return fewer than
          five businesses; email availability varies. A connected inbox and
          automatic sending are not available.
        </p>
      </section>
    </LandingMotionProvider>
  );
}
