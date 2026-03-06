# Runbook: Deployment

## Standard Deployment (Vercel)

Merging to `main` triggers automatic deployment.

### Pre-deploy checklist
- [ ] All tests pass: `npx jest --forceExit`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No secrets in diff: `git diff --cached | grep -i "sk-\|password\|secret"` (should be empty)
- [ ] `PATIENT_JWT_SECRET` is set in Vercel Production environment variables (required for patient portal auth)

### Deploy process
1. Create PR against `main`
2. Review changes (require at least 1 approval if branch protection is on)
3. Merge PR — Vercel auto-deploys
4. Verify: `curl https://<domain>/api/health` returns `{"status":"healthy"}`

### Rollback
1. Go to Vercel Dashboard > Deployments
2. Find the last known good deployment
3. Click "..." > "Promote to Production"
4. Verify health endpoint

## Database Migrations

Migrations live in `supabase/migrations/`. They are applied manually.

### Apply a migration
```bash
# Connect to Supabase SQL Editor (Dashboard > SQL Editor)
# Paste the migration SQL and run
```

### Rollback a migration
- There are no auto-rollback scripts. Write a reverse migration manually.
- Test the reverse migration on a branch/preview database first.

## Environment Variable Changes

1. Go to Vercel Dashboard > Settings > Environment Variables
2. Update the variable for the correct environment (Production / Preview / Development)
3. Redeploy: Vercel Dashboard > Deployments > latest > "..." > Redeploy
4. Verify: `curl https://<domain>/api/health`

## Supabase MFA Changes
See `supabase/MFA_CONFIG.md` for TOTP configuration steps.

<!-- Environment variables last verified: 2026-03-05 -->
