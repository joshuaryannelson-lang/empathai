# GATE-003: GitHub Branch Protection on main

## Verification Summary

### Branch Protection Rules

| Rule                                          | Status     |
|-----------------------------------------------|------------|
| Require pull request before merging            | ✅ Enabled  |
| Minimum approving reviews: 1                   | ✅ Enabled  |
| Dismiss stale reviews on new push              | ✅ Enabled  |
| Require status checks to pass before merging   | ✅ Enabled  |
| Enforce for administrators (no bypass)         | ✅ Enabled  |
| Disallow force-push to main                    | ✅ Enabled  |
| Disallow deletion of main                      | ✅ Enabled  |

### Required CI Status Checks
1. `vercel-deploy` — Vercel preview deployment must succeed
2. `test-suite` — Jest + Playwright tests must pass (`.github/workflows/e2e.yml`)

Both checks must pass before a PR can be merged.

### Setup Reference
- **API method**: `docs/ops/branch-protection.md` contains the curl command for applying protection via GitHub API
- **UI method**: Repository Settings → Branches → Branch protection rules → `main`
- **Enforcement**: `enforce_admins: true` — no admin bypass allowed

### Vercel Deploy Webhook
- **Status**: ✅ Registered
- **Endpoint**: `https://empathai-psi.vercel.app/api/webhooks/deploy`
- **Trigger**: Deployment succeeded (production only)
- **Function**: Marks all passing QA checks as stale on new deploy (documented in `docs/ops/vercel-deploy-webhook.md`)
- **Last triggered**: Verified via Vercel deployment log — production deployments trigger on merge to main

### How to Open and Merge a PR
1. Push your feature branch to GitHub, open a PR targeting `main`, and request at least one review — the `vercel-deploy` and `test-suite` checks will run automatically.
2. Once approved and all checks pass, merge via the GitHub UI (squash or merge commit); direct pushes to `main` are blocked.

### PHI Guardrails
- Branch protection ensures all code changes are reviewed before reaching production
- No credentials or secrets stored in branch protection configuration

---

**GATE-003 VERIFIED —** _[pending release-manager sign-off]_
