-- Add patient profile fields for portal onboarding (BUG-003)
-- Safe to re-run: every column uses IF NOT EXISTS.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS preferred_name TEXT,
  ADD COLUMN IF NOT EXISTS pronouns TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS has_completed_profile BOOLEAN NOT NULL DEFAULT false;
