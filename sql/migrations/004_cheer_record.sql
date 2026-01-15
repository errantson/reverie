-- cheer_record: tracks likes by cheerful workers
CREATE TABLE IF NOT EXISTS cheer_record (
    id SERIAL PRIMARY KEY,
    cheerful_did TEXT NOT NULL,
    post_uri TEXT NOT NULL,
    post_author_did TEXT NOT NULL,
    cheered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    like_uri TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    UNIQUE(cheerful_did, post_uri)
);

CREATE INDEX IF NOT EXISTS idx_cheer_record_cheered_at ON cheer_record(cheered_at);
