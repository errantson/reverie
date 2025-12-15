import pytest

from tools.quest_migration import convert_quest_record


def test_watson_convert_to_canonical():
    quest = {'title': 'watson', 'conditions': [{'condition': 'reply_contains', 'value': 'it would take me a week now'}], 'commands': []}
    new = convert_quest_record(quest)
    assert new['conditions'][0]['condition'] == 'reply_contains'
    assert 'it would take me a week now' in new['conditions'][0]['args'][0]
