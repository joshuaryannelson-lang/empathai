# Runbook: Incident Response

## Triggers
- `/api/health` returns 503
- User reports unable to check in or join
- Vercel alerts on function errors

## Triage (first 5 minutes)

1. **Check health endpoint**: `curl https://<domain>/api/health`
   - If `supabase: error` — Supabase is down, see [Supabase Status](https://status.supabase.com)
   - If `anthropic_key: missing` — env var dropped, redeploy or check Vercel settings

2. **Check Vercel function logs**: Vercel Dashboard > Deployments > Functions > Logs
   - Look for 500 errors, timeout patterns, or repeated 429s

3. **Check Supabase logs**: Supabase Dashboard > Logs > API
   - Look for RLS violations (403), connection pool exhaustion, or query timeouts

## Common Issues

### Patient cannot join (join code rejected)
1. Check `join_code_attempts` table for IP rate limiting (>5/hr)
2. Check `join_codes` table: is the code expired? Already redeemed?
3. If legitimate user locked out: delete their rows from `join_code_attempts`

### Patient cannot submit check-in
1. Verify JWT is valid: check `Authorization` header format
2. Check `cases` table: does the `case_code` exist?
3. Check RLS: the patient JWT must have matching `case_code` claim

### AI session prep returns error
1. Check Anthropic API status
2. Check rate limit: 20 AI calls/practice/day
3. Check `ANTHROPIC_API_KEY` is set in Vercel env

### MFA enrollment stuck
1. Check Supabase Dashboard: is TOTP enabled under Auth > MFA?
2. Check browser console for `mfa.enroll` errors
3. User may need to clear cookies and re-authenticate

## Escalation
- If Supabase is down: wait for platform recovery, no action needed
- If data integrity issue: contact Supabase support, do NOT run manual SQL
- If PHI exposure suspected: immediately revoke affected JWTs by rotating `SUPABASE_SERVICE_ROLE_KEY`
