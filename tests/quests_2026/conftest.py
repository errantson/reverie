"""
Pytest configuration for quests_2026 tests.
These tests verify PRODUCTION data state after migrations.
Sets up proper database connection for tests running outside Docker.
"""

import os
import pytest

# These tests verify production state - MUST use reverie_house database
# Override parent conftest's test database setting
def pytest_configure(config):
    """Configure environment for tests - PRODUCTION DATABASE."""
    # Force production database connection
    os.environ['POSTGRES_HOST'] = '172.23.0.3'
    os.environ['POSTGRES_PORT'] = '5432'
    os.environ['POSTGRES_DB'] = 'reverie_house'  # PRODUCTION - verifying real state
    os.environ['POSTGRES_USER'] = 'reverie'
    
    # Read password from secrets file if available
    password_file = '/srv/reverie.house/secrets/db_password.txt'
    if os.path.exists(password_file):
        with open(password_file, 'r') as f:
            os.environ['POSTGRES_PASSWORD'] = f.read().strip()
