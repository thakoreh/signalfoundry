"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  normalizeBusinessWebsite,
  saveBusinessIntake,
} from "../lib/business-intake";
import { Icon } from "./icons";

export const BUSINESS_SIGN_UP = "/sign-up?redirect_url=/workspace/setup";

export function LandingIntake() {
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function continueToSetup(intent: { website: string } | { manual: true }) {
    if (opening) return;
    try {
      saveBusinessIntake(intent);
      setError("");
      setOpening(true);
      router.push(BUSINESS_SIGN_UP);
    } catch {
      setOpening(false);
      setError(
        "We couldn’t keep your details for the next step. Please try again, or sign up above and enter them there.",
      );
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (opening) return;
    const normalized = normalizeBusinessWebsite(website);
    if (!normalized) {
      setError("Enter a public business website, like example.com.");
      input.current?.focus();
      return;
    }
    continueToSetup({ website: normalized });
  }

  return (
    <div className="sf-intake">
      <form
        className="sf-intake-form"
        action="/sign-up"
        method="get"
        onSubmit={submit}
        noValidate
        aria-label="Start with your business website"
      >
        <input type="hidden" name="redirect_url" value="/workspace/setup" />
        <label htmlFor="business-website">Your business website</label>
        <div
          className={`sf-intake-field${error ? " sf-intake-field--error" : ""}`}
        >
          <Icon name="globe" size={21} />
          <input
            ref={input}
            id="business-website"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Your website, e.g. example.com"
            value={website}
            maxLength={2048}
            disabled={opening}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? "website-error website-hint" : "website-hint"
            }
            onChange={(event) => {
              setWebsite(event.target.value);
              if (error) setError("");
            }}
          />
          <button
            className="sf-button sf-button-dark sf-analyze-button"
            type="submit"
            disabled={opening}
          >
            {opening ? "Opening setup…" : "Get started"}
            <Icon name="arrow" size={18} />
          </button>
        </div>
        {error && (
          <p id="website-error" className="sf-intake-error" role="alert">
            {error}
          </p>
        )}
        <p id="website-hint" className="sf-intake-hint">
          Create your account, then review your business profile before
          searching.
        </p>
      </form>
      <button
        type="button"
        className="sf-manual-option"
        disabled={opening}
        onClick={() => continueToSetup({ manual: true })}
      >
        No website? <span>Enter your business details manually</span>
        <Icon name="arrow" size={15} />
      </button>
      <noscript>
        <p className="sf-intake-hint">
          JavaScript keeps your website ready for the next step. You can still
          sign up and enter it there.
        </p>
      </noscript>
    </div>
  );
}
