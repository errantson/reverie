-- Wretched Profile System
-- Stores original profiles, tracks avatars, and manages soothing

-- Profile backups for wretched users (full backup of everything)
CREATE TABLE IF NOT EXISTS wretched_profiles (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL,
    handle TEXT,
    
    -- Original Reverie House DB profile
    rh_display_name TEXT,
    rh_bio TEXT,
    rh_avatar TEXT,
    rh_banner TEXT,
    rh_spectrum JSONB,              -- Their spectrum settings
    rh_color TEXT,                  -- Their profile color
    
    -- Original Bluesky profile (fetched at time of wretching)
    bsky_display_name TEXT,
    bsky_description TEXT,
    bsky_avatar TEXT,
    bsky_banner TEXT,
    
    -- Wretched state
    wretched_avatar TEXT,           -- Which wretch avatar assigned (e.g., 'wretch001.png')
    wretched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    wretched_reason TEXT,           -- 'banished' or 'false_accuser'
    challenge_id TEXT,              -- Reference to challenge that caused this
    
    -- Soothing clock
    soothe_target_at TIMESTAMP WITH TIME ZONE,  -- When soothing completes (gets halved with likes)
    soothe_likes_count INTEGER DEFAULT 0,       -- How many valid soothing posts they've liked
    
    -- Resolution
    soothed_at TIMESTAMP WITH TIME ZONE,
    soothed_by TEXT,                -- 'clock' for natural soothe, or admin DID for manual
    
    -- Status
    status TEXT DEFAULT 'wretched', -- 'wretched', 'soothed', 'restored'
    
    UNIQUE(did, wretched_at)        -- Can be wretched multiple times historically
);

-- Track which wretched avatars exist and their assignments
CREATE TABLE IF NOT EXISTS wretched_avatars (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,  -- 'wretch001.png', 'wretch002.png', etc.
    assigned_to_did TEXT,           -- NULL if available, DID if assigned
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,                -- DID of WretcherSketcher, or 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Avatar can be "retired" (used once) or "reusable"
    reusable BOOLEAN DEFAULT FALSE, -- If true, can be reassigned after soothing
    is_canon BOOLEAN DEFAULT FALSE, -- If true, this avatar is "canon" (special significance)
    times_used INTEGER DEFAULT 0
);

-- Track soothing posts (dreams composed to help the wretch)
CREATE TABLE IF NOT EXISTS wretched_soothe_posts (
    id SERIAL PRIMARY KEY,
    wretched_did TEXT NOT NULL,     -- The wretch being soothed
    post_uri TEXT UNIQUE NOT NULL,  -- Bluesky post URI
    author_did TEXT NOT NULL,       -- Who wrote the soothing post
    author_handle TEXT,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Validation
    liked_by_wretch BOOLEAN DEFAULT FALSE,
    liked_at TIMESTAMP WITH TIME ZONE,
    is_valid BOOLEAN DEFAULT TRUE   -- Can be marked invalid if gaming detected
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wretched_profiles_did ON wretched_profiles(did);
CREATE INDEX IF NOT EXISTS idx_wretched_profiles_status ON wretched_profiles(status);
CREATE INDEX IF NOT EXISTS idx_wretched_profiles_handle ON wretched_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_wretched_avatars_available ON wretched_avatars(assigned_to_did) WHERE assigned_to_did IS NULL;
CREATE INDEX IF NOT EXISTS idx_soothe_posts_wretch ON wretched_soothe_posts(wretched_did);

-- Seed the initial avatar
INSERT INTO wretched_avatars (filename, created_by) 
VALUES ('wretch001.png', 'system')
ON CONFLICT (filename) DO NOTHING;

-- Add wretched flag to dreamers table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dreamers' AND column_name = 'is_wretched'
    ) THEN
        ALTER TABLE dreamers ADD COLUMN is_wretched BOOLEAN DEFAULT FALSE;
        ALTER TABLE dreamers ADD COLUMN wretched_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE dreamers ADD COLUMN wretched_profile_id INTEGER;
    END IF;
END $$;
