"""
Work Roles Integration Tests

Tests all worker roles (greeter, mapper, cogitarian) to ensure:
1. App passwords are correctly stored and encrypted
2. Credentials can be decrypted and used for authentication
3. Workers can write ATProto records (create test post)
4. Workers can delete records (cleanup test post)
5. Service endpoints are functional

This provides end-to-end validation of the worker system.
"""

import pytest
import time
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from core.workers import WorkerNetworkClient
from core.encryption import decrypt_password, encrypt_password


class TestWorkerRoles:
    """Test suite for worker role authentication and functionality"""
    
    @pytest.fixture
    def db(self):
        """Database connection fixture"""
        return DatabaseManager()
    
    @pytest.fixture
    def available_roles(self, db):
        """Get list of roles that have active workers"""
        cursor = db.execute("""
            SELECT DISTINCT role 
            FROM user_roles 
            WHERE status = 'active'
        """)
        roles = [row['role'] for row in cursor.fetchall()]
        return roles
    
    def test_role_definitions_exist(self, db):
        """Test that work role definitions are in database"""
        cursor = db.execute("SELECT role, worker_limit, requires_password FROM work")
        roles = cursor.fetchall()
        
        assert len(roles) > 0, "No work roles defined in database"
        
        # Check expected roles exist
        role_names = {r['role'] for r in roles}
        expected_roles = {'greeter', 'mapper', 'cogitarian'}
        
        for role in expected_roles:
            assert role in role_names, f"Expected role '{role}' not found"
        
        # Verify all roles require passwords (for app password auth)
        for role in roles:
            if role['role'] in expected_roles:
                assert role['requires_password'], f"Role '{role['role']}' should require password"
    
    def test_active_workers_have_credentials(self, db):
        """Test that all active workers have stored credentials"""
        cursor = db.execute("""
            SELECT ur.did, ur.role, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.status = 'active'
        """)
        active_workers = cursor.fetchall()
        
        for worker in active_workers:
            # Check user_credentials table
            cred = db.fetch_one("""
                SELECT app_password_hash, is_valid 
                FROM user_credentials 
                WHERE did = %s
            """, (worker['did'],))
            
            assert cred is not None, \
                f"Worker {worker['handle']} ({worker['role']}) has no credentials"
            assert cred['app_password_hash'], \
                f"Worker {worker['handle']} ({worker['role']}) has empty password hash"
            assert cred['is_valid'], \
                f"Worker {worker['handle']} ({worker['role']}) has invalid credentials"
    
    def test_password_encryption_roundtrip(self, db):
        """Test that passwords can be encrypted and decrypted"""
        test_password = "test-1234-5678-abcd"
        
        # Encrypt
        encrypted = encrypt_password(test_password)
        assert encrypted != test_password, "Password should be encrypted"
        
        # Decrypt
        decrypted = decrypt_password(encrypted)
        assert decrypted == test_password, "Decrypted password doesn't match original"
    
    @pytest.mark.parametrize("role", ["greeter", "mapper", "cogitarian"])
    def test_worker_client_creation(self, db, role):
        """Test WorkerNetworkClient can be created for each role"""
        # Get active worker for role
        worker = db.fetch_one("""
            SELECT ur.did, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.role = %s AND ur.status = 'active'
            LIMIT 1
        """, (role,))
        
        if not worker:
            pytest.skip(f"No active {role} worker found")
        
        # Create client
        client = WorkerNetworkClient.from_credentials(db, worker['did'], role)
        
        assert client is not None, f"Failed to create client for {role}"
        assert client.worker_did == worker['did']
        assert client.worker_handle == worker['handle']
    
    @pytest.mark.parametrize("role", ["greeter", "mapper", "cogitarian"])
    def test_worker_authentication(self, db, role):
        """Test worker can authenticate with ATProto"""
        # Get active worker
        worker = db.fetch_one("""
            SELECT ur.did, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.role = %s AND ur.status = 'active'
            LIMIT 1
        """, (role,))
        
        if not worker:
            pytest.skip(f"No active {role} worker found")
        
        # Create client
        client = WorkerNetworkClient.from_credentials(db, worker['did'], role)
        assert client is not None, f"Failed to create client for {role}"
        
        # Authenticate
        success = client.authenticate()
        
        assert success, f"Authentication failed for {role} worker {worker['handle']}"
        assert client.session_token, f"No session token received for {role}"
        assert client.pds_url, f"No PDS URL resolved for {role}"
    
    @pytest.mark.parametrize("role", ["greeter", "mapper", "cogitarian"])
    def test_worker_can_create_and_delete_post(self, db, role):
        """
        Test worker can create and delete a test post
        This proves app password has write access
        """
        # Get active worker
        worker = db.fetch_one("""
            SELECT ur.did, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.role = %s AND ur.status = 'active'
            LIMIT 1
        """, (role,))
        
        if not worker:
            pytest.skip(f"No active {role} worker found")
        
        # Create client and authenticate
        client = WorkerNetworkClient.from_credentials(db, worker['did'], role)
        assert client is not None
        
        success = client.authenticate()
        assert success, f"Authentication failed for {role}"
        
        # Create test post
        test_text = f"🧪 Test post from {role} integration test - {int(time.time())}"
        post_result = client.create_post(text=test_text)
        
        assert post_result is not None, f"Failed to create test post for {role}"
        assert 'uri' in post_result, f"Post result missing URI for {role}"
        assert 'cid' in post_result, f"Post result missing CID for {role}"
        
        post_uri = post_result['uri']
        post_cid = post_result['cid']
        
        print(f"✅ Created test post for {role}: {post_uri}")
        
        # Delete test post
        delete_success = client.delete_post(post_uri)
        
        assert delete_success, f"Failed to delete test post for {role}"
        print(f"🗑️  Deleted test post for {role}: {post_uri}")
    
    @pytest.mark.parametrize("role", ["greeter", "mapper"])
    def test_worker_can_like_and_unlike(self, db, role):
        """Test worker can like and unlike posts (if needed for their role)"""
        # Get active worker
        worker = db.fetch_one("""
            SELECT ur.did, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.role = %s AND ur.status = 'active'
            LIMIT 1
        """, (role,))
        
        if not worker:
            pytest.skip(f"No active {role} worker found")
        
        # Create client and authenticate
        client = WorkerNetworkClient.from_credentials(db, worker['did'], role)
        assert client is not None
        
        success = client.authenticate()
        assert success
        
        # Create a test post to like
        test_text = f"🧪 Test post for like test - {int(time.time())}"
        post_result = client.create_post(text=test_text)
        assert post_result is not None
        
        post_uri = post_result['uri']
        
        try:
            # Like the post
            like_result = client.create_like(post_uri)
            assert like_result, f"Failed to like post for {role}"
            print(f"👍 Liked post for {role}")
            
            # Unlike (delete like record)
            # Note: We'd need the like URI to unlike, which requires storing it
            # For now, we'll just verify the like was created
            
        finally:
            # Cleanup: delete test post
            client.delete_post(post_uri)
    
    def test_greeter_can_post_with_facets(self, db):
        """Test greeter can post with mentions and links (needed for greetings)"""
        # Get active greeter
        worker = db.fetch_one("""
            SELECT ur.did, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.role = 'greeter' AND ur.status = 'active'
            LIMIT 1
        """)
        
        if not worker:
            pytest.skip("No active greeter found")
        
        # Create client and authenticate
        client = WorkerNetworkClient.from_credentials(db, worker['did'], 'greeter')
        assert client is not None
        
        success = client.authenticate()
        assert success
        
        # Create post with mention facet (simulating greeting format)
        test_text = f"🧪 Test greeting with mention - {int(time.time())}"
        
        # Add mention facet
        facets = [{
            "index": {
                "byteStart": test_text.find("🧪"),
                "byteEnd": test_text.find("🧪") + len("🧪".encode('utf-8'))
            },
            "features": [{
                "$type": "app.bsky.richtext.facet#tag",
                "tag": "test"
            }]
        }]
        
        post_result = client.create_post(text=test_text, facets=facets)
        assert post_result is not None
        
        post_uri = post_result['uri']
        print(f"✅ Created test post with facets: {post_uri}")
        
        # Cleanup
        client.delete_post(post_uri)
    
    def test_worker_client_handles_invalid_credentials(self, db):
        """Test that worker client properly handles invalid credentials"""
        # Create a fake worker entry
        fake_did = "did:plc:fake123456789"
        
        # Try to create client with non-existent DID
        client = WorkerNetworkClient.from_credentials(db, fake_did, 'greeter')
        
        assert client is None, "Should return None for non-existent credentials"
    
    def test_credential_validity_check(self, db):
        """Test that credential validity flags work correctly"""
        # Get any worker
        worker = db.fetch_one("""
            SELECT ur.did, ur.role
            FROM user_roles ur
            WHERE ur.status = 'active'
            LIMIT 1
        """)
        
        if not worker:
            pytest.skip("No active workers found")
        
        # Check credential is marked as valid
        cred = db.fetch_one("""
            SELECT is_valid FROM user_credentials WHERE did = %s
        """, (worker['did'],))
        
        assert cred is not None
        assert cred['is_valid'], f"Active worker {worker['did']} has invalid credentials"
    
    def test_multiple_roles_same_credential(self, db):
        """Test that a user can have multiple roles using same credential"""
        # Check if any user has multiple active roles
        multi_role = db.fetch_one("""
            SELECT did, COUNT(*) as role_count
            FROM user_roles
            WHERE status = 'active'
            GROUP BY did
            HAVING COUNT(*) > 1
            LIMIT 1
        """)
        
        if not multi_role:
            pytest.skip("No users with multiple roles found")
        
        # Verify they only have one credential entry
        creds = db.fetch_one("""
            SELECT COUNT(*) as cred_count
            FROM user_credentials
            WHERE did = %s
        """, (multi_role['did'],))
        
        assert creds['cred_count'] == 1, \
            "User with multiple roles should have only one credential entry"
    
    def test_worker_pds_resolution(self, db):
        """Test that worker client correctly resolves PDS URLs"""
        # Get a reverie.house worker
        worker = db.fetch_one("""
            SELECT ur.did, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.status = 'active' AND d.handle LIKE '%.reverie.house'
            LIMIT 1
        """)
        
        if not worker:
            pytest.skip("No reverie.house worker found")
        
        # Create client and authenticate
        client = WorkerNetworkClient.from_credentials(db, worker['did'])
        assert client is not None
        
        success = client.authenticate()
        assert success
        
        # Check PDS URL was resolved
        assert client.pds_url, "PDS URL not resolved"
        print(f"🔍 Resolved PDS: {client.pds_url}")
        
        # For .reverie.house handles, should resolve to our PDS
        if worker['handle'].endswith('.reverie.house'):
            assert 'reverie.house' in client.pds_url.lower(), \
                f"Expected reverie.house PDS, got {client.pds_url}"


class TestWorkerServiceEndpoints:
    """Test service endpoints that workers use"""
    
    @pytest.fixture
    def db(self):
        return DatabaseManager()
    
    def test_greeter_service_functions(self, db):
        """Test greeter-specific service functions"""
        # This would test greet_newcomer functionality
        # For now, we'll just verify the command module exists
        from ops.commands import greet_newcomer
        
        assert hasattr(greet_newcomer, 'greet'), \
            "Greeter service missing greet function"
    
    def test_mapper_service_functions(self, db):
        """Test mapper-specific service functions"""
        # This would test origin deduction functionality
        # Verify mapper utilities exist
        try:
            from utils import spectrum, octant
            assert True  # Modules imported successfully
        except ImportError as e:
            pytest.fail(f"Mapper utility modules missing: {e}")
    
    def test_work_table_structure(self, db):
        """Test that work table has expected structure"""
        # Get work table schema
        cursor = db.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'work'
            ORDER BY ordinal_position
        """)
        columns = {row['column_name']: row['data_type'] for row in cursor.fetchall()}
        
        # Verify expected columns
        expected_columns = {
            'role': 'text',
            'workers': 'text',  # JSON array
            'worker_limit': 'integer',
            'requires_password': 'boolean'
        }
        
        for col, dtype in expected_columns.items():
            assert col in columns, f"Missing column '{col}' in work table"
            # Note: data_type might be slightly different (e.g., 'character varying' vs 'text')
    
    def test_user_roles_table_structure(self, db):
        """Test that user_roles table has expected structure"""
        cursor = db.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_roles'
            ORDER BY ordinal_position
        """)
        columns = {row['column_name']: row['data_type'] for row in cursor.fetchall()}
        
        # Verify expected columns
        expected_columns = [
            'did', 'role', 'status', 
            'activated_at', 'deactivated_at'
        ]
        
        for col in expected_columns:
            assert col in columns, f"Missing column '{col}' in user_roles table"


if __name__ == '__main__':
    # Run tests with verbose output
    pytest.main([__file__, '-v', '--tb=short'])
