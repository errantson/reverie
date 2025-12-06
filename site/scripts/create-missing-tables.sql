-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_by TEXT,
    used_at TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_invite_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_used ON invite_codes(used_by);

-- Create dialogues table
CREATE TABLE IF NOT EXISTS dialogues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0,
    speaker TEXT,
    avatar TEXT,
    text TEXT NOT NULL,
    buttons_json TEXT,
    context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dialogue_key ON dialogues(key);
CREATE INDEX IF NOT EXISTS idx_dialogue_key_sequence ON dialogues(key, sequence);
CREATE INDEX IF NOT EXISTS idx_dialogue_context ON dialogues(context);
