# Test Safety Guide

## ✅ SAFE: Default Testing (Test Database)

```bash
# Run all tests against reverie_test database
./run_tests.sh

# Run specific test file
./run_tests.sh tests/test_api.py -v

# Run only unit tests (no database needed)
pytest -m unit
```

**Database**: `reverie_test` (isolated copy, safe to break)

## ⚠️ CAUTION: Integration Testing (Production Database)

```bash
# Run integration tests against PRODUCTION
POSTGRES_DB=reverie_house ./run_tests.sh -m integration

# WARNING: This connects to real production database!
# Only use for validation before deployment
```

**Database**: `reverie_house` (PRODUCTION - do not modify!)

## Test Database Management

### Reset Test Database
```bash
# Drop and recreate from scratch
docker exec reverie_db psql -U reverie -d postgres -c "DROP DATABASE IF EXISTS reverie_test;"
docker exec reverie_db psql -U reverie -d postgres -c "CREATE DATABASE reverie_test OWNER reverie;"

# Run migrations to set up schema
# (Add migration commands here when available)
```

### Populate Test Data
```bash
# Insert minimal test data
docker exec reverie_db psql -U reverie -d reverie_test -f /path/to/test_fixtures.sql
```

## Test Markers

- `@pytest.mark.unit` - Safe, no external dependencies
- `@pytest.mark.integration` - Requires database/services  
- `@pytest.mark.network` - Makes real network calls
- `@pytest.mark.database` - Requires database access

## Running Specific Test Types

```bash
# Only safe unit tests
pytest -m unit

# Skip network tests
pytest -m "not network"

# Only integration tests (use test DB by default)
pytest -m integration

# Integration tests on production (DANGEROUS)
POSTGRES_DB=reverie_house pytest -m integration
```

## Before Committing

Always run:
```bash
# 1. Unit tests (fast, safe)
pytest -m unit

# 2. Database tests on test DB
./run_tests.sh -m database

# 3. Check for skipped tests
pytest --collect-only | grep SKIPPED
```

## Test Database vs Production

| Database | Use Case | Risk |
|----------|----------|------|
| `reverie_test` | Default, unit tests, development | ✅ Zero risk |
| `reverie_house` | Integration validation, pre-deploy | ⚠️ High risk - READ ONLY |

## Common Pitfalls

❌ **DON'T**: Run tests against production without explicit POSTGRES_DB override
❌ **DON'T**: Commit tests that modify production data
❌ **DON'T**: Use `assert True` or overly permissive assertions

✅ **DO**: Use test database by default
✅ **DO**: Mark tests appropriately (@pytest.mark.unit, etc.)
✅ **DO**: Write specific assertions with clear error messages
✅ **DO**: Clean up test data after each test

## Recent Fixes (2025-12-09)

1. ✅ Changed default from `reverie_house` → `reverie_test`
2. ✅ Removed `assert True` bypasses
3. ✅ Strengthened weak assertions
4. ✅ Added warnings for production database access
5. ✅ Improved skip messages for clarity

## Contact

Questions about testing safety? Review `/srv/reverie.house/TESTING.md`
