# SignalFoundry frontend

A responsive, API-driven Next.js + TypeScript research workspace. This is a local development MVP, not a hosted or multi-user production service.

## Run

Use Node.js 22.6+ (verified with Node 24) and npm. Start the backend at `http://127.0.0.1:8000` first, or use the root project `dev.sh` to start both services.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`. The default server binds only to loopback. `API_BASE_URL` overrides the backend used by the `/api/*` rewrite. Never put API keys or other secrets in a `NEXT_PUBLIC_*` variable.

The frontend rejects non-loopback and ambiguous forwarded Host headers before the API rewrite. It is not designed to sit behind a reverse proxy or a public deployment. Next's server-side proxy timeout is 180 seconds to cover bounded synchronous research batches.

## Workflow

1. Analyze a public company website, or enter an ideal-customer profile manually
2. Review the inferred profile and save explicit targeting preferences
3. Create a campaign using up to 10 public business domains or fictional demo fixtures
4. Filter, sort, and search accounts; inspect score components, evidence excerpts, source URLs, publication/retrieval dates, and unknowns
5. Shortlist/dismiss accounts; generate a grounded draft for manual review and copying
6. Download the backend's formula-safe campaign CSV

Every account, status, score, campaign count, contact field, and draft comes from the backend. There is no second frontend fixture dataset. The demo loader replaces the customer profile with a fictional profile and adds a demo campaign; it preserves existing campaigns. All demo views identify their data as fictional. Completed campaigns can be re-researched after profile changes.

Qualification and strong-fit filtering both use the backend threshold of 65. Signal counts use signal evidence records, not generic why-now text. Source counts deduplicate URLs. Company size and geography remain planning context until supported by scoring. Contact enrichment is not connected, and the interface never invents people or email addresses. Outreach is draft-only and never sent.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
```

The Node test suite covers profile token normalization, composable account filters, nonmutating sorting, safe source URLs, unknown dates, qualification thresholds, signal/source counts, stale account-selection updates, and the localhost trust boundary. The root project includes a real HTTP proxy regression covering foreign Host rejection and a 31.25-second upstream response.

## UI implementation

- Dark evergreen navigation with a light research workspace and mint accents
- Desktop and mobile responsive layouts; horizontally scrollable tables on narrow screens
- Native modal dialogs for focus containment and return, Escape/backdrop close, labeled controls, visible keyboard focus, arrow-key detail tabs, reduced-motion support
- Empty, pending, failure, partial-research, and unknown-data states
- Input retention on failed campaign creation/research; disabled profile fields while saving
- Guards against old account requests reopening a closed drawer or overwriting newer navigation
- No hosted fonts, remote images, or analytics scripts

## Remaining validation

The integrated HTTP checks and production build do not replace a browser pass. The available managed browser blocked local navigation, so visual rendering and interactive browser QA have not been verified here. Before release, manually check desktop/mobile layouts; analyze/manual-profile flows; failed and repeated campaign creation; repeated selection of the current campaign; close/change account during a delayed status save; navigate during re-research; keyboard focus and Escape; draft copy; CSV download; and public-source links. There is no claim of an automated browser or WCAG conformance pass.
