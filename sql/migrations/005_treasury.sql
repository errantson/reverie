-- Treasury: internal tracking of funds pooled from OpenCollective and book sales
CREATE TABLE IF NOT EXISTS treasury (
    id SERIAL PRIMARY KEY,
    
    -- OpenCollective synced values (in cents to avoid float issues)
    oc_balance_cents INTEGER DEFAULT 0,
    oc_raised_cents INTEGER DEFAULT 0,
    oc_disbursed_cents INTEGER DEFAULT 0,
    
    -- Print revenue contribution (books * 350 cents each)
    print_revenue_cents INTEGER DEFAULT 0,
    print_books_counted INTEGER DEFAULT 0,
    
    -- Computed totals
    total_balance_cents INTEGER DEFAULT 0,
    total_raised_cents INTEGER DEFAULT 0,
    
    -- Sync metadata
    oc_last_sync TIMESTAMP,
    print_last_sync TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert single row for treasury state
INSERT INTO treasury (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Treasury transactions log for audit trail
CREATE TABLE IF NOT EXISTS treasury_transactions (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL,  -- 'opencollective', 'print_sales', 'manual'
    type TEXT NOT NULL,    -- 'sync', 'contribution', 'disbursement'
    amount_cents INTEGER NOT NULL,
    description TEXT,
    reference_id TEXT,     -- e.g., event id, OC transaction id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_source ON treasury_transactions(source);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_created ON treasury_transactions(created_at DESC);
