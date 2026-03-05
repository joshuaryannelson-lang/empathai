// lib/constants.ts

export const BUCKET = {
  LOW_SCORES: "low_scores",
  MISSING_CHECKINS: "missing_checkins",
  UNASSIGNED: "unassigned",
} as const;

export type Bucket = (typeof BUCKET)[keyof typeof BUCKET];

export const SIGNAL = {
  AT_RISK: "AT_RISK",
  MISSING_CHECKIN: "MISSING_CHECKIN",
  MONITOR: "MONITOR",
  OK: "OK",
} as const;

export type Signal = (typeof SIGNAL)[keyof typeof SIGNAL];

export const CASE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;
