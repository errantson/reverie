# Reverie House Test Suite

## Overview

Comprehensive test suite covering:
- ✅ Database layer (transactions, pooling, CRUD operations)
- ✅ Authentication (sessions, JWT validation, encryption)
- ✅ API routes (all major endpoints)  
- ✅ Docker networking (service connectivity)
- ✅ PDS integration (account management)
- ✅ Worker roles (app passwords, write access, service endpoints)
- ✅ **Courier auth recovery (401 handling, credential invalidation, auto-retry)**

## Test Structure

```
tests/
├── conftest.py                      # Shared fixtures
├── test_database.py                 # Database layer (25 tests)
├── test_auth.py                     # Authentication (23 tests)
├── test_api_routes.py               # API endpoints (26 tests)
├── test_docker.py                   # Docker networking (15 tests)
├── test_pds.py                      # PDS integration (13 tests)
├── test_work_roles.py               # Worker roles (15 tests)
├── test_courier_auth_recovery.py    # Courier auth recovery (NEW - 8 tests)
└── run_work_tests.py                # Quick runner for work tests
```

## Running Tests

**Full test suite:**
```bash
./run_tests.sh
```

**Quick tests only (exclude slow/docker/pds):**
```bash
./run_tests.sh -m "not slow and not docker and not pds"
```

**Courier auth recovery tests:**
```bash
pytest tests/test_courier_auth_recovery.py -v
```

**Worker role tests only:**
```bash
pytest tests/test_work_roles.py -v
# OR use the quick runner:
python3 tests/run_work_tests.py
```

**Specific test file:**
```bash
./run_tests.sh tests/test_database.py
```

**Specific test:**
```bash
./run_tests.sh -k test_connection_successful
```

**With verbose output:**
```bash
./run_tests.sh -v
```

## Test Markers

- `@pytest.mark.database` - Requires database connection
- `@pytest.mark.docker` - Requires Docker
- `@pytest.mark.pds` - Requires PDS admin access  
- `@pytest.mark.slow` - Long-running tests
- `@pytest.mark.integration` - Integration tests

## Worker Role Tests

**New in this version:** Comprehensive worker role validation

### What's Tested

1. **Role Definitions** - All roles exist with correct configuration
2. **Credential Storage** - Active workers have valid encrypted credentials
3. **Password Encryption** - Encryption/decryption roundtrip works
4. **Worker Client Creation** - WorkerNetworkClient instantiation
5. **ATProto Authentication** - Authentication with PDS
6. **Write Access Proof** - Create and delete test posts
   - Creates timestamped test post
   - Verifies creation succeeded
   - Deletes post immediately
   - Proves app password is functional
7. **Service Endpoints** - Role-specific functions available

### Quick Test Runner

```bash
# Test all roles
python3 tests/run_work_tests.py

# Test specific role only
python3 tests/run_work_tests.py --role greeter

# Quick mode (skip write tests)
python3 tests/run_work_tests.py --quick
```

Output shows step-by-step validation:
```
======================================================================
Testing GREETER Role
======================================================================

[1/6] Checking role definition...
✅ Role exists (limit: 1, requires_password: True)

[2/6] Checking for active workers...
✅ Active greeter: @isilme.reverie.house (Isilmë)

[3/6] Checking stored credentials...
✅ Credentials exist and marked valid

[4/6] Testing password decryption...
✅ Password decrypted successfully

[5/6] Testing ATProto authentication...
✅ Authenticated successfully
   PDS: https://reverie.house
   Session token: ********************...abc123xyz

[6/6] Testing create/delete post (proof of write access)...
✅ Created test post: at://did:plc:xxx/app.bsky.feed.post/yyy
✅ Deleted test post successfully

======================================================================
✅ ALL TESTS PASSED FOR GREETER
======================================================================
```

## Coverage

**Phase 1 (Completed):**
- Database connection pooling
- Transaction safety (commit/rollback)
- CRUD operations (insert/update/delete)
- Session management
- JWT validation
- Password encryption
- Rate limiting
- Core API endpoints

**Phase 2 (Docker tests - requires `-m docker`):**
- Bridge network configuration
- Service connectivity
- Port exposure security
- Caddy reverse proxy

**Phase 3 (PDS tests - requires `-m pds` and sudo access):**
- PDS account listing
- Handle resolution
- DID validation

## Known Issues

1. **Password authentication** - Test fixture needs to read DB password from mounted secrets
2. **Rate limiter API** - Need to verify method names match implementation
3. **Empty string encryption** - Test needs to handle edge case

## Current Status

**Initial run:** 5 tests passed, suite is functional

**Next steps:**
1. Fix password authentication in test container
2. Update rate limiter test method names
3. Fix empty string encryption test
4. Achieve 80% coverage target

## Requirements

```bash
pip install -r requirements-test.txt
```

Dependencies:
- pytest>=9.0.0
- pytest-timeout>=2.4.0
- pytest-flask>=1.3.0
