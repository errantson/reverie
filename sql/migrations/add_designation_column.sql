-- Migration: Add designation column
-- Date: 2026-01-05
-- Description: Add designation column for new unified designation system

-- Step 1: Add the new column
ALTER TABLE dreamers ADD COLUMN IF NOT EXISTS designation TEXT;

-- Step 2: Migrate existing status data to designation
UPDATE dreamers SET designation = status WHERE status IS NOT NULL AND designation IS NULL;

-- Step 3: Create index for querying designations
CREATE INDEX IF NOT EXISTS idx_dreamers_designation ON dreamers(designation);

-- Note: The old 'status' column will be kept for now for backward compatibility
-- Run the designation backfill script to recalculate all designations
-- After verification, the status column can be dropped with:
-- ALTER TABLE dreamers DROP COLUMN status;
