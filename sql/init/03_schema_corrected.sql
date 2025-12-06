-- =============================================================================
-- REVERIE HOUSE POSTGRESQL SCHEMA - SIMPLIFIED & ALIGNED
-- =============================================================================
-- Generated from SQLite schema: data/reverie.db
-- Simplified nomenclature: Single words where possible, clean column names
-- Foreign keys preserved, indexes optimized
-- =============================================================================

SET timezone = 'UTC';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- CORE: User Identity & Authentication
-- =============================================================================

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
    created_at TEXT,
    updated_at INTEGER,
    heading TEXT,
    heading_changed_at INTEGER,
    alts TEXT,
    color_hex TEXT,
    phanera TEXT,
    dream_pair_did TEXT,
    dream_pair_since INTEGER,
    collab_partner_did TEXT,
    collab_partner_since INTEGER,
    status TEXT
);

CREATE INDEX idx_dreamers_handle ON dreamers(handle);
CREATE INDEX idx_dreamers_name ON dreamers(name);
CREATE INDEX idx_dreamers_name_trgm ON dreamers USING gin (name gin_trgm_ops);

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

CREATE TABLE credentials (
    did TEXT PRIMARY KEY REFERENCES dreamers(did) ON DELETE CASCADE,
    password_hash TEXT,
    pds TEXT,
    created_at INTEGER DEFAULT extract(epoch from now())::integer,
    verified INTEGER,
    valid BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_credentials_valid ON credentials(valid);

CREATE TABLE admins (
    did TEXT PRIMARY KEY REFERENCES dreamers(did) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    authorized_by TEXT,
    authorized_at INTEGER NOT NULL,
    last_login INTEGER,
    notes TEXT
);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    admin_did TEXT NOT NULL REFERENCES admins(did),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX idx_sessions_admin ON sessions(admin_did);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- =============================================================================
-- CONTENT: User Timeline & Achievements
-- =============================================================================

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    event TEXT NOT NULL,
    type TEXT NOT NULL,
    key TEXT NOT NULL,
    uri TEXT,
    url TEXT,
    epoch INTEGER,
    created_at INTEGER
);

CREATE INDEX idx_events_did ON events(did);
CREATE INDEX idx_events_key ON events(key);
CREATE INDEX idx_events_did_key ON events(did, key);
CREATE INDEX idx_events_epoch ON events(epoch DESC);
CREATE INDEX idx_events_type_key ON events(type, key);

CREATE TABLE souvenirs (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    phanera TEXT,
    category TEXT,
    created_at INTEGER
);

CREATE TABLE awards (
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    souvenir_key TEXT NOT NULL,
    earned_epoch INTEGER,
    PRIMARY KEY(did, souvenir_key)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    recipient_did TEXT REFERENCES dreamers(did) ON DELETE CASCADE,
    pigeon_id INTEGER,
    subject TEXT,
    body TEXT,
    created_at INTEGER,
    read_at INTEGER,
    action TEXT,
    priority INTEGER DEFAULT 50
);

CREATE INDEX idx_messages_recipient ON messages(recipient_did);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_read ON messages(read_at);

CREATE TABLE actions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_did TEXT REFERENCES dreamers(did) ON DELETE CASCADE,
    action TEXT,
    action_data TEXT,
    created_at INTEGER,
    uri TEXT
);

CREATE INDEX idx_actions_message ON actions(message_id);
CREATE INDEX idx_actions_user ON actions(user_did);

-- =============================================================================
-- GAME: Quests & World State
-- =============================================================================

CREATE TABLE quests (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    uri TEXT,
    commands TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    canon_event TEXT,
    canon_keys TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    conditions TEXT,
    condition_operator TEXT DEFAULT 'AND',
    trigger_type TEXT DEFAULT 'bsky_reply',
    trigger_config TEXT,
    hose_service TEXT DEFAULT 'questhose'
);

CREATE INDEX idx_quests_enabled ON quests(enabled);
CREATE INDEX idx_quests_trigger_type ON quests(trigger_type);

CREATE TABLE retries (
    id SERIAL PRIMARY KEY,
    did TEXT REFERENCES dreamers(did) ON DELETE CASCADE,
    quest_id INTEGER REFERENCES quests(id) ON DELETE CASCADE,
    requested_at INTEGER,
    status TEXT
);

CREATE TABLE world (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
);

-- =============================================================================
-- SOCIAL: Relationships
-- =============================================================================

CREATE TABLE kindred (
    did_a TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    did_b TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    discovered_epoch INTEGER NOT NULL,
    paired INTEGER DEFAULT 0,
    paired_epoch INTEGER,
    PRIMARY KEY (did_a, did_b),
    CHECK (did_a < did_b)
);

CREATE INDEX idx_kindred_a ON kindred(did_a);
CREATE INDEX idx_kindred_b ON kindred(did_b);

-- =============================================================================
-- AUTOMATION: Pigeons & Dialogues
-- =============================================================================

CREATE TABLE pigeons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active',
    trigger_type TEXT NOT NULL,
    trigger_config TEXT,
    dialogue_key TEXT NOT NULL,
    conditions TEXT DEFAULT '[]',
    condition_operator TEXT DEFAULT 'AND',
    priority INTEGER DEFAULT 50,
    repeating INTEGER DEFAULT 1,
    max_deliveries INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT
);

CREATE INDEX idx_pigeons_status ON pigeons(status);

CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    pigeon_id INTEGER NOT NULL REFERENCES pigeons(id) ON DELETE CASCADE,
    recipient_did TEXT REFERENCES dreamers(did) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id),
    delivered_at INTEGER NOT NULL,
    status TEXT DEFAULT 'sent',
    context TEXT
);

CREATE INDEX idx_deliveries_pigeon ON deliveries(pigeon_id);
CREATE INDEX idx_deliveries_recipient ON deliveries(recipient_did);

CREATE TABLE dialogues (
    id SERIAL PRIMARY KEY,
    key TEXT,
    speaker TEXT,
    content TEXT,
    mood TEXT,
    style TEXT,
    context TEXT,
    triggers TEXT,
    created_at TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    category TEXT,
    priority INTEGER DEFAULT 50,
    conditions TEXT,
    next_id INTEGER,
    branch_a INTEGER,
    branch_b INTEGER,
    branch_c INTEGER
);

CREATE TABLE dialogue_seen (
    id SERIAL PRIMARY KEY,
    did TEXT REFERENCES dreamers(did) ON DELETE CASCADE,
    dialogue_id INTEGER REFERENCES dialogues(id) ON DELETE CASCADE,
    seen_at INTEGER,
    UNIQUE(did, dialogue_id)
);

CREATE INDEX idx_dialogue_seen_did ON dialogue_seen(did);

CREATE TABLE courier (
    id SERIAL PRIMARY KEY,
    did TEXT REFERENCES dreamers(did) ON DELETE CASCADE,
    text TEXT,
    scheduled_for INTEGER,
    posted_at INTEGER,
    status TEXT DEFAULT 'pending',
    uri TEXT
);

CREATE INDEX idx_courier_did ON courier(did);
CREATE INDEX idx_courier_scheduled ON courier(scheduled_for);
CREATE INDEX idx_courier_status ON courier(status);

-- =============================================================================
-- LIBRARY & REFERENCE
-- =============================================================================

CREATE TABLE books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    cover TEXT,
    epub TEXT,
    author TEXT,
    release INTEGER,
    pages INTEGER,
    isbn TEXT,
    asin TEXT,
    amazon_reviews TEXT,
    goodreads_reviews TEXT
);

CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file TEXT NOT NULL,
    chapter_order INTEGER
);

CREATE INDEX idx_chapters_book ON chapters(book_id);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT,
    created_at INTEGER
);

CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at INTEGER NOT NULL,
    assigned_by TEXT,
    UNIQUE(did, role_id)
);

CREATE INDEX idx_assignments_did ON assignments(did);
CREATE INDEX idx_assignments_role ON assignments(role_id);

CREATE TABLE invites (
    code TEXT PRIMARY KEY,
    created_by TEXT REFERENCES dreamers(did),
    created_at INTEGER NOT NULL,
    used_by TEXT REFERENCES dreamers(did),
    used_at INTEGER,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0
);

CREATE INDEX idx_invites_created_by ON invites(created_by);
CREATE INDEX idx_invites_used_by ON invites(used_by);

-- =============================================================================
-- LOGS & HISTORY
-- =============================================================================

CREATE TABLE admin_log (
    id SERIAL PRIMARY KEY,
    admin_did TEXT REFERENCES admins(did),
    action TEXT,
    target_did TEXT,
    details TEXT,
    timestamp INTEGER,
    ip_address TEXT,
    notes TEXT
);

CREATE INDEX idx_admin_log_admin ON admin_log(admin_did);
CREATE INDEX idx_admin_log_timestamp ON admin_log(timestamp DESC);

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

CREATE TABLE spectrum_snapshots (
    id SERIAL PRIMARY KEY,
    epoch INTEGER NOT NULL,
    operation TEXT,
    total_dreamers INTEGER,
    snapshot_data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    notes TEXT
);

CREATE INDEX idx_spectrum_snapshots_epoch ON spectrum_snapshots(epoch);
CREATE INDEX idx_spectrum_snapshots_created ON spectrum_snapshots(created_at);

CREATE TABLE world_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_data TEXT NOT NULL,
    snapshot_at INTEGER NOT NULL
);

CREATE INDEX idx_world_snapshots_at ON world_snapshots(snapshot_at DESC);

CREATE TABLE _metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
);

-- =============================================================================
-- INITIALIZATION
-- =============================================================================

INSERT INTO _metadata (key, value, updated_at) VALUES 
    ('schema_version', '1.0.0', extract(epoch from now())::integer),
    ('migration_date', now()::text, extract(epoch from now())::integer),
    ('source', 'SQLite', extract(epoch from now())::integer);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Reverie House PostgreSQL schema initialized';
    RAISE NOTICE '📊 Simplified nomenclature applied';
    RAISE NOTICE '🔗 Foreign keys active';
    RAISE NOTICE '📈 Indexes optimized';
    RAISE NOTICE '🎯 Ready for data migration';
END $$;
