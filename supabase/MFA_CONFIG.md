# Supabase MFA Configuration — EmpathAI

## How MFA is enabled

EmpathAI uses a **hosted Supabase** instance (no `supabase/config.toml`).
MFA is configured via the **Supabase Dashboard**, not a config file.

### Dashboard steps (one-time setup)

1. Go to **Authentication → Configuration → Multi-Factor Authentication**
2. Enable **TOTP (Time-based One-Time Password)**
3. Leave **Phone (SMS)** disabled (TOTP only for pilot)
4. Under **MFA Enrollment**, set to **Optional** (enforcement is handled
   by our Next.js middleware — only manager role is required to enroll)

### Why not config.toml?

This project does not use `supabase init` / `supabase start` for local
development — it connects to a hosted Supabase instance directly. The
`supabase/` directory contains only migrations and tests. MFA toggle is
a dashboard-level setting, not a migration.

## Enforcement architecture

```
Browser → Next.js middleware.ts → checkMfaGate()
                                    ↓
                          /admin/* + role=manager + aal<aal2
                                    ↓
                          redirect → /auth/mfa-enroll
```

- **middleware.ts** reads the Supabase session from cookies via `@supabase/ssr`
- **lib/mfaGuard.ts** contains the pure-function gate logic (unit-tested)
- Only `role=manager` is gated; therapists, patients, and admins are not affected
- Manager cannot skip or dismiss — the page has no close/skip button
- On successful TOTP verification, session is elevated to `aal2` and user
  is redirected to their original destination

## Files

| File | Purpose |
|------|---------|
| `lib/mfaGuard.ts` | Pure gate logic: (role, aal, path) → pass/redirect |
| `middleware.ts` | Next.js edge middleware, reads session, applies gate |
| `lib/supabaseBrowser.ts` | Browser Supabase client for MFA API calls |
| `app/auth/mfa-enroll/page.tsx` | Enrollment + verification UI |
| `__tests__/portal-safety-guards.test.ts` | Tests for MFA gate logic |
