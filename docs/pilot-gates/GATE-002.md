# GATE-002: Backup Verification

## Verification Summary

### Point-in-Time Recovery (PITR)
- **Status**: ✅ Enabled (requires Supabase Pro plan or above)
- **Dashboard path**: Database → Backups → Point-in-Time Recovery
- Supabase Pro plan includes PITR with WAL archiving

### Backup Freshness
- **Verification script**: `scripts/verify-backup.sh`
- **Automated check**: `.github/workflows/backup-check.yml` (daily at 06:00 UTC)
- **Threshold**: Backup must be < 25 hours old
- **Slack alerts**: Configured via `SLACK_WEBHOOK_URL` on failure

### Retention Policy
- **Current setting**: 7 days (Supabase Pro default)
- **Minimum required**: 7 days ✅
- PITR allows restoration to any point within the retention window

### Restore Procedure

1. **Navigate** to Supabase Dashboard → Project → Database → Backups
2. **Select** "Point-in-Time Recovery" tab
3. **Choose** the target restore timestamp (UTC)
4. **Confirm** restoration — Supabase will create a new database branch or restore in-place depending on the option selected
5. **Verify** data integrity after restore (see checks below)

**Alternative (CLI)**:
```bash
# List available backups
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/backups"
```

### Estimated Restore Time
- Small databases (< 1 GB): 5–15 minutes
- Medium databases (1–10 GB): 15–45 minutes
- Based on Supabase documentation; actual times vary by database size and load

### Recovery Point Objective (RPO)
- **Worst case**: Up to 25 hours of data loss (backup check threshold)
- **Typical case with PITR**: Minutes of data loss (WAL-based continuous archiving)
- PITR provides near-zero RPO for point-in-time recovery within the retention window

### Authorized Restore Roles
- Supabase Project Owner
- Supabase Project Admin
- (No individual names listed — roles only)

### Post-Restore Data Integrity Checks
1. **Row counts**: Compare `patients`, `cases`, `checkins` table counts against last known baseline
2. **Recent data**: Verify most recent check-in timestamp is within expected range
3. **RLS enforcement**: Run a quick RLS spot-check (therapist JWT should not see other therapists' cases)

### PHI Guardrails
- Backups contain production data — access restricted to authorized roles only
- Restore operations are logged in Supabase audit trail
- No backup data is exposed to preview environments

---

**GATE-002 VERIFIED —** _[pending release-manager sign-off]_

> ⚠️ This gate requires explicit release-manager sign-off before pilot launch.
