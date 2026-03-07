# MFA Enforcement Checklist

Multi-factor authentication must be enforced across all infrastructure services.

## 1. Supabase (Requires Org Owner)

- Dashboard > Organization > Settings > Authentication
- Enable **"Require MFA for all members"**
- Supported methods: TOTP (authenticator apps)
- This is an org-level setting, not project-level

## 2. Vercel (Requires Team Owner)

- Dashboard > Team Settings > Security
- Enable **"Require two-factor authentication"**
- All team members will be required to enable 2FA on next login
- Grace period: Members have 7 days to enable 2FA

## 3. GitHub (Requires Org Owner)

- GitHub > Organization > Settings > Authentication security
- Enable **"Require two-factor authentication for everyone"**
- Members without 2FA will be removed from the org after grace period
- Send notification before enforcement

## Access Requirements

| Service  | Required Role | Setting Location                        |
|----------|--------------|------------------------------------------|
| Supabase | Org Owner    | Organization > Settings > Authentication |
| Vercel   | Team Owner   | Team Settings > Security                 |
| GitHub   | Org Owner    | Organization > Settings > Auth security  |

## Notes

- All three services support TOTP-based authenticator apps
- GitHub also supports hardware security keys (WebAuthn)
- Vercel supports authenticator apps and SMS (prefer TOTP)
- Enforce TOTP over SMS where possible for stronger security
