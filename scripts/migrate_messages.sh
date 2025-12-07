#!/bin/bash
# Message System Migration Script
# Adds messages inbox table to database

DB_PATH="/srv/data/reverie.db"
MIGRATION_FILE="/srv/data/migrations/004_messages_inbox.sql"

echo "📬 Message System Migration"
echo "=========================="
echo ""

# Backup database
echo "📦 Creating backup..."
cp "$DB_PATH" "$DB_PATH.backup_$(date +%Y%m%d_%H%M%S)"
echo "✓ Backup created"
echo ""

# Run migration
echo "🔧 Running migration..."
sqlite3 "$DB_PATH" < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Migration successful!"
    echo ""
    
    # Verify tables
    echo "📊 Verifying tables..."
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('messages', 'message_interactions') ORDER BY name;"
    echo ""
    
    # Add delivery_mode column to dialogues
    echo "🔧 Adding delivery_mode to dialogues table..."
    sqlite3 "$DB_PATH" "ALTER TABLE dialogues ADD COLUMN delivery_mode TEXT DEFAULT 'immediate';" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Column added successfully"
    else
        echo "⚠️ Column may already exist (this is OK)"
    fi
    echo ""
    
    echo "✅ Migration complete!"
    echo ""
    echo "Next steps:"
    echo "1. Include messages.js in your pages: <script src=\"/js/widgets/messages.js\"></script>"
    echo "2. Include messages.css: <link rel=\"stylesheet\" href=\"/css/widgets/messages.css\">"
    echo "3. Update header.js to call updateMessageBadge()"
    echo "4. Test by creating a test message via Python console"
else
    echo "❌ Migration failed!"
    exit 1
fi
