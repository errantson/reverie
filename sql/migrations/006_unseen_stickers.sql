-- Track which stickers a user has already seen (for NEW badge)
-- Simple approach: store sticker subject DIDs that have been viewed
-- Any sticker NOT in this table = NEW
CREATE TABLE IF NOT EXISTS sticker_acknowledged (
    id SERIAL PRIMARY KEY,
    user_did TEXT NOT NULL,
    sticker_subject_did TEXT NOT NULL,
    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_did, sticker_subject_did)
);

CREATE INDEX IF NOT EXISTS idx_sticker_ack_user ON sticker_acknowledged(user_did);
