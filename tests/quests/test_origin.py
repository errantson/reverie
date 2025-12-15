import pytest

from tools.quest_migration import convert_quest_record


def test_origin_convert_to_canonical():
    quest = {'title': 'origin', 'conditions': [{'condition': 'first_reply'}], 'commands': []}
    new = convert_quest_record(quest)
    assert new['conditions'][0]['condition'] == 'first_reply'
