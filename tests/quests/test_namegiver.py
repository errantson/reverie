import pytest

from tools.quest_migration import convert_quest_record


def test_namegiver_convert_to_canonical():
    quest = {'title': 'namegiver', 'conditions': [{'condition': 'hasnt_canon', 'value': 'name'}], 'commands': ['name_dreamer']}
    new = convert_quest_record(quest)
    assert new['conditions'][0]['condition'] == 'hasnt_canon'
    assert new['conditions'][0]['args'][0] == 'name'
