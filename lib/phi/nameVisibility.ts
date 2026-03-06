// lib/phi/nameVisibility.ts
// Enforces Option B name visibility rules across all API responses.
//
// Therapists: see first_name only, and only for their own assigned cases.
// Managers / admins / all other roles: see case_code only. No names ever.
// last_name is NEVER returned to any role.

import { getRole, type Role } from "@/lib/roleContext";
export type { Role };

/**
 * Read user role via the unified getRole() context.
 * Returns null on the server or if not set.
 */
export function getClientRole(): Role {
  return getRole();
}

/**
 * Strip or truncate patient name fields based on the requesting user's role.
 *
 * Pass a single patient record or an array. Returns a new object (never mutates).
 * Fields removed: last_name, full_name, patient_last_name, patient_name (combined).
 * Fields kept (therapist only): first_name, patient_first_name.
 * Fields kept (all roles): case_code.
 */
export function sanitizePatientData<T extends Record<string, unknown>>(
  data: T,
  role: Role,
): T;
export function sanitizePatientData<T extends Record<string, unknown>>(
  data: T[],
  role: Role,
): T[];
export function sanitizePatientData<T extends Record<string, unknown>>(
  data: T | T[],
  role: Role,
): T | T[] {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeOne(item, role));
  }
  return sanitizeOne(data, role);
}

// Fields that are always stripped (no role ever sees these)
const ALWAYS_STRIP = [
  "last_name",
  "patient_last_name",
  "full_name",
];

// Fields only therapists may see (managers/admins never see these)
const THERAPIST_ONLY = [
  "first_name",
  "patient_first_name",
  "patient_name",
];

function sanitizeOne<T extends Record<string, unknown>>(
  record: T,
  role: Role,
): T {
  const out = { ...record };
  const isTherapist = role === "therapist";

  for (const key of ALWAYS_STRIP) {
    if (key in out) delete (out as Record<string, unknown>)[key];
  }

  if (!isTherapist) {
    for (const key of THERAPIST_ONLY) {
      if (key in out) delete (out as Record<string, unknown>)[key];
    }
  }

  // If record has a nested `patient` object, sanitize it too
  if (out.patient && typeof out.patient === "object" && !Array.isArray(out.patient)) {
    (out as Record<string, unknown>).patient = sanitizeOne(
      out.patient as Record<string, unknown>,
      role,
    );
  }

  return out;
}

/**
 * Build the display label for a patient based on role.
 * Therapist: first_name or fallback to case_code.
 * Everyone else: case_code only.
 */
export function patientDisplayLabel(
  record: { first_name?: string | null; case_code?: string | null },
  role: Role,
): string {
  if (role === "therapist" && record.first_name) {
    return record.first_name;
  }
  return record.case_code ?? "Unknown";
}

/**
 * Build avatar text for a patient based on role.
 * Therapist: first initial (e.g. "J").
 * Everyone else: first 2 chars of case_code (e.g. "EM").
 */
export function patientAvatarText(
  record: { first_name?: string | null; case_code?: string | null },
  role: Role,
): string {
  if (role === "therapist" && record.first_name) {
    return record.first_name[0].toUpperCase();
  }
  return (record.case_code ?? "??").slice(0, 2);
}
