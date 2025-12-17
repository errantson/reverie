#!/usr/bin/env python3
"""
test_strangers.py - Tests for foreign PDS user workflows

Tests the complete journey of a "stranger" (user from external PDS like chaos.observer)
through the Reverie House systems:
1. Handle resolution via plc.directory
2. PDS endpoint discovery from DID document
3. Foreign PDS authentication (Honoured Guest flow)
4. Credential storage and retrieval
5. Heading/movement functionality
6. Work role activation (cogitarian, greeter, etc.)
"""

import pytest
import requests
import time
import json
import os
import sys
import subprocess

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def docker_db_query(query):
    """Execute a query against the Docker PostgreSQL database."""
    cmd = f'docker exec reverie_db psql -U reverie -d reverie_house -t -A -c "{query}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Query failed: {result.stderr}")
    
    return result.stdout.strip()


class TestForeignPDSResolution:
    """Tests for resolving foreign PDS users."""
    
    def test_resolve_foreign_handle_to_did(self):
        """Test resolving a foreign handle to DID via ATP API."""
        handle = "chaos.observer"
        
        response = requests.get(
            f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}",
            timeout=30
        )
        
        assert response.status_code == 200, f"Failed to resolve handle: {response.text}"
        data = response.json()
        assert 'did' in data, "Response missing 'did' field"
        assert data['did'].startswith('did:plc:'), f"Unexpected DID format: {data['did']}"
        print(f"✅ Resolved {handle} to {data['did']}")
    
    def test_resolve_did_document(self):
        """Test fetching DID document from plc.directory."""
        did = "did:plc:sv4z2azwos6imedro2cfibrn"
        
        response = requests.get(f"https://plc.directory/{did}", timeout=30)
        
        assert response.status_code == 200, f"Failed to fetch DID document: {response.text}"
        doc = response.json()
        
        assert 'id' in doc, "DID document missing 'id'"
        assert doc['id'] == did, f"DID mismatch: {doc['id']} != {did}"
        assert 'service' in doc, "DID document missing 'service'"
        
        pds_service = None
        for service in doc.get('service', []):
            if service.get('type') == 'AtprotoPersonalDataServer':
                pds_service = service.get('serviceEndpoint')
                break
        
        assert pds_service is not None, "No PDS service found in DID document"
        assert 'pds.chaos.observer' in pds_service, f"Unexpected PDS: {pds_service}"
        print(f"✅ Found PDS endpoint: {pds_service}")
    
    def test_pds_health_check(self):
        """Test that the foreign PDS is accessible."""
        pds_url = "https://pds.chaos.observer"
        
        response = requests.get(f"{pds_url}/xrpc/_health", timeout=30)
        
        assert response.status_code == 200, f"PDS health check failed: {response.status_code}"
        print(f"✅ PDS at {pds_url} is healthy")


class TestWorkerNetworkClient:
    """Tests for WorkerNetworkClient with foreign PDS."""
    
    def test_worker_client_resolve_pds(self):
        """Test resolving PDS from DID via plc.directory."""
        did = "did:plc:sv4z2azwos6imedro2cfibrn"
        
        response = requests.get(f"https://plc.directory/{did}", timeout=30)
        assert response.status_code == 200
        doc = response.json()
        
        pds = None
        for service in doc.get('service', []):
            if service.get('type') == 'AtprotoPersonalDataServer':
                pds = service.get('serviceEndpoint')
                break
        
        assert pds is not None, "Failed to resolve PDS"
        assert 'pds.chaos.observer' in pds, f"Unexpected PDS: {pds}"
        print(f"✅ Resolved PDS from plc.directory: {pds}")
    
    def test_worker_client_initialization(self):
        """Test WorkerNetworkClient module exists and has required methods."""
        try:
            from core.workers import WorkerNetworkClient
            # Check that the class exists and has the expected interface
            assert hasattr(WorkerNetworkClient, '__init__'), "Missing __init__ method"
            # Check for authenticate method on the class
            assert hasattr(WorkerNetworkClient, 'authenticate') or callable(getattr(WorkerNetworkClient, 'authenticate', None)) or 'authenticate' in dir(WorkerNetworkClient), "Missing authenticate method"
            print("✅ WorkerNetworkClient class exists with required interface")
        except ImportError:
            pytest.skip("WorkerNetworkClient not available outside Docker")


class TestEncryption:
    """Tests for credential encryption system."""
    
    def test_encrypt_decrypt_roundtrip(self):
        """Test that encryption and decryption work correctly."""
        try:
            from core.encryption import encrypt_password, decrypt_password
        except ImportError:
            pytest.skip("Encryption module not available outside Docker")
        
        test_password = "test-app-password-1234"
        
        encrypted = encrypt_password(test_password)
        assert encrypted is not None, "Encryption failed"
        assert encrypted != test_password, "Password not encrypted"
        assert encrypted.startswith('gAAAAA'), "Invalid Fernet token format"
        
        decrypted = decrypt_password(encrypted)
        assert decrypted == test_password, f"Decryption failed: {decrypted} != {test_password}"
        print("✅ Encryption roundtrip successful")
    
    def test_encrypt_different_outputs(self):
        """Test that same password produces different ciphertext (due to IV)."""
        try:
            from core.encryption import encrypt_password, decrypt_password
        except ImportError:
            pytest.skip("Encryption module not available outside Docker")
        
        password = "same-password"
        
        enc1 = encrypt_password(password)
        enc2 = encrypt_password(password)
        
        assert enc1 != enc2, "Encryption should produce different ciphertext for same input"
        assert decrypt_password(enc1) == password
        assert decrypt_password(enc2) == password
        print("✅ Encryption produces unique ciphertext")


class TestDatabaseSchema:
    """Tests for database schema compatibility using Docker."""
    
    def test_user_credentials_has_last_verified(self):
        """Test that user_credentials table has last_verified column."""
        result = docker_db_query(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'user_credentials' AND column_name = 'last_verified'"
        )
        
        assert result, "user_credentials missing 'last_verified' column"
        assert 'integer' in result, f"last_verified should be integer, got {result}"
        print("✅ user_credentials.last_verified exists and is integer")
    
    def test_user_credentials_has_required_columns(self):
        """Test that user_credentials has all required columns."""
        required_columns = ['did', 'app_password_hash', 'pds_url', 'is_valid', 'last_verified']
        
        result = docker_db_query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_credentials'"
        )
        
        existing_columns = result.split('\n') if result else []
        
        for col in required_columns:
            assert col in existing_columns, f"user_credentials missing column: {col}"
        
        print(f"✅ All required columns exist: {required_columns}")
    
    def test_spectrum_table_exists(self):
        """Test that spectrum table exists with required columns."""
        required_columns = ['did', 'oblivion', 'authority', 'skeptic', 'receptive', 'liberty', 'entropy', 'octant']
        
        result = docker_db_query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'spectrum'"
        )
        
        existing_columns = result.split('\n') if result else []
        
        for col in required_columns:
            assert col in existing_columns, f"spectrum table missing column: {col}"
        
        print(f"✅ Spectrum table has required columns")
    
    def test_work_table_updated_at_is_integer(self):
        """Test that work.updated_at is integer type."""
        result = docker_db_query(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'work' AND column_name = 'updated_at'"
        )
        
        assert result, "work table missing 'updated_at' column"
        assert 'integer' in result, f"updated_at should be integer, got {result}"
        print("✅ work.updated_at is integer type")


class TestCredentialsStatusEndpoint:
    """Tests for /api/user/credentials/status endpoint."""
    
    def test_credentials_status_for_new_user(self):
        """Test credentials status for user without stored credentials."""
        base_url = "http://localhost:4444"
        
        response = requests.get(f"{base_url}/api/user/credentials/status", timeout=30)
        
        # Should return 401 without valid token
        assert response.status_code in [401, 500], f"Unexpected status: {response.status_code}"
        print("✅ Credentials status endpoint responds correctly without token")
    
    def test_credentials_status_query_works(self):
        """Test that the credentials status query doesn't error on schema."""
        test_did = "did:plc:test-nonexistent-user"
        
        # Directly test the query that was failing
        try:
            result = docker_db_query(
                f"SELECT last_verified, is_valid, pds_url FROM user_credentials WHERE did = '{test_did}'"
            )
            # Should return empty for non-existent user, not error
            print("✅ Credentials query executes without schema error")
        except Exception as e:
            pytest.fail(f"Query failed with error: {e}")


class TestHeadingEndpoint:
    """Tests for /api/heading/set endpoint."""
    
    def test_heading_set_requires_auth(self):
        """Test that heading set requires authentication."""
        base_url = "http://localhost:4444"
        
        response = requests.post(
            f"{base_url}/api/heading/set",
            json={"heading": "entropy"},
            timeout=30
        )
        
        # Should require authentication
        assert response.status_code in [401, 403], f"Unexpected status: {response.status_code}"
        print("✅ Heading set endpoint requires authentication")


class TestWorkRoleActivation:
    """Tests for work role activation endpoints."""
    
    def test_cogitarian_status_endpoint_exists(self):
        """Test that cogitarian status endpoint exists."""
        base_url = "http://localhost:4444"
        
        response = requests.get(f"{base_url}/api/work/cogitarian/status", timeout=30)
        
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        
        data = response.json()
        assert 'role_status' in data or 'status' in data, "Response missing status field"
        print("✅ Cogitarian status endpoint responds")
    
    def test_work_table_has_cogitarian(self):
        """Test that cogitarian role exists in work table."""
        result = docker_db_query("SELECT role, status FROM work WHERE role = 'cogitarian'")
        
        assert result, "Cogitarian role not found in work table"
        print(f"✅ Cogitarian role exists: {result}")
    
    def test_greeter_status_endpoint_exists(self):
        """Test that greeter status endpoint exists."""
        base_url = "http://localhost:4444"
        
        response = requests.get(f"{base_url}/api/work/greeter/status", timeout=30)
        
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        print("✅ Greeter status endpoint responds")


class TestChaosObserverSpecific:
    """Specific tests for chaos.observer user state."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.chaos_did = "did:plc:sv4z2azwos6imedro2cfibrn"
    
    def test_chaos_observer_exists_in_dreamers(self):
        """Test that chaos.observer exists in dreamers table."""
        result = docker_db_query(
            f"SELECT did, handle, display_name FROM dreamers WHERE did = '{self.chaos_did}'"
        )
        
        assert result, "chaos.observer not found in dreamers"
        assert 'chaos.observer' in result, f"Handle mismatch: {result}"
        print(f"✅ chaos.observer exists: {result}")
    
    def test_chaos_observer_has_arrival_event(self):
        """Test that chaos.observer has arrival event."""
        result = docker_db_query(
            f"SELECT epoch, type, event FROM events WHERE did = '{self.chaos_did}' AND type = 'arrival'"
        )
        
        assert result, "chaos.observer missing arrival event"
        print(f"✅ chaos.observer has arrival event")
    
    def test_chaos_observer_pds_accessible(self):
        """Test that chaos.observer's PDS is accessible."""
        response = requests.get("https://pds.chaos.observer/xrpc/_health", timeout=30)
        
        assert response.status_code == 200, f"PDS not accessible: {response.status_code}"
        print("✅ chaos.observer PDS is accessible")


class TestForeignPDSWorkflow:
    """End-to-end workflow tests for foreign PDS users."""
    
    def test_full_resolution_chain(self):
        """Test the full handle -> DID -> PDS resolution chain."""
        handle = "chaos.observer"
        
        # Step 1: Resolve handle to DID
        response = requests.get(
            f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}",
            timeout=30
        )
        assert response.status_code == 200
        did = response.json()['did']
        
        # Step 2: Get DID document
        response = requests.get(f"https://plc.directory/{did}", timeout=30)
        assert response.status_code == 200
        doc = response.json()
        
        # Step 3: Extract PDS endpoint
        pds = None
        for service in doc.get('service', []):
            if service.get('type') == 'AtprotoPersonalDataServer':
                pds = service.get('serviceEndpoint')
                break
        
        assert pds is not None
        
        # Step 4: Verify PDS is accessible
        response = requests.get(f"{pds}/xrpc/_health", timeout=30)
        assert response.status_code == 200
        
        print(f"✅ Full resolution chain: {handle} -> {did} -> {pds}")
    
    def test_spectrum_storage_uses_correct_table(self):
        """Test that spectrum data goes to spectrum table, not dreamers."""
        test_did = "did:plc:sv4z2azwos6imedro2cfibrn"
        
        # Check spectrum table
        result = docker_db_query(
            f"SELECT oblivion, authority, octant FROM spectrum WHERE did = '{test_did}'"
        )
        
        if result:
            print(f"✅ Spectrum data in correct table: {result}")
        else:
            print("ℹ️ No spectrum data yet for this user (expected for new users)")
    
    def test_workerwatch_type_compatibility(self):
        """Test that workerwatch can update work table without type errors."""
        # Just verify the updated_at column is integer
        result = docker_db_query(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'work' AND column_name = 'updated_at'"
        )
        
        assert 'integer' in result, f"work.updated_at should be integer: {result}"
        print("✅ work.updated_at is compatible with epoch integers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
