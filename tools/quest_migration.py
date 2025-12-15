"""
Helpers to convert legacy quest records into canonical schema objects.
This module is importable for unit tests and used by the migration script.
"""
from typing import Dict, List, Any


def parse_command_string(cmd_str: str) -> Dict[str, Any]:
    """
    Parse legacy command string into canonical command object.

    Examples:
      'name_dreamer' -> {'cmd': 'name_dreamer', 'args': []}
      'award_souvenir:bell' -> {'cmd': 'award_souvenir', 'args': ['bell']}
      'add_canon:bell:answered a call:event:bell' -> {
           'cmd':'add_canon','args':['bell','answered a call','event','bell']
      }
    """
    parts = cmd_str.split(':')
    cmd = parts[0]
    args = parts[1:] if len(parts) > 1 else []
    return {'cmd': cmd, 'args': args}


def normalize_condition_obj_to_canonical(cond_obj: Dict) -> Dict:
    """
    Convert the varied condition representations to the canonical condition object:
      {'condition': 'reply_contains', 'args': ['text'], 'operator':'AND', 'once_only': False}
    Handles legacy forms where value is stored separately or condition contains ':'
    """
    condition = cond_obj.get('condition', '')
    operator = cond_obj.get('operator', 'AND')
    once_only = bool(cond_obj.get('once_only', False))

    # If condition already contains ':', split into name and arg string
    if condition and ':' in condition:
        name, rest = condition.split(':', 1)
        args = [rest]
    else:
        args = []
        # value field
        if 'value' in cond_obj and cond_obj['value'] is not None:
            args = [cond_obj['value']]
        # args field
        elif 'args' in cond_obj and isinstance(cond_obj['args'], (list, tuple)):
            args = list(cond_obj['args'])

    return {
        'condition': condition.split(':')[0] if condition else '',
        'args': args,
        'operator': operator,
        'once_only': once_only,
        'disabled': bool(cond_obj.get('disabled', False))
    }


def convert_commands_list(cmds: List[str]) -> List[Dict[str, Any]]:
    return [parse_command_string(c) for c in cmds]


def convert_quest_record(quest: Dict) -> Dict:
    """
    Convert a full quest record (as exported by tools/export_quests.py)
    into canonical schema fields: 'conditions' array of canonical objects
    and 'commands' list of command objects.
    This function does not modify DB; it returns a new dict with converted fields.
    """
    new = dict(quest)

    # Convert conditions
    raw_conditions = quest.get('conditions') or []
    # If conditions is a string JSON, ignore here — tools/export_quests already parsed
    canonical_conditions = []
    if raw_conditions:
        for c in raw_conditions:
            canonical_conditions.append(normalize_condition_obj_to_canonical(c))
    else:
        # Legacy single 'condition' field
        legacy = quest.get('condition')
        if legacy:
            # parse into condition and args
            if ':' in legacy:
                name, rest = legacy.split(':', 1)
                canonical_conditions.append({'condition': name, 'args': [rest], 'operator': quest.get('condition_operator','AND'), 'once_only': False, 'disabled': False})
            else:
                canonical_conditions.append({'condition': legacy, 'args': [], 'operator': quest.get('condition_operator','AND'), 'once_only': False, 'disabled': False})

    new['conditions'] = canonical_conditions

    # Convert commands
    raw_cmds = quest.get('commands') or []
    new['commands'] = convert_commands_list(raw_cmds)

    # Make trigger_type explicit
    if not new.get('trigger_type'):
        # If uri present, default to bsky_reply
        if new.get('uri'):
            new['trigger_type'] = 'bsky_reply'
        else:
            # Default to webhook for site-origin entries like 'trespass'
            new['trigger_type'] = 'webhook'

    return new
