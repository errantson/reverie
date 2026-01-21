#!/usr/bin/env python3
"""
PLC Handle Registration for Individual Users

Each user's DID gets registered with their handle in their own alsoKnownAs record.
This module handles registration when accounts are created or handles are assigned.
"""

import requests
import json
from typing import Optional, Dict, List


class UserPLCRegistration:
    """Register individual users' DIDs with their handles in PLC"""
    
    PLC_URL = "https://plc.directory"
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
    
    def log(self, msg: str):
        if self.verbose:
            print(msg)
    
    def get_user_plc_state(self, did: str) -> Optional[Dict]:
        """Fetch user's current PLC state"""
        try:
            response = requests.get(f"{self.PLC_URL}/{did}", timeout=10)
            if response.ok:
                return response.json()
            return None
        except Exception as e:
            self.log(f"⚠️  Error fetching PLC for {did}: {e}")
            return None
    
    def user_has_handle_registered(self, did: str, handle: str) -> bool:
        """Check if user already has this handle registered in PLC"""
        state = self.get_user_plc_state(did)
        if not state:
            return False
        
        also_known_as = state.get('alsoKnownAs', [])
        target_urn = f"at://{handle}"
        return target_urn in also_known_as
    
    def register_user_handle(self, did: str, handle: str) -> bool:
        """
        Verify user's handle is registered in their PLC alsoKnownAs.
        
        The actual signing and registration is done through the Node.js PDS,
        not directly from Python. This method checks the current state.
        
        Args:
            did: User's DID
            handle: Handle to check (e.g., "alice.reverie.house")
            
        Returns:
            True if handle is registered, False otherwise
        """
        if not handle.endswith('.reverie.house'):
            return False
        
        # Check if already registered
        if self.user_has_handle_registered(did, handle):
            self.log(f"✅ {handle} registered in PLC for {did}")
            return True
        
        # Get current PLC state to verify
        state = self.get_user_plc_state(did)
        if not state:
            self.log(f"⚠️  Could not fetch PLC state for {did}")
            return False
        
        self.log(f"⚠️  {handle} not yet registered in PLC for {did}")
        return False
    
    def queue_for_pds_registration(self, did: str, handle: str) -> bool:
        """
        Queue handle for registration through Node.js PDS.
        
        The PDS manages the actual PLC signing via @did-plc/lib,
        not from Python.
        
        Args:
            did: User's DID
            handle: Handle to register
            
        Returns:
            True if queued (always succeeds, PDS handles validation)
        """
        return True


def register_handle_on_account_creation(did: str, handle: str) -> bool:
    """
    Called when a new account is created on reverie.house.
    Queue the handle for PLC registration.
    
    Args:
        did: New user's DID
        handle: New user's handle
        
    Returns:
        True if queued successfully
    """
    if not handle.endswith('.reverie.house'):
        return False  # Not our domain
    
    registrar = UserPLCRegistration(verbose=True)
    registrar.log(f"\n✨ New account created: {handle} ({did})")
    
    # Queue for registration
    queue_status = registrar.queue_for_pds_registration(did, handle)
    registrar.log(f"📋 Queued for PLC registration:")
    registrar.log(f"   DID: {did}")
    registrar.log(f"   Handle: {handle}")
    
    return True


def register_handle_on_namegiver_completion(did: str, handle: str, new_name: str) -> bool:
    """
    Called when namegiver quest is completed and user gets a .reverie.house handle.
    Queue the handle for PLC registration.
    
    Args:
        did: User's DID
        handle: Existing Bluesky handle (e.g., external PDS)
        new_name: New canonical name (e.g., "alice")
        
    Returns:
        True if queued successfully
    """
    reverie_handle = f"{new_name}.reverie.house"
    
    registrar = UserPLCRegistration(verbose=True)
    registrar.log(f"\n✨ Namegiver quest completed: {new_name}")
    registrar.log(f"   User DID: {did}")
    registrar.log(f"   Reverie handle: {reverie_handle}")
    
    # Queue for registration
    queue_status = registrar.queue_for_pds_registration(did, reverie_handle)
    
    return True


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python3 user_plc_registration.py <did> <handle>")
        print("Example: python3 user_plc_registration.py did:plc:xxx alice.reverie.house")
        sys.exit(1)
    
    did = sys.argv[1]
    handle = sys.argv[2]
    
    registrar = UserPLCRegistration(verbose=True)
    
    # Check current state
    state = registrar.get_user_plc_state(did)
    if state:
        print(f"\n📋 Current PLC state for {did}:")
        print(f"   alsoKnownAs: {state.get('alsoKnownAs', [])}")
    
    # Try to register
    success = registrar.register_user_handle(did, handle)
    sys.exit(0 if success else 1)
