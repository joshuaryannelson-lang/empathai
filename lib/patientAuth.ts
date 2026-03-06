// lib/patientAuth.ts
// Patient authentication via join code → signed JWT scoped to case_code.
// This replaces the name+DOB identification flow.

import { SignJWT, jwtVerify, JWTPayload } from "jose";

const JWT_SECRET = process.env.PATIENT_JWT_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? "";
const JWT_ISSUER = "empathai-portal";
const JWT_EXPIRY = "7d";

if (!JWT_SECRET && typeof window === "undefined") {
  console.warn("[patientAuth] PATIENT_JWT_SECRET not set — patient JWTs will fail to verify");
}

function getSecret() {
  return new TextEncoder().encode(JWT_SECRET);
}

export interface PatientJWTClaims extends JWTPayload {
  role: "patient";
  case_code: string;
  // No patient name, email, DOB, or address — PHI-light
}

/**
 * Mint a signed JWT scoped to a specific case_code.
 * Called after successful join code redemption.
 */
export async function mintPatientJWT(caseCode: string): Promise<string> {
  if (!JWT_SECRET) {
    throw new Error(
      "[patientAuth] PATIENT_JWT_SECRET is not set. " +
      "Add it to Vercel Dashboard > Settings > Environment Variables > Production. " +
      "Patient portal auth will not work without it."
    );
  }

  return new SignJWT({
    role: "patient",
    case_code: caseCode,
  } satisfies Omit<PatientJWTClaims, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret());
}

/**
 * Verify and decode a patient JWT. Returns the claims or null if invalid.
 */
export async function verifyPatientJWT(token: string): Promise<PatientJWTClaims | null> {
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[patientAuth] PATIENT_JWT_SECRET is not set — rejecting token. " +
        "Add it to Vercel Dashboard > Settings > Environment Variables > Production."
      );
    }
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
    });

    if (payload.role !== "patient" || !payload.case_code) return null;

    return payload as PatientJWTClaims;
  } catch {
    return null;
  }
}

/**
 * Extract patient JWT from request headers.
 * Accepts: Authorization: Bearer <token>
 */
export function extractPatientToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Full auth middleware: extract token → verify → return claims or null.
 */
export async function authenticatePatient(req: Request): Promise<PatientJWTClaims | null> {
  const token = extractPatientToken(req);
  if (!token) return null;
  return verifyPatientJWT(token);
}
