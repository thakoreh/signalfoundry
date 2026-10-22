# Shader poster and shared theme — October 22, 2026

Owner scope: real OGL Flowmap poster distortion and Paper GrainGradient on the landing page, with a consistent site theme. The effects must make sense for Clientrove. This supersedes the old forest/cream palette for visual styling only. The broad release goal remains paused; no sending, providers or product capabilities were added.

The original typographic poster says “Less search. More hello.” beside the website-first form. Its caption explains the actual manual-assisted flow: AI drafts, founder reviews and sends. Only the decorative lettering distorts under a fine desktop pointer; controls, business records and message editors never distort. A pearl/lilac/ink token palette carries through existing landing, setup, leads, outreach, Settings, auth appearance, favicon and social card. Semantic warning/error/contact status colors remain separate.

## Implementation and boundaries

- OGL 1.0.11 (Unlicense), pinned. A 128px Flowmap displaces the transparent original typographic canvas; max render area 600,000 pixels. It renders on pointer input and at most 48 decay frames, with no perpetual idle loop.
- Paper shaders 0.0.82 (Apache-2.0), pinned. Actual GrainGradient with subtle lilac/peach/blue colors, capped at 280,000 pixels. Low-power contexts. No new service or subscription.
- Both follow the existing shared pause, reduced-motion and visibility controls. Offscreen work stops; phones/coarse pointers use static treatment. Missing/failed/lost GPU contexts retain readable HTML and solid background. Async effects are cancelled/disposed on unmount.
- Heavy libraries load dynamically. Paper's built-in style marker uses the existing CSP nonce; canvas layout is in bundled CSS. CSP was not loosened.
- Licenses/notices are retained in `frontend/public/licenses/`. No third-party poster artwork or customer proof was copied.

## Current evidence

187 component tests across 27 files PASS, including 13 new shader lifecycle tests. Nonincremental TypeScript and focused ESLint PASS. The first test run exposed an intermediate dynamic-module mock issue; the component now imports only the lightweight controller module and that module retains the heavyweight lazy library imports. Existing 174 cases are unchanged.

The connected Chrome outage is resolved after the owner's reconnect. Production build and fresh rendered desktop/390/320 verification are next. This document does not claim current shader visual acceptance, provider acceptance, or production readiness. Root `design-qa.md` will record the actual final outcome and screenshots.

## Primary references

- [Paper GrainGradient](https://shaders.paper.design/grain-gradient), including speed zero and pixel limits.
- [Paper source and Apache license](https://github.com/paper-design/shaders).
- [OGL Flowmap example](https://github.com/oframe/ogl/blob/master/examples/mouse-flowmap.html) and [OGL source/license](https://github.com/oframe/ogl).

These establish the native effects and API contract, not a claim of pixel cloning or a new product capability. Dependency audit findings must be reported separately from shader functionality.
