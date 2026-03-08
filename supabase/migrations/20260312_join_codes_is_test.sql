-- Add is_test flag to join_codes for TEST- prefixed codes
ALTER TABLE join_codes ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;

UPDATE join_codes SET is_test = true WHERE code LIKE 'TEST-%';
