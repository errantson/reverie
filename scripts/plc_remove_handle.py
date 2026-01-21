#!/usr/bin/env python3
"""
PLC Handle Removal Tool

Removes a handle from a user's PLC record by signing and submitting an operation.
This requires the user's rotation key (private key).

Usage:
    python3 plc_remove_handle.py <did> <handle> [--key-hex <hex_key>]

Example:
    python3 plc_remove_handle.py did:plc:xyz at://alice.reverie.house --key-hex abc123...
"""

import sys
import requests
import json
import cbor2
import base64
import hashlib
from typing import Optional


class PLCHandleRemover:
    """Remove handles from PLC using a private key"""
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.plc_url = "https://plc.directory"
    
    def log(self, msg: str):
        if self.verbose:
            print(msg)
    
    def get_plc_state(self, did: str) -> Optional[dict]:
        """Fetch current PLC state"""
        try:
            response = requests.get(f"{self.plc_url}/{did}", timeout=10)
            if response.ok:
                return response.json()
            self.log(f"❌ Failed to fetch PLC state: {response.status_code}")
            return None
        except Exception as e:
            self.log(f"❌ Error fetching PLC: {e}")
            return None
    
    def remove_handle(self, did: str, handle: str, key_hex: Optional[str] = None) -> bool:
        """
        Remove a handle from a user's PLC record
        
        Note: Without the user's private key (key_hex), this will fail.
        The key should be the user's rotation key in hex format.
        """
        
        if not handle.startswith('at://'):
            handle = f"at://{handle}"
        
        self.log(f"\n🔍 Fetching PLC state for {did}...")
        
        state = self.get_plc_state(did)
        if not state:
            self.log(f"❌ Cannot proceed without PLC state")
            return False
        
        also_known_as = state.get('alsoKnownAs', [])
        
        if handle not in also_known_as:
            self.log(f"✅ Handle {handle} is not in PLC (already removed)")
            return True
        
        self.log(f"📝 Current alsoKnownAs: {also_known_as}")
        
        # Remove the handle
        new_aka = [h for h in also_known_as if h != handle]
        self.log(f"📝 New alsoKnownAs: {new_aka}")
        
        if not key_hex:
            self.log(f"\n⚠️  Private key required to sign operation")
            self.log(f"    Provide with: --key-hex <hex_key>")
            self.log(f"\n    Without the key, the handle cannot be removed from PLC.")
            self.log(f"    The handle is functionally unusable (account deleted).")
            return False
        
        # Build operation
        operation = {
            'verificationMethods': state.get('verificationMethods', {}),
            'rotationKeys': state.get('rotationKeys', []),
            'alsoKnownAs': new_aka,
            'services': state.get('services', {}),
            'prev': state.get('prev'),
        }
        
        # TODO: Sign operation with key_hex if provided
        # This would require:
        # 1. CBOR encoding
        # 2. ECDSA signing with the rotation key
        # 3. base64url encoding of signature
        # 4. Submitting to PLC
        
        self.log(f"\n⚠️  Signing implementation not yet available")
        self.log(f"    To implement: use cryptography library for ECDSA signing")
        
        return False


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 plc_remove_handle.py <did> <handle> [--key-hex <key>]")
        print("")
        print("Examples:")
        print("  # Check without removing:")
        print("  python3 plc_remove_handle.py did:plc:xyz at://alice.reverie.house")
        print("")
        print("  # Remove with key:")
        print("  python3 plc_remove_handle.py did:plc:xyz at://alice.reverie.house \\")
        print("    --key-hex abc123def456...")
        sys.exit(1)
    
    did = sys.argv[1]
    handle = sys.argv[2]
    
    key_hex = None
    if '--key-hex' in sys.argv:
        idx = sys.argv.index('--key-hex')
        if idx + 1 < len(sys.argv):
            key_hex = sys.argv[idx + 1]
    
    remover = PLCHandleRemover(verbose=True)
    success = remover.remove_handle(did, handle, key_hex)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
