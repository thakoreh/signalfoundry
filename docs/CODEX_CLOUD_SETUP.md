# SignalFoundry Codex Cloud setup and approval checklist

This is a repository handoff, not evidence that a Codex Cloud environment has been created or that GitHub/Coolify protection is enabled. The repo is public; do not place provider credentials in Codex tasks or GitHub issues.

## 1. Create and publish the environment in Codex (owner action)

1. Sign in to ChatGPT on web or desktop. Go to Codex and choose Work in Cloud > Select environment > Create environment (or Settings > Codex Cloud > Environments).
2. Connect/authorize the GitHub account and select ONLY thakoreh/signalfoundry.
3. Let Codex inspect the repository and propose an installation/startup configuration.
4. Ensure Python 3.12 and Node.js 24 are available. Use bash scripts/setup.sh for dependency installation.
5. For verification use bash scripts/check.sh. Stop development servers first; the full suite uses local ports. If needed for UI work, install Chromium with cd frontend && npx playwright install --with-deps chromium and run npm run test:browser.
6. Avoid provisioning Clerk, Convex, Stripe or Coolify accounts for ordinary coding tasks. Do not expose live credentials or production networks to the environment.
7. Test the environment with a read-only inspection or small unit-test task, inspect its report, then Publish. Existing tasks will keep their current workspace; start a new task after environment changes.

Read AGENTS.md before starting tasks. Codex can implement changes and prepare PRs, but cannot be treated as the person authorizing merge/deploy.

## 2. Protect main in GitHub (repository admin action)

Go to repository Settings > Rules > Rulesets and create an active branch ruleset targeting main. Recommended settings:

- Require a pull request before merging.
- Require one human approving review, dismiss stale approvals after new commits, and require approval of the latest reviewable push.
- Require all conversations resolved.
- Require passing CI status checks from .github/workflows/verify.yml. Confirm exact job status names after a PR CI run; currently the defined job names are source-checks and container-checks.
- Block force pushes and branch deletion. Do not permit automated agents or broad administrative bypass.
- Do not enable automatic merging.

Important: GitHub does not permit authors to approve their own PRs. On a single-developer repository, a required review by another person means inviting a trusted second reviewer. If you remain the sole reviewer, use the manual owner-merge gate, but understand that this is a procedural policy, not an independently enforced second-person approval.

Existing repository ruleset access may differ from branch-protection access; verify any separate legacy branch protection rule in Settings. No repository admin protection was modified by this PR.

## 3. Protect deployments separately (hosting admin action)

- Keep production deployments manual until separate approval is configured.
- If using GitHub Actions for production deployment, create a production Environment with required human reviewers and reference it on the deploy job (environment: production). Apply restrictions to the permitted deployment branches and prevent self-review where appropriate.
- If Coolify automatically deploys whenever main changes, disable or gate that automatic deployment in Coolify. GitHub Environment reviewers DO NOT block an external Coolify webhook or direct Git-based redeploy.
- Never expose production API credentials to test workflows or Codex Cloud. Use scoped, environment-specific credentials only after review.
- Do not treat a green CI build or a merged PR as deployment authorization.

## 4. Scheduled checks

- Existing Verify release candidate workflow runs on pull requests and pushes to main.
- New .github/workflows/scheduled-security.yml performs a read-only weekly production-dependency audit each Monday at 13:00 UTC after this PR is merged into the default branch. It does not publish code, open PRs, or deploy.
- Inspect Actions failures and security findings manually, or create a separate scheduled ChatGPT task to monitor PRs and reports using the connected GitHub app.
- GitHub scheduled workflows are best effort; they may be delayed and can be disabled after repository inactivity. Security signals must still be reviewed by a human.

## 5. Starter Codex Cloud assignment

Repository: thakoreh/signalfoundry
Base branch: main

"Read AGENTS.md and the existing documentation. Investigate the current lack of automatic prospect discovery, and produce a concrete incremental implementation plan with acceptance criteria, source-compliance safeguards, evaluation/testing strategy and rollout flags. Do not claim the feature is already implemented. Do not deploy, modify billing/auth configuration, contact real prospects or add paid lead-data dependencies. Start with an isolated, small, test-covered implementation increment on a feature branch and prepare a DRAFT pull request with actual test results and outstanding risks. Do not merge or deploy."

## 6. Human PR review checklist

- Scope matches an issue or task and the change can be rolled back.
- Verify CI has passed on the latest commit; independently review security, tenant isolation, SSRF checks, data handling and billing/auth impact.
- Check screenshots for UI changes; validate tests, evidence and documentation.
- Explicitly approve and merge only after the review; subsequently approve any production deployment separately.

Status: setup instructions and proposed repository defaults only; connecting/publishing Codex Cloud and enforcing GitHub or Coolify settings require account-owner action.

