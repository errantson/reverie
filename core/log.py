"""
Structured logging for reverie.house services.
Usage:
    from core.log import get_logger
    log = get_logger(__name__)
    log.info("message")       # always shown
    log.debug("message")      # only with --verbose
"""

import logging
import sys
from datetime import datetime

class ServiceFormatter(logging.Formatter):
    def format(self, record):
        ts = datetime.now().strftime('%H:%M:%S')
        level = record.levelname[0]  # I, D, W, E
        name = record.name.split('.')[-1][:12].ljust(12)
        return f"[{ts}] {level} {name} | {record.getMessage()}"

def get_logger(name: str, verbose: bool = False) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(ServiceFormatter())
        logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    return logger

def set_verbose(logger: logging.Logger, verbose: bool):
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
