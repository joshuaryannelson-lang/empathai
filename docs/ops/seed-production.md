# Seeding Production Demo Data

## Quick Start

```bash
SUPABASE_ENV=production SUPABASE_PROJECT_REF=<your-project-ref> ./scripts/seed-demo-accounts.sh
```

The script will:
1. Prompt for confirmation before touching production
2. Execute `supabase/seed-demo.sql` against the production DB
3. Verify that `TEST-0000` join code exists and is unredeemed
4. Print PASS/FAIL result

## What Gets Seeded

| Table       | Records                                                  |
|-------------|----------------------------------------------------------|
| practice    | Sunrise Wellness Center, Harbor Mental Health             |
| therapists  | Dr. Demo (demo-therapist-01)                             |
| patients    | Alex, Jordan, Sam (first names only — no PHI)            |
| cases       | 3 active cases linked to demo-therapist-01               |
| checkins    | 7 synthetic check-ins with mood scores                   |
| goals       | 5 synthetic treatment goals                              |
| join_codes  | TEST-0000 → EMP-DEMO01, expires 2099, unredeemed         |

## Re-Running Safely

The seed is idempotent:
- Uses `ON CONFLICT ... DO UPDATE` for entities with stable IDs
- Uses `DELETE ... WHERE case_id IN (...)` before inserting checkins/goals
- Deletes existing `TEST-0000` before re-inserting (handles UNIQUE constraint on code)

## Prerequisites

- `supabase` CLI installed (`npx supabase --version`)
- Or `DATABASE_URL` env var set for psql fallback
- `SUPABASE_PROJECT_REF` required for production runs

## Troubleshooting

**TEST-0000 returns "Code not found"**: Re-run the seed script. The most common cause is the seed not having been applied after a migration or DB reset.

**Seed fails with unique constraint error**: The `DELETE FROM join_codes WHERE code = 'TEST-0000'` should prevent this. If it persists, check for foreign key constraints on the join_codes table.
