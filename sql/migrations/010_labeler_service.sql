-- Migration 010: Labeler Service Tables
-- Core infrastructure for Reverie House as an ATProto labeler

-- Main labels table - stores all labels issued by the labeler
CREATE TABLE IF NOT EXISTS labels (
    id SERIAL PRIMARY KEY,
    uri TEXT NOT NULL,                    -- AT URI of the subject (post or account)
    val TEXT NOT NULL,                    -- Label value (e.g., "hide:guardian.handle")
    src TEXT NOT NULL DEFAULT 'did:web:reverie.house',  -- Labeler DID
    neg BOOLEAN NOT NULL DEFAULT FALSE,   -- True if this is a negation
    cts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Created timestamp
    exp TIMESTAMP WITH TIME ZONE,         -- Optional expiration
    sig TEXT,                             -- Base64-encoded signature
    creator_did TEXT,                     -- DID of guardian who created this label
    reason TEXT,                          -- Optional reason for the label
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one active label per uri+val+src combination
    CONSTRAINT labels_uri_val_src_unique UNIQUE (uri, val, src)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_labels_uri ON labels(uri);
CREATE INDEX IF NOT EXISTS idx_labels_val ON labels(val);
CREATE INDEX IF NOT EXISTS idx_labels_src ON labels(src);
CREATE INDEX IF NOT EXISTS idx_labels_cts ON labels(cts DESC);
CREATE INDEX IF NOT EXISTS idx_labels_creator ON labels(creator_did);
CREATE INDEX IF NOT EXISTS idx_labels_neg ON labels(neg) WHERE neg = FALSE;

-- Index for prefix matching on URIs (for did:* queries)
CREATE INDEX IF NOT EXISTS idx_labels_uri_prefix ON labels(uri text_pattern_ops);

COMMENT ON TABLE labels IS 'ATProto labels issued by the Reverie House labeler service';
COMMENT ON COLUMN labels.uri IS 'AT URI of the labeled subject (post URI or account DID)';
COMMENT ON COLUMN labels.val IS 'Label value like safe:handle, hide:handle, hide:community, lore, canon';
COMMENT ON COLUMN labels.src IS 'DID of the labeler (always did:web:reverie.house)';
COMMENT ON COLUMN labels.neg IS 'True if this label negates/removes a previous label';
COMMENT ON COLUMN labels.cts IS 'Timestamp when the label was created (ISO 8601)';
COMMENT ON COLUMN labels.sig IS 'Base64-encoded cryptographic signature';
COMMENT ON COLUMN labels.creator_did IS 'DID of the guardian who requested this label';

-- Label subscription tracking (who has subscribed to our labeler)
CREATE TABLE IF NOT EXISTS label_subscribers (
    id SERIAL PRIMARY KEY,
    subscriber_did TEXT NOT NULL UNIQUE,  -- DID of the subscriber
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE,
    cursor_position TEXT,                 -- Last label they received (for resumption)
    active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_label_subs_active ON label_subscribers(active) WHERE active = TRUE;

COMMENT ON TABLE label_subscribers IS 'Tracks clients subscribed to label updates';
