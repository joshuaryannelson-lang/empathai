-- Add clinical_notes column to cases table for therapist-editable notes
ALTER TABLE cases ADD COLUMN IF NOT EXISTS clinical_notes text DEFAULT '';
