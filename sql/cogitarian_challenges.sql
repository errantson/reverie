-- Cogitarian Challenge System Schema
-- Creates the table for tracking challenges to the current Cogitarian

CREATE TABLE IF NOT EXISTS cogitarian_challenges (
    id SERIAL PRIMARY KEY,
    challenge_id VARCHAR(20) UNIQUE NOT NULL,  -- e.g., 'challenge001', 'challenge002'
    
    -- Challenger info
    challenger_did VARCHAR(255) NOT NULL,
    challenger_handle VARCHAR(255) NOT NULL,
    challenger_rank VARCHAR(50) NOT NULL,  -- The rank they would receive if successful (Alpha, Beta, etc.)
    
    -- Challenged (current Cogitarian) info
    challenged_did VARCHAR(255) NOT NULL,
    challenged_handle VARCHAR(255) NOT NULL,
    challenged_rank VARCHAR(50) NOT NULL,  -- Their current rank (Prime, Alpha, etc.)
    
    -- Challenge details
    challenge_type VARCHAR(50) NOT NULL,  -- 'wish_to_be' or 'wretched'
    evidence TEXT,
    
    -- ATProto record references
    challenger_record_uri VARCHAR(500),  -- URI of record in challenger's PDS
    challenged_record_uri VARCHAR(500),  -- URI of record in challenged's PDS (duplicate)
    announcement_post_uri VARCHAR(500),  -- URI of the public announcement post
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- 14 days from creation
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Keeper's Favor system
    favor VARCHAR(20) DEFAULT 'challenger',  -- 'challenger' or 'cogitarian' - who the Keeper favors
    favor_set_by VARCHAR(255),  -- DID of who last set the favor (Keeper or system)
    favor_set_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Status/outcome
    status VARCHAR(50) DEFAULT 'active',  -- 'active', 'expired', 'resolved', 'withdrawn', 'disqualified'
    outcome VARCHAR(50),  -- 'challenger_wins', 'challenged_wins', 'expired', 'withdrawn', 'disqualified'
    outcome_notes TEXT,
    
    -- Indexes
    CONSTRAINT valid_challenge_type CHECK (challenge_type IN ('wish_to_be', 'wretched')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'resolved', 'withdrawn', 'disqualified')),
    CONSTRAINT valid_favor CHECK (favor IN ('challenger', 'cogitarian'))
);

-- Individual votes (one vote per user per challenge)
CREATE TABLE IF NOT EXISTS cogitarian_challenge_votes (
    id SERIAL PRIMARY KEY,
    challenge_id VARCHAR(20) REFERENCES cogitarian_challenges(challenge_id) ON DELETE CASCADE,
    voter_did VARCHAR(255) NOT NULL,
    voter_handle VARCHAR(255),
    vote_for VARCHAR(20) NOT NULL,  -- 'challenger' or 'challenged'
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Guest votes (when voter_did is a hash of IP or something)
    is_guest BOOLEAN DEFAULT FALSE,
    
    UNIQUE(challenge_id, voter_did)
);

-- Challenge replies/discourse (similar to our existing reply systems)
CREATE TABLE IF NOT EXISTS cogitarian_challenge_replies (
    id SERIAL PRIMARY KEY,
    challenge_id VARCHAR(20) REFERENCES cogitarian_challenges(challenge_id) ON DELETE CASCADE,
    reply_uri VARCHAR(500) NOT NULL,  -- ATProto post URI of the reply
    author_did VARCHAR(255) NOT NULL,
    author_handle VARCHAR(255),
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional parent reply for threading
    parent_reply_id INTEGER REFERENCES cogitarian_challenge_replies(id) ON DELETE SET NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_challenges_status ON cogitarian_challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON cogitarian_challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON cogitarian_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_challenge ON cogitarian_challenge_votes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_replies_challenge ON cogitarian_challenge_replies(challenge_id);
