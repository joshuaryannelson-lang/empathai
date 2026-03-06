# Runbook: Cost Management

## Current Budget

| Item | Monthly Estimate | Notes |
|------|-----------------|-------|
| Vercel (Hobby/Pro) | $0 - $20 | Free tier covers pilot; Pro if custom domain needed |
| Supabase (Free/Pro) | $0 - $25 | Free tier: 500MB DB, 50K auth users, 500K edge invocations |
| Anthropic API | $5 - $15 | claude-sonnet-4-6 @ $3/M input + $15/M output, max_tokens: 400 |
| Google Places API | $0 - $5 | $200/mo free credit covers pilot volume |
| **Total (pilot)** | **$5 - $65** | Conservative upper bound |

## Anthropic API Cost Breakdown

Per session-prep call (estimated):
- Input: ~800 tokens (prompt + context) = $0.0024
- Output: ~300 tokens (max 400) = $0.0045
- **Per call: ~$0.007**

Pilot projections (10 therapists, 30 patients):
- 5 session preps/therapist/week = 50 calls/week = 200 calls/month
- **AI cost: ~$1.40/month**

Growth scenario (50 therapists, 200 patients):
- 250 session preps/week = 1000 calls/month
- **AI cost: ~$7.00/month**

## Monitoring

- `/api/status` tracks daily and weekly AI costs with a $25 budget ceiling
- Alert threshold: $20/month projected (shown in status dashboard)

## Cost Reduction Levers

1. **Reduce max_tokens**: Currently 400. Most session preps complete in ~200 tokens.
2. **Cache session preps**: If checkin data hasn't changed, serve cached result.
3. **Rate limit AI calls**: Currently 20/practice/day (see `lib/rateLimit.ts`).
4. **Switch to Haiku**: For lower-stakes operations (task generation, risk classification).

## If Budget is Exceeded

1. Check `/api/status` cost tracking section
2. Identify which service is consuming the most
3. Options:
   - Lower the rate limit in `session-prep/route.ts`
   - Switch to demo mode temporarily (`?demo=true` query param)
   - Rotate API key to a new one with billing limits set in Anthropic Console
