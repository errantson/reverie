#!/usr/bin/env python3
"""
Events Management for Reverie House
Handles recording all events to the events table in PostgreSQL.

This replaces the obsolete canon.py which was trying to write to a non-existent canon table.
The canon view is read-only and filtered for name/origin events only.

All events (arrivals, orders, souvenirs, reactions, etc.) go into the events table.
"""

import time
import logging
from typing import Dict, Optional, Any
from core.database import DatabaseManager
from core.utils import number_to_words

try:
    from config import Config
    ANONYMOUS_DID = getattr(Config, 'ANONYMOUS_DID', 'did:plc:zdxbourfcbv66iq2xfpb233q')
except ImportError:
    ANONYMOUS_DID = 'did:plc:zdxbourfcbv66iq2xfpb233q'

logger = logging.getLogger(__name__)


class EventsManager:
    """
    Manages all events in the Reverie House events table.
    
    Events include:
    - arrivals: When dreamers first join
    - orders: Book purchases
    - souvenirs: Collected items
    - reactions: Interactions with other events
    - name: Name changes
    - origin: Origin story updates
    """
    
    def __init__(self, db: Optional[DatabaseManager] = None):
        self.db = db or DatabaseManager()
    
    def _format_order_event(self, customer_name: Optional[str], quantity: int, anonymous: bool = False) -> str:
        """
        Format order event text.
        
        Args:
            customer_name: Name of customer (or None for anonymous)
            quantity: Number of books ordered
            anonymous: Whether to use anonymous format
            
        Returns:
            str: Formatted event text like "realizes five books"
        """
        quantity_text = number_to_words(quantity)
        books_text = 'book' if quantity == 1 else 'books'
        return f"realizes {quantity_text} {books_text}"
    
    def _resolve_customer_did(self, customer_did: Optional[str] = None, 
                             customer_email: Optional[str] = None,
                             customer_handle: Optional[str] = None,
                             anonymous: bool = False) -> tuple[Optional[str], str]:
        """
        Resolve customer DID using intelligent attribution hierarchy.
        
        Attribution hierarchy:
        1. If anonymous=True, use anonymous DID
        2. Use customer_did if provided (from OAuth session metadata)
        3. Try email pattern matching against dreamer handles
        4. Fallback to anonymous DID
        
        Args:
            customer_did: DID if known (from OAuth session)
            customer_email: Customer's email from Stripe
            customer_handle: Handle if known (from OAuth session)
            anonymous: Whether order should be anonymous
            
        Returns:
            tuple: (did or None, attribution_method)
        """
        if anonymous:
            logger.info(f"🔒 Order anonymous - attributed to dreamer.reverie.house")
            return ANONYMOUS_DID, 'anonymous'
        
        if customer_did:
            with self.db.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT did, name FROM dreamers WHERE did = %s",
                        (customer_did,)
                    )
                    existing = cursor.fetchone()
                    
                    if existing:
                        logger.info(f"✅ Order attributed via OAuth: {customer_handle or customer_did[:20]}")
                        return customer_did, 'oauth'
                    else:
                        logger.warning(f"⚠️  DID from OAuth not in database: {customer_did}")
        
        if customer_email and not anonymous:
            email_username = customer_email.split('@')[0].lower()
            
            with self.db.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT did, name, handle FROM dreamers WHERE LOWER(handle) LIKE %s",
                        (f"%{email_username}%",)
                    )
                    matches = cursor.fetchall()
                    
                    if len(matches) == 1:
                        logger.info(f"✅ Order attributed via email: {matches[0]['handle']}")
                        return matches[0]['did'], 'email'
                    elif len(matches) > 1:
                        logger.warning(f"⚠️  Multiple handle matches for {email_username}, attributed to dreamer")
                        return ANONYMOUS_DID, 'anonymous'
                    else:
                        logger.info(f"ℹ️  No handle match for {customer_email}, attributed to dreamer")
                        return ANONYMOUS_DID, 'anonymous'
        
        return ANONYMOUS_DID, 'anonymous'
    
    def record_book_order(self, customer_email: str, customer_name: str,
                         quantity: int, amount: float, currency: str,
                         session_id: str, customer_did: Optional[str] = None,
                         customer_handle: Optional[str] = None,
                         anonymous: bool = False) -> Dict[str, Any]:
        """
        Record a book order as an event with intelligent DID attribution.
        Writes directly to the events table with proper transaction handling.
        
        Attribution hierarchy:
        1. Use customer_did if provided (from OAuth session metadata)
        2. Try email pattern matching against dreamer handles
        3. If anonymous=True or no match found, attribute to 'dreamer' user
        
        Args:
            customer_email: Customer's email from Stripe
            customer_name: Customer's name from Stripe
            quantity: Number of books ordered
            amount: Total amount paid (in cents)
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
                'event_id': int or None
            }
        """
        epoch = int(time.time())
        
        try:
            # Resolve customer DID using attribution hierarchy
            did, attribution_method = self._resolve_customer_did(
                customer_did=customer_did,
                customer_email=customer_email,
                customer_handle=customer_handle,
                anonymous=anonymous
            )
            
            # Format event text
            event_text = self._format_order_event(customer_name, quantity, anonymous)
            
            session_short = session_id.split('_')[-1][:8] if session_id else 'unknown'
            order_uri = f"stripe:{session_short}"
            order_url = "/order"
            key = 'seeker'
            
            # Prepare quantities JSONB
            import json
            quantities = {
                'books': quantity,
                'amount_cents': amount,
                'currency': currency
            }
            quantities_json = json.dumps(quantities)
            
            # Write to events table with transaction safety
            with self.db.transaction() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, quantities, color_source, color_intensity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                        RETURNING id
                    """, (
                        did,
                        event_text,
                        'order',
                        key,
                        order_uri,
                        order_url,
                        epoch,
                        epoch,
                        quantities_json,
                        'user',
                        'special'
                    ))
                    
                    result = cursor.fetchone()
                    event_id = result['id'] if result else None
            
            quantity_text = number_to_words(quantity)
            books_text = 'book' if quantity == 1 else 'books'
            logger.info(f"📖 EVENT: {quantity_text} {books_text} realized [order] [{key}] (id: {event_id})")
            
            return {
                'success': True,
                'did': did,
                'attribution_method': attribution_method,
                'event_id': event_id
            }
            
        except Exception as e:
            logger.error(f"❌ EVENT ORDER ERROR: {e}", exc_info=True)
            return {
                'success': False,
                'did': None,
                'attribution_method': 'error',
                'event_id': None
            }
    
    def record_event(self, did: str, event: str, event_type: str, 
                    key: str = "", epoch: Optional[int] = None, 
                    uri: str = "", url: str = "", 
                    reaction_to: Optional[int] = None,
                    quantities: Optional[Dict] = None) -> Optional[int]:
        """
        Record a generic event to the events table.
        
        Args:
            did: Dreamer's DID
            event: Event description (e.g., "found our wild mindscape")
            event_type: Event type ('arrival', 'souvenir', 'reaction', etc.)
            key: Souvenir key or tag for categorization (e.g., 'residence', 'strange')
            epoch: Event timestamp (defaults to current time)
            uri: AT protocol URI
            url: Public URL
            reaction_to: ID of event being reacted to (for reactions)
            quantities: Optional JSONB data (for orders, etc.)
            
        Returns:
            int: Event ID if successful, None otherwise
        """
        if not did or not event or not event_type:
            logger.error("Missing required fields for event")
            return None
            
        if epoch is None:
            epoch = int(time.time())
            
        try:
            with self.db.transaction() as conn:
                with conn.cursor() as cursor:
                    # Check for duplicates
                    cursor.execute('''
                        SELECT id FROM events 
                        WHERE did = %s AND event = %s AND epoch = %s
                    ''', (did, event, epoch))
                    
                    existing = cursor.fetchone()
                    if existing:
                        logger.debug(f"Event already exists: {did} {event}")
                        return existing['id']
                    
                    # Insert new event
                    cursor.execute('''
                        INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, reaction_to, quantities, color_source, color_intensity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                        RETURNING id
                    ''', (did, event, event_type, key or '', uri, url, epoch, int(time.time()), reaction_to, quantities, 'user', 'highlight'))
                    
                    result = cursor.fetchone()
                    event_id = result['id'] if result else None
            
            key_str = f"[{key}]" if key else ""
            logger.info(f"📖 EVENT: {event} [{event_type}] {key_str} (id: {event_id})")
            return event_id
            
        except Exception as e:
            logger.error(f"❌ EVENT ERROR: {e}", exc_info=True)
            return None
    
    def get_events(self, limit: int = 100, event_type: Optional[str] = None, 
                   did: Optional[str] = None) -> list[Dict]:
        """
        Fetch events from the database.
        
        Args:
            limit: Maximum number of events to return
            event_type: Filter by event type (optional)
            did: Filter by dreamer DID (optional)
            
        Returns:
            List of event dictionaries
        """
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cursor:
                    query = '''
                        SELECT e.*, d.name, d.handle
                        FROM events e 
                        LEFT JOIN dreamers d ON e.did = d.did 
                        WHERE 1=1
                    '''
                    params = []
                    
                    if event_type:
                        query += ' AND e.type = %s'
                        params.append(event_type)
                    
                    if did:
                        query += ' AND e.did = %s'
                        params.append(did)
                    
                    query += ' ORDER BY e.epoch DESC LIMIT %s'
                    params.append(limit)
                    
                    cursor.execute(query, params)
                    rows = cursor.fetchall()
                    return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"❌ EVENT FETCH ERROR: {e}", exc_info=True)
            return []
