// lib/fixtures/portalTestData.ts
// Test fixtures for the Patient Portal security regression suite.

export const TEST_CASE_CODE_A = "EMP-A1B2C3";
export const TEST_CASE_CODE_B = "EMP-X9Y8Z7";
export const TEST_CASE_ID_A = "00000000-0000-0000-0000-case000000a1";
export const TEST_CASE_ID_B = "00000000-0000-0000-0000-case000000b2";

export const VALID_JOIN_CODE = "ABCD-5678";
export const EXPIRED_JOIN_CODE = "EXPD-0000";
export const REDEEMED_JOIN_CODE = "USED-1111";

export const VALID_CHECKIN = { rating: 7, notes: "Feeling better this week" };
export const CHECKIN_WITH_PHI_EMAIL = { rating: 5, notes: "Contact me at john@example.com" };
export const CHECKIN_WITH_PHI_PHONE = { rating: 5, notes: "Call me at 555-123-4567" };
export const CHECKIN_WITH_PHI_SSN = { rating: 5, notes: "My SSN is 123-45-6789" };
export const CHECKIN_WITH_CRISIS = { rating: 2, notes: "I want to end my life" };
export const CHECKIN_RATING_TOO_LOW = { rating: 0, notes: null };
export const CHECKIN_RATING_TOO_HIGH = { rating: 11, notes: null };
export const CHECKIN_RATING_FLOAT = { rating: 5.5, notes: null };
export const CHECKIN_RATING_STRING = { rating: "five" as unknown as number, notes: null };

export const CRISIS_PHRASES = [
  "I want to kill myself",
  "suicidal thoughts",
  "I don't want to live anymore",
  "better off dead",
  "want to die",
  "end it all",
  "no reason to go on",
  "self-harm",
];

export const SAFE_PHRASES = [
  "Feeling okay today",
  "Had a good session",
  "My sleep improved",
  "Still anxious but managing",
  "killed it at work today",
];
