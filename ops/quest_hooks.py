#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Quest Hooks - Firehose integration for quest processing

This module provides the external interface for quest processing,
called by the firehose when quest replies are detected.
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from ops.quests import QuestManager
from core.database import DatabaseManager


def get_quest_uris() -> List[str]:
    """
    Get list of quest URIs to monitor in the firehose.
    
    Returns:
        List of AT Protocol URIs for active quests
    """
    try:
        manager = QuestManager()
        uris = manager.get_quest_uris()
        return list(uris)
    except Exception as e:
        print(f"⚠️  Error loading quest URIs: {e}")
        return []


def process_quest_reply(reply_uri: str, author_did: str, author_handle: str,
                       post_text: str, post_created_at: str, quest_uri: str,
                       verbose: bool = False) -> Dict:
    """
    Process a quest reply detected by the firehose.
    
    Args:
        reply_uri: AT URI of the reply post
        author_did: DID of the reply author
        author_handle: Handle of the reply author  
        post_text: Text content of the reply
        post_created_at: ISO timestamp of post creation
        quest_uri: AT URI of the quest post being replied to
        verbose: Whether to print debug output
        
    Returns:
        Dictionary with processing results:
        {
            'success': bool,
            'quest_title': str,
            'commands_executed': List[str],
            'skipped': bool,
            'skip_reason': str,
            'errors': List[str]
        }
    """
    result = {
        'success': False,
        'quest_title': 'unknown',
        'commands_executed': [],
        'skipped': False,
        'skip_reason': None,
        'errors': []
    }
    
    try:
        manager = QuestManager()
        quests = manager.get_enabled_quests()
        
        matching_quest = None
        for quest in quests:
            if quest['uri'] == quest_uri:
                matching_quest = quest
                break
        
        if not matching_quest:
            result['errors'].append(f"No enabled quest found for URI: {quest_uri}")
            return result
        
        result['quest_title'] = matching_quest['title']
        
        if verbose:
            print(f"🎯 Processing quest '{matching_quest['title']}' reply from @{author_handle}")
        
        reply_obj = {
            'uri': reply_uri,
            'author': {
                'did': author_did,
                'handle': author_handle
            },
            'record': {
                'text': post_text,
                'createdAt': post_created_at
            }
        }
        
        from ops.conditions import evaluate_conditions
        
        # Use new conditions array format (required)
        conditions = matching_quest.get('conditions', [])
        condition_operator = matching_quest.get('condition_operator', 'AND')
        
        if not conditions:
            result['errors'].append(f"Quest '{matching_quest['title']}' has no conditions defined")
            return result
        
        # Evaluate conditions
        condition_result = evaluate_conditions(
            conditions,
            condition_operator,
            {'replies': [reply_obj]},
            matching_quest
        )
        
        if not condition_result['success'] or condition_result['count'] == 0:
            result['skipped'] = True
            result['skip_reason'] = condition_result.get('reason', 'Condition not met')
            if verbose:
                print(f"   ⏭️  Skipped: {result['skip_reason']}")
            return result
        
        matching_replies = condition_result.get('matching_replies', [reply_obj])
        
        from ops.command_executor import execute_quest_commands
        
        # Combine custom commands (from matched conditions) with common commands
        custom_commands = condition_result.get('custom_commands', [])
        common_commands = matching_quest['commands']
        
        # Execute custom commands first (e.g., personalized replies), then common commands
        all_commands = custom_commands + common_commands
        
        command_result = execute_quest_commands(
            all_commands,
            matching_replies,
            matching_quest,
            verbose=verbose
        )
        
        result['success'] = command_result['success']
        result['commands_executed'] = command_result['commands_executed']
        result['errors'] = command_result.get('errors', [])
        result['custom_commands_count'] = len(custom_commands)
        
        if verbose and result['success']:
            if custom_commands:
                print(f"   ✨ Custom: {', '.join(custom_commands[:1])}... ({len(custom_commands)} total)")
            print(f"   ✅ Executed: {', '.join(result['commands_executed'])}")
        
    except Exception as e:
        result['errors'].append(f"Quest processing error: {e}")
        if verbose:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    return result


class QuestHooks:
    """
    Main quest hooks class for backward compatibility.
    Provides the interface that firehose and other systems expect.
    """
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.manager = QuestManager()
    
    def get_quest_uris(self) -> Set[str]:
        """Get set of quest URIs to monitor."""
        return self.manager.get_quest_uris()
    
    def process_reply(self, reply_uri: str, author_did: str, author_handle: str,
                     post_text: str, post_created_at: str, quest_uri: str) -> Dict:
        """Process a quest reply."""
        return process_quest_reply(
            reply_uri, author_did, author_handle,
            post_text, post_created_at, quest_uri,
            verbose=self.verbose
        )


if __name__ == '__main__':
    print("🔍 Testing quest hooks...")
    print()
    
    uris = get_quest_uris()
    print(f"📜 Loaded {len(uris)} quest URIs:")
    for uri in uris:
        print(f"   - {uri}")
    
    if not uris:
        print()
        print("⚠️  No quests found in database!")
        print("   Run migration first:")
        print("   python3 core/quests.py")
