#!/usr/bin/env python3
"""
🎯 QUEST MANAGEMENT & DIAGNOSTICS TOOL
Manage and monitor firehose-integrated quests

Features:
- View all quests with status and details
- Enable/disable quests
- Test quest conditions
- Monitor quest activity
- Validate quest configuration
- Check firehose integration status
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

from ops.quests import QuestManager
from ops.quest_hooks import get_quest_uris, process_quest_reply
from core.database import DatabaseManager
from core.network import NetworkClient


class QuestDiagnostics:
    """Quest system diagnostics and management."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.manager = QuestManager()
        self.db = DatabaseManager()
        self.network = NetworkClient()
    
    def show_all_quests(self, show_disabled: bool = False):
        """Display all quests with their status and details."""
        if show_disabled:
            quests = self.manager.get_all_quests()
            title = "📋 ALL QUESTS (ENABLED & DISABLED)"
        else:
            quests = self.manager.get_enabled_quests()
            title = "📋 ACTIVE QUESTS"
        
        print("\n" + "=" * 80)
        print(title)
        print("=" * 80)
        
        if not quests:
            print("❌ No quests found")
            if not show_disabled:
                print("   Try: questing.py --all to see disabled quests")
            return
        
        for i, quest in enumerate(quests, 1):
            self._print_quest_details(quest, index=i)
            if i < len(quests):
                print("-" * 80)
        
        print("\n" + "=" * 80)
        print(f"📊 SUMMARY: {len(quests)} quest(s)")
        
        enabled_count = sum(1 for q in quests if q['enabled'])
        disabled_count = len(quests) - enabled_count
        
        if show_disabled:
            print(f"   ✅ Enabled: {enabled_count}")
            print(f"   ❌ Disabled: {disabled_count}")
        
        print("=" * 80 + "\n")
    
    def _print_quest_details(self, quest: Dict, index: Optional[int] = None):
        """Print detailed information about a quest."""
        status = "✅ ENABLED" if quest['enabled'] else "❌ DISABLED"
        
        if index:
            print(f"\n[{index}] {quest['title']}")
        else:
            print(f"\n{quest['title']}")
        
        print(f"Status:      {status}")
        
        if quest.get('description'):
            print(f"Description: {quest['description']}")
        
        if quest.get('uri'):
            print(f"URI:         {quest['uri']}")
            
            # Convert URI to clickable Bluesky link
            if quest['uri'].startswith('at://'):
                bsky_url = quest['uri'].replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
                print(f"View Post:   {bsky_url}")
        
        # Display canonical conditions if available, otherwise show legacy condition
            if quest.get('conditions'):
                try:
                    conditions_str = json.dumps(quest['conditions'], indent=2)
                except Exception:
                    conditions_str = str(quest.get('conditions'))
                print(f"Conditions:  {conditions_str}")
            elif quest.get('condition'):
                print(f"Condition:   {quest.get('condition')}")

        # Display commands (support canonical command objects and legacy strings)
        if quest.get('commands'):
            cmds_out = []
            for c in quest.get('commands', []):
                if isinstance(c, dict):
                    args = c.get('args') or []
                    cmds_out.append(f"{c.get('cmd')} {args}")
                else:
                    cmds_out.append(str(c))
            print(f"Commands:    {', '.join(cmds_out)}")
        
        if quest.get('canon'):
            print(f"Canon Event: {quest['canon'].get('event', 'N/A')}")
            if quest['canon'].get('keys'):
                print(f"Canon Tags:  {', '.join(quest['canon']['keys'])}")
        
        # Show timestamps
        if quest.get('created_at'):
            created = datetime.fromtimestamp(quest['created_at']).strftime('%Y-%m-%d %H:%M:%S')
            print(f"Created:     {created}")
        
        if quest.get('updated_at'):
            updated = datetime.fromtimestamp(quest['updated_at']).strftime('%Y-%m-%d %H:%M:%S')
            print(f"Updated:     {updated}")
    
    def show_quest_by_title(self, title: str):
        """Show detailed information for a specific quest."""
        quest = self.manager.get_quest(title)
        
        if not quest:
            print(f"❌ Quest not found: {title}")
            print("\nAvailable quests:")
            quests = self.manager.get_all_quests()
            for q in quests:
                print(f"   - {q['title']}")
            return
        
        print("\n" + "=" * 80)
        print("🔍 QUEST DETAILS")
        print("=" * 80)
        
        self._print_quest_details(quest)
        
        print("\n" + "=" * 80 + "\n")
    
    def check_firehose_integration(self):
        """Check if firehose is monitoring quest URIs."""
        print("\n" + "=" * 80)
        print("🌊 FIREHOSE INTEGRATION STATUS")
        print("=" * 80)
        
        # Check if jetstream container is running (replaces questhose)
        try:
            import subprocess
            result = subprocess.run(
                ['docker', 'ps', '--filter', 'name=jetstream', '--format', '{{.Status}}'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0 and result.stdout.strip():
                status = result.stdout.strip()
                print(f"✅ Jetstream Hub: {status}")
            else:
                print("❌ Jetstream Hub: Not running")
                print("   Start with: cd /srv && docker compose up -d jetstream")
        except Exception as e:
            print(f"⚠️  Could not check jetstream status: {e}")
        
        # Check quest URIs
        print("\n📜 Quest URIs being monitored:")
        
        quest_uris = get_quest_uris()
        
        if not quest_uris:
            print("   ❌ No quest URIs loaded (no enabled quests)")
        else:
            print(f"   ✅ {len(quest_uris)} URI(s) active")
            for uri in quest_uris:
                print(f"      - {uri}")
        
        # Check enabled quests
        enabled_quests = self.manager.get_enabled_quests()
        print(f"\n🎯 Enabled Quests: {len(enabled_quests)}")
        for quest in enabled_quests:
            print(f"   ✅ {quest['title']}")
        
        print("\n" + "=" * 80 + "\n")
    
    def validate_quest_config(self):
        """Validate quest configurations for common issues."""
        print("\n" + "=" * 80)
        print("🔍 QUEST CONFIGURATION VALIDATION")
        print("=" * 80)
        
        quests = self.manager.get_all_quests()
        
        if not quests:
            print("❌ No quests found in database")
            print("   Run migration: python3 ops/quests.py")
            return
        
        issues_found = 0
        warnings = 0
        
        for quest in quests:
            quest_issues = []
            quest_warnings = []
            
            # Check URI format
            if not quest['uri'].startswith('at://'):
                quest_issues.append("Invalid URI format (should start with 'at://')")
            
            # Check condition - UPDATED LIST (supports canonical `conditions`)
            valid_conditions = [
                'new_reply',
                'dreamer_replies', 
                'any_reply',
                'contains_hashtags',
                'contains_mentions',
                'hasnt_canon'  # Added hasnt_canon
            ]

            conds = quest.get('conditions')
            if conds:
                if isinstance(conds, str):
                    try:
                        conds = json.loads(conds)
                    except Exception:
                        conds = []

                for cond_obj in conds:
                    cond_val = cond_obj.get('condition') if isinstance(cond_obj, dict) else str(cond_obj)
                    cond_base = cond_val.split(':')[0]
                    if cond_base not in valid_conditions and not cond_val.startswith('reply_contains:'):
                        quest_warnings.append(f"Unknown condition: {cond_val}")
            else:
                # Fallback to legacy single-condition string
                    if quest.get('condition'):
                        cond_val = quest.get('condition')
                        cond_base = str(cond_val).split(':')[0]
                        if cond_base not in valid_conditions and not str(cond_val).startswith('reply_contains:'):
                            quest_warnings.append(f"Unknown condition: {cond_val}")
            
            # Check commands - UPDATED LIST
            valid_commands = [
                'name_dreamer',
                'registration_check',
                'register_if_needed',  # Backward compatibility
                'add_kindred',
                'like_post',
                'add_canon',
                'add_name',
                'disable_quest',
                'mod_spectrum',
                'award_souvenir',
                'reply_origin_spectrum',
                'reply_post',
                'paired',
                'check_collaboration_partners',
                'calculate_origin',
                'greet_newcomer',  # Added greeter command
                'declare_origin'   # Added mapper command
            ]
            for cmd in quest.get('commands', []):
                if isinstance(cmd, dict):
                    cmd_name = cmd.get('cmd', '').split(':')[0]
                else:
                    cmd_name = str(cmd).split(':')[0]
                if cmd_name not in valid_commands:
                    quest_warnings.append(f"Unknown command: {cmd}")
            
            # Check if URI is reachable
            if quest['enabled'] and self.verbose:
                try:
                    # Try to fetch the post
                    # This is optional and slow, so only in verbose mode
                    pass  # TODO: Implement if needed
                except Exception as e:
                    quest_warnings.append(f"Could not verify URI: {e}")
            
            # Print results for this quest
            if quest_issues or quest_warnings:
                status = "❌" if quest_issues else "⚠️ "
                print(f"\n{status} {quest['title']}")
                
                for issue in quest_issues:
                    print(f"   ❌ ERROR: {issue}")
                    issues_found += 1
                
                for warning in quest_warnings:
                    print(f"   ⚠️  WARNING: {warning}")
                    warnings += 1
            else:
                print(f"✅ {quest['title']}")
        
        print("\n" + "=" * 80)
        print("📊 VALIDATION SUMMARY")
        print("=" * 80)
        print(f"Total Quests: {len(quests)}")
        print(f"Errors:       {issues_found}")
        print(f"Warnings:     {warnings}")
        
        if issues_found == 0 and warnings == 0:
            print("\n✅ All quests passed validation!")
        elif issues_found == 0:
            print("\n⚠️  Some warnings found, but no critical errors")
        else:
            print("\n❌ Critical errors found - please fix before enabling quests")
        
        print("=" * 80 + "\n")
    
    def enable_quest(self, title: str):
        """Enable a quest."""
        quest = self.manager.get_quest(title)
        if not quest:
            print(f"❌ Quest not found: {title}")
            return
        
        if quest['enabled']:
            print(f"ℹ️  Quest '{title}' is already enabled")
            return
        
        if self.manager.enable_quest(title):
            print(f"✅ Enabled quest: {title}")
            print("\n⚠️  Restart jetstream to apply changes:")
            print("   cd /srv && docker compose restart jetstream")
        else:
            print(f"❌ Failed to enable quest: {title}")
    
    def disable_quest(self, title: str):
        """Disable a quest."""
        quest = self.manager.get_quest(title)
        if not quest:
            print(f"❌ Quest not found: {title}")
            return
        
        if not quest['enabled']:
            print(f"ℹ️  Quest '{title}' is already disabled")
            return
        
        if self.manager.disable_quest(title):
            print(f"✅ Disabled quest: {title}")
            print("\n⚠️  Restart jetstream to apply changes:")
            print("   cd /srv && docker compose restart jetstream")
        else:
            print(f"❌ Failed to disable quest: {title}")
    
    def show_quest_stats(self):
        """Show statistics about quest activity."""
        print("\n" + "=" * 80)
        print("📊 QUEST STATISTICS")
        print("=" * 80)
        
        quests = self.manager.get_all_quests()
        
        if not quests:
            print("❌ No quests found")
            return
        
        # Count by status
        enabled = sum(1 for q in quests if q['enabled'])
        disabled = len(quests) - enabled
        
        # Count by condition type (canonical `conditions` expected)
        conditions = defaultdict(int)
        for quest in quests:
            conds = quest.get('conditions') or []
            # Support JSON-string stored conditions (defensive)
            if isinstance(conds, str):
                try:
                    conds = json.loads(conds)
                except Exception:
                    conds = []

            for cond_obj in conds:
                if isinstance(cond_obj, dict) and 'condition' in cond_obj:
                    cond = cond_obj['condition'].split(':')[0]
                    conditions[cond] += 1
        
        # Count by command type (canonical `commands` expected as objects)
        commands = defaultdict(int)
        for quest in quests:
            for cmd in quest.get('commands', []):
                if isinstance(cmd, dict) and 'cmd' in cmd:
                    cmd_name = cmd['cmd'].split(':')[0]
                else:
                    # Legacy string commands may still exist; count by prefix
                    cmd_name = str(cmd).split(':')[0]
                commands[cmd_name] += 1
        
        print(f"\n📋 Total Quests: {len(quests)}")
        print(f"   ✅ Enabled:   {enabled}")
        print(f"   ❌ Disabled:  {disabled}")
        
        print(f"\n🔍 Condition Types:")
        for cond, count in sorted(conditions.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cond:20} {count}")
        
        print(f"\n⚙️  Command Types:")
        for cmd, count in sorted(commands.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cmd:20} {count}")
        
        # Canon quests
        canon_quests = [q for q in quests if q.get('canon')]
        print(f"\n📖 Canon Quests: {len(canon_quests)}")
        
        # Check for recent activity (dreamers added/updated)
        cursor = self.db.execute("""
            SELECT COUNT(*) as count FROM dreamers 
            WHERE updated_at > ?
        """, (int(datetime.now().timestamp()) - 86400,))
        
        recent_count = cursor.fetchone()['count']
        print(f"\n👥 Dreamers Active (24h): {recent_count}")
        
        print("\n" + "=" * 80 + "\n")
    
    def test_quest_condition(self, title: str):
        """Test if a quest condition would trigger (simulation)."""
        quest = self.manager.get_quest(title)
        if not quest:
            print(f"❌ Quest not found: {title}")
            return
        
        print("\n" + "=" * 80)
        print(f"🧪 TESTING QUEST CONDITION: {quest['title']}")
        print("=" * 80)
        
        # Show canonical conditions (or fall back to legacy condition for display)
        if quest.get('conditions'):
            print(f"\nConditions: {quest.get('conditions')}")
        else:
            print(f"\nCondition: {quest.get('condition')}")

        print(f"URI: {quest.get('uri')}")
        
        print("\n⚠️  This is a dry-run simulation")
        print("   No actual commands will be executed")
        print("   Checking if condition logic is valid...\n")
        
        # Import condition evaluator
        from ops.conditions import evaluate_condition
        
        # Create a mock reply for testing
        mock_reply = {
            'uri': 'at://did:plc:test/app.bsky.feed.post/test',
            'author': {
                'did': 'did:plc:test123',
                'handle': 'testuser.bsky.social'
            },
            'record': {
                'text': 'Test reply for quest condition',
                'createdAt': datetime.now().isoformat()
            }
        }
        
        thread_result = {'replies': [mock_reply]}
        
        try:
            # evaluate_condition will prefer `quest['conditions']` when present
            result = evaluate_condition(None, thread_result, quest)

            if result['success']:
                print(f"✅ Condition would trigger")
                print(f"   Matching replies: {result['count']}")
                print(f"   Reason: {result.get('reason', 'N/A')}")

                print(f"\n⚙️  Commands that would execute:")
                for cmd in quest.get('commands', []):
                    if isinstance(cmd, dict):
                        args = cmd.get('args') or []
                        print(f"   - {cmd.get('cmd')} {args}")
                    else:
                        print(f"   - {cmd}")
            else:
                print(f"❌ Condition would NOT trigger")
                print(f"   Reason: {result.get('reason', 'N/A')}")
            
        except Exception as e:
            print(f"❌ Error evaluating condition: {e}")
            import traceback
            traceback.print_exc()
        
        print("\n" + "=" * 80 + "\n")
    
    def export_quests(self, output_file: str):
        """Export all quests to JSON file."""
        quests = self.manager.get_all_quests()
        
        # Convert to exportable format
        export_data = {
            'exported_at': datetime.now().isoformat(),
            'quest_count': len(quests),
            'quests': []
        }
        
        for quest in quests:
            quest_data = {
                'title': quest.get('title'),
                'uri': quest.get('uri'),
                # Export canonical fields
                'conditions': quest.get('conditions'),
                'commands': quest.get('commands'),
                'enabled': quest.get('enabled'),
                'description': quest.get('description'),
            }

            if quest.get('canon'):
                quest_data['canon'] = quest.get('canon')

            export_data['quests'].append(quest_data)
        
        with open(output_file, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        print(f"✅ Exported {len(quests)} quests to: {output_file}")


def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='🎯 Quest Management & Diagnostics Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                          # Show all enabled quests
  %(prog)s --all                    # Show all quests (including disabled)
  %(prog)s --quest "Welcome Quest"  # Show specific quest details
  %(prog)s --enable "Quest Name"    # Enable a quest
  %(prog)s --disable "Quest Name"   # Disable a quest
  %(prog)s --check                  # Check firehose integration
  %(prog)s --validate               # Validate quest configurations
  %(prog)s --stats                  # Show quest statistics
  %(prog)s --test "Quest Name"      # Test quest condition logic
  %(prog)s --export quests.json     # Export quests to JSON
        """
    )
    
    parser.add_argument('--all', action='store_true',
                        help='Show all quests (including disabled)')
    parser.add_argument('--quest', metavar='TITLE',
                        help='Show details for specific quest')
    parser.add_argument('--enable', metavar='TITLE',
                        help='Enable a quest')
    parser.add_argument('--disable', metavar='TITLE',
                        help='Disable a quest')
    parser.add_argument('--check', action='store_true',
                        help='Check firehose integration status')
    parser.add_argument('--validate', action='store_true',
                        help='Validate quest configurations')
    parser.add_argument('--stats', action='store_true',
                        help='Show quest statistics')
    parser.add_argument('--test', metavar='TITLE',
                        help='Test quest condition logic (dry-run)')
    parser.add_argument('--export', metavar='FILE',
                        help='Export quests to JSON file')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='Verbose output')
    
    args = parser.parse_args()
    
    diagnostics = QuestDiagnostics(verbose=args.verbose)
    
    # Handle different commands
    if args.quest:
        diagnostics.show_quest_by_title(args.quest)
    elif args.enable:
        diagnostics.enable_quest(args.enable)
    elif args.disable:
        diagnostics.disable_quest(args.disable)
    elif args.check:
        diagnostics.check_firehose_integration()
    elif args.validate:
        diagnostics.validate_quest_config()
    elif args.stats:
        diagnostics.show_quest_stats()
    elif args.test:
        diagnostics.test_quest_condition(args.test)
    elif args.export:
        diagnostics.export_quests(args.export)
    else:
        # Default: show quests
        diagnostics.show_all_quests(show_disabled=args.all)


if __name__ == '__main__':
    main()
