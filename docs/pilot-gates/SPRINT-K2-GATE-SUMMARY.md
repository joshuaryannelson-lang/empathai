# Sprint K-2 Pilot Gate Summary

| Gate      | Description                    | Status |
|-----------|--------------------------------|--------|
| GATE-001  | Supabase preview environment   | ✅      |
| GATE-002  | Backup verification            | ✅      |
| GATE-003  | Branch protection on main      | ✅      |
| GATE-004  | MFA enforcement                | ⚠️      |

## Gate Details

### GATE-001 — Supabase Preview Environment ✅
- Preview DB script verified (`scripts/setup-preview-db.sh`)
- Schema parity guaranteed via Supabase branching (same migrations)
- Production isolation confirmed (separate DB URL per preview)
- RLS spot-checks: 3/3 pass
- Seed data present, synthetic only — no real patient data

### GATE-002 — Backup Verification ✅
- PITR enabled on production project
- Automated daily backup check (`scripts/verify-backup.sh`, GitHub Actions cron)
- Retention: 7 days (Supabase Pro default, meets minimum)
- Restore procedure documented with integrity checks

**GATE-002 RELEASE-MANAGER SIGN-OFF — 2026-03-07**

### GATE-003 — Branch Protection on main ✅
- All protection rules active: PR required (1 approval), status checks (`vercel-deploy`, `test-suite`), admin enforcement, no force-push, no deletion
- Vercel webhook registered and triggering on production deploys
- No direct pushes to main permitted

### GATE-004 — MFA Enforcement ⚠️
- **Application-level MFA**: ✅ Enforced (TOTP for manager accounts on /admin routes)
- **Infrastructure MFA**: ⚠️ Three manual steps pending confirmation:
  1. **GitHub** — Org Owner must confirm 2FA requirement is enabled in org settings
  2. **Supabase** — Org Owner must confirm MFA requirement is enabled in org settings
  3. **Vercel** — Team Owner must confirm 2FA requirement is enabled in team settings

**Resolution owner**: Infrastructure Org/Team Owners (see `docs/pilot-gates/GATE-004.md` for specific dashboard paths)

These are org-level admin settings that cannot be verified programmatically from within the repository. Each Owner should confirm and attest.

## PHI Guardrails — Verified Across All Gates
- No patient last names, DOB, email, or phone in any UI or log output
- Case codes never appear alongside identifying information
- RLS enforced at DB layer across production and preview
- Demo seed data is synthetic only — never touches real patient rows
- Console logging in portal routes now uses `safeLog` with PHI redaction

---

**Sprint K-2 pilot gates: 3 of 4 fully closed. GATE-004 requires manual infrastructure MFA confirmation by Org/Team Owners before pilot launch is unblocked.**
