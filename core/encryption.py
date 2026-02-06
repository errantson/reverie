#!/usr/bin/env python3
"""
Encryption utilities for sensitive data

Provides Fernet-based encryption for app passwords and other sensitive strings.
Uses a key stored in /srv/secrets/reverie.encryption.key.

SECURITY NOTES:

Algorithm: Fernet (symmetric encryption)
- AES-128 in CBC mode
- HMAC for authentication
- Automatic timestamp for expiration support
- Safe against tampering

Key Storage:
- Location: /srv/secrets/reverie.encryption.key
- Permissions: 600 (owner read/write only)
- Format: Base64-encoded 32-byte key
- Generation: Fernet.generate_key()

Why Reversible Encryption (Not Hashing):
- Worker credentials need to authenticate with user's PDS
- We must POST the plaintext password to their PDS endpoint
- Hashing (bcrypt, argon2) would make this impossible
- We need: encrypted storage → decrypt → use → discard

Security Measures:
- Credentials validated every 3 minutes (workerwatch)
- Invalid credentials auto-disabled
- Failed auth attempts logged
- Users can revoke worker status anytime
- App passwords (not main passwords) limit blast radius

Key Rotation Procedure:
1. Generate new key: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
2. Save to /srv/secrets/reverie.encryption.key.new
3. Run migration script to re-encrypt all credentials
4. Rename .new to replace old key
5. Restart services

Threat Model:
- ✅ Protected against: Database breach (encrypted at rest)
- ✅ Protected against: Network sniffing (TLS in transit)
- ✅ Protected against: Accidental exposure (no plaintext logs)
- ⚠️ Vulnerable to: Server compromise with root access (key readable)
- ⚠️ Vulnerable to: Database + secrets backup theft together

Alternative Considered:
- OAuth refresh tokens (preferred but not supported by all PDS)
- Future: Switch to refresh tokens when available
"""

import os
from cryptography.fernet import Fernet


class PasswordEncryption:
    """Encrypt and decrypt app passwords using Fernet (symmetric encryption)"""
    
    def __init__(self, key_path='/srv/secrets/reverie.encryption.key'):
        """
        Initialize encryption with key from file.
        
        Args:
            key_path: Path to file containing Fernet key (default: /srv/secrets/reverie.encryption.key)
        """
        self.key_path = key_path
        self._load_key()
    
    def _load_key(self):
        """Load encryption key from file"""
        try:
            with open(self.key_path, 'rb') as f:
                key = f.read().strip()
            self.cipher = Fernet(key)
        except FileNotFoundError:
            raise FileNotFoundError(
                f"Encryption key not found at {self.key_path}. "
                f"Generate one with: python3 -c \"from cryptography.fernet import Fernet; "
                f"print(Fernet.generate_key().decode())\" > {self.key_path}"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to load encryption key: {e}")
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string.
        
        Args:
            plaintext: String to encrypt (e.g., app password)
            
        Returns:
            Base64-encoded encrypted string (safe to store in database)
        """
        if not plaintext:
            raise ValueError("Cannot encrypt empty string")
        
        plaintext_bytes = plaintext.encode('utf-8')
        encrypted_bytes = self.cipher.encrypt(plaintext_bytes)
        # Return as string for database storage
        return encrypted_bytes.decode('utf-8')
    
    def decrypt(self, encrypted: str) -> str:
        """
        Decrypt an encrypted string.
        
        Args:
            encrypted: Base64-encoded encrypted string from database
            
        Returns:
            Decrypted plaintext string
        """
        if not encrypted:
            raise ValueError("Cannot decrypt empty string")
        
        try:
            encrypted_bytes = encrypted.encode('utf-8')
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")


# Global encryption instance
_encryptor = None


def get_encryptor() -> PasswordEncryption:
    """Get global encryption instance (singleton pattern)"""
    global _encryptor
    if _encryptor is None:
        _encryptor = PasswordEncryption()
    return _encryptor


def encrypt_password(plaintext: str) -> str:
    """
    Convenience function to encrypt a password.
    
    Args:
        plaintext: Plaintext password
        
    Returns:
        Encrypted string safe for database storage
    """
    return get_encryptor().encrypt(plaintext)


def decrypt_password(encrypted: str) -> str:
    """
    Convenience function to decrypt a password.
    
    Args:
        encrypted: Encrypted password from database
        
    Returns:
        Plaintext password
    """
    return get_encryptor().decrypt(encrypted)
