#!/usr/bin/env python3
"""
test_quest_conditions.py - Test condition evaluation for quests
"""

import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ops.quests import QuestManager
from ops.conditions import evaluate_conditions

def test_quest_conditions(quest_title: str, test_reply: dict):
    """
    Test a quest's conditions against a sample reply.
    
    Args:
        quest_title: Title of quest to test
        test_reply: Sample reply dict {uri, author, record}
    """
    print(f"\n{'='*70}")
    print(f"TESTING QUEST: {quest_title}")
    print(f"{'='*70}")
    
    # Load quest
    qm = QuestManager()
    quest = qm.get_quest(quest_title)
    
    if not quest:
        print(f"❌ Quest '{quest_title}' not found")
        return
    
    print(f"\n📋 Quest Configuration:")
    print(f"   URI: {quest['uri']}")
    print(f"   Enabled: {quest['enabled']}")
    print(f"   Conditions: {len(quest.get('conditions', []))} conditions")
    print(f"   Commands: {quest.get('commands', [])}")
    
    # Parse conditions
    conditions = quest.get('conditions', [])
    if isinstance(conditions, str):
        conditions = json.loads(conditions)
    
    print(f"\n🔍 Evaluating Conditions:")
    for idx, cond in enumerate(conditions):
        cond_str = cond.get('condition', '')
        operator = cond.get('operator', 'AND')
        disabled = cond.get('disabled', False)
        status = '(DISABLED)' if disabled else ''
        print(f"   [{idx}] {cond_str} (operator: {operator}) {status}")
    
    # Test evaluation
    thread_result = {'replies': [test_reply]}
    
    result = evaluate_conditions(
        conditions,
        quest.get('condition_operator', 'AND'),
        thread_result,
        quest
    )
    
    print(f"\n📊 Evaluation Result:")
    print(f"   Success: {result['success']}")
    print(f"   Matches: {result['count']}")
    print(f"   Reason: {result['reason']}")
    
    if result.get('custom_commands'):
        print(f"   Custom Commands: {result['custom_commands']}")
    
    # Show individual condition results
    if result.get('condition_results'):
        print(f"\n📝 Individual Condition Results:")
        for idx, cond_result in enumerate(result['condition_results']):
            print(f"   [{idx}] {cond_result['success']} - {cond_result.get('reason', 'N/A')}")
    
    print(f"\n{'='*70}")

if __name__ == '__main__':
    print("\n" + "=" * 70)
    print("QUEST CONDITION TEST SUITE")
    print("=" * 70)
    
    # Test namegiver with sample reply
    print("\n[TEST 1] Namegiver Quest - Valid Name Reply")
    sample_namegiver_reply = {
        'uri': 'at://did:plc:test/app.bsky.feed.post/test123',
        'author': {
            'did': 'did:plc:testuser',
            'handle': 'testuser.bsky.social'
        },
        'record': {
            'text': 'My name is Watson',
            'createdAt': '2025-12-04T12:00:00.000Z'
        }
    }
    
    test_quest_conditions('namegiver', sample_namegiver_reply)
    
    # Test origin with sample reply
    print("\n[TEST 2] Origin Quest - Dream Reply")
    sample_origin_reply_dream = {
        'uri': 'at://did:plc:test/app.bsky.feed.post/test456',
        'author': {
            'did': 'did:plc:testuser',
            'handle': 'testuser.bsky.social'
        },
        'record': {
            'text': 'It was a dream',
            'createdAt': '2025-12-04T12:00:00.000Z'
        }
    }
    
    test_quest_conditions('origin', sample_origin_reply_dream)
    
    # Test origin with nightmare reply
    print("\n[TEST 3] Origin Quest - Nightmare Reply")
    sample_origin_reply_nightmare = {
        'uri': 'at://did:plc:test/app.bsky.feed.post/test789',
        'author': {
            'did': 'did:plc:testuser2',
            'handle': 'testuser2.bsky.social'
        },
        'record': {
            'text': 'nightmare',
            'createdAt': '2025-12-04T12:00:00.000Z'
        }
    }
    
    test_quest_conditions('origin', sample_origin_reply_nightmare)
    
    # Test origin with no keyword match
    print("\n[TEST 4] Origin Quest - No Keyword Match (Should Fail)")
    sample_origin_reply_no_match = {
        'uri': 'at://did:plc:test/app.bsky.feed.post/test999',
        'author': {
            'did': 'did:plc:testuser3',
            'handle': 'testuser3.bsky.social'
        },
        'record': {
            'text': 'yes please',
            'createdAt': '2025-12-04T12:00:00.000Z'
        }
    }
    
    test_quest_conditions('origin', sample_origin_reply_no_match)
    
    print("\n" + "=" * 70)
    print("TEST SUITE COMPLETE")
    print("=" * 70)
