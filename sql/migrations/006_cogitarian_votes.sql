-- Migration 006: Add vote count and favor columns to cogitarian_challenges table
-- These columns cache the vote counts for quick access without joining
-- The favor columns track the Keeper's Favor system

-- Add vote count columns
ALTER TABLE cogitarian_challenges
ADD COLUMN IF NOT EXISTS votes_challenger INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS votes_challenged INTEGER DEFAULT 0;

-- Add Keeper's Favor columns
ALTER TABLE cogitarian_challenges
ADD COLUMN IF NOT EXISTS favor VARCHAR(20) DEFAULT 'challenger',
ADD COLUMN IF NOT EXISTS favor_set_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS favor_set_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing challenges with actual vote counts from cogitarian_challenge_votes
UPDATE cogitarian_challenges c
SET 
    votes_challenger = COALESCE((
        SELECT COUNT(*) 
        FROM cogitarian_challenge_votes v 
        WHERE v.challenge_id = c.challenge_id AND v.vote_for = 'challenger'
    ), 0),
    votes_challenged = COALESCE((
        SELECT COUNT(*) 
        FROM cogitarian_challenge_votes v 
        WHERE v.challenge_id = c.challenge_id AND v.vote_for = 'challenged'
    ), 0);

-- Create index for faster vote queries
CREATE INDEX IF NOT EXISTS idx_challenge_votes_vote_for ON cogitarian_challenge_votes(challenge_id, vote_for);

-- Add constraints (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_favor' AND table_name = 'cogitarian_challenges'
    ) THEN
        ALTER TABLE cogitarian_challenges ADD CONSTRAINT valid_favor CHECK (favor IN ('challenger', 'cogitarian'));
    END IF;
END $$;

-- Update status constraint to include 'disqualified'
ALTER TABLE cogitarian_challenges DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE cogitarian_challenges ADD CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'resolved', 'withdrawn', 'disqualified'));

-- Add comments
COMMENT ON COLUMN cogitarian_challenges.votes_challenger IS 'Cached count of votes supporting the challenger';
COMMENT ON COLUMN cogitarian_challenges.votes_challenged IS 'Cached count of votes supporting the current cogitarian';
COMMENT ON COLUMN cogitarian_challenges.favor IS 'Current Keeper''s Favor - determines winner if challenge expires';
COMMENT ON COLUMN cogitarian_challenges.favor_set_by IS 'DID of who last set the favor (Keeper or system)';
COMMENT ON COLUMN cogitarian_challenges.favor_set_at IS 'Timestamp when favor was last changed';
