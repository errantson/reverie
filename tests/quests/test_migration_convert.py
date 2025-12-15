import pytest

from tools.quest_migration import convert_quest_record


def test_convert_watson_sample():
    quest = {
        'title': 'watson',
        'commands': ['register_if_needed', 'award_souvenir:bell', 'add_canon:bell:answered a call:event:bell', 'like_post', 'disable_quest'],
        'conditions': [{'condition': 'reply_contains', 'value': 'it would take me a week now', 'operator': 'AND'}],
        'condition_operator': 'AND',
        'uri': 'at://did:plc:44y.../post/3jk'
    }

    new = convert_quest_record(quest)
    assert any(c['condition'] == 'reply_contains' and c['args'][0].startswith('it would take me') for c in new['conditions'])
    assert all(isinstance(cmd, dict) and 'cmd' in cmd for cmd in new['commands'])


def test_convert_trespass_sample():
    quest = {
        'title': 'trespass',
        'commands': ['add_canon:trespass:trespassed upon an Unfinished Dream:flawed.center:dream'],
        'conditions': [{'condition': 'hasnt_canon', 'value': 'trespass'}],
        'uri': ''
    }
    new = convert_quest_record(quest)
    assert new['trigger_type'] == 'webhook'
    assert new['commands'][0]['cmd'] == 'add_canon'
