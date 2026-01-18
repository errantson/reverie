-- Migration 009: Guardian Labels System
-- Track labels applied to lore.farm labeler for ward/charge protection

-- Track per-guardian labels applied to content
CREATE TABLE IF NOT EXISTS guardian_labels (
    id SERIAL PRIMARY KEY,
    
    -- What is being labeled
    uri TEXT NOT NULL,                      -- AT URI of post or 'did:{did}' for user-level
    target_did TEXT,                        -- DID of content author (for user-level labels)
    
    -- Who is the source guardian
    guardian_did TEXT NOT NULL,
    guardian_handle TEXT NOT NULL,          -- Handle for label value (safe:handle or hide:handle)
    
    -- Label details
    label_type TEXT NOT NULL,               -- 'safe' (for wards) or 'hide' (for charges)
    reason TEXT,                            -- Optional reason for the label
    
    -- Sync state
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_to_labeler BOOLEAN DEFAULT FALSE,
    sync_error TEXT,                        -- Last sync error if any
    
    -- For label negation (removal)
    negated_at TIMESTAMP WITH TIME ZONE,
    negation_synced BOOLEAN DEFAULT FALSE,
    
    UNIQUE(uri, guardian_did, label_type)
);

CREATE INDEX IF NOT EXISTS idx_guardian_labels_uri ON guardian_labels(uri);
CREATE INDEX IF NOT EXISTS idx_guardian_labels_guardian ON guardian_labels(guardian_did);
CREATE INDEX IF NOT EXISTS idx_guardian_labels_type ON guardian_labels(label_type);
CREATE INDEX IF NOT EXISTS idx_guardian_labels_unsynced ON guardian_labels(synced_to_labeler) WHERE synced_to_labeler = FALSE;
CREATE INDEX IF NOT EXISTS idx_guardian_labels_target ON guardian_labels(target_did);

COMMENT ON TABLE guardian_labels IS 'Labels applied to lore.farm for guardian-based content moderation';
COMMENT ON COLUMN guardian_labels.label_type IS 'safe = approved for wards, hide = barred for charges';

-- Track aggregate community labels (majority threshold)
CREATE TABLE IF NOT EXISTS aggregate_labels (
    uri TEXT PRIMARY KEY,
    target_did TEXT,                        -- DID of content author
    guardian_count INTEGER DEFAULT 0,       -- How many guardians have flagged this
    threshold_met BOOLEAN DEFAULT FALSE,    -- Has majority threshold been reached
    label_applied BOOLEAN DEFAULT FALSE,    -- Has hide:community been applied to labeler
    first_flagged_at TIMESTAMP WITH TIME ZONE,
    threshold_met_at TIMESTAMP WITH TIME ZONE,
    label_applied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_aggregate_labels_threshold ON aggregate_labels(threshold_met) WHERE threshold_met = TRUE;
CREATE INDEX IF NOT EXISTS idx_aggregate_labels_target ON aggregate_labels(target_did);

COMMENT ON TABLE aggregate_labels IS 'Track content that multiple guardians have barred for aggregate hide:community label';

-- Track ward/charge labeler subscription status
CREATE TABLE IF NOT EXISTS labeler_subscriptions (
    user_did TEXT PRIMARY KEY,
    guardian_did TEXT,                      -- Their assigned guardian
    guardian_handle TEXT,                   -- Guardian handle for label matching
    subscription_type TEXT NOT NULL,        -- 'ward' or 'charge'
    
    -- Subscription configuration
    subscribed_to_labeler BOOLEAN DEFAULT FALSE,  -- Subscribed to did:web:reverie.house
    label_preferences_set BOOLEAN DEFAULT FALSE,  -- Label visibility configured
    
    -- Timestamps
    relationship_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subscription_configured_at TIMESTAMP WITH TIME ZONE,
    last_sync_attempt TIMESTAMP WITH TIME ZONE,
    last_sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_labeler_subs_guardian ON labeler_subscriptions(guardian_did);
CREATE INDEX IF NOT EXISTS idx_labeler_subs_type ON labeler_subscriptions(subscription_type);

COMMENT ON TABLE labeler_subscriptions IS 'Track ward/charge labeler subscription status for ATProto-wide protection';
