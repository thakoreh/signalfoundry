# Native shader theme QA - October 22, 2026

Scope: owner-requested real OGL Flowmap poster distortion, Paper GrainGradient and a consistent pearl/lilac/ink site theme. Reviewer: implementing agent, not an independent reviewer. Whole-product release remains paused/incomplete.

## Source and comparison contract

Reference captures in `C:/Users/Hiren/Documents/Codex/2026-10-19/https-github-com-thakoreh-signalfoundry-https/work/review-probes/shader-theme-20261022/`:

- `01-paper-reference.png`: official https://shaders.paper.design/grain-gradient, 2545x1264 returned pixels at native Chrome desktop.
- `02-ogl-reference.png`: https://webdev.teknium.io/d/gl/demos/ogl-flowmap-poster/, 2560x1215 returned pixels at native Chrome desktop.

The user asked to use these native effects meaningfully, and allowed changing the site's theme. This is an adaptation, not a pixel clone. Dark source artwork, RGB split and library/debug text are intentionally absent. The poster typography is original Clientrove content, rendered by an actual OGL Flowmap over a transparent canvas; the grain is the actual Paper shader. No source image/logo was replaced with a purportedly faithful handmade illustration. The existing Clientrove logo geometry and product illustrations are retained with new colors.

Full references and implementation03/08/09 were opened together in one image-tool comparison. Reference02 and final repaired18 were also opened together. Source and target dimensions/states differ intentionally: compare texture, restrained pointer distortion, hierarchy and readability rather than pixel equality. No image manipulation/downsampling was applied to the saved files; the image viewer resized large source images for display. All captures have JPEG bytes despite their .png suffix.

## Rendered implementation and states

Actual Next standalone + FastAPI + existing owned fictional SQLite fixture, providers off, loopback3001/API8025. Application checkpoint `0473a85` production webpack build passed and is the running preview. Earlier37fa69c captures show the same UI except the caption repair and nonvisual failed-constructor cleanup. No real model/provider/outreach call, owner database, account connection or production service was used.

| Capture | CSS viewport and state | Returned pixels |
| --- | --- | --- |
| 19-final-desktop-hero.png | 1440x1000, final source, native grain/OGL ready, active | 1425x990 |
| 18-final-desktop-workflow.png | 1440x1000, final caption repair, scene1 | 1425x990 |
| 04-pointer-flow.png | 1440x1000, real pointer events across OGL poster | 1425x990 |
| 05-paused.png | 1440x1000, shared motion paused, HTML poster fallback | 1425x990 |
| 08-phone320-top-reduced.png | 320x844, reduced motion, top/form | 320x844 |
| 09-phone320-poster.png | 320x844, reduced/static poster fully visible | 320x844 |
| 10-phone390-top.png | 390x844, top/form | 390x844 |
| 11-desktop-leads.png | 1440x1000, fictional saved results | 1425x990 |
| 12-desktop-review.png | 1440x1000, exact Echo modal | 1440x1000 |
| 13-phone390-review.png | 390x844, exact Echo modal | 390x844 |
| 14-phone390-setup.png | 390x844, existing seller review | 390x844 |
| 15-phone390-dashboard.png | 390x844, reported fictional activity | 390x844 |
| 16-phone390-settings.png | 390x844, folded data controls | 390x844 |

Device scale factor1; native DPR1. Desktop viewport captures sometimes omit a scrollbar/capture area. Both CSS and returned raster sizes are recorded, with no numerical fidelity claim. Captures06 and07 are valid scrolled details but their filenames misname the state:06 shows form tail/poster,07 shows workflow. They are excluded as top/poster acceptance proof;08/09/10 provide that proof.

Phone widths320/390 and desktop1440 had no page overflow (scrollWidth320/390/1425 respectively). Exact phone modal width390, internal scrollWidth388. Working screens have zero decorative canvases. Text and controls remain static. Native pause changes the shared root state and flow fallback; keyboard Space toggles and Tab reaches the shared workflow toggle. Reduced-motion media emulation removes OGL, keeps a static grain and disables motion toggles. Escape closes the Echo review and restores focus to that company's button. Manual next-scene still works while paused. Offscreen hero reports visualActive=false; returning top reports true with both native contexts ready. App console error readback is empty; extension warnings are unrelated. GPU-unavailable/context-loss/partial-initialization and asynchronous unmount disposal have unit coverage, not a claimed physical-GPU failure test.

## Findings and iteration history

1. [P2, repaired] Workflow caption used a dark translucent background with dark text after palette migration. Evidence17-desktop-workflow.png. Fix at0473a85: .sf-tour-caption uses --surface-tint. Fresh18 is the same1440x1000 scene and visibly restores a light surface. Computed ink#252238 on surface#f2f0f8 is13.63:1. No actionable P0/P1/P2 finding remains in this focused slice.
2. Test harness initially omitted the new runtime file because its suffix was .test.ts rather than the configured .test.tsx. It now participates in the full suite. A mock interception issue was resolved by importing the lightweight controller module directly while retaining lazy heavyweight imports. No preexisting test was weakened. This is test/tooling work, not a visual iteration.

## Required visual surfaces

- Typography: existing system sans for product copy; bold Arial for original poster. Clear three-level hierarchy, readable wraps at320, no serif/type-image substitution or distorted editor text. The poster is decorative and has an accessible descriptive figure label plus real caption.
- Spacing/layout: left website-first form beside a contained poster on desktop; form first and poster below on phones. Existing dense lead rows, native dialog scrolling and44px poster pause target retained. No screenshot-driven layout or invented product dashboard replaces the selling pitch.
- Colors/tokens: pearl#f8f7fb, ink#252238, lilac accent#6652b5 and primary#3d345f shared across pages. Semantic unverified/warning/error distinctions retained. Calculated pairs: muted/paper5.69:1, white/primary11.32:1, accent/paper5.72:1, ink/darkest chosen grain color7.02:1. These are static token checks, not exhaustive animated-pixel contrast certification.
- Image/effect quality: real pinned WebGL libraries, transparent poster texture over actual grain, limited distortion and no source artwork appropriation. Static HTML remains legible when paused/on phones. Full1440 view and320 poster capture resolve type/texture; no extra crop was needed for those details. Original logo remains sharp SVG; not regenerated.
- Copy/content: the poster reinforces moving from search to an introduction. It explicitly says AI drafts, founder reviews and sends; no false automatic outreach, testimonials or outcome metrics added. Existing illustrations stay labelled illustrative.

## Limits and checklist

- [x] Exact application optimized build/typecheck, focused lint;188 component and67 Node tests.
- [x] Fresh real connected Chrome desktop/390/320, pause/reduced/phone fallback, selected-business focus and shared working-page colors.
- [x] Caption defect fixed and recaptured; old component QA archived separately.
- [x] Production npm audit0; six dev-only advisories match the pre-change baseline, not solved by this visual slice.
- [ ] Physical phone, screen reader, true browser200% zoom, live hosted auth/provider acceptance, exhaustive device/GPU performance and whole-product acceptance are not claimed.

Final result: passed
