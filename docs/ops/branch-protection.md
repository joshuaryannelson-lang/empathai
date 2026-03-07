# GitHub Branch Protection — main

## Required Settings

### Pull Request Reviews
- Require at least **1 approving review** before merge
- Dismiss stale reviews on new pushes

### Required Status Checks
- `vercel-deploy` — Vercel preview deployment must succeed
- `test-suite` — Jest + Playwright tests must pass (from `e2e.yml` workflow)
- Both must be marked as **required** (block merge on failure)

### Branch Restrictions
- **Disallow force-push** to `main`
- **Disallow deletion** of `main`

## Setup via GitHub API

An admin with a Personal Access Token (repo scope) can apply protection:

```bash
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/OWNER/empathai/branches/main/protection" \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["vercel-deploy", "test-suite"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 1,
      "dismiss_stale_reviews": true
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

Replace `OWNER` with the GitHub organization or username.

## Setup via GitHub UI

1. Go to repository Settings > Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Enable:
   - Require a pull request before merging (1 approval)
   - Require status checks to pass (add: vercel-deploy, test-suite)
   - Do not allow force pushes
   - Do not allow deletions
5. Save changes
