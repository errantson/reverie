# Courier System Testing Guide

## Running Tests

### Quick Start
```bash
# Install test dependencies
pip install -r tests/requirements.txt

# Run all courier tests
python tests/run_tests.sh

# Or run with pytest directly
pytest tests/test_courier.py -v
```

### Run Specific Test Classes
```bash
# Test only facet detection
pytest tests/test_courier.py::TestFacetDetection -v

# Test only post delivery
pytest tests/test_courier.py::TestPostDelivery -v

# Test only database operations
pytest tests/test_courier.py::TestDatabaseOperations -v
```

### Run with Coverage
```bash
pytest tests/test_courier.py --cov=core.courier --cov=api.routes.courier_routes --cov-report=html
```

Coverage report will be generated in `htmlcov/index.html`

## Test Structure

### Test Classes

1. **TestFacetDetection** - Auto-detection of links and @mentions
   - Simple URLs
   - URLs without protocol
   - Multiple facets
   - Byte position calculation
   - Edge cases

2. **TestEncryptionDecryption** - Post text security
   - Roundtrip encryption
   - Unicode handling
   - Empty strings
   - Max length (300 chars)

3. **TestDatabaseOperations** - Courier table operations
   - Insert scheduled posts
   - Query pending posts
   - Update post status
   - **Note:** Requires test database access

4. **TestPostDelivery** - Post sending mechanism
   - Successful delivery
   - Authentication failures
   - Post creation failures
   - Facet integration

5. **TestLoreIntegration** - Lore label application
   - API key handling
   - Label application
   - Error handling

6. **TestServiceLoop** - Background service behavior
   - Processing pending posts
   - Error recovery
   - Rate limiting

7. **TestEdgeCases** - Boundary conditions
   - Empty inputs
   - Very long content
   - Special characters
   - Null values

8. **TestAPIRouteIntegration** - HTTP endpoint testing
   - Authentication requirements
   - Input validation
   - Error responses
   - **Note:** Requires Flask app context

## Test Database Setup

For database tests to work, you need:

1. Test database credentials in environment:
   ```bash
   export POSTGRES_HOST=localhost
   export POSTGRES_DB=reverie_house
   export POSTGRES_USER=reverie
   export POSTGRES_PASSWORD=your_password
   ```

2. Or use a password file:
   ```bash
   export POSTGRES_PASSWORD_FILE=/srv/secrets/reverie.postgres.password
   ```

3. Test data will be cleaned up automatically

## Mocking vs Integration

### Mocked Tests (Fast, No Dependencies)
- `TestFacetDetection` - Mocks HTTP requests
- `TestEncryptionDecryption` - No external dependencies
- `TestPostDelivery` - Mocks Bluesky API
- `TestLoreIntegration` - Mocks lore.farm API
- `TestServiceLoop` - Mocks database and time

### Integration Tests (Slower, Requires Services)
- `TestDatabaseOperations` - Requires PostgreSQL
- `TestAPIRouteIntegration` - Requires Flask app + database

## Environment Variables

Required for tests:
```bash
# Encryption (for post text)
export ENCRYPTION_KEY="your_32_byte_key_here_exactly"

# Lore integration (optional for most tests)
export LOREFARM_KEY="your_lore_api_key"
```

## Continuous Integration

To run in CI/CD:
```bash
#!/bin/bash
set -e

# Install dependencies
pip install -r requirements.txt
pip install -r tests/requirements.txt

# Run tests with coverage
pytest tests/test_courier.py \
    --cov=core.courier \
    --cov=api.routes.courier_routes \
    --cov-report=xml \
    --cov-report=term-missing \
    --junitxml=test-results.xml

# Fail if coverage below 80%
pytest tests/test_courier.py --cov=core.courier --cov-fail-under=80
```

## Common Issues

### Database Connection Errors
```
psycopg2.OperationalError: password authentication failed
```
**Solution:** Check database credentials and password file

### Import Errors
```
ModuleNotFoundError: No module named 'core'
```
**Solution:** Run tests from `/srv/reverie.house` directory

### Encryption Key Errors
```
ValueError: Encryption key must be exactly 32 bytes
```
**Solution:** Set ENCRYPTION_KEY environment variable

## Test Coverage Goals

- **Core courier.py:** 90%+ coverage
- **API routes:** 85%+ coverage
- **Critical paths:** 100% coverage
  - Post scheduling
  - Post delivery
  - Error handling
  - Authentication

## Adding New Tests

1. Add test method to appropriate class
2. Use descriptive names: `test_<what>_<expected_behavior>`
3. Follow AAA pattern:
   - **Arrange:** Set up test data
   - **Act:** Execute the code
   - **Assert:** Verify results
4. Use mocks for external dependencies
5. Clean up test data in fixtures
6. Update this documentation

## Debugging Tests

Run with more detail:
```bash
# Show full traceback
pytest tests/test_courier.py -v --tb=long

# Show print statements
pytest tests/test_courier.py -v -s

# Run only failed tests
pytest tests/test_courier.py --lf

# Drop into debugger on failure
pytest tests/test_courier.py --pdb
```

## Performance Testing

For load testing the courier system:
```python
# Add to test_courier.py
class TestPerformance:
    def test_handle_1000_scheduled_posts(self):
        # Create 1000 scheduled posts
        # Verify service can process them
        # Measure time and memory
        pass
```

Run performance tests separately:
```bash
pytest tests/test_courier.py::TestPerformance -v --durations=10
```
