# Runbook: Data Access & PHI Safety

## Accessing Patient Data

Patient data is protected by RLS. There is no admin UI for viewing individual patient records.

### Viewing aggregate data
- `/api/status` — AI service metrics, cost tracking (no PHI)
- Supabase Dashboard > Table Editor — requires service role (admin only)

### Investigating a specific case
1. Obtain the `case_code` (never the patient name)
2. In Supabase SQL Editor:
   ```sql
   SELECT id, status, created_at FROM cases WHERE case_code = '<case_code>';
   ```
3. To view check-ins for a case:
   ```sql
   SELECT id, score, created_at FROM checkins WHERE case_id = '<case_id>' ORDER BY created_at DESC LIMIT 10;
   ```

### What NOT to do
- Never export full tables containing patient data
- Never log `case_code` alongside patient names
- Never share Supabase SQL Editor screenshots that show patient data
- Never use `SELECT *` on `checkins` or `cases` — always select specific columns

## Audit Log

The `portal_audit_log` table records:
- `join_code_redeemed` / `join_code_failed` / `join_code_rate_limited`
- `checkin_submitted`

Query recent audit events:
```sql
SELECT event, case_code, ip, metadata, created_at
FROM portal_audit_log
ORDER BY created_at DESC
LIMIT 50;
```

## Rotating Secrets

### Supabase Service Role Key
1. Supabase Dashboard > Settings > API > Service Role Key > Regenerate
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel env (Production + Preview)
3. Redeploy

### Anthropic API Key
1. Anthropic Console > API Keys > Create new key
2. Update `ANTHROPIC_API_KEY` in Vercel env
3. Redeploy
4. Revoke the old key in Anthropic Console

### Patient JWTs
Patient JWTs are signed with `SUPABASE_SERVICE_ROLE_KEY`. Rotating that key invalidates all outstanding patient tokens. Patients will need to re-enter their join code.
