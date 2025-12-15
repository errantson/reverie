#!/usr/bin/env python3
"""
Phrase Monitoring Service

Dear Cogitarian,

This watches the public firehose for posts containing specific hashtags or phrases
(like #flawedcenter or URLs). When matches are found, triggers associated quests.

Configured via quest records with trigger_type='firehose_phrase'.
"""

import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import CAR, FirehoseSubscribeReposClient, parse_subscribe_repos_message, models
from ops.quests import QuestManager
from ops.quest_hooks import process_quest_reply
from ops.conditions import evaluate_conditions
from ops.commands import execute_quest_commands
from ops.triggers import get_trigger_handler, FirehosePhraseTriger
from core.cursor_manager import CursorManager


class PhrasehoseMonitor:
    """Monitor public firehose for specific phrases and trigger quests."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.cursor_manager = CursorManager('phrasehose', save_interval=1000, verbose=verbose)
        self.quest_manager = QuestManager()
        self.phrase_quests: List[Dict] = []
        self.quest_triggers: Dict[int, FirehosePhraseTriger] = {}  # quest_id -> trigger handler
        self.all_phrases: Set[str] = set()  # All phrases we're monitoring
        self._load_phrase_quests()
        
        # Stats
        self.total_posts = 0
        self.matched_posts = 0
        self.quests_triggered = 0
    
    def _load_phrase_quests(self):
        """Load quests that use firehose_phrase trigger type."""
        all_quests = self.quest_manager.get_enabled_quests()
        
        self.phrase_quests = []
        self.quest_triggers = {}
        self.all_phrases = set()
        
        for quest in all_quests:
            # Only load quests with firehose_phrase trigger type
            trigger_type = quest.get('trigger_type', 'bsky_reply')
            
            if trigger_type != 'firehose_phrase':
                continue
            
            try:
                # Create trigger handler for this quest
                trigger = get_trigger_handler('firehose_phrase', quest)
                
                self.phrase_quests.append(quest)
                self.quest_triggers[quest['id']] = trigger
                
                # Track all phrases we need to monitor
                phrases = trigger.get_monitored_phrases()
                self.all_phrases.update(phrases)
                
            except Exception as e:
                print(f"⚠️  Error loading phrase quest '{quest.get('title')}': {e}")
                continue
        
        if self.verbose:
            print(f"🔍 Loaded {len(self.phrase_quests)} phrase monitoring quests")
            if self.all_phrases:
                print(f"   Watching for: {', '.join(list(self.all_phrases)[:5])}" + 
                      (f" ... and {len(self.all_phrases) - 5} more" if len(self.all_phrases) > 5 else ""))
    
    def on_message_handler(self, message: models.ComAtprotoSyncSubscribeRepos.Message):
        """Handle firehose messages - look for posts with matching phrases."""
        
        # Update cursor if this is a sequenced message
        if hasattr(message, 'seq'):
            self.cursor_manager.update_cursor(message.seq)
        
        # Only process commits
        if not isinstance(message, models.ComAtprotoSyncSubscribeRepos.Commit):
            return
        
        # Parse the CAR file to extract records
        try:
            car = CAR.from_bytes(message.blocks)
        except Exception as e:
            if self.verbose:
                print(f"⚠️  Failed to parse CAR: {e}")
            return
        
        # Check each operation in the commit
        for op in message.ops:
            # Only care about post creates
            if op.action != 'create':
                continue
            
            if not op.path.startswith('app.bsky.feed.post/'):
                continue
            
            # Extract the post record
            try:
                record_cid = op.cid
                if not record_cid:
                    continue
                
                record_bytes = car.blocks.get(record_cid)
                if not record_bytes:
                    continue
                
                # Decode the post
                post = models.AppBskyFeedPost.model_validate_json(record_bytes)
                
                self.total_posts += 1
                
                # Check if post matches any of our phrases
                self._check_post_for_phrases(message.repo, post, op)
                
            except Exception as e:
                if self.verbose:
                    print(f"⚠️  Error processing post: {e}")
                continue
    
    def _check_post_for_phrases(self, author_did: str, post: models.AppBskyFeedPost, op):
        """Check if post contains any monitored phrases and trigger quests."""
        
        text = post.text
        if not text:
            return
        
        # Quick pre-filter: check if ANY phrase might be in text
        # (case-insensitive for performance)
        text_lower = text.lower()
        has_potential_match = any(phrase.lower() in text_lower for phrase in self.all_phrases)
        
        if not has_potential_match:
            return
        
        # Build post event for trigger evaluation
        post_uri = f"at://{author_did}/{op.path}"
        
        post_event = {
            'uri': post_uri,
            'author': {
                'did': author_did,
                'handle': 'unknown'  # We don't have handle from firehose
            },
            'record': {
                'text': text,
                'createdAt': post.created_at
            },
            'is_repost': False  # Firehose ops distinguish creates from reposts
        }
        
        # Check each phrase quest
        for quest in self.phrase_quests:
            trigger = self.quest_triggers.get(quest['id'])
            if not trigger:
                continue
            
            # Use trigger's should_activate method
            if trigger.should_activate(post_event):
                self.matched_posts += 1

                if self.verbose:
                    matched = trigger.get_matched_phrases(text)
                    print(f"\n✨ Phrase match found!")
                    print(f"   Quest: {quest['title']}")
                    print(f"   Author: {author_did}")
                    print(f"   Matched: {', '.join(matched)}")
                    print(f"   Text: {text[:100]}{'...' if len(text) > 100 else ''}")

                # Get evaluation context from trigger
                eval_context = trigger.get_evaluation_context(post_event)

                # Trigger quest for the author
                self._trigger_quest_for_user(quest, trigger, eval_context)
    
    def _trigger_quest_for_user(self, quest: Dict, trigger: FirehosePhraseTriger, 
                                 eval_context: Dict):
        """
        Trigger a quest for a specific user.
        
        Args:
            quest: Quest configuration
            trigger: Trigger handler instance
            eval_context: Evaluation context from trigger
        """
        try:
            user_did = eval_context['user_did']
            user_handle = eval_context['user_handle']
            
            # Evaluate quest conditions
            conditions = quest.get('conditions', [])
            condition_operator = quest.get('condition_operator', 'AND')

            if conditions:
                cond_result = evaluate_conditions(conditions, condition_operator, eval_context, quest)
                if not cond_result.get('success'):
                    if self.verbose:
                        print(f"   ❌ Conditions not met for {user_handle}")
                    return

            # Execute quest commands
            commands = quest.get('commands', [])

            if commands:
                if self.verbose:
                    print(f"   ✅ Executing {len(commands)} command(s) for {user_handle}")

                replies = eval_context.get('replies', [])
                execute_quest_commands(commands, replies, quest, verbose=self.verbose)
                self.quests_triggered += 1
            
        except Exception as e:
            print(f"⚠️  Error triggering quest '{quest.get('title')}': {e}")
            import traceback
            traceback.print_exc()
    
    def start(self):
        """Start monitoring the firehose."""
        
        if not self.phrase_quests:
            print("❌ No phrase monitoring quests enabled")
            print("   Create quests with trigger_type='firehose_phrase' first")
            return
        
        print(f"\n🌊 Starting Phrasehose Monitor")
        print(f"   Monitoring: {len(self.all_phrases)} phrase(s)")
        print(f"   Active quests: {len(self.phrase_quests)}")
        
        # Load saved cursor
        saved_cursor = self.cursor_manager.load_cursor()
        if saved_cursor:
            print(f"   Cursor: Resuming from {saved_cursor}")
        else:
            print(f"   Cursor: Starting fresh")
        print()
        
        # Create client with cursor if we have one
        params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=saved_cursor) if saved_cursor else None
        client = FirehoseSubscribeReposClient(params=params)
        
        try:
            client.start(self.on_message_handler)
        except KeyboardInterrupt:
            print("\n\n🛑 Shutting down...")
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.cursor_manager.finalize()
            self._print_stats()
    
    def _print_stats(self):
        """Print monitoring statistics."""
        print("\n" + "=" * 60)
        print("📊 PHRASEHOSE STATISTICS")
        print("=" * 60)
        print(f"Total posts seen:     {self.total_posts:,}")
        print(f"Phrase matches:       {self.matched_posts:,}")
        print(f"Quests triggered:     {self.quests_triggered:,}")
        
        if self.total_posts > 0:
            match_rate = (self.matched_posts / self.total_posts) * 100
            print(f"Match rate:           {match_rate:.4f}%")
        
        print("=" * 60 + "\n")


def main():
    """Run the phrasehose monitor."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Reverie House Phrasehose Monitor')
    parser.add_argument('--verbose', '-v', action='store_true', 
                       help='Enable verbose output')
    args = parser.parse_args()
    
    print("🔍 Reverie House Phrasehose Monitor")
    print("   Watching public firehose for phrases and hashtags")
    print()
    
    monitor = PhrasehoseMonitor(verbose=args.verbose)
    monitor.start()


if __name__ == '__main__':
    main()
