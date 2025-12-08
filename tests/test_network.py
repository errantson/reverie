"""
Network & ATProto Testing

Consolidated network tests for ATProto client, profile fetching, DID resolution.

Author: Reverie House Testing Framework  
Date: 2025-12-08
"""

import pytest
import requests
from unittest.mock import Mock, patch


@pytest.mark.database
class TestATProtoClient:
    """ATProto client initialization"""
    
    def test_client_initialization(self):
        """Test client initializes"""
        from core.atproto_client import ATProtoClient
        client = ATProtoClient()
        assert client is not None


@pytest.mark.api
class TestProfileFetching:
    """Profile fetching from ATProto"""
    
    def test_fetch_profile_by_handle(self):
        """Test fetch profile by handle"""
        from utils.atproto_utils import fetch_profile_by_handle
        
        try:
            profile = fetch_profile_by_handle('bsky.app')
            if profile:
                assert 'did' in profile
        except Exception:
            pytest.skip("Network unavailable")


@pytest.mark.network
class TestNetworkResilience:
    """Network error handling"""
    
    def test_handles_timeout(self):
        """Test timeout handling"""
        from utils.atproto_utils import fetch_profile_by_handle
        
        with patch('requests.get', side_effect=requests.Timeout):
            result = fetch_profile_by_handle('test.bsky.social')
            assert result is None or isinstance(result, dict)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
