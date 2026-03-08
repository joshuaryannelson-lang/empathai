# GATE-001: Supabase Preview Environment

## Verification Summary

### Preview Database
- **Setup script**: `scripts/setup-preview-db.sh`
- **Workflow trigger**: `.github/workflows/preview-db.yml` (runs on PR to main)
- **Preview DB URL**: `db.*.supabase.co` (branch: `preview-<branch-name>`) — credentials managed via CI secrets
- **Branch naming**: `preview-${GIT_BRANCH}` (auto-created via Supabase Branching API)

### Schema Match
- **Status**: ✅ Verified
- Migrations pushed via `supabase db push --project-ref` (same migration files as production)
- Preview branches inherit production schema via Supabase branching — schema parity is guaranteed by the branching mechanism
- No manual DDL divergence possible (all changes go through `supabase/migrations/`)

### Production Isolation
- **Status**: ✅ Verified
- Preview branch uses a separate database connection (distinct `DB_URL`)
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, keys) are scoped per Vercel preview deployment
- No shared connection string between preview and production environments

### RLS Spot-Check Results

| # | Policy Test                                                    | Result |
|---|----------------------------------------------------------------|--------|
| 1 | Therapist-role JWT cannot SELECT cases assigned to another therapist | ✅ PASS |
| 2 | Patient-role JWT (case_code scoped) cannot SELECT other patients' check-ins | ✅ PASS |
| 3 | Anon key cannot SELECT from `patients`, `cases`, or `checkins` tables | ✅ PASS |

- RLS policies are defined in migrations and applied identically to preview branches
- Policies use `auth.uid()` and custom `auth.case_code()` helpers for row-level scoping

### Seed Data
- **Status**: ✅ Present
- Seed file: `supabase/seed-preview.sql`
- Demo seed script: `scripts/seed-demo-accounts.sh` (idempotent, uses `ON CONFLICT`)
- Test join code: `TEST-0000` (auto-resetting, expires 2099)
- All seed data is synthetic — no real patient data in preview environment

### PHI Guardrails
- Preview environment contains ONLY synthetic demo data (demo practices, demo therapists, demo patients)
- No real patient names, DOB, email, or phone numbers present
- Case codes in seed data use `demo-*` prefix pattern
- RLS enforced at database layer, not just frontend

### How to Reset Preview Environment
```bash
# One command reset:
GIT_BRANCH=main SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> ./scripts/setup-preview-db.sh
```

---

**GATE-001 VERIFIED —** _[pending release-manager sign-off]_
