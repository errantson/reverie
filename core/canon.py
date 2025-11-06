#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Canon management for Reverie House.
Handles writing canon events directly to the database.
"""

from typing import Dict, List, Optional
import json
import os
import sys
import sqlite3
import time

try:
    from config import Config
    DATA_DIR = Config.DATA_DIR
except ImportError:
    DATA_DIR = "/srv/data"

DB_FILE = os.path.join(DATA_DIR, "reverie.db")
CANON_FILE = os.path.join(DATA_DIR, "canon.json")
CANON_HARD_FILE = os.path.join(DATA_DIR, "canon.hard")
PENDING_FILE = os.path.join(DATA_DIR, ".canon_pending.json")


class CanonManager:
    """Manages canon entries - writes directly to database."""

    def __init__(self):
        self.pending_entries = []
        self.scribe_active = False
        self._ensure_data_dir()
        
    def _ensure_data_dir(self):
        """Ensure data directory exists."""
        os.makedirs(DATA_DIR, exist_ok=True)
        
    def _get_db_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn
        
    def record_book_order(self, customer_email: str, customer_name: str,
                         quantity: int, amount: float, currency: str,
                         session_id: str, customer_did: Optional[str] = None,
                         customer_handle: Optional[str] = None,
                         anonymous: bool = False) -> Dict[str, any]:
        """
        Record a book order as a canon event with intelligent DID attribution.
        
        Attribution hierarchy:
        1. Use customer_did if provided (from OAuth session metadata)
        2. Try email pattern matching against dreamer handles
        3. If anonymous=True or no match found, attribute to 'dreamer' user
        
        Args:
            customer_email: Customer's email from Stripe
            customer_name: Customer's name from Stripe
            quantity: Number of books ordered
            amount: Total amount paid
            currency: Currency code (e.g., 'usd')
            session_id: Stripe checkout session ID
            customer_did: DID if known (from OAuth session)
            customer_handle: Handle if known (from OAuth session)
            anonymous: Whether order should be anonymous (from checkbox or no login)
        
        Returns:
            dict: {
                'success': bool,
                'did': str or None,
                'attribution_method': 'oauth' | 'email' | 'anonymous',
                'canon_id': int or None
            }
        """
        epoch = int(time.time())
        did = None
        attribution_method = 'anonymous'
        
        try:
            conn = self._get_db_connection()
            
            if anonymous:
                did = 'did:plc:zdxbourfcbv66iq2xfpb233q'
                attribution_method = 'anonymous'
                print(f"🔒 Order anonymous - attributed to dreamer.reverie.house")
            elif customer_did:
                existing = conn.execute(
                    "SELECT did, name FROM dreamers WHERE did = ?",
                    (customer_did,)
                ).fetchone()
                
                if existing:
                    did = customer_did
                    attribution_method = 'oauth'
                    print(f"✅ Order attributed via OAuth: {customer_handle or did[:20]}")
                else:
                    print(f"⚠️  DID from OAuth not in database: {customer_did}")
            
            if not did and customer_email and not anonymous:
                email_username = customer_email.split('@')[0].lower()
                
                cursor = conn.execute(
                    "SELECT did, name, handle FROM dreamers WHERE LOWER(handle) LIKE ?",
                    (f"%{email_username}%",)
                )
                matches = cursor.fetchall()
                
                if len(matches) == 1:
                    did = matches[0]['did']
                    attribution_method = 'email'
                    print(f"✅ Order attributed via email: {matches[0]['handle']}")
                elif len(matches) > 1:
                    did = 'did:plc:zdxbourfcbv66iq2xfpb233q'
                    attribution_method = 'anonymous'
                    print(f"⚠️  Multiple handle matches for {email_username}, attributed to dreamer")
                else:
                    did = 'did:plc:zdxbourfcbv66iq2xfpb233q'
                    attribution_method = 'anonymous'
                    print(f"ℹ️  No handle match for {customer_email}, attributed to dreamer")
            
            # Convert quantity to words
            def number_to_words(n):
                """Convert a number to its word representation (1-999)"""
                if n == 0:
                    return 'zero'
                
                ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
                teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 
                         'sixteen', 'seventeen', 'eighteen', 'nineteen']
                tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
                
                if n < 10:
                    return ones[n]
                elif n < 20:
                    return teens[n - 10]
                elif n < 100:
                    ten_digit = n // 10
                    one_digit = n % 10
                    if one_digit == 0:
                        return tens[ten_digit]
                    else:
                        return f"{tens[ten_digit]} {ones[one_digit]}"
                elif n < 1000:
                    hundred_digit = n // 100
                    remainder = n % 100
                    if remainder == 0:
                        return f"{ones[hundred_digit]} hundred"
                    else:
                        return f"{ones[hundred_digit]} hundred {number_to_words(remainder)}"
                else:
                    return str(n)  # For very large numbers, just use the number
            
            quantity_text = number_to_words(quantity)
            
            books_text = 'book' if quantity == 1 else 'books'
            event_text = f"realizes {quantity_text} {books_text}"
            
            session_short = session_id.split('_')[-1][:8] if session_id else 'unknown'
            order_uri = f"stripe:{session_short}"
            
            order_url = "/order"
            
            # No personal data stored - Stripe maintains the transaction records
            
            key = 'seeker'
            
            cursor = conn.execute("""
                INSERT INTO canon (did, event, epoch, uri, url, type, key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                did,
                event_text,
                epoch,
                order_uri,
                order_url,
                'order',
                key,
                epoch
            ))
            
            canon_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            print(f"📖 CANON: {quantity_text} {books_text} realized [order] [{key}]")
            
            return {
                'success': True,
                'did': did,
                'attribution_method': attribution_method,
                'canon_id': canon_id
            }
            
        except Exception as e:
            print(f"❌ CANON ORDER ERROR: {e}")
            return {
                'success': False,
                'did': None,
                'attribution_method': 'error',
                'canon_id': None
            }
    
    def record_canon_event(self, did: str, name: str, event: str, canon_type: str, 
                          epoch: Optional[int] = None, uri: str = "", url: str = "", key: str = "") -> bool:
        """
        Record a canon event directly to the database.
        
        Args:
            did: Dreamer's DID
            name: Dreamer's name (for legacy compatibility, not stored)
            event: Event description (e.g., "found our wild mindscape")
            canon_type: Event type ('arrival', 'souvenir', 'name', etc.)
            epoch: Event timestamp (defaults to current time)
            uri: AT protocol URI
            url: Public URL
            key: Souvenir key or tag for categorization (e.g., 'residence', 'strange')
            
        Returns:
            bool: Success status
        """
        if not did or not event or not canon_type:
            return False
            
        if epoch is None:
            epoch = int(time.time())
            
        try:
            conn = self._get_db_connection()
            
            existing = conn.execute('''
                SELECT id FROM canon 
                WHERE did = ? AND event = ? AND epoch = ?
            ''', (did, event, epoch)).fetchone()
            
            if existing:
                conn.close()
                return True
            
            conn.execute('''
                INSERT INTO canon (did, event, epoch, uri, url, type, key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (did, event, epoch, uri, url, canon_type, key or None, int(time.time())))
            
            conn.commit()
            conn.close()
            
            key_str = f"[{key}]" if key else ""
            print(f"📖 CANON: {name} {event} [{canon_type}] {key_str}")
            return True
            
        except Exception as e:
            print(f"❌ CANON ERROR: {e}")
            return False


    def scribe_begin(self):
        """Begin batching canon entries (legacy compatibility)."""
        self.pending_entries = []
        self.scribe_active = True
        try:
            if os.path.exists(PENDING_FILE):
                os.remove(PENDING_FILE)
        except Exception:
            pass
        print(" ")
        print("=== CANON ===")
        print("✍  SCRIBE BEGIN")

    def record_entry(self, name: str, event: str, **kwargs):
        """
        Record a new canon entry (legacy compatibility - redirects to database).
        
        This method maintains backward compatibility with old batching system
        but now writes directly to database.
        """
        canon_type = kwargs.get("type", "souvenir")
        key = kwargs.get("key", "")
        
        if "keys" in kwargs and not key:
            keys = kwargs["keys"]
            if isinstance(keys, list) and len(keys) > 0:
                key = keys[0]
        
        success = self.record_canon_event(
            did=kwargs.get("did", ""),
            name=name,
            event=event,
            canon_type=canon_type,
            epoch=kwargs.get("epoch", None),
            uri=kwargs.get("uri", ""),
            url=kwargs.get("url", ""),
            key=key
        )
        
        if success and self.scribe_active:
            self.pending_entries.append({"name": name, "event": event, "type": canon_type, "key": key})
        
        return success

    def scribe_commit(self) -> tuple[bool, int]:
        """
        Commit pending entries (legacy compatibility).
        
        Since we now write directly to database, this just reports what was written.
        """
        count = len(self.pending_entries)
        
        if count > 0:
            print("")
            print("=== CANON ===")
            print(f"� CANON WRITTEN: {count} new entries")
            for entry in self.pending_entries:
                name = entry.get('name', '')
                event = entry.get('event', '')
                canon_type = entry.get('type', '')
                print(f"-- \"{name} {event}\" [{canon_type}]")
        
        self.scribe_active = False
        self.pending_entries = []
        try:
            if os.path.exists(PENDING_FILE):
                os.remove(PENDING_FILE)
        except Exception:
            pass
        
        return True, count


    def get_pending_count(self) -> int:
        """Get count of pending entries."""
        return len(self.pending_entries)

    def get_pending_entries(self) -> List[str]:
        """Get formatted list of pending entries for display."""
        return [f"{entry.get('name', '')} {entry.get('event', '')}" 
                for entry in self.pending_entries]

    def load_canon(self) -> List[Dict]:
        """Load canon entries from database."""
        try:
            conn = self._get_db_connection()
            rows = conn.execute('''
                SELECT c.*, d.name 
                FROM canon c 
                LEFT JOIN dreamers d ON c.did = d.did 
                ORDER BY c.epoch DESC
            ''').fetchall()
            conn.close()
            
            return [dict(row) for row in rows]
        except Exception as e:
            print(f"❌ CANON LOAD ERROR: {e}")
            return []


def create_canon_manager() -> CanonManager:
    """Create a CanonManager instance for use in reverie cycle."""
    return CanonManager()


def main():
    """CLI entry point for canon processing."""    
    canon_mgr = CanonManager()
    
    try:
        canon_entries = canon_mgr.load_canon()
        print(f"📖 Loaded {len(canon_entries)} canon entries from database")
        
    except Exception as e:
        print(f"❌ CANON ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
