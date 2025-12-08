# Reverie House Test Suite

Clean, consolidated test structure with 9 focused test files.

## Test Files

```
test_api.py              17K    REST API endpoints
test_registration.py     18K    User registration
test_caddy.py            25K    Caddy configuration
test_domain.py            6K    Domain logic (canon, world, zones, spectrum, etc.)
test_quests.py            4K    Quest system
test_services.py          4K    Services (firehose, feeds, rate limiting, PDS)
test_network.py           2K    ATProto networking
test_infrastructure.py    3K    Database & Docker
test_security.py          4K    Auth, encryption, sessions
```

## Quick Start

```bash
# Run all tests
pytest tests/

# Run specific suite
pytest tests/test_api.py -v

# Run by marker
pytest tests/ -m api
pytest tests/ -m database

# Coverage
pytest tests/ --cov=core --cov=utils
```

## Structure

Each file covers one major functional area:
- **API** - All REST endpoints
- **Registration** - User signup and profile management
- **Caddy** - Reverse proxy configuration
- **Domain** - Business logic (canon, world, zones, spectrum, contributions)
- **Quests** - Quest manager and monitoring
- **Services** - Background services (firehose, feeds, rate limiting)
- **Network** - ATProto client and networking
- **Infrastructure** - Database and Docker
- **Security** - Authentication, encryption, sessions

## Adding Tests

Add to the appropriate file:
- New API endpoint → `test_api.py`
- Registration change → `test_registration.py`
- Domain logic → `test_domain.py`
- New service → `test_services.py`

Don't create new files for:
- "Edge cases" vs "basic" splits
- "Brutal" vs "comprehensive" variants
- Test style variations

## History

**Consolidated from 32 files → 9 files (Dec 2025)**
- Removed ~5,500 lines of duplication
- 72% reduction in file count
- 71% reduction in code
- Maintained all test coverage
