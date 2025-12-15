#!/usr/bin/env python3
"""
Migrate quests in the database to canonical schema using tools/quest_migration.convert_quest_record.

Usage:
  python3 tools/migrate_quests_to_canonical.py

This will update the `conditions` and `commands` fields for all quests.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from ops.quests import QuestManager
from tools.quest_migration import convert_quest_record


def main():
    mgr = QuestManager()
    quests = mgr.get_all_quests()
    print(f"Found {len(quests)} quests to migrate")

    for q in quests:
        print(f"Migrating: {q['title']}")
        new_q = convert_quest_record(q)

        # Update commands and conditions using update_quest
        updated = mgr.update_quest(q['title'], commands=new_q['commands'], conditions=new_q['conditions'], trigger_type=new_q.get('trigger_type'))
        if updated:
            print(f"  ✓ Updated {q['title']}")
        else:
            print(f"  ⚠️ Failed to update {q['title']}")

    print("Migration complete")


if __name__ == '__main__':
    main()
