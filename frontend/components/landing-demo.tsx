"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useLandingMotion } from "./landing-motion-provider";

export const RESEARCH_STAGES = [
  {
    label: "Define the ICP",
    short: "ICP",
    title: "Start with a clear point of view.",
    description:
      "Tell the workspace what a good-fit company looks like. Your brief guides the review.",
  },
  {
    label: "Import accounts",
    short: "Import",
    title: "Bring the companies you want to understand.",
    description:
      "Paste company domains or import a CSV. You choose the accounts; the workspace keeps the research together.",
  },
  {
    label: "Review evidence",
    short: "Evidence",
    title: "See the reason. Check the source.",
    description:
      "Read the public website observations alongside the unknowns. An explanation is more useful than a score alone.",
  },
  {
    label: "Shortlist or export",
    short: "Shortlist",
    title: "Keep the account. Keep the why.",
    description:
      "Make a human-reviewed decision, then carry the evidence into a draft or CSV export in your workspace.",
  },
] as const;

function Tick() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

export default function LandingDemo() {
  const [active, setActive] = useState(0);
  const [shortlisted, setShortlisted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const playPointerIntent = useRef<boolean | null>(null);
  const { motionAllowed, reduced, paused } = useLandingMotion();
  const running = playing && motionAllowed && inView && !hovered;

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.35);
      },
      { threshold: [0, 0.35] },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setActive((index) => (index + 1) % RESEARCH_STAGES.length);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [active, running]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = RESEARCH_STAGES[active];
  const select = (next: number, focus = false) => {
    const index = (next + RESEARCH_STAGES.length) % RESEARCH_STAGES.length;
    setPlaying(false);
    setActive(index);
    if (focus) tabs.current[index]?.focus();
  };
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + 1) % RESEARCH_STAGES.length;
    if (event.key === "ArrowLeft")
      next = (index + RESEARCH_STAGES.length - 1) % RESEARCH_STAGES.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = RESEARCH_STAGES.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    setPlaying(false);
    if ((event.target as Element).closest("a, button, input, summary")) return;
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      select(active + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <div
      ref={root}
      className="sf-demo"
      role="region"
      aria-roledescription="carousel"
      aria-label="Research walkthrough"
      data-playing={running}
      data-active-step={active}
      onPointerDown={(event) => {
        if (event.isPrimary && event.button === 0) setPlaying(false);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        pointer.current = null;
      }}
      onFocusCapture={() => setPlaying(false)}
    >
      <div className="sf-demo-topbar">
        <div className="sf-demo-workspace">
          <span className="sf-mini-mark" aria-hidden="true">
            S
          </span>
          <strong>Research workspace</strong>
          <span className="sf-demo-divider" aria-hidden="true">
            /
          </span>
          <span>Services-led teams</span>
        </div>
        <span className="sf-sample-badge">Illustrative example</span>
      </div>
      <div
        className="sf-demo-tabs"
        role="tablist"
        aria-label="Research walkthrough"
      >
        {RESEARCH_STAGES.map((item, index) => (
          <button
            key={item.label}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            id={`research-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`research-panel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="sf-tab-number" aria-hidden="true">
              0{index + 1}
            </span>
            <span className="sf-tab-label">{item.label}</span>
            <span className="sf-tab-short" aria-hidden="true">
              {item.short}
            </span>
            {active === index && (
              <span
                key={`${active}-${running}`}
                className="sf-tab-progress"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
      <div
        className="sf-demo-viewport"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        <div
          className="sf-demo-track"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {RESEARCH_STAGES.map((item, index) => (
            <div
              key={item.label}
              className="sf-demo-panel"
              id={`research-panel-${index}`}
              role="tabpanel"
              aria-labelledby={`research-tab-${index}`}
              tabIndex={active === index ? 0 : -1}
              aria-hidden={active !== index}
              inert={active !== index}
            >
              <div className="sf-demo-explanation">
                <span className="sf-overline">
                  0{index + 1} / THE RESEARCH PROCESS
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="sf-demo-assurance">
                  <span className="sf-status-dot" aria-hidden="true" />
                  {index === 0
                    ? "The brief stays editable"
                    : index === 1
                      ? "Research starts with your inputs"
                      : index === 2
                        ? "Source: homepage · saved public research"
                        : "Your judgment stays in the loop"}
                </div>
              </div>
              <div className="sf-demo-canvas">
                {index === 0 && (
                  <div className="sf-brief-card">
                    <div className="sf-ui-card-title">
                      <span className="sf-ui-icon" aria-hidden="true">
                        ↗
                      </span>
                      <span>Ideal customer profile</span>
                      <span className="sf-tag">Example brief</span>
                    </div>
                    <dl className="sf-brief-fields">
                      <div>
                        <dt>WHO WE’RE LOOKING FOR</dt>
                        <dd>Services-led B2B teams</dd>
                      </div>
                      <div>
                        <dt>WHAT WE WANT TO UNDERSTAND</dt>
                        <dd>How they build and deliver internal tools</dd>
                      </div>
                      <div>
                        <dt>PUBLIC SIGNALS TO REVIEW</dt>
                        <dd className="sf-brief-chips">
                          <span>Offer</span>
                          <span>Audience</span>
                          <span>Delivery model</span>
                        </dd>
                      </div>
                    </dl>
                    <p className="sf-ui-card-footer">
                      <Tick />A point of view to test, not a conclusion.
                    </p>
                  </div>
                )}
                {index === 1 && (
                  <div className="sf-import-card">
                    <div className="sf-ui-card-title">
                      <span className="sf-ui-icon" aria-hidden="true">
                        ↙
                      </span>
                      <span>Company domains</span>
                      <span className="sf-tag sf-tag-neutral">3 examples</span>
                    </div>
                    <div className="sf-domain-list">
                      <div>
                        <span>01</span>
                        <strong>lowcode.agency</strong>
                        <Tick />
                      </div>
                      <div>
                        <span>02</span>
                        <strong>airtable.com</strong>
                        <Tick />
                      </div>
                      <div>
                        <span>03</span>
                        <strong>xray.tech</strong>
                        <Tick />
                      </div>
                    </div>
                    <div className="sf-import-foot">
                      <span className="sf-file-icon" aria-hidden="true">
                        CSV
                      </span>
                      <div>
                        <strong>Your list is the starting point</strong>
                        <p>Domain entry or CSV import in the workspace.</p>
                      </div>
                    </div>
                  </div>
                )}
                {index === 2 && (
                  <div className="sf-demo-evidence">
                    <div className="sf-demo-account">
                      <span className="sf-account-token">LA</span>
                      <div>
                        <strong>Lowcode Agency</strong>
                        <span>lowcode.agency</span>
                      </div>
                      <span className="sf-tag">Agency</span>
                    </div>
                    <div className="sf-evidence-excerpt">
                      <span className="sf-overline">
                        SAVED HOMEPAGE SUMMARY
                      </span>
                      <p>Builds custom internal tools for growing teams.</p>
                      <a
                        href="https://www.lowcode.agency/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open public source <span aria-hidden="true">↗</span>
                        <span className="sf-sr-only">
                          {" "}
                          (opens in a new tab)
                        </span>
                      </a>
                    </div>
                    <div className="sf-evidence-interpretation">
                      <div>
                        <span className="sf-overline">REASON TO REVIEW</span>
                        <p>Services-led offer relevant to the example brief.</p>
                      </div>
                      <div>
                        <span className="sf-overline">STILL UNKNOWN</span>
                        <p>Buying intent and verified contacts.</p>
                      </div>
                    </div>
                  </div>
                )}
                {index === 3 && (
                  <div className="sf-shortlist-card">
                    <div className="sf-ui-card-title">
                      <span className="sf-ui-icon" aria-hidden="true">
                        ✓
                      </span>
                      <span>Your shortlist</span>
                      <span className="sf-tag sf-tag-neutral">Sample only</span>
                    </div>
                    <div
                      className={`sf-shortlist-account ${shortlisted ? "is-shortlisted" : ""}`}
                    >
                      <span className="sf-account-token">LA</span>
                      <div>
                        <strong>Lowcode Agency</strong>
                        <p>Services-led · reason attached</p>
                      </div>
                      <span className="sf-shortlist-status">
                        {shortlisted ? "Shortlisted" : "For review"}
                      </span>
                    </div>
                    <button
                      className={`sf-demo-shortlist ${shortlisted ? "is-shortlisted" : ""}`}
                      type="button"
                      aria-pressed={shortlisted}
                      onClick={() => setShortlisted((value) => !value)}
                    >
                      <Tick />
                      {shortlisted
                        ? "Remove from sample shortlist"
                        : "Shortlist this example"}
                    </button>
                    <p className="sf-shortlist-feedback" aria-live="polite">
                      {shortlisted
                        ? "1 sample account shortlisted. Nothing is saved to a workspace."
                        : "Try the decision. This example never saves real accounts."}
                    </p>
                    <div className="sf-export-preview">
                      <span>IN THE WORKSPACE</span>
                      <strong>
                        Review a draft <span aria-hidden="true">↗</span> Export
                        a CSV
                      </strong>
                      <p>The source and reason stay with your account.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sf-demo-bottom">
        <p aria-live={playing ? "off" : "polite"} aria-atomic="true">
          <strong>0{active + 1}</strong>
          <span> / 04</span>
          <span className="sf-demo-current">{stage.label}</span>
        </p>
        <div className="sf-demo-controls">
          <button
            className="sf-demo-play"
            type="button"
            disabled={reduced || paused}
            aria-label={
              playing && !reduced && !paused
                ? "Pause walkthrough"
                : "Play walkthrough"
            }
            title={
              reduced
                ? "Automatic playback is off for reduced motion"
                : paused
                  ? "Resume page motion to enable playback"
                  : "Auto-advances every 7 seconds; pauses while you explore"
            }
            onPointerDown={() => {
              playPointerIntent.current = playing;
            }}
            onPointerCancel={() => {
              playPointerIntent.current = null;
            }}
            onKeyDown={() => {
              playPointerIntent.current = null;
            }}
            onBlur={() => {
              playPointerIntent.current = null;
            }}
            onClick={() => {
              setPlaying(!(playPointerIntent.current ?? playing));
              playPointerIntent.current = null;
            }}
          >
            <span aria-hidden="true">
              {playing && !reduced && !paused ? "Ⅱ" : "▷"}
            </span>
            <span>{playing && !reduced && !paused ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            onClick={() => select(active - 1)}
            aria-label="Previous research step"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onClick={() => select(active + 1)}
            aria-label="Next research step"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <p className="sf-demo-disclaimer">
        A walkthrough of saved public research, not a live account list. No
        accounts are imported, researched, saved, or exported here.
      </p>
      <noscript>
        <div className="sf-no-js">
          <strong>The four-step workflow</strong>
          <ol>
            {RESEARCH_STAGES.map((item) => (
              <li key={item.label}>
                <strong>{item.label}.</strong> {item.description}
              </li>
            ))}
          </ol>
          <p>
            Enable JavaScript to try the interactive example. The product
            explanation and source links below remain available.
          </p>
        </div>
      </noscript>
    </div>
  );
}
