# Vercel Deploy Webhook — QA Staleness

## Overview

On each successful production deploy, all passing QA checks are automatically
marked stale so testers know to re-verify against the new deployment.

## Setup Steps

### 1. Add Environment Variable

In Vercel Dashboard → Project → Settings → Environment Variables:

- **Name:** `DEPLOY_WEBHOOK_SECRET`
- **Value:** Generate a secure random string (`openssl rand -hex 32`)
- **Scope:** Production

### 2. Configure Webhook

In Vercel Dashboard → Project → Settings → Webhooks → Add:

- **Event:** Deployment succeeded (production only)
- **URL:** `https://empathai-psi.vercel.app/api/webhooks/deploy`
- **Secret:** Use the same value as `DEPLOY_WEBHOOK_SECRET`

Note: Vercel sends its own payload — the endpoint treats any valid-secret POST
with no `pages[]` as "mark all passing checks stale".

### 3. How It Works

1. Vercel triggers webhook on successful production deploy
2. Endpoint validates the secret using constant-time comparison
3. All `qa_checks` rows with `status = 'pass'` are marked `stale = true` with `stale_since` timestamp
4. Rows with `status = 'fail'` are never touched
5. Testers see stale indicators in the QA dashboard and can re-verify

### 4. Optional: Targeted Staleness

POST body can include `pages[]` to mark only specific pages stale:

```json
{
  "secret": "your-secret",
  "pages": ["landing", "therapist-dashboard"]
}
```

If `pages[]` is omitted or empty, ALL passing checks are marked stale.

### 5. Response Format

```json
{ "data": { "marked_stale": 12, "skipped": 3 }, "error": null }
```

- `marked_stale`: Number of passing checks marked stale
- `skipped`: Number of checks not affected (already stale or insufficient match)
