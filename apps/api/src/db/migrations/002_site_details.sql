-- Labelled facts from the official site sheets (dangers, aerology, restrictions, level…).
ALTER TABLE sites ADD COLUMN IF NOT EXISTS details jsonb;
