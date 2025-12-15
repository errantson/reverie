import pytest

from tools.quest_migration import convert_quest_record


def test_letters_convert_once_only():
    quest = {'title': 'letters', 'conditions': [{'condition': 'reply_contains', 'value': 'strange musical instruments', 'once_only': True}], 'commands': []}
    new = convert_quest_record(quest)
    assert new['conditions'][0]['once_only'] is True
    assert new['conditions'][0]['condition'] == 'reply_contains'
