#!/usr/bin/env python3
"""
Quest Trigger System - Registry and Base Classes

This module provides the trigger handler registry and base classes for
the quest trigger system. Supports multiple trigger types:
- bsky_reply: Traditional Bluesky post replies (default)
- poll: Periodic polling of external APIs
- webhook: External HTTP triggers
- cron: Time-based triggers
- database_watch: React to database changes
"""

from typing import Dict, Type
from .base import BaseTrigger
from .bsky_reply import BskyReplyTrigger
from .poll import PollTrigger
from .bibliohose import BibliohoseTrigger
from .firehose_phrase import FirehosePhraseTriger

# Registry of all available trigger handlers
TRIGGER_HANDLERS: Dict[str, Type[BaseTrigger]] = {
    'bsky_reply': BskyReplyTrigger,
    'poll': PollTrigger,
    'bibliohose': BibliohoseTrigger,
    'firehose_phrase': FirehosePhraseTriger,
}


def get_trigger_handler(trigger_type: str, quest_config: Dict) -> BaseTrigger:
    """
    Get a trigger handler instance for a quest.
    
    Args:
        trigger_type: Type of trigger ('bsky_reply', 'poll', etc.)
        quest_config: Quest configuration dictionary
        
    Returns:
        Instance of the appropriate trigger handler
        
    Raises:
        ValueError: If trigger_type is not recognized
    """
    handler_class = TRIGGER_HANDLERS.get(trigger_type)
    
    if not handler_class:
        raise ValueError(f"Unknown trigger type: {trigger_type}")
    
    return handler_class(quest_config)


def register_trigger_handler(trigger_type: str, handler_class: Type[BaseTrigger]):
    """
    Register a new trigger handler type.
    
    Args:
        trigger_type: Unique identifier for this trigger type
        handler_class: Class that extends BaseTrigger
    """
    TRIGGER_HANDLERS[trigger_type] = handler_class


__all__ = [
    'BaseTrigger',
    'BskyReplyTrigger',
    'PollTrigger',
    'BibliohoseTrigger',
    'FirehosePhraseTriger',
    'TRIGGER_HANDLERS',
    'get_trigger_handler',
    'register_trigger_handler',
]
