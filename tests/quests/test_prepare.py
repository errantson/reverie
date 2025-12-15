import pytest

from tools.quest_migration import convert_quest_record


def test_prepare_convert_to_canonical():
    quest = {'title': 'prepare', 'conditions': [{'condition': 'any_reply'}], 'commands': []}
    new = convert_quest_record(quest)
    assert new['conditions'][0]['condition'] == 'any_reply'
