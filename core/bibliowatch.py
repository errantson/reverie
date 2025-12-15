#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Bibliohose - Monitor biblio.bond firehose for quest triggers

Monitors the AT Protocol firehose for biblio.bond records:
- biblio.bond.book (reading records)
- biblio.bond.list (reading lists created)
- biblio.bond.stamps (completion stamps issued)
- biblio.bond.completion (alternate stamp name)

When biblio.bond records are detected, triggers relevant quests
that depend on biblio.bond data.
"""

import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from ops.quests import QuestManager
from ops.quest_hooks import process_quest_reply
from ops.conditions import evaluate_conditions
from ops.commands import execute_quest_commands
from ops.triggers import get_trigger_handler, BibliohoseTrigger


class BibliohoseMonitor:
    """Monitor biblio.bond records and trigger quests."""
    
    # Collection types we monitor
    BIBLIO_COLLECTIONS = {
        'biblio.bond.book',
        'biblio.bond.record',  # Alternate name
        'biblio.bond.list',
        'biblio.bond.stamps',
        'biblio.bond.completion',  # Alternate stamp name
    }
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.quest_manager = QuestManager()
        self.biblio_quests: List[Dict] = []
        self.quest_triggers: Dict[int, BibliohoseTrigger] = {}  # quest_id -> trigger handler
        self.monitored_lists: Set[str] = set()  # List rkeys we care about
        self._load_biblio_quests()
    
    def _load_biblio_quests(self):
        """Load quests that use bibliohose trigger type."""
        all_quests = self.quest_manager.get_enabled_quests()
        
        self.biblio_quests = []
        self.quest_triggers = {}
        self.monitored_lists = set()
        
        for quest in all_quests:
            # Only load quests with bibliohose trigger type
            trigger_type = quest.get('trigger_type', 'bsky_reply')
            
            if trigger_type != 'bibliohose':
                continue
            
            try:
                # Create trigger handler for this quest
                trigger = get_trigger_handler('bibliohose', quest)
                
                self.biblio_quests.append(quest)
                self.quest_triggers[quest['id']] = trigger
                
                # Track which lists we need to monitor
                monitored = trigger.get_monitored_lists()
                self.monitored_lists.update(monitored)
                
            except Exception as e:
                print(f"⚠️  Error loading bibliohose quest '{quest.get('title')}': {e}")
                continue
        
        if self.verbose:
            print(f"📚 Loaded {len(self.biblio_quests)} bibliohose quests")
            if self.monitored_lists:
                print(f"   Monitoring lists: {', '.join(self.monitored_lists)}")
    
    def process_biblio_record(self, record: Dict):
        """
        Process a biblio.bond record from the firehose.
        
        Args:
            record: The biblio.bond record event
        """
        collection = record.get('collection')
        author_did = record.get('author', {}).get('did')
        author_handle = record.get('author', {}).get('handle', 'unknown')
        record_uri = record.get('uri')
        
        if not collection or not author_did:
            return
        
        # Handle stamp/completion records specially
        if collection in ('biblio.bond.stamps', 'biblio.bond.completion'):
            self._process_stamp_record(record, author_did, author_handle)
        
        # Handle book/reading records
        elif collection in ('biblio.bond.book', 'biblio.bond.record'):
            self._process_book_record(record, author_did, author_handle)
        
        # Handle list creation (less common but supported)
        elif collection == 'biblio.bond.list':
            if self.verbose:
                print(f"📋 New list created by @{author_handle}")
    
    def _process_stamp_record(self, record: Dict, author_did: str, author_handle: str):
        """Process a biblio.bond stamp/completion record."""
        value = record.get('value', {})
        reader_did = value.get('reader')
        list_uri = value.get('list', '')
        badge = value.get('badge', 'unknown')
        
        # Extract list rkey
        list_rkey = list_uri.split('/')[-1] if '/' in list_uri else list_uri
        
        if self.verbose:
            print(f"📚 Stamp issued by @{author_handle}")
            print(f"   Reader: {reader_did}")
            print(f"   List: {list_rkey}")
            print(f"   Badge: {badge}")
        
        # Check each quest to see if it should trigger
        for quest in self.biblio_quests:
            trigger = self.quest_triggers.get(quest['id'])
            if not trigger:
                continue
            
            # Use trigger's should_activate method
            if trigger.should_activate(record):
                if self.verbose:
                    print(f"   ✅ Quest '{quest['title']}' triggered!")
                
                # Get evaluation context from trigger
                eval_context = trigger.get_evaluation_context(record)
                
                # Trigger quest for the reader
                self._trigger_quest_for_user(quest, trigger, eval_context)
    
    def _process_book_record(self, record: Dict, author_did: str, author_handle: str):
        """Process a biblio.bond book/reading record."""
        value = record.get('value', {})
        title = value.get('title', 'unknown')
        author = value.get('author', '')
        
        if self.verbose:
            print(f"📖 Book record by @{author_handle}: {title}")
            if author:
                print(f"   Author: {author}")
        
        # Check each quest to see if it should trigger
        for quest in self.biblio_quests:
            trigger = self.quest_triggers.get(quest['id'])
            if not trigger:
                continue
            
            # Use trigger's should_activate method
            if trigger.should_activate(record):
                if self.verbose:
                    print(f"   ✅ Quest '{quest['title']}' triggered!")
                
                # Get evaluation context from trigger
                eval_context = trigger.get_evaluation_context(record)
                
                # Trigger quest for the book reader
                self._trigger_quest_for_user(quest, trigger, eval_context)
    
    def _trigger_quest_for_user(self, quest: Dict, trigger: BibliohoseTrigger, 
                                  eval_context: Dict):
        """
        Trigger a specific quest using the provided evaluation context.
        
        Args:
            quest: Quest configuration dict
            trigger: The trigger handler instance
            eval_context: Evaluation context from trigger.get_evaluation_context()
        """
        try:
            # Get user info from context
            user_handle = eval_context.get('user_handle', 'unknown')
            
            # Evaluate conditions
            conditions = quest.get('conditions', [])
            condition_operator = quest.get('condition_operator', 'AND')
            
            condition_result = evaluate_conditions(
                conditions,
                condition_operator,
                eval_context,
                quest
            )
            
            if not condition_result['success']:
                if self.verbose:
                    print(f"   ⏭️  Conditions not met for @{user_handle}")
                return
            
            # Execute commands
            custom_commands = condition_result.get('custom_commands', [])
            common_commands = quest.get('commands', [])
            all_commands = custom_commands + common_commands

            replies = eval_context.get('replies', [])

            command_result = execute_quest_commands(
                all_commands,
                replies,
                quest,
                verbose=self.verbose
            )
            
            if command_result['success']:
                print(f"✅ Quest '{quest['title']}' completed for @{user_handle}")
                if self.verbose:
                    print(f"   Commands: {', '.join(command_result['commands_executed'])}")
        
        except Exception as e:
            user_handle = eval_context.get('user_handle', 'unknown')
            print(f"❌ Error processing quest '{quest['title']}' for @{user_handle}: {e}")
            if self.verbose:
                import traceback
                traceback.print_exc()


def monitor_firehose_simulation(bibliohose: BibliohoseMonitor):
    """
    Simulate firehose monitoring by polling for recent biblio.bond records.
    
    In production, this would connect to the actual AT Protocol firehose.
    For now, we periodically query users and check for new records.
    """
    from core.database import DatabaseManager
    import requests
    
    db = DatabaseManager()
    
    print("🔄 Starting biblio.bond polling (simulated firehose)...")
    print()
    
    # Track last seen records to avoid duplicates
    seen_records = set()
    
    while True:
        try:
            # Get all dreamers
            dreamers = db.execute("SELECT did, handle FROM dreamers WHERE did IS NOT NULL").fetchall()
            
            if bibliohose.verbose:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking {len(dreamers)} dreamers...")
            
            for dreamer in dreamers:
                try:
                    did = dreamer['did']
                    handle = dreamer['handle']
                    
                    # Query for stamps (most important for quests)
                    stamps = query_user_stamps(did)
                    
                    for stamp in stamps:
                        # Create unique ID for this stamp
                        stamp_id = f"{did}:{stamp.get('list', '')}:{stamp.get('badge', '')}"
                        
                        if stamp_id not in seen_records:
                            seen_records.add(stamp_id)
                            
                            # Create record object
                            record = {
                                'collection': 'biblio.bond.stamps',
                                'uri': f'at://{did}/biblio.bond.stamps/simulated',
                                'author': {
                                    'did': did,
                                    'handle': handle
                                },
                                'value': stamp
                            }
                            
                            # Process the stamp
                            bibliohose.process_biblio_record(record)
                
                except Exception as e:
                    if bibliohose.verbose:
                        print(f"   ⚠️  Error checking {dreamer['handle']}: {e}")
                    continue
            
            # Sleep before next poll
            time.sleep(300)  # Check every 5 minutes
        
        except KeyboardInterrupt:
            print("\n⚠️  Stopping bibliohose...")
            break
        except Exception as e:
            print(f"❌ Bibliohose error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)


def query_user_stamps(did: str) -> List[Dict]:
    """Query a user's biblio.bond stamps."""
    import requests
    
    try:
        # Try API endpoints
        for endpoint in [
            f'https://biblio.bond/api/stamps/{did}',
            f'https://biblio.bond/api/users/{did}/stamps'
        ]:
            try:
                response = requests.get(endpoint, timeout=5)
                if response.ok:
                    stamps = response.json()
                    return stamps if isinstance(stamps, list) else [stamps]
            except:
                continue
        
        # Try AT Protocol direct query
        url = 'https://bsky.social/xrpc/com.atproto.repo.listRecords'
        
        for collection in ['biblio.bond.stamps', 'biblio.bond.completion']:
            try:
                params = {
                    'repo': did,
                    'collection': collection,
                    'limit': 100
                }
                
                response = requests.get(url, params=params, timeout=5)
                if response.ok:
                    data = response.json()
                    records = data.get('records', [])
                    return [r.get('value', {}) for r in records]
            except:
                continue
        
        return []
    
    except Exception as e:
        return []


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Reverie Bibliohose - Monitor biblio.bond records')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    print("📚 Starting Reverie Bibliohose")
    print("="*60)
    
    bibliohose = BibliohoseMonitor(verbose=args.verbose)
    
    if not bibliohose.biblio_quests:
        print("⚠️  No biblio.bond quests found!")
        print("   Create quests with has_biblio_stamp or has_read conditions")
        return
    
    print(f"✅ Monitoring {len(bibliohose.biblio_quests)} biblio.bond quest(s)")
    print()
    
    # Start monitoring
    monitor_firehose_simulation(bibliohose)


if __name__ == '__main__':
    main()
