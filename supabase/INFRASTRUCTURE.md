# Infrastructure — EmpathAI

## Hosting

| Layer | Provider | Details |
|-------|----------|---------|
| Frontend + API | Vercel | Next.js 16 App Router, Edge middleware |
| Database | Supabase (hosted) | PostgreSQL 15, Row-Level Security |
| AI | Anthropic API | claude-sonnet-4-6, max_tokens: 400 |
| Auth | Supabase Auth + custom JWT | Supabase for therapists/managers, jose HS256 JWT for patients |

## Environment Variables

| Variable | Scope | Secret? |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | No (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | YES |
| `ANTHROPIC_API_KEY` | Server only | YES |
| `PATIENT_JWT_SECRET` | Server only | YES — required for patient portal auth |

### Local scripts only (not needed in Vercel)

These are used by `scripts/outreach/` tooling and are **not** required for the production application.

| Variable | Used by |
|----------|---------|
| `GOOGLE_PLACES_API_KEY` | `scripts/outreach/google-maps-scraper.js` |
| `APOLLO_API_KEY` | `scripts/outreach/email-enrichment.js` |

Server-only secrets must NEVER be prefixed with `NEXT_PUBLIC_`.

## Encryption

### At rest
- Supabase encrypts all data at rest using AES-256 (managed by the platform)
- Vercel does not persist application data (stateless functions)

### In transit
- All Supabase connections use TLS 1.2+
- Vercel enforces HTTPS on all routes
- Anthropic API uses TLS 1.2+

### PHI handling
- Patient tokens contain only `case_code` (no name, DOB, or PII)
- AI audit logs store `input_hash` (SHA-256 of prompt), never raw prompts
- AI output stored as `output_summary` (first 100 chars only)
- Portal audit log stores `event`, `case_code`, `ip`, `metadata` (checkin_id, score)
- No PHI in Vercel function logs (no `console.log` of patient data)

## Row-Level Security (RLS)

30 RLS policies across 8 tables. Key design:
- Patient check-ins enforced via `auth.case_code()` custom helper
- Service role restricted to 2 permitted uses: case_code resolution + audit writes
- All patient-facing queries use anon key + patient JWT

## Rate Limiting

| Endpoint | Limit | Window | Method |
|----------|-------|--------|--------|
| `/api/portal/join` | 5 attempts/IP | 1 hour | DB table (`join_code_attempts`) |
| `/api/portal/checkin` | 10 requests/case_code | 1 hour | In-memory sliding window |
| `/api/cases/[id]/session-prep` (POST) | 20 AI calls/practice | 24 hours | In-memory sliding window |

## MFA

- TOTP only (no SMS) — enabled via Supabase Dashboard
- Enforced for `role=manager` on `/admin/*` routes
- See `supabase/MFA_CONFIG.md` for details

## Monitoring

- `/api/health` — uptime check (Supabase connectivity + API key config)
- `/api/status` — AI service dashboard (aggregate metrics, cost tracking, $25 budget ceiling)
- Latency logging on AI endpoints via `console.log` (structured, no PHI)

## Manual Verification Needed

These items cannot be automated and must be confirmed in dashboards:

1. **Vercel**: Environment variables are set per-environment (Production vs Preview)
2. **Vercel**: `main` branch is the production branch
3. **Supabase Dashboard**: MFA (TOTP) is enabled under Authentication > Configuration
4. **Supabase Dashboard**: SSL enforcement is ON
5. **GitHub**: Branch protection on `main` (require PR reviews)
