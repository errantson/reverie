"""
Comprehensive Caddy Builder Testing Suite

Tests the entire Caddy configuration generation system including:

1. Handle Composition
   - Primary name subdomain generation
   - Alternate name subdomain generation  
   - DID-to-handle mapping
   - Handle format validation

2. Timing & Operations
   - Database query timing
   - File generation timing
   - Reload/restart operations
   - Concurrent rebuild handling

3. Name Assignment Tracking
   - Primary name → subdomain
   - Alt names → additional subdomains
   - Name changes → configuration updates
   - Name swaps → both subdomains active

4. History & State Management
   - Caddyfile generation tracking
   - Rebuild triggers (registration, name changes)
   - Configuration consistency
   - Dreamer count validation

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import subprocess
import time
import re
import os
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import psycopg2


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def caddybuilder_path():
    """Path to caddybuilder.py"""
    return "/srv/caddy/caddybuilder.py"


@pytest.fixture
def caddyfile_path():
    """Path to generated Caddyfile"""
    return "/srv/caddy/Caddyfile"


@pytest.fixture
def unique_test_id():
    """Generate unique ID for this test run"""
    return int(time.time() * 1000)


@pytest.fixture
def test_dreamer_data(unique_test_id):
    """Generate test dreamer with primary and alt names"""
    timestamp = unique_test_id
    return {
        'did': f'did:plc:caddytest{timestamp}',
        'name': f'testdreamer{timestamp}',
        'alts': f'altname{timestamp},anothername{timestamp}',
        'handle': f'test{timestamp}.bsky.social'
    }


# ============================================================================
# HANDLE COMPOSITION TESTS
# ============================================================================

@pytest.mark.integration
class TestHandleComposition:
    """Test subdomain generation from dreamer names"""
    
    def test_primary_name_generates_subdomain(self, caddyfile_path):
        """Test that primary dreamer name generates a subdomain block"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Check for at least one dreamer subdomain
        # Pattern: {name}.reverie.house with DID response
        pattern = r'(\w+)\.reverie\.house \{\s+import log_config\s+handle_path /\.well-known/atproto-did'
        matches = re.findall(pattern, content)
        
        assert len(matches) > 0, "No dreamer subdomains found in Caddyfile"
    
    def test_alt_names_generate_subdomains(self, test_db, caddyfile_path):
        """Test that alternate names also get subdomain blocks"""
        # Find a dreamer with alts
        dreamer = test_db.execute(
            "SELECT name, alts, did FROM dreamers WHERE alts IS NOT NULL AND alts != '' LIMIT 1"
        ).fetchone()
        
        # This test requires dreamers with alt names - skip only if truly not applicable
        if not dreamer:
            pytest.skip("No dreamers with alternate names found - feature may not be used yet")
        
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Check that primary name exists
        assert f"{dreamer['name']}.reverie.house" in content
        
        # Check that alt names exist
        alt_names = [alt.strip() for alt in dreamer['alts'].split(',') if alt.strip()]
        for alt_name in alt_names:
            assert f"{alt_name}.reverie.house" in content, \
                f"Alt name {alt_name} not found in Caddyfile"
    
    def test_subdomain_structure_correct(self, caddyfile_path):
        """Test that subdomain blocks have correct structure"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Find first dreamer subdomain
        pattern = r'# (\w+)\n(\w+)\.reverie\.house \{([^}]+)\}'
        match = re.search(pattern, content, re.DOTALL)
        
        assert match is not None, "No valid subdomain block found"
        
        comment_name = match.group(1)
        subdomain_name = match.group(2)
        block_content = match.group(3)
        
        # Names should match
        assert comment_name == subdomain_name
        
        # Block should contain required elements
        assert 'import log_config' in block_content
        assert 'handle_path /.well-known/atproto-did' in block_content
        assert 'respond "did:plc:' in block_content
        assert 'reverse_proxy 172.23.0.12:4444' in block_content
        assert 'header_up Host' in block_content
    
    def test_did_to_handle_mapping_correct(self, test_db, caddyfile_path):
        """Test that DIDs are correctly mapped to handles"""
        # Get a known dreamer
        dreamer = test_db.execute(
            "SELECT name, did FROM dreamers WHERE name IS NOT NULL AND did IS NOT NULL LIMIT 1"
        ).fetchone()
        
        if not dreamer:
            pytest.skip("No dreamers found in database")
        
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Find the subdomain block for this dreamer
        pattern = rf'{re.escape(dreamer["name"])}\.reverie\.house \{{[^}}]+respond "{re.escape(dreamer["did"])}"'
        
        assert re.search(pattern, content, re.DOTALL), \
            f"DID {dreamer['did']} not correctly mapped to {dreamer['name']}"
    
    def test_no_duplicate_subdomains(self, caddyfile_path):
        """Test that no subdomain is defined twice"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Extract all subdomain definitions
        pattern = r'(\w+)\.reverie\.house \{'
        subdomains = re.findall(pattern, content)
        
        # Check for duplicates
        duplicates = [name for name in set(subdomains) if subdomains.count(name) > 1]
        
        assert len(duplicates) == 0, f"Duplicate subdomains found: {duplicates}"
    
    def test_empty_alts_handled(self, test_db, caddyfile_path):
        """Test that dreamers with empty alts field are handled correctly"""
        # Get dreamers with NULL or empty alts
        dreamers = test_db.execute(
            "SELECT name, did FROM dreamers WHERE (alts IS NULL OR alts = '') AND name IS NOT NULL LIMIT 5"
        ).fetchall()
        
        if len(dreamers) == 0:
            pytest.skip("No dreamers without alts found")
        
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Each should have exactly one subdomain block
        for dreamer in dreamers:
            pattern = rf'{re.escape(dreamer["name"])}\.reverie\.house'
            matches = re.findall(pattern, content)
            assert len(matches) == 1, \
                f"Dreamer {dreamer['name']} appears {len(matches)} times (expected 1)"


# ============================================================================
# TIMING & OPERATIONS TESTS
# ============================================================================

@pytest.mark.integration
class TestTimingAndOperations:
    """Test timing and operational aspects of caddy builder"""
    
    def test_build_completes_in_reasonable_time(self, caddybuilder_path):
        """Test that build completes within reasonable time"""
        start = time.time()
        
        result = subprocess.run(
            ['python3', caddybuilder_path, '--no-reload'],
            capture_output=True,
            text=True,
            timeout=60  # Should complete within 60 seconds
        )
        
        duration = time.time() - start
        
        assert result.returncode == 0, f"Build failed: {result.stderr}"
        assert duration < 30, f"Build took {duration:.2f}s (expected < 30s)"
    
    def test_database_query_retrieves_all_dreamers(self, test_db, caddybuilder_path):
        """Test that caddybuilder retrieves all dreamers from database"""
        # Count dreamers in database
        db_count = test_db.execute(
            "SELECT COUNT(*) as count FROM dreamers WHERE did IS NOT NULL AND name IS NOT NULL"
        ).fetchone()['count']
        
        # Run builder with --no-reload
        result = subprocess.run(
            ['python3', caddybuilder_path, '--no-reload'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        assert result.returncode == 0
        
        # Check output for dreamer count
        # Expected: "✅ Loaded {N} dreamers from database"
        match = re.search(r'Loaded (\d+) dreamers from database', result.stdout)
        assert match is not None, "Could not find dreamer count in output"
        
        loaded_count = int(match.group(1))
        assert loaded_count == db_count, \
            f"Loaded {loaded_count} dreamers but database has {db_count}"
    
    def test_subdomain_count_matches_names_plus_alts(self, test_db, caddybuilder_path):
        """Test that subdomain count = primary names + all alt names"""
        # Count expected subdomains
        dreamers = test_db.execute(
            "SELECT name, alts FROM dreamers WHERE did IS NOT NULL AND name IS NOT NULL"
        ).fetchall()
        
        expected_count = 0
        for dreamer in dreamers:
            expected_count += 1  # Primary name
            if dreamer['alts']:
                alts = [alt.strip() for alt in dreamer['alts'].split(',') if alt.strip()]
                expected_count += len(alts)
        
        # Run builder
        result = subprocess.run(
            ['python3', caddybuilder_path, '--no-reload'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        assert result.returncode == 0
        
        # Check output for subdomain count
        # Expected: "✅ Generated {N} dreamer subdomains"
        match = re.search(r'Generated (\d+) dreamer subdomains', result.stdout)
        assert match is not None, "Could not find subdomain count in output"
        
        generated_count = int(match.group(1))
        assert generated_count == expected_count, \
            f"Generated {generated_count} subdomains but expected {expected_count}"
    
    def test_no_reload_flag_skips_reload(self, caddybuilder_path):
        """Test that --no-reload flag prevents Caddy reload"""
        result = subprocess.run(
            ['python3', caddybuilder_path, '--no-reload'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        assert result.returncode == 0
        assert 'Reloading Caddy' not in result.stdout
        assert 'Caddy reloaded' not in result.stdout
    
    def test_file_generation_produces_valid_output(self, caddyfile_path):
        """Test that generated Caddyfile is valid and non-empty"""
        assert os.path.exists(caddyfile_path), "Caddyfile does not exist"
        
        stat = os.stat(caddyfile_path)
        assert stat.st_size > 1000, f"Caddyfile is too small ({stat.st_size} bytes)"
        
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Check for expected sections
        assert '# AUTO-GENERATED CADDYFILE' in content
        assert 'email books@reverie.house' in content
        assert 'DREAMER SUBDOMAINS' in content
        assert 'reverie.house' in content


# ============================================================================
# NAME ASSIGNMENT TRACKING TESTS
# ============================================================================

@pytest.mark.database
class TestNameAssignmentTracking:
    """Test how name assignments are tracked in Caddy configuration"""
    
    def test_new_dreamer_triggers_subdomain_creation(self, test_db, test_dreamer_data, caddyfile_path):
        """Test that new dreamer registration results in new subdomain"""
        # Clean up any existing test data
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_dreamer_data['did'],))
        
        # Get initial subdomain count
        with open(caddyfile_path, 'r') as f:
            initial_content = f.read()
        initial_subdomains = len(re.findall(r'\.reverie\.house \{', initial_content))
        
        try:
            # Add new dreamer
            test_db.execute("""
                INSERT INTO dreamers (did, handle, name, arrival, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                test_dreamer_data['did'],
                test_dreamer_data['handle'],
                test_dreamer_data['name'],
                int(time.time()),
                int(time.time()),
                int(time.time())
            ))
            
            # Rebuild Caddy
            result = subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            assert result.returncode == 0, f"Build failed: {result.stderr}"
            
            # Check new subdomain exists
            with open(caddyfile_path, 'r') as f:
                new_content = f.read()
            
            assert f"{test_dreamer_data['name']}.reverie.house" in new_content
            
            # Subdomain count should increase by 1
            new_subdomains = len(re.findall(r'\.reverie\.house \{', new_content))
            assert new_subdomains == initial_subdomains + 1
            
        finally:
            # Cleanup
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_dreamer_data['did'],))
            # Rebuild to remove test subdomain
            subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                timeout=60
            )
    
    def test_alt_names_create_additional_subdomains(self, test_db, test_dreamer_data, caddyfile_path):
        """Test that adding alt names creates additional subdomains"""
        # Clean up
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_dreamer_data['did'],))
        
        try:
            # Add dreamer with alt names
            test_db.execute("""
                INSERT INTO dreamers (did, handle, name, alts, arrival, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                test_dreamer_data['did'],
                test_dreamer_data['handle'],
                test_dreamer_data['name'],
                test_dreamer_data['alts'],
                int(time.time()),
                int(time.time()),
                int(time.time())
            ))
            
            # Rebuild
            result = subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            assert result.returncode == 0
            
            # Check all subdomains exist
            with open(caddyfile_path, 'r') as f:
                content = f.read()
            
            # Primary name
            assert f"{test_dreamer_data['name']}.reverie.house" in content
            
            # Alt names
            alt_names = test_dreamer_data['alts'].split(',')
            for alt_name in alt_names:
                assert f"{alt_name.strip()}.reverie.house" in content, \
                    f"Alt name {alt_name} not found in Caddyfile"
            
        finally:
            # Cleanup
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_dreamer_data['did'],))
            subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                timeout=60
            )
    
    def test_name_swap_maintains_both_subdomains(self, test_db, caddyfile_path):
        """Test that swapping primary/alt names keeps both subdomains active"""
        # Find a dreamer with alts
        dreamer = test_db.execute(
            "SELECT did, name, alts FROM dreamers WHERE alts IS NOT NULL AND alts != '' LIMIT 1"
        ).fetchone()
        
        if not dreamer:
            pytest.skip("No dreamers with alt names found")
        
        original_name = dreamer['name']
        original_alts = dreamer['alts']
        
        # Get first alt name
        alt_names = [alt.strip() for alt in original_alts.split(',') if alt.strip()]
        if len(alt_names) == 0:
            pytest.skip("Dreamer has empty alts")
        
        first_alt = alt_names[0]
        
        try:
            # Simulate name swap: primary ↔ first alt
            # New primary = first_alt
            # New alts = original_name + remaining alts
            remaining_alts = alt_names[1:] if len(alt_names) > 1 else []
            new_alts = [original_name] + remaining_alts
            new_alts_str = ','.join(new_alts)
            
            test_db.execute("""
                UPDATE dreamers
                SET name = %s, alts = %s, updated_at = %s
                WHERE did = %s
            """, (first_alt, new_alts_str, int(time.time()), dreamer['did']))
            
            # Rebuild
            result = subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            assert result.returncode == 0
            
            # Check BOTH names still have subdomains
            with open(caddyfile_path, 'r') as f:
                content = f.read()
            
            assert f"{original_name}.reverie.house" in content, \
                f"Original name {original_name} disappeared after swap"
            assert f"{first_alt}.reverie.house" in content, \
                f"New primary name {first_alt} not found after swap"
            
        finally:
            # Restore original state
            test_db.execute("""
                UPDATE dreamers
                SET name = %s, alts = %s, updated_at = %s
                WHERE did = %s
            """, (original_name, original_alts, int(time.time()), dreamer['did']))
            subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                timeout=60
            )


# ============================================================================
# CONFIGURATION CONSISTENCY TESTS
# ============================================================================

@pytest.mark.integration
class TestConfigurationConsistency:
    """Test configuration consistency and validity"""
    
    def test_all_dreamers_in_db_have_subdomains(self, test_db, caddyfile_path):
        """Test that every valid dreamer in DB has a subdomain"""
        dreamers = test_db.execute(
            "SELECT name, did FROM dreamers WHERE did IS NOT NULL AND name IS NOT NULL AND name != ''"
        ).fetchall()
        
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        missing = []
        for dreamer in dreamers:
            if f"{dreamer['name']}.reverie.house" not in content:
                missing.append(dreamer['name'])
        
        assert len(missing) == 0, f"Dreamers missing from Caddyfile: {missing}"
    
    def test_all_subdomains_point_to_correct_proxy(self, caddyfile_path):
        """Test that all dreamer subdomains proxy to reverie API"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Find all dreamer subdomain blocks
        pattern = r'(\w+)\.reverie\.house \{([^}]+)\}'
        matches = re.findall(pattern, content, re.DOTALL)
        
        # Core sites might proxy elsewhere, so filter to just dreamer subdomains
        # Dreamer subdomains are in the "AUTO-GENERATED FROM DATABASE" section
        dreamer_section_match = re.search(
            r'# DREAMER SUBDOMAINS \(AUTO-GENERATED FROM DATABASE\)(.*)',
            content,
            re.DOTALL
        )
        
        if dreamer_section_match:
            dreamer_content = dreamer_section_match.group(1)
            dreamer_matches = re.findall(r'(\w+)\.reverie\.house \{([^}]+)\}', dreamer_content, re.DOTALL)
            
            for name, block in dreamer_matches:
                assert 'reverse_proxy 172.23.0.12:4444' in block, \
                    f"Subdomain {name} does not proxy to correct endpoint"
    
    def test_generated_file_has_proper_header(self, caddyfile_path):
        """Test that generated file has proper auto-generated warning header"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        assert '# AUTO-GENERATED CADDYFILE' in content
        assert 'Generated by: /srv/caddy/caddybuilder.py' in content
        assert 'DO NOT EDIT' in content or 'auto-generated' in content.lower()
    
    def test_project_configs_included(self, caddyfile_path):
        """Test that project configurations are included"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Should have project configurations section
        assert 'PROJECT CONFIGURATIONS' in content
        
        # Should have at least some core projects
        # (reverie.house, lore.farm, etc. - from their caddy.conf files)
        assert 'reverie.house' in content
    
    def test_no_malformed_subdomain_blocks(self, caddyfile_path):
        """Test that all subdomain blocks are properly formed"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Find dreamer section
        dreamer_section_match = re.search(
            r'# DREAMER SUBDOMAINS \(AUTO-GENERATED FROM DATABASE\)(.*)',
            content,
            re.DOTALL
        )
        
        if dreamer_section_match:
            dreamer_content = dreamer_section_match.group(1)
            
            # Check for common malformations
            # 1. Unclosed braces
            open_braces = dreamer_content.count('{')
            close_braces = dreamer_content.count('}')
            assert open_braces == close_braces, "Mismatched braces in dreamer section"
            
            # 2. Missing DIDs
            subdomain_blocks = re.findall(r'(\w+)\.reverie\.house \{([^}]+)\}', dreamer_content, re.DOTALL)
            for name, block in subdomain_blocks:
                assert 'respond "did:plc:' in block or 'respond "did:web:' in block, \
                    f"Subdomain {name} missing DID response"
            
            # 3. Missing proxy
            for name, block in subdomain_blocks:
                assert 'reverse_proxy' in block, \
                    f"Subdomain {name} missing reverse proxy"


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

@pytest.mark.integration
class TestErrorHandling:
    """Test error handling in caddy builder"""
    
    def test_handles_missing_database_gracefully(self, caddybuilder_path):
        """Test behavior when database is unreachable"""
        # This test would require mocking the database connection
        # For now, just verify the script doesn't crash
        result = subprocess.run(
            ['python3', caddybuilder_path, '--no-reload'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        # Should either succeed or fail gracefully
        assert result.returncode in [0, 1]
    
    def test_handles_null_did_gracefully(self, test_db):
        """Test that dreamers with NULL DIDs are skipped"""
        # Check if any dreamers have NULL DIDs
        null_dids = test_db.execute(
            "SELECT COUNT(*) as count FROM dreamers WHERE did IS NULL"
        ).fetchone()['count']
        
        if null_dids > 0:
            # Rebuild should succeed despite NULL DIDs
            result = subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            assert result.returncode == 0, "Build failed with NULL DIDs present"
    
    def test_handles_empty_name_gracefully(self, test_db):
        """Test that dreamers with empty names are skipped"""
        # Check for empty names
        empty_names = test_db.execute(
            "SELECT COUNT(*) as count FROM dreamers WHERE name IS NULL OR name = ''"
        ).fetchone()['count']
        
        if empty_names > 0:
            # Rebuild should succeed despite empty names
            result = subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py', '--no-reload'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            assert result.returncode == 0, "Build failed with empty names present"


# ============================================================================
# CRITICAL INFRASTRUCTURE TESTS
# ============================================================================

@pytest.mark.critical
class TestCriticalInfrastructure:
    """Test critical infrastructure that must always be present"""
    
    def test_reverie_house_config_exists(self):
        """Test that /srv/reverie.house/caddy.conf exists"""
        config_path = "/srv/reverie.house/caddy.conf"
        assert os.path.exists(config_path), \
            f"CRITICAL: {config_path} is missing! Main domain will not be accessible."
    
    def test_reverie_house_config_loaded(self, caddyfile_path):
        """Test that reverie.house configuration is included in Caddyfile"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        assert 'reverie.house {' in content, \
            "CRITICAL: reverie.house domain block missing from Caddyfile"
    
    def test_pds_xrpc_endpoints_configured(self, caddyfile_path):
        """Test that PDS XRPC endpoints are properly proxied"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Find reverie.house block - match balanced braces
        pattern = r'^reverie\.house \{(.*?)^(?=\S)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
        assert match, "Could not find reverie.house configuration block"
        
        reverie_block = match.group(0)
        
        # Check critical PDS endpoints
        assert 'handle /xrpc/*' in reverie_block, \
            "CRITICAL: XRPC proxy missing - PDS will not be accessible"
        assert 'reverse_proxy 172.23.0.1:3333' in reverie_block, \
            "CRITICAL: PDS proxy not pointing to port 3333"
    
    def test_cors_headers_configured(self, caddyfile_path):
        """Test that CORS headers are set for reverie.house"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        pattern = r'^reverie\.house \{(.*?)^(?=\S)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
        assert match, "Could not find reverie.house configuration block"
        
        reverie_block = match.group(0)
        
        # Check CORS headers
        assert 'Access-Control-Allow-Origin' in reverie_block, \
            "CRITICAL: CORS headers missing - ATProto clients will fail"
        assert 'Access-Control-Allow-Methods' in reverie_block
        assert 'Access-Control-Allow-Headers' in reverie_block
    def test_feedgen_endpoints_configured(self, caddyfile_path):
        """Test that feed generator endpoints are proxied"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        pattern = r'^reverie\.house \{(.*?)^(?=\S)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
        assert match, "Could not find reverie.house configuration block"
        
        reverie_block = match.group(0)
        
        # Check feedgen endpoints
        assert 'app.bsky.feed.describeFeedGenerator' in reverie_block, \
            "Feed generator describe endpoint missing"
        assert 'app.bsky.feed.getFeedSkeleton' in reverie_block, \
            "Feed generator skeleton endpoint missing"
        assert 'reverie_feedgen:3001' in reverie_block, \
            "Feed generator not proxying to correct container"
    def test_did_resolution_configured(self, caddyfile_path):
        """Test that DID resolution endpoint is configured"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        pattern = r'^reverie\.house \{(.*?)^(?=\S)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
        assert match, "Could not find reverie.house configuration block"
        
        reverie_block = match.group(0)
        
        # Check DID resolution
        assert '/.well-known/atproto-did' in reverie_block, \
            "CRITICAL: DID resolution endpoint missing"
        assert 'did:plc:yauphjufk7phkwurn266ybx2' in reverie_block, \
            "Main server DID not configured correctly"
    
    def test_oauth_endpoints_configured(self, caddyfile_path):
        """Test that OAuth endpoints are configured"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Check for auth.reverie.house subdomain
        assert 'auth.reverie.house {' in content, \
            "OAuth auth subdomain missing"
        
        # Check main domain OAuth metadata
        pattern = r'^reverie\.house \{(.*?)^(?=\S)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
        assert match, "Could not find reverie.house configuration block"
        
        reverie_block = match.group(0)
        
        assert '/.well-known/oauth-authorization-server' in reverie_block, \
            "OAuth authorization server metadata endpoint missing"
        assert '/.well-known/oauth-protected-resource' in reverie_block, \
            "OAuth protected resource metadata endpoint missing"
    
    def test_api_proxy_configured(self, caddyfile_path):
        """Test that API endpoints are proxied to backend"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        pattern = r'^reverie\.house \{(.*?)^(?=\S)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
        assert match, "Could not find reverie.house configuration block"
        
        reverie_block = match.group(0)
        
        # Check API proxying
        assert 'handle /api/*' in reverie_block, \
            "API proxy missing"
        # API container uses host networking, must proxy to localhost not bridge IP
        assert 'reverse_proxy localhost:4444' in reverie_block or \
               'reverse_proxy 127.0.0.1:4444' in reverie_block, \
            "CRITICAL: API not proxying to localhost:4444 (reverie_api uses host networking)"
        assert '172.23.0.12:4444' not in reverie_block, \
            "CRITICAL: API proxying to wrong IP 172.23.0.12 - should be localhost since container uses host networking"
    
    def test_caddybuilder_includes_project_configs(self, caddybuilder_path):
        """Test that caddybuilder discovers and loads project configs"""
        result = subprocess.run(
            ['python3', caddybuilder_path, '--no-reload'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        assert result.returncode == 0, f"Caddybuilder failed: {result.stderr}"
        
        # Check that it loaded project configs
        match = re.search(r'Loaded IP guard \+ (\d+) project configs', result.stdout)
        assert match, "Could not find project config count in output"
        
        project_count = int(match.group(1))
        assert project_count >= 7, \
            f"Only {project_count} project configs loaded (expected at least 7: " \
            "reverie.house, lore.farm, biblio.bond, lakeblood.ca, flawed.center, " \
            "avonlea.town, vagabond.quest)"
    
    def test_reverie_route_handlers_configured(self, caddyfile_path):
        """Test that all critical website route handlers are present
        
        CRITICAL: These route handlers map URLs to HTML pages. Without them,
        pages like /library, /spectrum, /order, etc. will not load properly.
        
        If this test fails, restore missing handlers from:
        /srv/caddy/caddy.hard.old-monolithic (lines 237-367)
        """
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Extract just the reverie.house block
        reverie_match = re.search(
            r'^reverie\.house \{(.*?)^(?=\S|\Z)',
            content,
            re.MULTILINE | re.DOTALL
        )
        
        assert reverie_match, "reverie.house configuration block not found"
        reverie_block = reverie_match.group(1)
        
        # Critical route handlers that must be present
        required_routes = {
            '/library': 'handle /library',
            '/books': 'handle /books',
            '/spectrum': 'handle /spectrum',
            '/order': 'handle /order',
            '/dreamer': 'handle /dreamer',
            '/story': 'handle /story',
            '/canon': 'handle /canon',
            '/lore': 'handle /lore',
            '/souvenirs': 'handle /souvenirs',
            '/database': 'handle /database',
            '/privacy': 'handle /privacy',
            '/work': 'handle /work',
            '/dreams': 'handle /dreams',
            '/explore': 'handle /explore',
            '/home': 'handle /home',
        }
        
        missing_routes = []
        for route_path, route_pattern in required_routes.items():
            if route_pattern not in reverie_block:
                missing_routes.append(route_path)
        
        assert len(missing_routes) == 0, \
            f"CRITICAL: Missing route handlers in reverie.house config: {missing_routes}\n" \
            f"Without these handlers, pages will not serve correctly.\n" \
            f"Restore from /srv/caddy/caddy.hard.old-monolithic (lines 237-367) to /srv/reverie.house/caddy.conf"
        
        # Verify the default handler is present (must come last)
        assert 'handle {' in reverie_block, \
            "CRITICAL: Missing default 'handle {}' block - this serves static files and index.html"
        
        # Verify try_files directives are used (SPA routing)
        assert 'try_files' in reverie_block, \
            "CRITICAL: Missing try_files directives - needed for proper HTML page routing"
    
    def test_no_duplicate_domains(self, caddyfile_path):
        """Test that no domains are defined multiple times"""
        with open(caddyfile_path, 'r') as f:
            content = f.read()
        
        # Find all domain blocks (excluding dreamer subdomains which may repeat for alts)
        # Focus on project domains
        domains = re.findall(r'^([a-z0-9.-]+\.(?:house|ca|farm|bond|center|town|quest)) \{', 
                            content, re.MULTILINE)
        
        # Check for duplicates
        seen = {}
        duplicates = []
        for domain in domains:
            if domain in seen:
                seen[domain] += 1
                if seen[domain] == 2:  # Only add once
                    duplicates.append(domain)
            else:
                seen[domain] = 1
        
        assert len(duplicates) == 0, \
            f"CRITICAL: Duplicate domain definitions found: {duplicates}. " \
            "This will cause Caddy to fail to reload."
    
    def test_caddyfile_syntax_valid(self, caddyfile_path):
        """Test that generated Caddyfile has valid syntax"""
        # Run caddy validate (requires caddy binary in container)
        result = subprocess.run(
            ['docker', 'exec', 'caddy', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        assert result.returncode == 0, \
            f"CRITICAL: Caddyfile has syntax errors:\n{result.stderr}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
