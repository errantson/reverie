-- =============================================================================
-- REVERIE HOUSE DATABASE INITIALIZATION
-- =============================================================================
-- Database: reverie_house
-- Version: 1.0.0
-- Migration from: SQLite (data/reverie.db)
-- Date: December 2025
--
-- This script creates the simplified 31-table schema for Reverie House.
-- Tables are created in dependency order (referenced tables first).
-- =============================================================================

-- Set timezone
SET timezone = 'UTC';

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- =============================================================================
-- METADATA & VERSIONING
-- =============================================================================

CREATE TABLE _metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO _metadata (key, value) VALUES 
    ('schema_version', '1.0.0'),
    ('migration_date', CURRENT_TIMESTAMP::TEXT),
    ('source', 'SQLite'),
    ('simplified_schema', 'true');

-- =============================================================================
-- PRIORITY 1: CORE IDENTITY TABLES
-- =============================================================================

-- User profiles and identity
CREATE TABLE dreamers (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    server TEXT,
    avatar TEXT,
    banner TEXT,
    followers_count INTEGER DEFAULT 0,
    follows_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    arrival INTEGER,
    created_at TIMESTAMPTZ,
    updated_at INTEGER,
    heading TEXT,
    heading_changed_at INTEGER,
    alts TEXT,
    color_hex TEXT,
    phanera TEXT,
    dream_pair_did TEXT,  -- DEPRECATED: Use kindred table
    dream_pair_since INTEGER,  -- DEPRECATED: Use kindred table
    collab_partner_did TEXT,  -- DEPRECATED: Feature removed
    collab_partner_since INTEGER,  -- DEPRECATED: Feature removed
    status TEXT
);

CREATE INDEX idx_dreamers_handle ON dreamers(handle);
CREATE INDEX idx_dreamers_name ON dreamers(name);
CREATE INDEX idx_dreamers_arrival ON dreamers(arrival DESC);
CREATE INDEX idx_dreamers_name_trgm ON dreamers USING gin (name gin_trgm_ops);

COMMENT ON TABLE dreamers IS 'User profiles synced from Bluesky ATProto network';
COMMENT ON COLUMN dreamers.did IS 'Decentralized identifier (DID) - primary key';
COMMENT ON COLUMN dreamers.handle IS 'Bluesky handle (e.g., user.bsky.social)';
COMMENT ON COLUMN dreamers.arrival IS 'Unix timestamp of first registration';
COMMENT ON COLUMN dreamers.dream_pair_did IS 'DEPRECATED - Use kindred table instead';

-- User personality spectrum (6 axes)
CREATE TABLE spectrum (
    did TEXT PRIMARY KEY REFERENCES dreamers(did) ON DELETE CASCADE,
    oblivion INTEGER DEFAULT 0,
    authority INTEGER DEFAULT 0,
    skeptic INTEGER DEFAULT 0,
    receptive INTEGER DEFAULT 0,
    liberty INTEGER DEFAULT 0,
    entropy INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0,
    octant TEXT
);

COMMENT ON TABLE spectrum IS 'User personality dimensions (0-100 scale on 6 axes)';
COMMENT ON COLUMN spectrum.octant IS 'Derived personality type from dominant axes';

-- Encrypted user credentials
CREATE TABLE user_credentials (
    did TEXT PRIMARY KEY REFERENCES dreamers(did) ON DELETE CASCADE,
    app_password_hash TEXT NOT NULL,
    pds_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_user_credentials_valid ON user_credentials(is_valid);

COMMENT ON TABLE user_credentials IS 'Encrypted Bluesky app passwords (base64 encoded)';
COMMENT ON COLUMN user_credentials.app_password_hash IS 'Base64 encoded app password for ATProto operations';

-- Admin privilege definitions (must be before admin_sessions)
CREATE TABLE authorized_admins (
    did TEXT PRIMARY KEY REFERENCES dreamers(did) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    authorized_by TEXT,
    authorized_at INTEGER NOT NULL,
    last_login INTEGER,
    notes TEXT
);

COMMENT ON TABLE authorized_admins IS 'Users with admin privileges';
COMMENT ON COLUMN authorized_admins.role IS 'Admin role (e.g., "admin", "superadmin")';

-- Admin authentication sessions
CREATE TABLE admin_sessions (
    token TEXT PRIMARY KEY,
    admin_did TEXT NOT NULL REFERENCES authorized_admins(did),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX idx_admin_sessions_admin_did ON admin_sessions(admin_did);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

COMMENT ON TABLE admin_sessions IS 'Active admin authentication sessions';

-- =============================================================================
-- PRIORITY 2: USER CONTENT & INTERACTIONS
-- =============================================================================

-- User timeline events (renamed from 'canon' to avoid lore.farm conflict)
CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_history_did ON history(did);
CREATE INDEX idx_history_created ON history(created_at DESC);

COMMENT ON TABLE history IS 'User timeline/history events (renamed from canon)';

-- Achievement/badge definitions
CREATE TABLE souvenirs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    rarity TEXT,
    created_at INTEGER
);

COMMENT ON TABLE souvenirs IS 'Achievement/badge definitions';

-- User achievements earned (renamed from 'dreamer_souvenirs')
CREATE TABLE souvenir_awards (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    souvenir_id INTEGER NOT NULL REFERENCES souvenirs(id) ON DELETE CASCADE,
    awarded_at INTEGER NOT NULL,
    UNIQUE(did, souvenir_id)
);

CREATE INDEX idx_souvenir_awards_did ON souvenir_awards(did);
CREATE INDEX idx_souvenir_awards_awarded ON souvenir_awards(awarded_at DESC);

COMMENT ON TABLE souvenir_awards IS 'User achievements earned (renamed from dreamer_souvenirs)';

-- User notification messages
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    message_type TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read_at INTEGER,
    action_taken INTEGER,
    priority TEXT DEFAULT 'normal'
);

CREATE INDEX idx_messages_did ON messages(did);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_read ON messages(read_at);

COMMENT ON TABLE messages IS 'User notification messages';

-- Message interaction tracking (renamed from 'message_interactions')
CREATE TABLE message_actions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_data TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_message_actions_message ON message_actions(message_id);
CREATE INDEX idx_message_actions_created ON message_actions(created_at DESC);

COMMENT ON TABLE message_actions IS 'Message interaction tracking (renamed from message_interactions)';

-- =============================================================================
-- PRIORITY 3: GAME SYSTEMS
-- =============================================================================

-- Quest definitions and triggers
CREATE TABLE quests (
    id SERIAL PRIMARY KEY,
    quest_name TEXT NOT NULL UNIQUE,
    trigger_type TEXT NOT NULL,
    trigger_pattern TEXT,
    command_type TEXT,
    command_data TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at INTEGER
);

CREATE INDEX idx_quests_active ON quests(active);
CREATE INDEX idx_quests_trigger ON quests(trigger_type);

COMMENT ON TABLE quests IS 'Quest definitions and trigger patterns';

-- Quest retry tracking
CREATE TABLE quest_retry_requests (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    request_type TEXT,
    requested_at INTEGER NOT NULL,
    processed_at INTEGER,
    status TEXT DEFAULT 'pending'
);

CREATE INDEX idx_quest_retry_did ON quest_retry_requests(did);
CREATE INDEX idx_quest_retry_status ON quest_retry_requests(status);

COMMENT ON TABLE quest_retry_requests IS 'Quest retry workflow tracking (TODO: Analyze if needed)';

-- Global world state (key-value store)
CREATE TABLE world_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER,
    updated_by TEXT
);

COMMENT ON TABLE world_state IS 'Global world configuration and state (10 active keys)';

-- =============================================================================
-- PRIORITY 4: SOCIAL & RELATIONSHIPS
-- =============================================================================

-- Dream pair relationships
CREATE TABLE kindred (
    id SERIAL PRIMARY KEY,
    did1 TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    did2 TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    paired_at INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    UNIQUE(did1, did2)
);

CREATE INDEX idx_kindred_did1 ON kindred(did1);
CREATE INDEX idx_kindred_did2 ON kindred(did2);

COMMENT ON TABLE kindred IS 'Dream pair relationships (9 active pairs)';

-- =============================================================================
-- PRIORITY 5: AUTOMATED SYSTEMS
-- =============================================================================

-- Automated message trigger definitions
CREATE TABLE pigeons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    trigger_type TEXT NOT NULL,
    trigger_data TEXT,
    message_template TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at INTEGER
);

CREATE INDEX idx_pigeons_active ON pigeons(active);

COMMENT ON TABLE pigeons IS 'Automated message trigger definitions';

-- Message delivery tracking
CREATE TABLE pigeon_deliveries (
    id SERIAL PRIMARY KEY,
    pigeon_id INTEGER NOT NULL REFERENCES pigeons(id) ON DELETE CASCADE,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    delivered_at INTEGER NOT NULL,
    status TEXT DEFAULT 'sent'
);

CREATE INDEX idx_pigeon_deliveries_pigeon ON pigeon_deliveries(pigeon_id);
CREATE INDEX idx_pigeon_deliveries_did ON pigeon_deliveries(did);

COMMENT ON TABLE pigeon_deliveries IS 'Automated message delivery tracking';

-- Dialogue content definitions
CREATE TABLE dialogues (
    id SERIAL PRIMARY KEY,
    dialogue_key TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    category TEXT,
    created_at INTEGER
);

COMMENT ON TABLE dialogues IS 'Dialogue content library';

-- User dialogue view tracking
CREATE TABLE dialogue_seen (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    dialogue_id INTEGER NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    seen_at INTEGER NOT NULL,
    UNIQUE(did, dialogue_id)
);

CREATE INDEX idx_dialogue_seen_did ON dialogue_seen(did);

COMMENT ON TABLE dialogue_seen IS 'User dialogue view tracking';

-- Scheduled post system
CREATE TABLE courier (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    post_text TEXT NOT NULL,
    scheduled_for INTEGER NOT NULL,
    posted_at INTEGER,
    status TEXT DEFAULT 'pending',
    post_uri TEXT
);

CREATE INDEX idx_courier_did ON courier(did);
CREATE INDEX idx_courier_scheduled ON courier(scheduled_for);
CREATE INDEX idx_courier_status ON courier(status);

COMMENT ON TABLE courier IS 'Scheduled post delivery system';

-- =============================================================================
-- PRIORITY 6: CONTENT & REFERENCE
-- =============================================================================

-- Book catalog
CREATE TABLE library_books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    description TEXT,
    cover_image TEXT,
    created_at INTEGER
);

COMMENT ON TABLE library_books IS 'Library book catalog (2 books)';

-- Book chapter index
CREATE TABLE library_chapters (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    UNIQUE(book_id, chapter_number)
);

CREATE INDEX idx_library_chapters_book ON library_chapters(book_id);

COMMENT ON TABLE library_chapters IS 'Library book chapters (16 chapters)';

-- Worker role definitions (restructured from 'work')
CREATE TABLE worker_roles (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT,  -- JSON array of permission strings
    created_at INTEGER
);

COMMENT ON TABLE worker_roles IS 'Worker role definitions (restructured from work table)';

-- User role assignments (restructured from 'user_roles')
CREATE TABLE worker_assignments (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES worker_roles(id) ON DELETE CASCADE,
    assigned_at INTEGER NOT NULL,
    assigned_by TEXT,
    UNIQUE(did, role_id)
);

CREATE INDEX idx_worker_assignments_did ON worker_assignments(did);
CREATE INDEX idx_worker_assignments_role ON worker_assignments(role_id);

COMMENT ON TABLE worker_assignments IS 'User worker role assignments (restructured from user_roles)';

-- Invite code tracking
CREATE TABLE invite_codes (
    code TEXT PRIMARY KEY,
    created_by TEXT REFERENCES dreamers(did) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    used_by TEXT REFERENCES dreamers(did) ON DELETE SET NULL,
    used_at INTEGER,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0
);

CREATE INDEX idx_invite_codes_created_by ON invite_codes(created_by);
CREATE INDEX idx_invite_codes_used_by ON invite_codes(used_by);

COMMENT ON TABLE invite_codes IS 'Invite code generation and tracking';

-- =============================================================================
-- PRIORITY 7: ADMIN & LOGGING
-- =============================================================================

-- Admin action audit log
CREATE TABLE admin_log (
    id SERIAL PRIMARY KEY,
    admin_did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_did TEXT,
    action_data TEXT,
    timestamp INTEGER NOT NULL,
    ip_address TEXT
);

CREATE INDEX idx_admin_log_admin ON admin_log(admin_did);
CREATE INDEX idx_admin_log_timestamp ON admin_log(timestamp DESC);
CREATE INDEX idx_admin_log_target ON admin_log(target_did);

COMMENT ON TABLE admin_log IS 'Admin action audit trail';

-- Login security tracking
CREATE TABLE login_attempts (
    id SERIAL PRIMARY KEY,
    handle TEXT NOT NULL,
    ip_address TEXT,
    success BOOLEAN NOT NULL,
    timestamp INTEGER NOT NULL,
    error_message TEXT
);

CREATE INDEX idx_login_attempts_handle ON login_attempts(handle);
CREATE INDEX idx_login_attempts_timestamp ON login_attempts(timestamp DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);

COMMENT ON TABLE login_attempts IS 'Login attempt tracking for security monitoring';

-- =============================================================================
-- PRIORITY 8: HISTORICAL SNAPSHOTS
-- =============================================================================

-- Historical spectrum data
CREATE TABLE spectrum_snapshots (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    oblivion INTEGER,
    authority INTEGER,
    skeptic INTEGER,
    receptive INTEGER,
    liberty INTEGER,
    entropy INTEGER,
    octant TEXT,
    snapshot_at INTEGER NOT NULL
);

CREATE INDEX idx_spectrum_snapshots_did ON spectrum_snapshots(did);
CREATE INDEX idx_spectrum_snapshots_time ON spectrum_snapshots(snapshot_at DESC);

COMMENT ON TABLE spectrum_snapshots IS 'Historical spectrum data for analytics';

-- Historical world state
CREATE TABLE world_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_data TEXT NOT NULL,  -- JSON dump of world_state
    snapshot_at INTEGER NOT NULL
);

CREATE INDEX idx_world_snapshots_time ON world_snapshots(snapshot_at DESC);

COMMENT ON TABLE world_snapshots IS 'Historical world state backups';

-- =============================================================================
-- INITIALIZATION COMPLETE
-- =============================================================================

-- Update metadata
UPDATE _metadata SET value = CURRENT_TIMESTAMP::TEXT WHERE key = 'schema_created_at';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Reverie House database schema initialized successfully';
    RAISE NOTICE '📊 31 tables created';
    RAISE NOTICE '🔗 Foreign key constraints active';
    RAISE NOTICE '📈 Indexes optimized for queries';
    RAISE NOTICE '🎯 Ready for data migration from SQLite';
END $$;
