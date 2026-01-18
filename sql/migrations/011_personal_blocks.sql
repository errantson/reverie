-- Migration 011: Personal Blocks
-- Allow any user to maintain personal block lists (separate from guardian system)
-- These personal blocks contribute to aggregate filtering with ward/charge attribution

-- Personal blocks: any user can block others for their own filtering
CREATE TABLE IF NOT EXISTS personal_blocks (
    id SERIAL PRIMARY KEY,
    blocker_did TEXT NOT NULL,          -- The user who created the block
    blocked_did TEXT NOT NULL,          -- The user being blocked
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker_did, blocked_did)
);

CREATE INDEX IF NOT EXISTS idx_personal_blocks_blocker ON personal_blocks(blocker_did);
CREATE INDEX IF NOT EXISTS idx_personal_blocks_blocked ON personal_blocks(blocked_did);

COMMENT ON TABLE personal_blocks IS 'Personal block lists for any user - contributes to aggregate filtering';
COMMENT ON COLUMN personal_blocks.blocker_did IS 'DID of the user who created the block';
COMMENT ON COLUMN personal_blocks.blocked_did IS 'DID of the user being blocked';

-- Personal content blocks: any user can block specific content
CREATE TABLE IF NOT EXISTS personal_content_blocks (
    id SERIAL PRIMARY KEY,
    blocker_did TEXT NOT NULL,          -- The user who created the block
    content_uri TEXT NOT NULL,          -- The content being blocked
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker_did, content_uri)
);

CREATE INDEX IF NOT EXISTS idx_personal_content_blocks_blocker ON personal_content_blocks(blocker_did);
CREATE INDEX IF NOT EXISTS idx_personal_content_blocks_uri ON personal_content_blocks(content_uri);

COMMENT ON TABLE personal_content_blocks IS 'Personal content block lists - contributes to aggregate filtering';
