#!/usr/bin/env python3
"""
Workerhose - Worker Role & Credential Monitor

This service monitors worker roles and app password validity every 3 minutes.
If a user's app password becomes invalid, they are automatically removed from
any role that requires an app password.

Processing:
- Checks every 3 minutes (180 seconds)
- Validates app passwords for all active workers
- Removes workers from password-required roles if credential is invalid
- Updates the work table and user_credentials table
- Logs all changes

Tables:
- work: Defines roles and their requirements
- user_credentials: Stores encrypted app passwords and validity status
- user_roles: Tracks which users have which roles

This keeps the work system clean and ensures only users with valid
credentials can perform automated actions.
"""

import json
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from core.database import DatabaseManager
from core.encryption import decrypt_password


class WorkerhoseMonitor:
    """Monitor worker credentials and role assignments every 3 minutes."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        
        self.stats = {
            'total_checks': 0,
            'workers_validated': 0,
            'credentials_invalidated': 0,
            'workers_removed': 0,
            'start_time': datetime.now()
        }
    
    def _get_roles_config(self) -> Dict:
        """
        Get all roles and their configuration from the work table.
        
        Returns:
            Dict mapping role name to config {status, forced_retirement, workers, worker_limit, requires_password}
        """
        try:
            db = DatabaseManager()
            cursor = db.execute("SELECT * FROM work")
            results = cursor.fetchall()
            
            roles = {}
            for row in results:
                # Parse workers JSON
                workers = json.loads(row['workers']) if row['workers'] else []
                
                roles[row['role']] = {
                    'status': row['status'],
                    'forced_retirement': row['forced_retirement'],
                    'workers': workers,
                    'worker_limit': row['worker_limit'],
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at']
                }
            
            return roles
            
        except Exception as e:
            print(f"❌ Error loading roles config: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def _validate_credential(self, did: str) -> bool:
        """
        Validate a user's Bluesky app password by attempting login.
        
        Args:
            did: User's DID
            
        Returns:
            True if credential is valid, False otherwise
        """
        try:
            db = DatabaseManager()
            cursor = db.execute(
                "SELECT d.handle, uc.app_password_hash FROM dreamers d JOIN user_credentials uc ON d.did = uc.did WHERE d.did = %s",
                (did,)
            )
            result = cursor.fetchone()
            
            if not result or not result['app_password_hash']:
                return False
            
            # Decrypt password
            app_password = decrypt_password(result['app_password_hash'])
            if not app_password:
                return False
            
            # Attempt login
            client = Client()
            client.login(result['handle'], app_password)
            
            # If we get here, login succeeded
            return True
            
        except Exception as e:
            # Any error (401, network, etc.) means invalid
            if self.verbose:
                print(f"      ❌ Validation failed for {did[:20]}...: {e}")
            return False
    
    def _mark_credential_invalid(self, did: str) -> None:
        """Mark a credential as invalid in the database."""
        try:
            db = DatabaseManager()
            db.execute(
                "UPDATE user_credentials SET is_valid = FALSE WHERE did = %s",
                (did,)
            )
            self.stats['credentials_invalidated'] += 1
            
        except Exception as e:
            print(f"      ❌ Error marking credential invalid: {e}")
    
    def _remove_worker_from_role(self, did: str, role: str) -> None:
        """
        Remove a worker from a role.
        
        Updates both the work table (removes from workers JSON) and
        the user_roles table (sets status to 'inactive').
        """
        try:
            db = DatabaseManager()
            
            # Get current workers JSON
            cursor = db.execute("SELECT workers FROM work WHERE role = %s", (role,))
            result = cursor.fetchone()
            
            if not result:
                return
            
            workers = json.loads(result['workers']) if result['workers'] else []
            
            # Remove this DID from workers list
            workers = [w for w in workers if w.get('did') != did]
            
            # Update work table
            import time
            db.execute(
                "UPDATE work SET workers = %s, updated_at = %s WHERE role = %s",
                (json.dumps(workers), int(time.time()), role)
            )
            
            # Update user_roles table
            db.execute(
                "UPDATE user_roles SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP WHERE did = %s AND role = %s",
                (did, role)
            )
            
            self.stats['workers_removed'] += 1
            
            if self.verbose:
                print(f"      🚫 Removed from {role}")
            
        except Exception as e:
            print(f"      ❌ Error removing worker: {e}")
    
    def _check_workers(self) -> None:
        """
        Check all active workers and validate their credentials.
        
        For any worker with an invalid credential, remove them from
        roles that require app passwords.
        """
        try:
            db = DatabaseManager()
            
            # Get all active workers with credentials
            cursor = db.execute("""
                SELECT DISTINCT ur.did, ur.role, d.handle, uc.is_valid
                FROM user_roles ur
                JOIN dreamers d ON ur.did = d.did
                JOIN user_credentials uc ON ur.did = uc.did
                WHERE ur.status = 'active'
                ORDER BY ur.role, d.handle
            """)
            workers = cursor.fetchall()
            
            if not workers:
                if self.verbose:
                    print("   No active workers found")
                return
            
            if self.verbose:
                print(f"   📋 Checking {len(workers)} active workers...")
            
            for worker in workers:
                did = worker['did']
                role = worker['role']
                handle = worker['handle']
                is_valid = worker['is_valid']
                
                self.stats['workers_validated'] += 1
                
                if self.verbose:
                    print(f"   👤 @{handle} ({role})")
                
                # If already marked invalid, remove from role
                if not is_valid:
                    print(f"      ⚠️  Credential already marked invalid")
                    self._remove_worker_from_role(did, role)
                    continue
                
                # Validate credential by attempting login
                if self._validate_credential(did):
                    if self.verbose:
                        print(f"      ✅ Credential valid")
                    
                    # Update last_verified timestamp
                    import time
                    db.execute(
                        "UPDATE user_credentials SET last_verified = %s WHERE did = %s",
                        (int(time.time()), did)
                    )
                else:
                    print(f"      ❌ Credential INVALID - removing from {role}")
                    self._mark_credential_invalid(did)
                    self._remove_worker_from_role(did, role)
            
        except Exception as e:
            print(f"❌ Error checking workers: {e}")
            import traceback
            traceback.print_exc()
    
    def _cleanup_junk_roles(self) -> None:
        """
        Clean up junk or obsolete role entries from the work table.
        
        This is a one-time cleanup that can be expanded as needed.
        """
        try:
            db = DatabaseManager()
            
            # Define roles that should exist
            valid_roles = {'greeter', 'mapper', 'cogitarian'}
            
            # Get all current roles
            cursor = db.execute("SELECT role FROM work")
            current_roles = {row['role'] for row in cursor.fetchall()}
            
            # Find junk roles
            junk_roles = current_roles - valid_roles
            
            if junk_roles:
                print(f"🗑️  Found {len(junk_roles)} junk roles to remove: {junk_roles}")
                
                for role in junk_roles:
                    # Delete from work table
                    db.execute("DELETE FROM work WHERE role = %s", (role,))
                    
                    # Deactivate in user_roles
                    db.execute(
                        "UPDATE user_roles SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP WHERE role = %s",
                        (role,)
                    )
                
                print(f"   ✅ Cleaned up {len(junk_roles)} junk roles")
            elif self.verbose:
                print("   ✨ No junk roles found")
            
        except Exception as e:
            print(f"❌ Error cleaning up junk roles: {e}")
            import traceback
            traceback.print_exc()
    
    def run(self):
        """Start the monitoring loop - check every 3 minutes (180 seconds)."""
        print(f"\n🔧 WORKERHOSE - Worker & Credential Monitor")
        print(f"=" * 70)
        print(f"Check interval: 3 minutes (180 seconds)")
        print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"=" * 70)
        
        # One-time cleanup on startup
        print("\n🧹 Running initial cleanup...")
        self._cleanup_junk_roles()
        
        print(f"\n🔧 Starting worker monitoring...\n")
        
        try:
            while True:
                self.stats['total_checks'] += 1
                
                print(f"📊 Workerhose check #{self.stats['total_checks']} at {datetime.now().strftime('%H:%M:%S')}")
                
                # Check all active workers
                self._check_workers()
                
                # Wait 3 minutes before next check
                if self.verbose:
                    print(f"\n⏱️  Sleeping for 3 minutes...\n")
                time.sleep(180)
                
        except KeyboardInterrupt:
            print("\n\n⚠️  Stopping workerhose...")
        finally:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            print("\n📊 WORKERHOSE STATS")
            print("=" * 70)
            print(f"Runtime: {elapsed:.0f} seconds ({elapsed/3600:.1f} hours)")
            print(f"Total checks: {self.stats['total_checks']}")
            print(f"Workers validated: {self.stats['workers_validated']}")
            print(f"Credentials invalidated: {self.stats['credentials_invalidated']}")
            print(f"Workers removed: {self.stats['workers_removed']}")
            print("=" * 70)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Workerhose - Worker & Credential Monitor')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    monitor = WorkerhoseMonitor(verbose=args.verbose)
    monitor.run()


if __name__ == '__main__':
    main()
