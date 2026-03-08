# GATE-004: MFA Enforcement

## Verification Summary

### GitHub MFA
- **Status**: ⚠️ Manual step required
- **Setting**: Organization → Settings → Authentication security → "Require two-factor authentication for everyone"
- **Required role**: Organization Owner
- **Action needed**: Org Owner must verify this setting is enabled in the GitHub org settings UI
- **Enforcement behavior**: Members without 2FA are removed from the org after the grace period
- **Supported methods**: TOTP (authenticator apps), WebAuthn (hardware security keys)

### Supabase MFA
- **Status**: ⚠️ Manual step required
- **Setting**: Organization → Settings → Authentication → "Require MFA for all members"
- **Required role**: Organization Owner
- **Action needed**: Org Owner must verify this setting is enabled in the Supabase dashboard
- **Supported methods**: TOTP (authenticator apps)

### Vercel MFA
- **Status**: ⚠️ Manual step required
- **Setting**: Team Settings → Security → "Require two-factor authentication"
- **Required role**: Team Owner
- **Action needed**: Team Owner must verify this setting is enabled in Vercel dashboard
- **Grace period**: 7 days for existing members to enable 2FA
- **Supported methods**: TOTP (authenticator apps), SMS (TOTP preferred)

### Roles in Scope

| Service  | Roles Requiring MFA                          |
|----------|----------------------------------------------|
| GitHub   | Org Owner, Repo Admin, Repo Contributor      |
| Supabase | Org Owner, Project Admin, Project Developer  |
| Vercel   | Team Owner, Team Member                      |

### Non-Enrollment Behavior

| Service  | Consequence of not enrolling                              |
|----------|-----------------------------------------------------------|
| GitHub   | Removed from organization after grace period              |
| Supabase | Required to enroll on next login (access blocked until enrolled) |
| Vercel   | Required to enroll within 7-day grace period; access revoked after |

### Application-Level MFA (EmpathAI)
- **Status**: ✅ Enforced
- Manager accounts require TOTP MFA (AAL2) to access `/admin/*` routes
- Enforced via `middleware.ts` + `lib/mfaGuard.ts`
- Enrollment flow at `/auth/mfa-enroll` (no skip option)

### Documentation Reference
- Full setup instructions: `docs/ops/mfa-enforcement.md`

### Note
MFA enforcement for GitHub, Supabase, and Vercel cannot be verified programmatically from within this repository — these are organization/team-level admin settings that require manual verification by the respective Owners. Each Owner should confirm enforcement is active and screenshot or attest to the setting.

---

**GATE-004 VERIFIED (application-level) —** _[infrastructure MFA pending manual confirmation by Org/Team Owners]_

> ⚠️ Three manual verification steps required before full sign-off:
> 1. GitHub Org Owner confirms 2FA requirement is enabled
> 2. Supabase Org Owner confirms MFA requirement is enabled
> 3. Vercel Team Owner confirms 2FA requirement is enabled
