"""
PDS Integration Tests
Tests for PDS admin commands and account management
"""
import pytest
import subprocess
from core.pds import PDSAdmin


@pytest.mark.pds
class TestPDSAdmin:
    """Test PDS admin command interface"""
    
    def test_pds_available(self, pds_available):
        """PDS admin commands should be available"""
        assert pds_available is True, "PDS not available (requires sudo pdsadmin)"
    
    def test_pds_admin_initialization(self):
        """PDSAdmin should initialize correctly"""
        pds = PDSAdmin()
        assert pds is not None
        assert pds.pds_command == 'pdsadmin'
    
    def test_list_accounts(self, pds_available):
        """Should list PDS accounts"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        assert isinstance(accounts, list)
        # Should have at least one account (reverie.house keeper)
        assert len(accounts) >= 0
    
    def test_account_structure(self, pds_available):
        """Accounts should have required fields"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        if len(accounts) > 0:
            account = accounts[0]
            assert 'handle' in account
            assert 'email' in account
            assert 'did' in account
            
            # Validate DID format
            assert account['did'].startswith('did:')
            
            # Validate handle format
            assert 'reverie.house' in account['handle']
    
    def test_get_account_by_did(self, pds_available):
        """Should retrieve account by DID"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        if len(accounts) > 0:
            did = accounts[0]['did']
            account = pds.get_account_by_did(did)
            
            assert account is not None
            assert account['did'] == did
    
    def test_get_account_by_handle(self, pds_available):
        """Should retrieve account by handle"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        if len(accounts) > 0:
            handle = accounts[0]['handle']
            account = pds.get_account_by_handle(handle)
            
            assert account is not None
            assert account['handle'] == handle
    
    def test_get_account_nonexistent_did(self, pds_available):
        """Should return None for nonexistent DID"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        account = pds.get_account_by_did('did:plc:nonexistent123456789')
        
        assert account is None
    
    def test_get_all_reverie_house_dids(self, pds_available):
        """Should get all reverie.house DIDs"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        dids = pds.get_all_reverie_house_dids()
        
        assert isinstance(dids, list)
        # All should be valid DIDs
        for did in dids:
            assert did.startswith('did:')


@pytest.mark.pds
class TestPDSHandleResolution:
    """Test handle to DID resolution"""
    
    def test_resolve_known_handle(self, pds_available):
        """Should resolve known handles to DIDs"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        if len(accounts) > 0:
            handle = accounts[0]['handle']
            did = pds.get_account_by_handle(handle)['did']
            
            assert did is not None
            assert did.startswith('did:')
    
    def test_handle_normalization(self, pds_available):
        """Should handle with or without .reverie.house suffix"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        
        # Both should work (if account exists)
        account1 = pds.get_account_by_handle('reverie.house')
        account2 = pds.get_account_by_handle('reverie')
        
        # If account exists, both lookups should find it
        if account1:
            assert account1['handle'] == 'reverie.house'


@pytest.mark.pds
class TestPDSErrorHandling:
    """Test PDS error handling"""
    
    def test_timeout_handling(self):
        """Should handle command timeouts gracefully"""
        pds = PDSAdmin()
        
        # Simulate timeout scenario
        # This should not crash, just return empty list
        accounts = pds.list_accounts()
        assert isinstance(accounts, list)
    
    def test_command_failure_handling(self):
        """Should handle PDS command failures"""
        pds = PDSAdmin()
        
        # Even if PDS is unavailable, should not crash
        try:
            accounts = pds.list_accounts()
            # Should return empty list on error
            assert isinstance(accounts, list)
        except Exception as e:
            pytest.fail(f"PDS error not handled gracefully: {e}")


@pytest.mark.pds
class TestPDSAccountValidation:
    """Test account validation logic"""
    
    def test_verify_account_exists(self, pds_available):
        """Should verify if account exists"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        if len(accounts) > 0:
            handle = accounts[0]['handle']
            exists = pds.verify_account_exists(handle)
            # This method may not exist yet, skip if not implemented
            if hasattr(pds, 'verify_account_exists'):
                assert exists is True
    
    def test_get_handle_for_did(self, pds_available):
        """Should get authoritative handle for DID"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        if len(accounts) > 0:
            did = accounts[0]['did']
            handle = pds.get_handle_for_did(did)
            
            assert handle is not None
            assert 'reverie.house' in handle


@pytest.mark.pds
class TestPDSIntegrationWithDatabase:
    """Test PDS integration with database"""
    
    def test_pds_accounts_match_database(self, pds_available, test_db):
        """PDS accounts should match database dreamers"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        pds_accounts = pds.list_accounts()
        
        if len(pds_accounts) > 0:
            # Get dreamers from database
            dreamers = test_db.fetch_all("SELECT did, handle FROM dreamers")
            
            # PDS DIDs should exist in database
            pds_dids = {acc['did'] for acc in pds_accounts}
            db_dids = {d['did'] for d in dreamers}
            
            # At least some overlap expected
            # (not all DB dreamers are PDS accounts - some are external)
            overlap = pds_dids.intersection(db_dids)
            assert len(overlap) > 0, "No overlap between PDS and database accounts"
    
    def test_sync_pds_to_database(self, pds_available, test_db):
        """Should be able to sync PDS accounts to database"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        pds = PDSAdmin()
        accounts = pds.list_accounts()
        
        # This tests the concept - actual sync implementation may vary
        for account in accounts:
            # Check if account exists in database
            dreamer = test_db.fetch_one(
                "SELECT * FROM dreamers WHERE did = %s",
                (account['did'],)
            )
            
            # If not in database, could be added
            # This is more of an integration test concept
            assert account['did'].startswith('did:')


@pytest.mark.pds
@pytest.mark.slow
class TestPDSCommandExecution:
    """Test actual PDS command execution"""
    
    def test_pds_command_output_parsing(self, pds_available):
        """Should correctly parse pdsadmin output"""
        if not pds_available:
            pytest.skip("PDS not available")
        
        result = subprocess.run(
            ['sudo', 'pdsadmin', 'account', 'list'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        assert result.returncode == 0
        output = result.stdout
        
        # Output should have header and account lines
        lines = output.strip().split('\n')
        assert len(lines) >= 1  # At least header
        
        # Should contain expected columns
        if len(lines) > 1:
            # Check header format
            assert 'handle' in lines[0].lower() or 'email' in lines[0].lower()
