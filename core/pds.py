#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
PDS Administration Interface

Access local PDS account information for reverie.house server.
Requires sudo access to pdsadmin command.
"""

import subprocess
import re
from typing import List, Dict, Optional


class PDSAdmin:
    """Interface to PDS admin commands."""
    
    def __init__(self):
        self.pds_command = "pdsadmin"
    
    def list_accounts(self) -> List[Dict[str, str]]:
        """
        List all PDS accounts with their handle, email, and DID.
        
        Returns:
            List of dicts with keys: handle, email, did
        """
        try:
            result = subprocess.run(
                ['sudo', self.pds_command, 'account', 'list'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                print(f"⚠️ PDS command failed: {result.stderr}")
                return []
            
            accounts = []
            lines = result.stdout.strip().split('\n')
            
            if len(lines) < 2:
                return []
            
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 3:
                    accounts.append({
                        'handle': parts[0],
                        'email': parts[1],
                        'did': parts[2]
                    })
            
            return accounts
            
        except subprocess.TimeoutExpired:
            print("⚠️ PDS command timed out")
            return []
        except Exception as e:
            print(f"⚠️ Error accessing PDS: {e}")
            return []
    
    def get_account_by_did(self, did: str) -> Optional[Dict[str, str]]:
        """Get account information for a specific DID."""
        accounts = self.list_accounts()
        for account in accounts:
            if account['did'] == did:
                return account
        return None
    
    def get_account_by_handle(self, handle: str) -> Optional[Dict[str, str]]:
        """Get account information for a specific handle."""
        accounts = self.list_accounts()
        if not handle.endswith('.reverie.house') and handle != 'reverie.house':
            handle = f"{handle}.reverie.house"
        
        for account in accounts:
            if account['handle'] == handle:
                return account
        return None
    
    def get_all_reverie_house_dids(self) -> List[str]:
        """Get all DIDs for reverie.house accounts."""
        accounts = self.list_accounts()
        return [acc['did'] for acc in accounts]
    
    def get_handle_for_did(self, did: str) -> Optional[str]:
        """Get the authoritative handle from PDS for a given DID."""
        account = self.get_account_by_did(did)
        if account:
            return account['handle']
        return None
    
    def verify_account_exists(self, handle):
        """
        Verify if an account with the given handle exists.
        
        Args:
            handle: Account handle to verify
            
        Returns:
            bool: True if account exists, False otherwise
        """
        accounts = self.list_accounts()
        return any(acc['handle'] == handle for acc in accounts)
    
    def get_identity_status(self, dreamers=None):
        """
        Get comprehensive identity status for all PDS accounts.
        
        Args:
            dreamers: Optional list of dreamer dicts (loaded from dreamers.json)
                     If not provided, will attempt to load from default location
        
        Returns:
            list: List of dicts with keys:
                  - handle: PDS handle
                  - did: Account DID
                  - email: Account email
                  - profile_name: Public profile name (or None if discrete)
                  - visibility: 'public_unified', 'public_alias', or 'discrete'
                  - alias_description: Human-readable description for aliases
        """
        accounts = self.list_accounts()
        
        if dreamers is None:
            import json
            import os
            dreamers_file = '/srv/site/data/dreamers.json'
            dreamers = []
            if os.path.exists(dreamers_file):
                try:
                    with open(dreamers_file, 'r') as f:
                        dreamers = json.load(f)
                except:
                    pass
        
        results = []
        for acc in accounts:
            did = acc['did']
            pds_handle = acc['handle']
            
            dreamer = next((d for d in dreamers if d.get('did') == did), None)
            
            result = {
                'handle': pds_handle,
                'did': did,
                'email': acc['email'],
                'profile_name': None,
                'visibility': 'discrete',
                'alias_description': None
            }
            
            if dreamer:
                profile_name = dreamer.get('name', 'unknown')
                result['profile_name'] = profile_name
                
                pds_sub = pds_handle.replace('.reverie.house', '') if pds_handle.endswith('.reverie.house') else pds_handle
                
                if profile_name == pds_sub or profile_name == pds_handle:
                    result['visibility'] = 'public_unified'
                else:
                    result['visibility'] = 'public_alias'
                    result['alias_description'] = f'{profile_name}→{pds_sub}'
            
            results.append(result)
        
        return results


def create_pds_admin():
    """Create a PDSAdmin instance."""
    return PDSAdmin()


def main():
    """CLI entry point for PDS admin interface."""
    pds = PDSAdmin()
    identity_status = pds.get_identity_status()
    if not identity_status:
        print("❌ No accounts found or unable to access PDS")
        return 1

    public_count = len([i for i in identity_status if i['visibility'].startswith('public')])
    discrete_count = len([i for i in identity_status if i['visibility'] == 'discrete'])

    print("╔════════════════════════════════════════════════════════════════════════╗")
    print("║              REVERIE HOUSE - PDS IDENTITY SYSTEM                       ║")
    print("╚════════════════════════════════════════════════════════════════════════╝")
    print()
    print(f"📋 Total PDS Accounts: {len(identity_status)}")
    print(f"👥 Public Dreamers: {public_count}")
    print(f"🔒 Discrete Accounts: {discrete_count}")
    print()
    print("{:<32} {:<18} {:<25}".format("PDS Handle", "Profile Name", "Visibility"))
    print("─" * 78)

    for identity in identity_status:
        pds_handle = identity['handle']
        profile_name = identity['profile_name'] or '—'

        if identity['visibility'] == 'public_unified':
            visibility = '🌐 Public (unified)'
        elif identity['visibility'] == 'public_alias':
            visibility = f"🌐 Public ({identity['alias_description']})"
        else:
            visibility = '🔒 Discrete (private)'

        print("{:<32} {:<18} {:<25}".format(pds_handle, profile_name, visibility))

    print()
    print("📝 Identity Types:")
    print("  🌐 Public (unified):  Profile name matches PDS handle")
    print("  🌐 Public (alias):    Profile has different public name")
    print("  🔒 Discrete:          PDS account, not in public system")
    print()
    print("💡 Discrete accounts are intentionally private - administrative,")
    print("   testing, or personal accounts not meant for public interaction.")

    try:
        import time
        from core.database import DatabaseManager
        db = DatabaseManager()
        db.execute(
            "INSERT OR REPLACE INTO world_state (key, value, updated_at) VALUES (?, ?, ?)",
            ('discrete_dreamweavers', str(discrete_count), int(time.time()))
        )
    except Exception as e:
        print(f"⚠️ Could not write discrete_dreamweavers to database: {e}")

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
