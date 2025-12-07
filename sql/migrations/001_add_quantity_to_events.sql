-- =============================================================================
-- Add quantities column to events table
-- =============================================================================
-- This allows us to store multiple item types and quantities in an order event
-- using a flexible JSON structure.
--
-- Format: {"books": 5, "pencils": 2, "hotdogs": -2}
-- Run date: 2025-12-07
-- =============================================================================

-- Add the quantities column (JSONB for flexible storage and querying)
ALTER TABLE events ADD COLUMN IF NOT EXISTS quantities JSONB DEFAULT NULL;

-- Create a GIN index for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_events_quantities ON events USING GIN (quantities) WHERE quantities IS NOT NULL;

-- Create an index for order events specifically
CREATE INDEX IF NOT EXISTS idx_events_type_quantities ON events(type) WHERE type = 'order' AND quantities IS NOT NULL;

COMMENT ON COLUMN events.quantities IS 'JSON object storing item types and their quantities. Format: {"books": 5, "pencils": 2}. Used for flexible order tracking.';
