#!/usr/bin/env python3
"""
Master Validator Service

Automatically creates and maintains actor.rpg.master records for all reverie.house
users based on the authoritative spectrum data in the reverie.house database.

This service runs periodically to:
1. Fetch all users with spectrum data from the database
2. Create/update actor.rpg.master records in the @reverie.house account
3. Users whose rpg.actor stats match these records are "pre-validated"

The records are stored at:
    at://did:plc:yauphjufk7phkwurn266ybx2/actor.rpg.master/<tid>

Each record contains:
    - player: The user's DID
    - stats.reverie: The authoritative spectrum values
    - createdAt/updatedAt: Timestamps
"""

import os
import sys
import time
import json
import logging
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any

# Add parent directories to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from core.database import DatabaseManager
from core.encryption import decrypt_password

# Configure logging
_log_handlers = [logging.StreamHandler()]
for _log_path in ('/srv/reverie.house/logs/master_validator.log', '/srv/logs/master_validator.log'):
    _log_dir = os.path.dirname(_log_path)
    if os.path.isdir(_log_dir):
        _log_handlers.append(logging.FileHandler(_log_path))
        break

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=_log_handlers
)
logger = logging.getLogger(__name__)

# Constants
REVERIE_HOUSE_DID = 'did:plc:yauphjufk7phkwurn266ybx2'
REVERIE_HOUSE_HANDLE = 'reverie.house'
PDS_URL = 'https://reverie.house'
COLLECTION = 'actor.rpg.master'


class MasterValidator:
    """Manages actor.rpg.master records for reverie.house users."""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.session = None
        self.access_jwt = None
        
    def authenticate(self) -> bool:
        """Authenticate as @reverie.house using stored app password."""
        try:
            # Fetch encrypted app password
            cursor = self.db.execute(
                "SELECT app_password_hash FROM user_credentials WHERE did = %s",
                (REVERIE_HOUSE_DID,)
            )
            creds = cursor.fetchone()
            
            if not creds or not creds.get('app_password_hash'):
                logger.error("No app password found for reverie.house")
                return False
            
            app_password = decrypt_password(creds['app_password_hash'])
            
            # Create session with PDS
            response = requests.post(
                f'{PDS_URL}/xrpc/com.atproto.server.createSession',
                json={
                    'identifier': REVERIE_HOUSE_HANDLE,
                    'password': app_password
                },
                timeout=10
            )
            
            if not response.ok:
                logger.error(f"Authentication failed: {response.status_code} - {response.text}")
                return False
            
            self.session = response.json()
            self.access_jwt = self.session.get('accessJwt')
            logger.info(f"✅ Authenticated as @{REVERIE_HOUSE_HANDLE}")
            return True
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return False
    
    def get_all_spectrum_users(self) -> List[Dict]:
        """Fetch all users with spectrum data from the database."""
        cursor = self.db.execute('''
            SELECT s.did, d.handle, d.name, 
                   s.oblivion, s.authority, s.skeptic, 
                   s.receptive, s.liberty, s.entropy, s.octant,
                   s.updated_at
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
            WHERE s.did != %s
            ORDER BY d.handle
        ''', (REVERIE_HOUSE_DID,))  # Exclude reverie.house itself
        
        return cursor.fetchall()
    
    def get_existing_master_records(self) -> Dict[str, Dict]:
        """Fetch all existing master records from the PDS."""
        try:
            records = {}
            cursor = None
            
            while True:
                params = {
                    'repo': REVERIE_HOUSE_DID,
                    'collection': COLLECTION,
                    'limit': 100
                }
                if cursor:
                    params['cursor'] = cursor
                
                response = requests.get(
                    f'{PDS_URL}/xrpc/com.atproto.repo.listRecords',
                    params=params,
                    timeout=30
                )
                
                if not response.ok:
                    logger.warning(f"Failed to list records: {response.status_code}")
                    break
                
                data = response.json()
                
                for record in data.get('records', []):
                    player_did = record['value'].get('player')
                    if player_did:
                        records[player_did] = {
                            'uri': record['uri'],
                            'cid': record['cid'],
                            'rkey': record['uri'].split('/')[-1],
                            'value': record['value']
                        }
                
                cursor = data.get('cursor')
                if not cursor:
                    break
            
            logger.info(f"Found {len(records)} existing master records")
            return records
            
        except Exception as e:
            logger.error(f"Error fetching existing records: {e}")
            return {}
    
    def build_master_record(self, user: Dict) -> Dict:
        """Build a master record from database spectrum data."""
        now = datetime.utcnow().isoformat() + 'Z'
        
        return {
            '$type': COLLECTION,
            'player': user['did'],
            'system': 'reverie',
            'snapshotScope': 'full',
            'stats': {
                'oblivion': user['oblivion'] or 0,
                'authority': user['authority'] or 0,
                'skeptic': user['skeptic'] or 0,
                'receptive': user['receptive'] or 0,
                'liberty': user['liberty'] or 0,
                'entropy': user['entropy'] or 0,
                'octant': user['octant'] or 'unknown'
            },
            'createdAt': now,
            'updatedAt': now
        }
    
    def records_match(self, existing: Dict, new_record: Dict) -> bool:
        """Check if existing record matches new data (skip update if same)."""
        existing_value = existing.get('value', {})
        existing_stats = existing_value.get('stats', {})
        new_stats = new_record.get('stats', {})
        
        # Check if record needs format upgrade (missing 'system' field = old format)
        if 'system' not in existing_value:
            return False  # Force update to new format
        
        # Check if snapshotScope is missing
        if 'snapshotScope' not in existing_value:
            return False  # Force update
        
        # Handle old format (stats.reverie.xxx) and new format (stats.xxx)
        if 'reverie' in existing_stats:
            existing_stats = existing_stats['reverie']
        
        keys = ['oblivion', 'authority', 'skeptic', 'receptive', 'liberty', 'entropy', 'octant']
        
        for key in keys:
            if existing_stats.get(key) != new_stats.get(key):
                return False
        
        return True
    
    def create_record(self, record: Dict) -> Optional[str]:
        """Create a new master record."""
        try:
            response = requests.post(
                f'{PDS_URL}/xrpc/com.atproto.repo.createRecord',
                headers={
                    'Authorization': f'Bearer {self.access_jwt}',
                    'Content-Type': 'application/json'
                },
                json={
                    'repo': REVERIE_HOUSE_DID,
                    'collection': COLLECTION,
                    'record': record
                },
                timeout=10
            )
            
            if response.ok:
                data = response.json()
                return data.get('uri')
            else:
                logger.error(f"Create failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Create error: {e}")
            return None
    
    def update_record(self, rkey: str, record: Dict) -> bool:
        """Update an existing master record."""
        try:
            # Update the updatedAt timestamp
            record['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
            
            response = requests.post(
                f'{PDS_URL}/xrpc/com.atproto.repo.putRecord',
                headers={
                    'Authorization': f'Bearer {self.access_jwt}',
                    'Content-Type': 'application/json'
                },
                json={
                    'repo': REVERIE_HOUSE_DID,
                    'collection': COLLECTION,
                    'rkey': rkey,
                    'record': record
                },
                timeout=10
            )
            
            if response.ok:
                return True
            else:
                logger.error(f"Update failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Update error: {e}")
            return False
    
    def delete_record(self, rkey: str) -> bool:
        """Delete a master record (for users no longer in system)."""
        try:
            response = requests.post(
                f'{PDS_URL}/xrpc/com.atproto.repo.deleteRecord',
                headers={
                    'Authorization': f'Bearer {self.access_jwt}',
                    'Content-Type': 'application/json'
                },
                json={
                    'repo': REVERIE_HOUSE_DID,
                    'collection': COLLECTION,
                    'rkey': rkey
                },
                timeout=10
            )
            
            return response.ok
                
        except Exception as e:
            logger.error(f"Delete error: {e}")
            return False
    
    def sync_all(self) -> Dict[str, int]:
        """Synchronize all master records with database."""
        stats = {
            'created': 0,
            'updated': 0,
            'unchanged': 0,
            'deleted': 0,
            'errors': 0
        }
        
        # Authenticate first
        if not self.authenticate():
            logger.error("Failed to authenticate, aborting sync")
            return stats
        
        # Get current data
        users = self.get_all_spectrum_users()
        existing = self.get_existing_master_records()
        
        logger.info(f"Processing {len(users)} users with spectrum data")
        
        # Track which DIDs we've processed
        processed_dids = set()
        
        for user in users:
            player_did = user['did']
            processed_dids.add(player_did)
            
            try:
                new_record = self.build_master_record(user)
                
                if player_did in existing:
                    # Check if update needed
                    if self.records_match(existing[player_did], new_record):
                        stats['unchanged'] += 1
                        logger.debug(f"Unchanged: {user['handle']}")
                    else:
                        # Preserve original createdAt
                        new_record['createdAt'] = existing[player_did]['value'].get('createdAt', new_record['createdAt'])
                        
                        if self.update_record(existing[player_did]['rkey'], new_record):
                            stats['updated'] += 1
                            logger.info(f"Updated: {user['handle']}")
                        else:
                            stats['errors'] += 1
                else:
                    # Create new record
                    uri = self.create_record(new_record)
                    if uri:
                        stats['created'] += 1
                        logger.info(f"Created: {user['handle']} -> {uri}")
                    else:
                        stats['errors'] += 1
                        
            except Exception as e:
                logger.error(f"Error processing {user['handle']}: {e}")
                stats['errors'] += 1
        
        # Delete records for users no longer in database
        for player_did, record_info in existing.items():
            if player_did not in processed_dids:
                if self.delete_record(record_info['rkey']):
                    stats['deleted'] += 1
                    logger.info(f"Deleted record for removed user: {player_did}")
                else:
                    stats['errors'] += 1
        
        return stats
    
    def sync_single_user(self, player_did: str) -> Dict[str, Any]:
        """
        Sync master record for a single user.
        
        Useful for immediate updates when a user's spectrum changes.
        
        Args:
            player_did: The DID of the player to sync
            
        Returns:
            Dict with 'success', 'action' (created/updated/unchanged/error), and details
        """
        result = {
            'success': False,
            'action': 'error',
            'player_did': player_did,
            'message': ''
        }
        
        # Authenticate
        if not self.authenticate():
            result['message'] = 'Authentication failed'
            return result
        
        # Get user's spectrum data
        cursor = self.db.execute('''
            SELECT s.did, d.handle, d.name, 
                   s.oblivion, s.authority, s.skeptic, 
                   s.receptive, s.liberty, s.entropy, s.octant,
                   s.updated_at
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
            WHERE s.did = %s
        ''', (player_did,))
        
        user = cursor.fetchone()
        
        if not user:
            result['message'] = f'No spectrum data found for {player_did}'
            return result
        
        # Check for existing record
        existing = self.get_existing_master_records()
        
        try:
            new_record = self.build_master_record(user)
            
            if player_did in existing:
                if self.records_match(existing[player_did], new_record):
                    result['success'] = True
                    result['action'] = 'unchanged'
                    result['message'] = f'Record for {user["handle"]} already up to date'
                else:
                    new_record['createdAt'] = existing[player_did]['value'].get('createdAt', new_record['createdAt'])
                    
                    if self.update_record(existing[player_did]['rkey'], new_record):
                        result['success'] = True
                        result['action'] = 'updated'
                        result['uri'] = existing[player_did]['uri']
                        result['message'] = f'Updated record for {user["handle"]}'
                    else:
                        result['message'] = f'Failed to update record for {user["handle"]}'
            else:
                uri = self.create_record(new_record)
                if uri:
                    result['success'] = True
                    result['action'] = 'created'
                    result['uri'] = uri
                    result['message'] = f'Created record for {user["handle"]}'
                else:
                    result['message'] = f'Failed to create record for {user["handle"]}'
                    
        except Exception as e:
            result['message'] = str(e)
            logger.error(f"Error syncing {player_did}: {e}")
        
        return result


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Sync actor.rpg.master records with reverie.house database')
    parser.add_argument('--user', '-u', type=str, help='Sync only a specific user (DID or handle)')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress info logging')
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    logger.info("=" * 60)
    logger.info("Master Validator starting")
    logger.info("=" * 60)
    
    validator = MasterValidator()
    
    if args.user:
        # Handle both DID and handle
        user_id = args.user
        if not user_id.startswith('did:'):
            # Resolve handle to DID
            cursor = validator.db.execute(
                "SELECT did FROM dreamers WHERE handle = %s",
                (user_id,)
            )
            result = cursor.fetchone()
            if result:
                user_id = result['did']
            else:
                logger.error(f"Could not find user: {args.user}")
                return 1
        
        result = validator.sync_single_user(user_id)
        logger.info(f"Result: {result['action']} - {result['message']}")
        return 0 if result['success'] else 1
    else:
        stats = validator.sync_all()
        
        logger.info("-" * 60)
        logger.info("Sync complete:")
        logger.info(f"  Created:   {stats['created']}")
        logger.info(f"  Updated:   {stats['updated']}")
        logger.info(f"  Unchanged: {stats['unchanged']}")
        logger.info(f"  Deleted:   {stats['deleted']}")
        logger.info(f"  Errors:    {stats['errors']}")
        logger.info("=" * 60)
        
        return 0 if stats['errors'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
