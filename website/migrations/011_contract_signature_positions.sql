-- Add signature_positions column to hr_contracts for configurable signature/date placement on PDFs
ALTER TABLE hr_contracts ADD COLUMN signature_positions JSON DEFAULT NULL;
