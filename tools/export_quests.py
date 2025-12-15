#!/usr/bin/env python3
"""
Export all quests (enabled and disabled) to JSON for analysis.
Run: python3 tools/export_quests.py > quests.json
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from ops.quests import QuestManager


def main():
    manager = QuestManager()
    quests = manager.get_all_quests()
    print(json.dumps(quests, indent=2, default=str))


if __name__ == '__main__':
    main()
