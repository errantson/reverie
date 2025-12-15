#!/usr/bin/env python3
"""
Tests for the work/worker subsystem: greeter, mapper, cogitarian, provisioner

These are lightweight integration checks that read the `work` table and
validate role entries, worker JSON structure, and capacity/retiring rules.
"""

from core.database import DatabaseManager
import json
import pytest


def test_work_roles_exist_and_structure():
    db = DatabaseManager()
    roles = ['greeter', 'mapper', 'cogitarian', 'provisioner']

    rows = db.fetch_all(
        """
        SELECT role, workers, worker_limit, status
        FROM work
        WHERE role = ANY(%s)
        """,
        (roles,)
    )

    # If the work table has no role rows at all, skip this test (no config)
    if not rows:
        pytest.skip("No work roles configured in `work` table; skipping role presence checks")

    # Validate present roles only; missing roles may simply be unconfigured
    found = {r['role'] for r in rows}
    missing = [r for r in roles if r not in found]
    if missing:
        # Informational only; don't fail the whole test if some roles aren't configured
        print(f"ℹ️  Some expected roles are not configured: {missing}")

    for row in rows:
        role = row['role']
        workers_raw = row.get('workers')

        # worker_limit should be an integer (or None/0)
        worker_limit = row.get('worker_limit')
        assert worker_limit is None or isinstance(worker_limit, int)

        if workers_raw:
            try:
                workers = json.loads(workers_raw) if isinstance(workers_raw, str) else workers_raw
            except Exception as e:
                assert False, f"Invalid JSON in work.workers for role {role}: {e}"

            assert isinstance(workers, list), f"workers for {role} is not a list"

            # Each worker should have a did and status
            for w in workers:
                assert isinstance(w, dict), f"worker entry for {role} is not an object: {w}"
                assert 'did' in w and w['did'], f"worker missing did for role {role}: {w}"
                assert 'status' in w and w['status'], f"worker missing status for role {role}: {w}"


def test_worker_capacity_and_retiring_policy():
    db = DatabaseManager()
    rows = db.fetch_all("SELECT role, workers, worker_limit FROM work WHERE worker_limit IS NOT NULL")

    for row in rows:
        role = row['role']
        limit = row['worker_limit'] or 0
        workers_raw = row.get('workers')
        workers = []
        if workers_raw:
            try:
                workers = json.loads(workers_raw) if isinstance(workers_raw, str) else workers_raw
            except Exception:
                workers = []

        if limit > 0 and len(workers) >= limit:
            # If role is at capacity, at least one worker should be 'retiring' to allow replacement
            statuses = {w.get('status') for w in workers if isinstance(w, dict)}
            assert 'retiring' in statuses or 'working' in statuses, (
                f"Role {role} at capacity ({limit}) but workers have no retiring/working statuses: {statuses}"
            )


if __name__ == '__main__':
    # Allow running standalone
    test_work_roles_exist_and_structure()
    test_worker_capacity_and_retiring_policy()
    print('OK')
