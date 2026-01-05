-- =============================================================================
-- MIGRATION 003: Heraldry System Tables
-- =============================================================================
-- Adds tables for PDS server visual identity (heraldry), community 
-- representation, and ambassador system
-- =============================================================================

-- =============================================================================
-- HERALDRY: PDS Community Visual Identity
-- =============================================================================

-- Main heraldry table - one row per unique PDS community identity
-- Multiple PDS domains can share the same heraldry (e.g., blacksky.app, blacksky.team)
CREATE TABLE IF NOT EXISTS heraldry (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE,     -- e.g., 'blacksky', 'northsky', 'reverie'
    name TEXT NOT NULL,   -- Display name, e.g., 'Blacksky'
    full_name TEXT,       -- Extended name, e.g., 'Blacksky Community'
    description TEXT,     -- Brief description of the community
    
    -- Visual identity
    color_primary TEXT NOT NULL DEFAULT '#2d3748',
    color_secondary TEXT DEFAULT '#1a202c',
    icon_path TEXT,       -- Path to PNG icon, e.g., '/assets/heraldry/blacksky.png'
    
    -- Ambassador - first user from this PDS to login
    ambassador_did TEXT REFERENCES dreamers(did) ON DELETE SET NULL,
    ambassador_since TIMESTAMP DEFAULT NOW(),
    
    -- Metadata
    user_count INTEGER DEFAULT 0,  -- Tracked population from this PDS
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Flags
    is_verified BOOLEAN DEFAULT FALSE,  -- Ambassador has verified ownership
    is_active BOOLEAN DEFAULT TRUE      -- Community is active
);

CREATE INDEX IF NOT EXISTS idx_heraldry_ambassador ON heraldry(ambassador_did);
CREATE INDEX IF NOT EXISTS idx_heraldry_active ON heraldry(is_active);
CREATE INDEX IF NOT EXISTS idx_heraldry_slug ON heraldry(slug);

-- =============================================================================
-- HERALDRY DOMAINS: Maps PDS domains to heraldry identities
-- =============================================================================

-- Many-to-one: multiple domains can share one heraldry identity
CREATE TABLE IF NOT EXISTS heraldry_domains (
    domain TEXT PRIMARY KEY,              -- e.g., 'blacksky.app', 'blacksky.team'
    heraldry_id INTEGER NOT NULL REFERENCES heraldry(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,     -- Is this the primary/canonical domain?
    is_pattern BOOLEAN DEFAULT FALSE,     -- Is this a wildcard pattern like *.pds.example.com?
    added_at TIMESTAMP DEFAULT NOW(),
    added_by TEXT REFERENCES dreamers(did) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_heraldry_domains_heraldry ON heraldry_domains(heraldry_id);

-- =============================================================================
-- REPRESENTATIVES: Users who can speak for their community
-- =============================================================================

-- Representatives can provide input on their community's heraldry
-- The ambassador is always also a representative
CREATE TABLE IF NOT EXISTS representatives (
    id SERIAL PRIMARY KEY,
    heraldry_id INTEGER NOT NULL REFERENCES heraldry(id) ON DELETE CASCADE,
    did TEXT NOT NULL REFERENCES dreamers(did) ON DELETE CASCADE,
    
    -- Role within the community
    role TEXT DEFAULT 'representative',  -- 'ambassador', 'representative', 'contributor'
    title TEXT,                          -- Custom title, e.g., 'Blacksky Founder'
    
    -- Permissions
    can_edit_colors BOOLEAN DEFAULT FALSE,
    can_edit_icon BOOLEAN DEFAULT FALSE,
    can_edit_description BOOLEAN DEFAULT FALSE,
    can_add_domains BOOLEAN DEFAULT FALSE,
    can_add_representatives BOOLEAN DEFAULT FALSE,
    
    -- Tracking
    joined_at TIMESTAMP DEFAULT NOW(),
    invited_by TEXT REFERENCES dreamers(did) ON DELETE SET NULL,
    last_active TIMESTAMP,
    
    UNIQUE(heraldry_id, did)
);

CREATE INDEX IF NOT EXISTS idx_representatives_heraldry ON representatives(heraldry_id);
CREATE INDEX IF NOT EXISTS idx_representatives_did ON representatives(did);
CREATE INDEX IF NOT EXISTS idx_representatives_role ON representatives(role);

-- =============================================================================
-- HERALDRY HISTORY: Audit trail for changes
-- =============================================================================

CREATE TABLE IF NOT EXISTS heraldry_history (
    id SERIAL PRIMARY KEY,
    heraldry_id INTEGER NOT NULL REFERENCES heraldry(id) ON DELETE CASCADE,
    changed_by_did TEXT REFERENCES dreamers(did) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    change_type TEXT NOT NULL,  -- e.g., 'update', 'icon_upload', 'ambassador_transfer'
    change_data TEXT            -- JSON or description of what changed
);

CREATE INDEX IF NOT EXISTS idx_heraldry_history_heraldry ON heraldry_history(heraldry_id);
CREATE INDEX IF NOT EXISTS idx_heraldry_history_changed_at ON heraldry_history(changed_at DESC);

-- =============================================================================
-- FUNCTIONS: Helper functions for heraldry management
-- =============================================================================

-- Get heraldry for a given PDS domain
CREATE OR REPLACE FUNCTION get_heraldry_for_domain(p_domain TEXT)
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    color_primary TEXT,
    color_secondary TEXT,
    icon_path TEXT,
    ambassador_did TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT h.id, h.name, h.color_primary, h.color_secondary, h.icon_path, h.ambassador_did
    FROM heraldry h
    JOIN heraldry_domains hd ON h.id = hd.heraldry_id
    WHERE hd.domain = p_domain;
END;
$$ LANGUAGE plpgsql;

-- Assign ambassador when first user from a PDS logs in
CREATE OR REPLACE FUNCTION assign_ambassador_if_new(
    p_heraldry_id INTEGER,
    p_did TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_ambassador TEXT;
BEGIN
    -- Check if there's already an ambassador
    SELECT ambassador_did INTO current_ambassador
    FROM heraldry
    WHERE id = p_heraldry_id;
    
    -- If no ambassador, assign this user
    IF current_ambassador IS NULL THEN
        UPDATE heraldry
        SET ambassador_did = p_did,
            ambassador_since = NOW(),
            updated_at = NOW()
        WHERE id = p_heraldry_id;
        
        -- Also add as representative with full permissions
        INSERT INTO representatives (heraldry_id, did, role, can_edit_colors, can_edit_icon, 
                                     can_edit_description, can_add_domains, can_add_representatives)
        VALUES (p_heraldry_id, p_did, 'ambassador', TRUE, TRUE, TRUE, TRUE, TRUE)
        ON CONFLICT (heraldry_id, did) DO UPDATE
        SET role = 'ambassador',
            can_edit_colors = TRUE,
            can_edit_icon = TRUE,
            can_edit_description = TRUE,
            can_add_domains = TRUE,
            can_add_representatives = TRUE;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Add a user as representative when they log in from a tracked PDS
CREATE OR REPLACE FUNCTION add_representative_on_login(
    p_heraldry_id INTEGER,
    p_did TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO representatives (heraldry_id, did, role)
    VALUES (p_heraldry_id, p_did, 'representative')
    ON CONFLICT (heraldry_id, did) DO UPDATE
    SET last_active = NOW();
    
    -- Update user count
    UPDATE heraldry
    SET user_count = (
        SELECT COUNT(*) FROM representatives WHERE heraldry_id = p_heraldry_id
    ),
    updated_at = NOW()
    WHERE id = p_heraldry_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- METADATA
-- =============================================================================

-- Ensure metadata table exists
CREATE TABLE IF NOT EXISTS _metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO _metadata (key, value, updated_at) 
VALUES ('heraldry_migration', '003', NOW())
ON CONFLICT (key) DO UPDATE SET value = '003', updated_at = NOW();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Heraldry tables created';
    RAISE NOTICE '🛡️ heraldry - PDS community identity';
    RAISE NOTICE '🌐 heraldry_domains - domain-to-heraldry mapping';
    RAISE NOTICE '👑 representatives - community representatives';
    RAISE NOTICE '📜 heraldry_history - audit trail';
END $$;
