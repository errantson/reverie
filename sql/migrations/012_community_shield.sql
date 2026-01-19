-- Migration 012: Add Community Shield settings
-- Community Shield enables aggregate filtering for logged-in users (like guests see)
-- Default ON for everyone

-- Add community_shield column (default true - ON for everyone)
ALTER TABLE dreamers ADD COLUMN IF NOT EXISTS community_shield BOOLEAN DEFAULT TRUE;

-- Add shield_unlocked column (remembers if user verified age to toggle shield off)
ALTER TABLE dreamers ADD COLUMN IF NOT EXISTS shield_unlocked BOOLEAN DEFAULT FALSE;

-- Set all existing users to have shield enabled
UPDATE dreamers SET community_shield = TRUE WHERE community_shield IS NULL;
UPDATE dreamers SET shield_unlocked = FALSE WHERE shield_unlocked IS NULL;
