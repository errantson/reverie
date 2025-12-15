#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Quest Conditions Package - Modular condition evaluation

Dispatches quest conditions to individual evaluator modules.
Supports both legacy single-condition format and new multi-condition arrays with operators.
"""

import json
from typing import Dict, List, Union

# Import individual condition modules
from .any_reply import any_reply
from .new_reply import new_reply
from .dreamer_replies import dreamer_replies
from .reply_contains import reply_contains
from .contains_hashtags import contains_hashtags
from .contains_mentions import contains_mentions
from .user_has_souvenir import user_has_souvenir
from .user_missing_souvenir import user_missing_souvenir
from .souvenir_exists_anywhere import souvenir_exists_anywhere
from .has_canon import has_canon
from .hasnt_canon import hasnt_canon
from .count_canon import count_canon
from .user_canon_equals import user_canon_equals
from .user_canon_not_equals import user_canon_not_equals
from .user_in_canon_list import user_in_canon_list
from .has_read import evaluate as has_read
from .has_biblio_stamp import evaluate as has_biblio_stamp

# Export all condition functions
__all__ = [
    'evaluate_condition',
    'evaluate_conditions',
    'any_reply',
    'new_reply',
    'dreamer_replies',
    'reply_contains',
    'contains_hashtags',
    'contains_mentions',
    'user_has_souvenir',
    'user_missing_souvenir',
    'souvenir_exists_anywhere',
    'has_canon',
    'hasnt_canon',
    'count_canon',
    'user_canon_equals',
    'user_canon_not_equals',
    'user_in_canon_list',
    'has_read',
    'has_biblio_stamp',
]


def evaluate_single_condition(condition: str, thread_result: Dict, quest_config: Dict) -> Dict:
    """
    Evaluate a single quest condition string.
    
    Args:
        condition: Condition string (e.g., 'new_reply', 'reply_contains:text')
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        
    Returns:
        {
            'success': bool,
            'count': int,
            'matching_replies': List[Dict],
            'reason': str
        }
    """
    replies = thread_result.get('replies', [])
    
    if not replies:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No replies found'
        }
    
    if condition == 'any_reply':
        return any_reply(thread_result, quest_config)
    elif condition == 'new_reply':
        return new_reply(thread_result, quest_config)
    elif condition == 'dreamer_replies':
        return dreamer_replies(thread_result, quest_config)
    elif condition.startswith('reply_contains:'):
        search_text = condition.split(':', 1)[1]
        return reply_contains(thread_result, quest_config, search_text)
    elif condition.startswith('contains_hashtags:'):
        hashtags = condition.split(':', 1)[1].split(',')
        return contains_hashtags(thread_result, quest_config, hashtags)
    elif condition.startswith('contains_mentions:'):
        mentions = condition.split(':', 1)[1].split(',')
        return contains_mentions(thread_result, quest_config, mentions)
    elif condition.startswith('user_has_souvenir:'):
        souvenir_key = condition.split(':', 1)[1]
        return user_has_souvenir(thread_result, quest_config, souvenir_key)
    elif condition.startswith('user_missing_souvenir:'):
        souvenir_key = condition.split(':', 1)[1]
        return user_missing_souvenir(thread_result, quest_config, souvenir_key)
    elif condition.startswith('souvenir_exists_anywhere:'):
        souvenir_key = condition.split(':', 1)[1]
        return souvenir_exists_anywhere(thread_result, quest_config, souvenir_key)
    elif condition.startswith('has_canon:'):
        canon_key = condition.split(':', 1)[1]
        return has_canon(thread_result, quest_config, canon_key)
    elif condition.startswith('hasnt_canon:'):
        canon_key = condition.split(':', 1)[1]
        return hasnt_canon(thread_result, quest_config, canon_key)
    elif condition.startswith('count_canon:'):
        canon_condition = condition.split(':', 1)[1]
        return count_canon(thread_result, quest_config, canon_condition)
    elif condition.startswith('user_canon_equals:'):
        # Format: user_canon_equals:key=value
        parts = condition.split(':', 1)[1]
        if '=' in parts:
            canon_key, canon_value = parts.split('=', 1)
            return user_canon_equals(thread_result, quest_config, canon_key, canon_value)
        else:
            return {
                'success': False,
                'count': 0,
                'matching_replies': [],
                'reason': 'Invalid format: use user_canon_equals:key=value'
            }
    elif condition.startswith('user_canon_not_equals:'):
        # Format: user_canon_not_equals:key=value
        parts = condition.split(':', 1)[1]
        if '=' in parts:
            canon_key, canon_value = parts.split('=', 1)
            return user_canon_not_equals(thread_result, quest_config, canon_key, canon_value)
        else:
            return {
                'success': False,
                'count': 0,
                'matching_replies': [],
                'reason': 'Invalid format: use user_canon_not_equals:key=value'
            }
    elif condition.startswith('user_in_canon_list:'):
        # Format: user_in_canon_list:key=value1,value2,value3
        parts = condition.split(':', 1)[1]
        if '=' in parts:
            canon_key, values_str = parts.split('=', 1)
            canon_values = [v.strip() for v in values_str.split(',')]
            return user_in_canon_list(thread_result, quest_config, canon_key, canon_values)
        else:
            return {
                'success': False,
                'count': 0,
                'matching_replies': [],
                'reason': 'Invalid format: use user_in_canon_list:key=value1,value2'
            }
    elif condition.startswith('has_read:'):
        # Format: has_read:Book Title
        book_title = condition.split(':', 1)[1]
        return has_read(thread_result, quest_config, book_title)
    elif condition.startswith('has_biblio_stamp:'):
        # Format: has_biblio_stamp:list_rkey or has_biblio_stamp:at://did:plc:xxx/biblio.bond.list/rkey
        list_identifier = condition.split(':', 1)[1]
        return has_biblio_stamp(thread_result, quest_config, list_identifier)
    else:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': f'Unknown condition: {condition}'
        }


# NOTE: We now enforce canonical condition objects only. Legacy condition
# normalization has been removed — run the migration tool to convert quests
# before enabling the new strict mode.


def evaluate_conditions(conditions: List[Dict], operator: str, thread_result: Dict, quest_config: Dict) -> Dict:
    """
    Evaluate multiple conditions with a logical operator.
    
    Args:
        conditions: List of condition objects [{"type":"condition","condition":"reply_contains:text","operator":"OR","custom_commands":[...]}, ...]
        operator: Global operator ('AND', 'OR', 'NOT') - can be overridden per condition
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        
    Returns:
        {
            'success': bool,
            'count': int,
            'matching_replies': List[Dict],
            'reason': str,
            'custom_commands': List[str] - Commands from matched conditions
        }
    """
    if not conditions:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No conditions to evaluate',
            'custom_commands': []
        }
    
    results = []
    all_matching_replies = []
    all_custom_commands = []
    matched_once_only_indices = []  # Track once-only conditions that matched
    
    # Evaluate each condition (skip disabled ones)
    for idx, cond_obj in enumerate(conditions):
        # Skip disabled conditions
        if cond_obj.get('disabled', False):
            continue

        # Expect canonical condition object with 'condition' and 'args'
        cond_name = cond_obj.get('condition')
        if not cond_name:
            raise RuntimeError(
                "Found non-canonical condition object; run migration to canonical schema: tools/migrate_quests_to_canonical.py"
            )

        # Build the condition string for the single-condition evaluator
        args = cond_obj.get('args', []) or []
        if args:
            # Join args with comma to form the single-condition API (e.g. reply_contains:foo)
            condition_str = f"{cond_name}:{','.join(str(a) for a in args)}"
        else:
            condition_str = cond_name

        result = evaluate_single_condition(condition_str, thread_result, quest_config)
        results.append(result)
        
        # If this condition matched, collect its custom commands
        if result['success']:
            custom_cmds = cond_obj.get('custom_commands', [])
            if custom_cmds:
                all_custom_commands.extend(custom_cmds)
            
            # If this is a once-only condition, mark it for disabling
            if cond_obj.get('once_only', False):
                matched_once_only_indices.append(idx)
            
            # Collect matching replies
            if result.get('matching_replies'):
                all_matching_replies.extend(result['matching_replies'])
    
    # Deduplicate replies by URI
    seen_uris = set()
    unique_replies = []
    for reply in all_matching_replies:
        uri = reply.get('uri', '')
        if uri and uri not in seen_uris:
            seen_uris.add(uri)
            unique_replies.append(reply)
    
    # IMPROVED: Handle mixed AND/OR operators within the condition list
    # Group conditions by their individual operator field
    and_results = []
    or_results = []
    not_results = []
    
    for idx, cond_obj in enumerate(conditions):
        if cond_obj.get('disabled', False):
            continue
        if idx < len(results):
            cond_operator = cond_obj.get('operator', operator)  # Use condition's operator or global
            if cond_operator == 'AND':
                and_results.append(results[idx])
            elif cond_operator == 'OR':
                or_results.append(results[idx])
            elif cond_operator == 'NOT':
                not_results.append(results[idx])
            else:
                and_results.append(results[idx])  # Default to AND
    
    # Evaluate groups
    and_pass = all(r['success'] for r in and_results) if and_results else True
    or_pass = any(r['success'] for r in or_results) if or_results else True
    not_pass = not any(r['success'] for r in not_results) if not_results else True
    
    # If we have mixed operators, require AND group to pass + at least one OR
    if and_results and or_results:
        # Mixed mode: AND conditions must pass AND at least one OR condition
        success = and_pass and or_pass and not_pass
        reason = 'All AND conditions and at least one OR condition matched' if success else \
                 'Missing required AND conditions or no OR conditions matched'
    elif and_results and not or_results:
        # Only AND conditions
        success = and_pass and not_pass
        reason = 'All conditions matched' if success else 'Not all conditions matched'
    elif or_results and not and_results:
        # Only OR conditions
        success = or_pass and not_pass
        reason = 'At least one condition matched' if success else 'No conditions matched'
    else:
        # Fallback to global operator for backward compatibility
        if operator == 'OR':
            success = any(r['success'] for r in results)
            reason = 'At least one condition matched' if success else 'No conditions matched'
        elif operator == 'AND':
            success = all(r['success'] for r in results)
            reason = 'All conditions matched' if success else 'Not all conditions matched'
        elif operator == 'NOT':
            success = not any(r['success'] for r in results)
            reason = 'No conditions matched (as expected)' if success else 'Some conditions matched (NOT failed)'
        elif operator == 'XOR':
            success_count = sum(1 for r in results if r['success'])
            success = success_count == 1
            reason = f'Exactly one condition matched' if success else f'{success_count} conditions matched (XOR requires exactly 1)'
        else:
            success = all(r['success'] for r in results)
            reason = f'All conditions matched (default AND)' if success else 'Not all conditions matched'
    
    # If any once-only conditions matched, add disable command at the END
    # (so it happens after all other commands)
    if matched_once_only_indices:
        indices_str = ','.join(str(i) for i in matched_once_only_indices)
        disable_cmd = f'disable_condition_group:{indices_str}'
        # Add at the END so custom commands execute first, then disable happens after
        all_custom_commands.append(disable_cmd)
    
    return {
        'success': success,
        'count': len(unique_replies),
        'matching_replies': unique_replies,
        'reason': reason,
        'condition_results': results,  # Include individual results for debugging
        'custom_commands': all_custom_commands  # Commands to execute before common commands
    }


def evaluate_condition(condition: Union[str, List[Dict]], thread_result: Dict, quest_config: Dict) -> Dict:
    """
    Main condition evaluation function - handles both legacy and new formats.
    
    Args:
        condition: Either a string (legacy) or list of condition objects (new format)
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        
    Returns:
        {
            'success': bool,
            'count': int,
            'matching_replies': List[Dict],
            'reason': str
        }
    """
    # Check if quest uses new multi-condition format
    conditions_array = quest_config.get('conditions')
    
    if conditions_array:
        # New format: Parse conditions array
        if isinstance(conditions_array, str):
            try:
                conditions_array = json.loads(conditions_array)
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'count': 0,
                    'matching_replies': [],
                    'reason': 'Failed to parse conditions JSON'
                }
        
        operator = quest_config.get('condition_operator', 'AND')
        return evaluate_conditions(conditions_array, operator, thread_result, quest_config)
    
    # Legacy format: Single condition string
    if isinstance(condition, str):
        return evaluate_single_condition(condition, thread_result, quest_config)
    
    # If condition is already a list (shouldn't happen but handle it)
    if isinstance(condition, list):
        operator = quest_config.get('condition_operator', 'AND')
        return evaluate_conditions(condition, thread_result, quest_config)
    
    return {
        'success': False,
        'count': 0,
        'matching_replies': [],
        'reason': 'Invalid condition format'
    }
