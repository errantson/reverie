-- Migration 008: Guardian Stewardship System
-- Clean schema for guardian management

-- Main stewardship table: one row per active guardian
CREATE TABLE IF NOT EXISTS stewardship (
    guardian_did TEXT PRIMARY KEY,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    wards TEXT[] DEFAULT '{}',      -- DIDs of users under this guardian as wards
    charges TEXT[] DEFAULT '{}'     -- DIDs of users under this guardian as charges
);

COMMENT ON TABLE stewardship IS 'Registry of active guardians with their wards and charges';
COMMENT ON COLUMN stewardship.wards IS 'Array of user DIDs who are wards of this guardian';
COMMENT ON COLUMN stewardship.charges IS 'Array of user DIDs who are charges of this guardian';

-- Curation lists: what the guardian allows/bars

-- Barred users: users this guardian has flagged
CREATE TABLE IF NOT EXISTS barred_users (
    id SERIAL PRIMARY KEY,
    guardian_did TEXT NOT NULL REFERENCES stewardship(guardian_did) ON DELETE CASCADE,
    user_did TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_barred_users_guardian ON barred_users(guardian_did);
CREATE INDEX IF NOT EXISTS idx_barred_users_user ON barred_users(user_did);

COMMENT ON TABLE barred_users IS 'Users barred by each guardian';

-- Barred content: posts/content this guardian has flagged
CREATE TABLE IF NOT EXISTS barred_content (
    id SERIAL PRIMARY KEY,
    guardian_did TEXT NOT NULL REFERENCES stewardship(guardian_did) ON DELETE CASCADE,
    content_uri TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_barred_content_guardian ON barred_content(guardian_did);
CREATE INDEX IF NOT EXISTS idx_barred_content_uri ON barred_content(content_uri);

COMMENT ON TABLE barred_content IS 'Content (posts) barred by each guardian';

-- Allowed users: users this guardian vouches for
CREATE TABLE IF NOT EXISTS allowed_users (
    id SERIAL PRIMARY KEY,
    guardian_did TEXT NOT NULL REFERENCES stewardship(guardian_did) ON DELETE CASCADE,
    user_did TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allowed_users_guardian ON allowed_users(guardian_did);
CREATE INDEX IF NOT EXISTS idx_allowed_users_user ON allowed_users(user_did);

COMMENT ON TABLE allowed_users IS 'Users allowed/vouched for by each guardian';

-- Allowed content: posts/content this guardian has approved
CREATE TABLE IF NOT EXISTS allowed_content (
    id SERIAL PRIMARY KEY,
    guardian_did TEXT NOT NULL REFERENCES stewardship(guardian_did) ON DELETE CASCADE,
    content_uri TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allowed_content_guardian ON allowed_content(guardian_did);
CREATE INDEX IF NOT EXISTS idx_allowed_content_uri ON allowed_content(content_uri);

COMMENT ON TABLE allowed_content IS 'Content (posts) approved by each guardian';
