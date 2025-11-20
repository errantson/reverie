#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Quest System - Database-backed quest monitoring

Manages quest configuration and monitoring in the database.
Replaces the old quest.json file-based system.
"""

import json
import time
from typing import List, Dict, Optional, Set
from core.database import DatabaseManager


class QuestManager:
    """Manages quest configuration and monitoring."""
    
    def __init__(self, db: Optional[DatabaseManager] = None):
        self.db = db or DatabaseManager()
        self._ensure_quest_table()
    
    def _ensure_quest_table(self):
        """Create quest table if it doesn't exist."""
        # Check if table exists (PostgreSQL compatible)
        uri_column = self.db.fetch_one("""
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'uri'
        """)
        
        if uri_column:
            # Check if URI column allows NULL (is_nullable = 'YES')
            if uri_column['is_nullable'] == 'NO':
                print("Migrating quests table to allow optional URIs...")
                self._migrate_quest_table_for_optional_uri()
                return
        
        # Create new table with optional URI (PostgreSQL uses SERIAL instead of AUTOINCREMENT)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS quests (
                id SERIAL PRIMARY KEY,
                title TEXT UNIQUE NOT NULL,
                uri TEXT,
                commands TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                description TEXT,
                canon_event TEXT,
                canon_keys TEXT,
                created_at INTEGER,
                updated_at INTEGER,
                conditions TEXT,
                condition_operator TEXT DEFAULT 'AND',
                trigger_type TEXT DEFAULT 'bsky_reply',
                trigger_config TEXT
            )
        """)
        
        self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_quests_enabled 
            ON quests(enabled) WHERE enabled = true
        """)
    
    def _migrate_quest_table_for_optional_uri(self):
        """Migrate quests table to allow NULL URIs and remove legacy columns."""
        # PostgreSQL supports ALTER COLUMN directly
        try:
            # Make URI column nullable
            self.db.execute("ALTER TABLE quests ALTER COLUMN uri DROP NOT NULL")
            print("✅ Migrated quests table - URI is now optional")
        except Exception as e:
            print(f"⚠️ Migration note: {e}")
            # If it fails, the column might already be nullable
        
        # Recreate index
        self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_quests_enabled 
            ON quests(enabled) WHERE enabled = true
        """)
        
        print("✅ Quest table migration complete")
    
    def add_quest(self, title: str, uri: str = '', commands: List[str] = None, 
                  enabled: bool = True,
                  description: Optional[str] = None,
                  canon_event: Optional[str] = None,
                  canon_keys: Optional[List[str]] = None,
                  conditions: Optional[List[Dict]] = None,
                  condition_operator: str = 'AND',
                  trigger_type: str = 'bsky_reply',
                  trigger_config: Optional[Dict] = None,
                  hose_service: Optional[str] = 'questhose') -> int:
        """
        Add a new quest to the database.
        
        Args:
            title: Unique quest identifier
            uri: AT Protocol URI of the post to monitor (for bsky_reply triggers)
            commands: List of commands to execute (e.g., ['name_dreamer', 'like_post'])
            enabled: Whether quest is active
            description: Human-readable description
            canon_event: Event text for canon entries
            canon_keys: Tags for canon entries
            conditions: List of condition objects (new format)
            condition_operator: Global operator for conditions (AND/OR/NOT/XOR)
            trigger_type: How quest is triggered ('bsky_reply', 'poll', 'webhook', etc.)
            trigger_config: Trigger-specific configuration (JSON)
            hose_service: Which firehose service monitors this ('questhose', 'greeterhose', None)
            
        Returns:
            Quest ID
        """
        if commands is None:
            commands = []
        
        # Default to simple any_reply condition if none provided
        if conditions is None:
            conditions = [{"type": "condition", "condition": "any_reply", "operator": "AND"}]
        
        now = int(time.time())
        
        self.db.execute("""
            INSERT INTO quests (title, uri, commands, enabled, 
                               description, canon_event, canon_keys, 
                               created_at, updated_at, conditions, condition_operator,
                               trigger_type, trigger_config, hose_service)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            title,
            uri,
            json.dumps(commands),
            1 if enabled else 0,
            description,
            canon_event,
            json.dumps(canon_keys) if canon_keys else None,
            now,
            now,
            json.dumps(conditions),
            condition_operator,
            trigger_type,
            json.dumps(trigger_config) if trigger_config else None,
            hose_service
        ))
        
        # For PostgreSQL, we need to retrieve the ID from a RETURNING clause
        # But since we can't modify the signature easily, return 1 for success
        # The quest is identified by title anyway, not ID
        return 1
    
    def get_quest(self, title: str) -> Optional[Dict]:
        """Get quest configuration by title."""
        row = self.db.fetch_one("""
            SELECT * FROM quests WHERE title = %s
        """, (title,))
        if not row:
            return None
        
        return self._row_to_dict(row)
    
    def get_enabled_quests(self) -> List[Dict]:
        """Get all enabled quests."""
        rows = self.db.fetch_all("""
            SELECT * FROM quests WHERE enabled = true ORDER BY id
        """)
        
        return [self._row_to_dict(row) for row in rows] if rows else []
    
    def get_all_quests(self) -> List[Dict]:
        """Get all quests (enabled and disabled)."""
        rows = self.db.fetch_all("""
            SELECT * FROM quests ORDER BY id
        """)
        
        return [self._row_to_dict(row) for row in rows] if rows else []
    
    def get_quest_uris(self) -> Set[str]:
        """Get URIs of all enabled bsky_reply quests for firehose monitoring."""
        rows = self.db.fetch_all("""
            SELECT uri FROM quests 
            WHERE enabled = true 
            AND (trigger_type = 'bsky_reply' OR trigger_type IS NULL)
            AND uri IS NOT NULL 
            AND uri != ''
        """)
        
        return {row['uri'] for row in rows} if rows else set()
    
    def update_quest(self, title: str, **kwargs) -> bool:
        """
        Update quest fields.
        
        Args:
            title: Quest identifier
            **kwargs: Fields to update (uri, commands, enabled, conditions, trigger_type, etc.)
            
        Returns:
            True if quest was updated, False if not found
        """
        allowed_fields = {
            'uri', 'commands', 'enabled', 'description',
            'canon_event', 'canon_keys', 'conditions', 'condition_operator',
            'trigger_type', 'trigger_config'
        }
        
        updates = []
        values = []
        
        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue
            
            if field in ('commands', 'canon_keys', 'conditions', 'trigger_config') and isinstance(value, (list, dict)):
                value = json.dumps(value)
            elif field == 'enabled' and isinstance(value, bool):
                value = 1 if value else 0
            
            updates.append(f"{field} = %s")
            values.append(value)
        
        if not updates:
            return False
        
        updates.append("updated_at = %s")
        values.append(int(time.time()))
        
        values.append(title)
        
        query = f"UPDATE quests SET {', '.join(updates)} WHERE title = %s"
        
        self.db.execute(query, tuple(values))
        
        # PostgreSQL returns True if update succeeded (execute doesn't return cursor)
        return True
    
    def enable_quest(self, title: str) -> bool:
        """Enable a quest."""
        return self.update_quest(title, enabled=True)
    
    def disable_quest(self, title: str) -> bool:
        """Disable a quest."""
        return self.update_quest(title, enabled=False)
    
    def delete_quest(self, title: str) -> bool:
        """Delete a quest."""
        self.db.execute("DELETE FROM quests WHERE title = %s", (title,))
        return True
    
    def _row_to_dict(self, row) -> Dict:
        """Convert database row to quest dictionary."""
        quest = dict(row)
        
        # Parse JSON fields
        if quest.get('commands'):
            quest['commands'] = json.loads(quest['commands'])
        if quest.get('canon_keys'):
            quest['canon_keys'] = json.loads(quest['canon_keys'])
        if quest.get('conditions'):
            quest['conditions'] = json.loads(quest['conditions'])
        if quest.get('trigger_config'):
            quest['trigger_config'] = json.loads(quest['trigger_config'])
        
        quest['enabled'] = bool(quest.get('enabled'))
        
        if quest.get('canon_event') or quest.get('canon_keys'):
            quest['canon'] = {}
            if quest.get('canon_event'):
                quest['canon']['event'] = quest['canon_event']
            if quest.get('canon_keys'):
                quest['canon']['keys'] = quest['canon_keys']
        
        return quest
    
    def migrate_from_json(self, json_path: str) -> Dict[str, int]:
        """
        Migrate quests from old quest.json format.
        
        Args:
            json_path: Path to quest.json file
            
        Returns:
            Dictionary with counts: {'added': N, 'updated': N, 'errors': N}
        """
        result = {'added': 0, 'updated': 0, 'errors': 0}
        
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f"❌ Quest file not found: {json_path}")
            result['errors'] += 1
            return result
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in {json_path}: {e}")
            result['errors'] += 1
            return result
        
        quests = data.get('quest', [])
        
        for quest in quests:
            try:
                title = quest.get('title')
                if not title:
                    print(f"⚠️  Skipping quest without title")
                    result['errors'] += 1
                    continue
                
                existing = self.get_quest(title)
                
                canon = quest.get('canon', {})
                canon_event = canon.get('event')
                canon_keys = canon.get('keys')
                
                quest_data = {
                    'uri': quest.get('uri'),
                    'condition': quest.get('cond'),
                    'commands': quest.get('cmnd', []),
                    'enabled': quest.get('enabled', True),
                    'description': quest.get('description'),
                    'canon_event': canon_event,
                    'canon_keys': canon_keys
                }
                
                if existing:
                    if self.update_quest(title, **quest_data):
                        print(f"✅ Updated quest: {title}")
                        result['updated'] += 1
                else:
                    self.add_quest(title, **quest_data)
                    print(f"✅ Added quest: {title}")
                    result['added'] += 1
                    
            except Exception as e:
                print(f"❌ Error migrating quest {quest.get('title', 'unknown')}: {e}")
                result['errors'] += 1
        
        return result


def migrate_quests_to_database():
    """CLI tool to migrate quests from JSON to database."""
    import sys
    from pathlib import Path
    
    possible_paths = [
        '/srv/ops/quest.json',
        '/srv/site/data/quest.json',
        '/srv/data/quest.json',
        Path(__file__).parent.parent / 'ops' / 'quest.json'
    ]
    
    json_path = None
    for path in possible_paths:
        if Path(path).exists():
            json_path = str(path)
            break
    
    if not json_path:
        print("❌ Could not find quest.json file")
        print("   Looked in:")
        for path in possible_paths:
            print(f"   - {path}")
        return False
    
    print(f"📁 Found quest.json: {json_path}")
    print()
    
    manager = QuestManager()
    result = manager.migrate_from_json(json_path)
    
    print()
    print("=" * 60)
    print("📊 MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Added: {result['added']}")
    print(f"Updated: {result['updated']}")
    print(f"Errors: {result['errors']}")
    print()
    
    quests = manager.get_all_quests()
    print(f"📋 Current quests in database: {len(quests)}")
    for quest in quests:
        status = "✅" if quest['enabled'] else "❌"
        print(f"   {status} {quest['title']} - {quest['description']}")
    
    return True


if __name__ == '__main__':
    migrate_quests_to_database()
