"""
Designation System
==================

Single source of truth for composing user designations in Reverie House.

Composition Order:
------------------
[Former?] [Character?] [Cheerful?] [Resident?/Patronage?] [Base/Role] [Stylist?]

Hierarchy:
----------
1. SINGULAR OVERRIDES (no compounding):
   - House Patron (highest lifetime patronage)
   - Keeper of Reverie House (GM of reverie.house world)

2. EXCLUSIVE WORK ROLES (one at a time, overrides base identity):
   - Guardian, Greeter of Reveries, Spectrum Mapper, Cogitarian, Provisioner, Bursar
   - Pattern: "[Character?] [Cheerful?] [Resident?] [Patronage?] [Work Role]"
   - e.g., Known Resident Guardian, Cheerful Greeter of Reveries

3. AFFIX ROLES (compound with base identities and work roles):
   - Cheerful: PREFIX - "Cheerful Resident", "Cheerful Ward", "Cheerful Guardian"
   - Stylist: SUFFIX - "Resident Stylist", "Ward Stylist"

4. BASE IDENTITIES (mutually exclusive, hierarchy: Resident > Dreamweaver > Ward/Charge/Dreamer):
   
   RESIDENT (PDS on reverie.house):
   - "[Character?] [Cheerful?] Resident [Patronage Suffix?]"
   - e.g., Revered Cheerful Resident Patron
   
   DREAMWEAVER (handle .reverie.house, above Ward/Charge):
   - "[Character?] [Cheerful?] [Patronage Prefix?] Dreamweaver"
   - e.g., Known Cheerful Altruist Dreamweaver
   
   WARD (replaces Dreamer when under protective stewardship):
   - "[Character?] [Cheerful?] [Patronage Prefix?] Ward"
   - e.g., Known Cheerful Reading Ward
   
   CHARGE (replaces Dreamer when under light stewardship):
   - "[Character?] [Cheerful?] [Patronage Prefix?] Charge"
   - e.g., Cheerful Reading Charge
   
   DREAMER (default, transforms to "Dreaming" with patronage):
   - With patronage: "[Character?] [Cheerful?] Dreaming [Patronage Suffix]"
   - Without: "[Character?] [Cheerful?] Dreamer"
   - e.g., Known Cheerful Dreaming Reader, Cheerful Dreamer

5. FORMER PREFIX (deactivated accounts):
   - Prepended when account is deactivated/dissipated
   - e.g., Former Resident, Former Ward

Example Designations:
---------------------
- House Patron
- Keeper of Reverie House
- The Cheerful
- Known Resident Guardian
- Resident Spectrum Mapper
- Known Reading Ward
- Reading Charge
- Revered Resident Altruist Stylist
- Well-Known Altruist Dreamweaver
- Known Dreaming Reader
- Former Known Ward
"""

import time
import requests
from typing import Optional, Tuple, Dict, Any

# Try to import DatabaseManager, but allow module to work without it for testing
try:
    from core.database import DatabaseManager
    def get_db_manager():
        return DatabaseManager()
except ImportError:
    DatabaseManager = None
    get_db_manager = None


class Designation:
    """Single source of truth for user designation composition."""
    
    # =========================================================================
    # CONSTANTS
    # =========================================================================
    
    # Singular overrides (checked first, no compounding)
    SINGULAR_OVERRIDES = {
        'house_patron': 'House Patron',
        'keeper': 'Keeper of Reverie House'
    }
    
    # Character prefixes (from lore.farm)
    CHARACTER_PREFIXES = {
        'revered': 'Revered',      # can_auto_canon
        'well_known': 'Well-Known', # can_auto_lore
        'known': 'Known'            # has character label
    }
    
    # Exclusive work roles (override base identity, one at a time)
    WORK_ROLES = {
        'guardian': 'Guardian',
        'greeter': 'Greeter of Reveries',
        'mapper': 'Spectrum Mapper',
        'cogitarian': 'Cogitarian',
        'provisioner': 'Provisioner',
        'bursar': 'Bursar'
    }
    
    # Affix roles (can compound with base identity or work roles)
    # Cheerful is a PREFIX: "Cheerful Ward", "Cheerful Guardian"
    # Stylist is a SUFFIX: "Resident Stylist", "Ward Stylist"
    AFFIX_ROLES = {
        'cheerful': {'word': 'Cheerful', 'position': 'prefix'},
        'dreamstyler': {'word': 'Stylist', 'position': 'suffix'}
    }
    
    # Base identities (mutually exclusive, hierarchy: resident > dreamweaver > ward/charge/dreamer)
    # Ward and Charge REPLACE Dreamer but not Dreamweaver or Resident
    BASE_IDENTITIES = {
        'resident': 'Resident',
        'dreamweaver': 'Dreamweaver',
        'ward': 'Ward',        # Replaces dreamer (under protective stewardship)
        'charge': 'Charge',    # Replaces dreamer (under light stewardship)
        'dreamer': 'Dreamer'
    }
    
    # Patronage tiers (amount in cents)
    PATRONAGE_TIERS = {
        'altruist': 15000,  # $150+
        'patron': 1500,     # $15+
        'reader': 1         # $0.01+
    }
    
    # Patronage words vary by context
    PATRONAGE_WORDS = {
        # For suffixes (Resident, Ward, Charge, Dreamer when transforming)
        'suffix': {
            'altruist': 'Altruist',
            'patron': 'Patron',
            'reader': 'Reader'
        },
        # For prefixes (Dreamweaver) and modifiers (work roles)
        'prefix': {
            'altruist': 'Altruist',
            'patron': 'Patron',
            'reader': 'Reading'  # Note: "Reading" not "Reader"
        }
    }
    
    # Points per book for patronage calculation
    POINTS_PER_BOOK = 150  # cents
    
    # =========================================================================
    # MAIN API
    # =========================================================================
    
    @classmethod
    def calculate(cls, did: str, handle: str = None, server: str = None,
                  auth_token: str = None) -> str:
        """
        Calculate the complete designation for a user.
        
        Args:
            did: User's DID (required)
            handle: User's handle (optional, used for base identity)
            server: User's PDS server URL (optional, used for base identity)
            auth_token: OAuth token for checking work roles (optional)
        
        Returns:
            Composed designation string
        """
        print(f"\n🏷️  [Designation] Calculating for {handle or did}")
        
        # Gather all status data
        status_data = cls._gather_status_data(did, handle, server, auth_token)
        
        # Compose the designation
        designation = cls._compose(status_data)
        
        print(f"✅ [Designation] Result: {designation}")
        return designation
    
    @classmethod
    def calculate_and_save(cls, did: str, handle: str = None,
                           server: str = None, auth_token: str = None) -> str:
        """
        Calculate and persist designation to database.
        
        Args:
            did: User's DID (required)
            handle: User's handle (optional)
            server: User's PDS server URL (optional)
            auth_token: OAuth token (optional)
        
        Returns:
            Composed designation string
        """
        designation = cls.calculate(did, handle, server, auth_token)
        cls._save_to_db(did, designation)
        return designation
    
    @classmethod
    def refresh_all(cls, auth_token: str = None) -> Dict[str, str]:
        """
        Recalculate designations for all users in the database.
        
        Returns:
            Dict mapping DID to new designation
        """
        if not get_db_manager:
            raise RuntimeError("Database not available")
        
        db = get_db_manager()
        cursor = db.execute("SELECT did, handle, server FROM dreamers")
        users = cursor.fetchall()
        
        results = {}
        for row in users:
            # Handle both dict-style (psycopg2) and tuple-style results
            if hasattr(row, 'get'):
                did = row.get('did')
                handle = row.get('handle')
                server = row.get('server')
            else:
                did, handle, server = row
                
            try:
                designation = cls.calculate_and_save(did, handle, server, auth_token)
                results[did] = designation
            except Exception as e:
                print(f"❌ [Designation] Error for {did}: {e}")
                results[did] = f"ERROR: {e}"
        
        return results
    
    # =========================================================================
    # COMPOSITION LOGIC
    # =========================================================================
    
    @classmethod
    def _compose(cls, data: Dict[str, Any]) -> str:
        """
        Compose the designation from gathered status data.
        
        Composition order:
        1. Check singular overrides (House Patron, Keeper)
        2. Determine base identity (Resident/Dreamweaver/Ward/Charge/Dreamer)
        3. Check for exclusive work role
        4. Check for affix roles (Cheerful prefix, Stylist suffix)
        5. Build compound designation
        
        New hierarchy:
        - Ward/Charge REPLACE Dreamer (but not Dreamweaver/Resident)
        - Cheerful is a PREFIX affix: "Cheerful Ward", "Cheerful Guardian"
        - Stylist is a SUFFIX affix: "Resident Stylist", "Cheerful Ward Stylist"
        """
        
        # Step 1: Singular overrides
        if data.get('is_house_patron'):
            return cls.SINGULAR_OVERRIDES['house_patron']
        
        if data.get('is_keeper'):
            return cls.SINGULAR_OVERRIDES['keeper']
        
        # Step 2: Get components
        character_prefix = cls._get_character_prefix_from_data(data)
        base_identity = data.get('base_identity', 'dreamer')
        work_role = data.get('work_role')
        patronage_tier = cls._get_patronage_tier_from_data(data)
        is_resident = (base_identity == 'resident')
        is_dreamweaver = (base_identity == 'dreamweaver')
        
        # Check affix roles
        is_cheerful = data.get('is_cheerful', False)
        is_stylist = data.get('is_stylist', False)
        
        # Check stewardship (Ward/Charge) - only affects Dreamers
        is_ward = data.get('is_ward', False)
        is_charge = data.get('is_charge', False)
        
        is_deactivated = data.get('is_deactivated', False)
        
        print(f"   📊 Components: character={character_prefix}, base={base_identity}, "
              f"work={work_role}, patronage={patronage_tier}, resident={is_resident}, "
              f"cheerful={is_cheerful}, stylist={is_stylist}, ward={is_ward}, charge={is_charge}, "
              f"deactivated={is_deactivated}")
        
        # Step 3: Adjust base identity for Ward/Charge (only if Dreamer)
        # Ward/Charge replace Dreamer but NOT Dreamweaver or Resident
        if base_identity == 'dreamer':
            if is_ward:
                base_identity = 'ward'
            elif is_charge:
                base_identity = 'charge'
        
        # Step 4: Build designation based on role type
        designation = None
        
        if work_role:
            # EXCLUSIVE WORK ROLE DESIGNATION
            designation = cls._compose_work_role(
                character_prefix=character_prefix,
                work_role=work_role,
                patronage_tier=patronage_tier,
                is_resident=is_resident,
                is_cheerful=is_cheerful
            )
        
        # BASE IDENTITY DESIGNATION
        elif base_identity == 'resident':
            designation = cls._compose_resident(character_prefix, patronage_tier, is_cheerful)
        
        elif base_identity == 'dreamweaver':
            designation = cls._compose_dreamweaver(character_prefix, patronage_tier, is_cheerful)
        
        elif base_identity == 'ward':
            designation = cls._compose_ward(character_prefix, patronage_tier, is_cheerful)
        
        elif base_identity == 'charge':
            designation = cls._compose_charge(character_prefix, patronage_tier, is_cheerful)
        
        else:  # dreamer
            designation = cls._compose_dreamer(character_prefix, patronage_tier, is_cheerful)
        
        # Step 5: Apply Stylist suffix if applicable
        if is_stylist and designation:
            designation = f"{designation} Stylist"
        
        # Step 6: Apply Former prefix if deactivated
        if is_deactivated and designation:
            designation = f"Former {designation}"
        
        return designation
    
    @classmethod
    def _compose_work_role(cls, character_prefix: Optional[str],
                           work_role: str, patronage_tier: Optional[str],
                           is_resident: bool, is_cheerful: bool = False) -> str:
        """
        Compose work role designation.
        
        Pattern: "[Character?] [Cheerful?] [Resident?] [Patronage?] [Work Role]"
        If Resident: "[Character?] [Cheerful?] Resident [Work Role]"
        Else: "[Character?] [Cheerful?] [Patronage?] [Work Role]"
        """
        role_name = cls.WORK_ROLES.get(work_role, work_role.title())
        
        parts = []
        
        if character_prefix:
            parts.append(cls.CHARACTER_PREFIXES.get(character_prefix, character_prefix.title()))
        
        if is_cheerful:
            parts.append('Cheerful')
        
        if is_resident:
            parts.append('Resident')
        elif patronage_tier:
            parts.append(cls.PATRONAGE_WORDS['prefix'].get(patronage_tier, patronage_tier.title()))
        
        parts.append(role_name)
        
        return ' '.join(parts)
    
    @classmethod
    def _compose_resident(cls, character_prefix: Optional[str],
                          patronage_tier: Optional[str],
                          is_cheerful: bool = False) -> str:
        """
        Compose Resident designation.
        
        "[Character?] [Cheerful?] Resident [Patronage Suffix?]"
        """
        parts = []
        
        if character_prefix:
            parts.append(cls.CHARACTER_PREFIXES.get(character_prefix, character_prefix.title()))
        
        if is_cheerful:
            parts.append('Cheerful')
        
        parts.append('Resident')
        
        if patronage_tier:
            parts.append(cls.PATRONAGE_WORDS['suffix'].get(patronage_tier, patronage_tier.title()))
        
        return ' '.join(parts)
    
    @classmethod
    def _compose_dreamweaver(cls, character_prefix: Optional[str],
                             patronage_tier: Optional[str],
                             is_cheerful: bool = False) -> str:
        """
        Compose Dreamweaver designation.
        
        "[Character?] [Cheerful?] [Patronage Prefix?] Dreamweaver"
        """
        parts = []
        
        if character_prefix:
            parts.append(cls.CHARACTER_PREFIXES.get(character_prefix, character_prefix.title()))
        
        if is_cheerful:
            parts.append('Cheerful')
        
        if patronage_tier:
            parts.append(cls.PATRONAGE_WORDS['prefix'].get(patronage_tier, patronage_tier.title()))
        
        parts.append('Dreamweaver')
        
        return ' '.join(parts)
    
    @classmethod
    def _compose_ward(cls, character_prefix: Optional[str],
                      patronage_tier: Optional[str],
                      is_cheerful: bool = False) -> str:
        """
        Compose Ward designation (replaces Dreamer when under protective stewardship).
        
        Pattern: "[Character?] [Cheerful?] [Patronage Prefix?] Ward"
        e.g., "Known Cheerful Reading Ward", "Cheerful Ward"
        """
        parts = []
        
        if character_prefix:
            parts.append(cls.CHARACTER_PREFIXES.get(character_prefix, character_prefix.title()))
        
        if is_cheerful:
            parts.append('Cheerful')
        
        if patronage_tier:
            parts.append(cls.PATRONAGE_WORDS['prefix'].get(patronage_tier, patronage_tier.title()))
        
        parts.append('Ward')
        
        return ' '.join(parts)
    
    @classmethod
    def _compose_charge(cls, character_prefix: Optional[str],
                        patronage_tier: Optional[str],
                        is_cheerful: bool = False) -> str:
        """
        Compose Charge designation (replaces Dreamer when under light stewardship).
        
        Pattern: "[Character?] [Cheerful?] [Patronage Prefix?] Charge"
        e.g., "Known Cheerful Reading Charge", "Cheerful Charge"
        """
        parts = []
        
        if character_prefix:
            parts.append(cls.CHARACTER_PREFIXES.get(character_prefix, character_prefix.title()))
        
        if is_cheerful:
            parts.append('Cheerful')
        
        if patronage_tier:
            parts.append(cls.PATRONAGE_WORDS['prefix'].get(patronage_tier, patronage_tier.title()))
        
        parts.append('Charge')
        
        return ' '.join(parts)
    
    @classmethod
    def _compose_dreamer(cls, character_prefix: Optional[str],
                         patronage_tier: Optional[str],
                         is_cheerful: bool = False) -> str:
        """
        Compose Dreamer designation.
        
        With patronage: "[Character?] [Cheerful?] Dreaming [Patronage Suffix]"
        Without: "[Character?] [Cheerful?] Dreamer"
        """
        parts = []
        
        if character_prefix:
            parts.append(cls.CHARACTER_PREFIXES.get(character_prefix, character_prefix.title()))
        
        if is_cheerful:
            parts.append('Cheerful')
        
        if patronage_tier:
            # Dreamer transforms to "Dreaming" when has patronage
            parts.append('Dreaming')
            parts.append(cls.PATRONAGE_WORDS['suffix'].get(patronage_tier, patronage_tier.title()))
        else:
            parts.append('Dreamer')
        
        return ' '.join(parts)
    
    # =========================================================================
    # DATA GATHERING
    # =========================================================================
    
    @classmethod
    def _gather_status_data(cls, did: str, handle: str = None,
                            server: str = None, auth_token: str = None) -> Dict[str, Any]:
        """Gather all status information for a user."""
        
        data = {
            'did': did,
            'handle': handle,
            'server': server,
            'is_house_patron': False,
            'is_keeper': False,
            'is_deactivated': False,  # Account deleted/dissipated
            'character_level': None,  # 'revered', 'well_known', 'known', or None
            'work_role': None,        # 'guardian', 'greeter', 'mapper', 'cogitarian', 'provisioner', 'bursar'
            'base_identity': 'dreamer',  # 'resident', 'dreamweaver', 'dreamer'
            'patronage': 0,           # cents
            # Affix roles (can compound)
            'is_cheerful': False,     # Cheerful prefix affix
            'is_stylist': False,      # Dreamstyler (suffix affix)
            # Stewardship status (Ward/Charge replace Dreamer only)
            'is_ward': False,         # Under protective stewardship
            'is_charge': False,       # Under light stewardship
            'guardian_did': None      # Their guardian's DID (if ward/charge)
        }
        
        # Determine base identity from handle/server
        data['base_identity'] = cls._determine_base_identity(handle, server)
        
        # Check if account is deactivated/dissipated
        data['is_deactivated'] = cls._check_deactivated(did)
        
        # Check House Patron status
        data['is_house_patron'] = cls._check_house_patron(did)
        
        # Check Keeper status
        data['is_keeper'] = cls._check_keeper(did)
        
        # Get character level from lore.farm
        data['character_level'] = cls._check_character_level(did)
        
        # Get exclusive work role (guardian, greeter, mapper, cogitarian, provisioner, bursar)
        data['work_role'] = cls._check_work_role(did, auth_token)
        
        # Check affix roles (Cheerful prefix, Stylist suffix)
        affix_data = cls._check_affix_roles(did, auth_token)
        data['is_cheerful'] = affix_data.get('is_cheerful', False)
        data['is_stylist'] = affix_data.get('is_stylist', False)
        
        # Check stewardship status (Ward/Charge)
        stewardship_data = cls._check_stewardship(did)
        data['is_ward'] = stewardship_data.get('is_ward', False)
        data['is_charge'] = stewardship_data.get('is_charge', False)
        data['guardian_did'] = stewardship_data.get('guardian_did')
        
        # Get patronage amount
        data['patronage'] = cls._get_patronage(did)
        
        return data
    
    @classmethod
    def _determine_base_identity(cls, handle: str = None, server: str = None) -> str:
        """Determine base identity from handle and server."""
        
        # Extract PDS host from server URL
        pds_host = None
        if server:
            pds_host = server.replace('https://', '').replace('http://', '').rstrip('/')
        
        # Check for Resident (PDS on reverie.house)
        if pds_host == 'reverie.house':
            return 'resident'
        
        # Check for Dreamweaver (handle ends with .reverie.house)
        if handle and handle.endswith('.reverie.house'):
            return 'dreamweaver'
        
        # Default: Dreamer
        return 'dreamer'
    
    @classmethod
    def _get_character_prefix_from_data(cls, data: Dict[str, Any]) -> Optional[str]:
        """Get character prefix from status data."""
        return data.get('character_level')
    
    @classmethod
    def _get_patronage_tier_from_data(cls, data: Dict[str, Any]) -> Optional[str]:
        """Get patronage tier from status data."""
        patronage = data.get('patronage', 0)
        
        if patronage >= cls.PATRONAGE_TIERS['altruist']:
            return 'altruist'
        elif patronage >= cls.PATRONAGE_TIERS['patron']:
            return 'patron'
        elif patronage >= cls.PATRONAGE_TIERS['reader']:
            return 'reader'
        
        return None
    
    # =========================================================================
    # EXTERNAL CHECKS
    # =========================================================================
    
    @classmethod
    def _check_house_patron(cls, did: str) -> bool:
        """Check if user has highest lifetime patronage."""
        if not get_db_manager:
            return False
        
        try:
            db = get_db_manager()
            
            # Get all book orders
            cursor = db.execute("""
                SELECT did, event FROM events WHERE type = 'order'
            """)
            rows = cursor.fetchall()
            
            if not rows:
                return False
            
            # Calculate patronage for all users
            patronage_by_did = {}
            for row in rows:
                order_did = row['did']
                event = row['event']
                book_count = cls._parse_book_count(event)
                if book_count > 0:
                    patronage_by_did[order_did] = patronage_by_did.get(order_did, 0) + (book_count * cls.POINTS_PER_BOOK)
            
            if not patronage_by_did:
                return False
            
            # Check if this user has highest patronage
            user_patronage = patronage_by_did.get(did, 0)
            if user_patronage > 0 and user_patronage == max(patronage_by_did.values()):
                print(f"   👑 House Patron confirmed (total: {user_patronage} points)")
                return True
            
        except Exception as e:
            print(f"   ⚠️ Could not check House Patron: {e}")
        
        return False
    
    @classmethod
    def _parse_book_count(cls, event_text: str) -> int:
        """Parse book count from order event text."""
        number_words = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'fifteen': 15, 'twenty': 20, 'twenty five': 25,
            'fifty': 50, 'seventy five': 75, 'one hundred': 100
        }
        
        if not event_text or 'realizes' not in event_text or 'book' not in event_text:
            return 0
        
        event_lower = event_text.lower()
        for word, num in number_words.items():
            if word in event_lower:
                return num
        
        return 0
    
    @classmethod
    def _check_keeper(cls, did: str) -> bool:
        """Check if user is Keeper (GM of reverie.house world on lore.farm)."""
        try:
            response = requests.get('https://lore.farm/api/worlds', timeout=5)
            if response.status_code == 200:
                data = response.json()
                worlds = data.get('worlds', [])
                for world in worlds:
                    if world.get('domain') == 'reverie.house':
                        if world.get('gm_did') == did:
                            print(f"   🏰 Keeper of Reverie House confirmed")
                            return True
                        break
        except Exception as e:
            print(f"   ⚠️ Could not check Keeper status: {e}")
        
        return False
    
    @classmethod
    def _check_deactivated(cls, did: str) -> bool:
        """Check if user account is deactivated/dissipated."""
        if not get_db_manager:
            return False
        
        try:
            db = get_db_manager()
            cursor = db.execute(
                "SELECT deactivated FROM dreamers WHERE did = %s",
                (did,)
            )
            row = cursor.fetchone()
            if row and row['deactivated']:
                print(f"   👻 Account is deactivated/dissipated")
                return True
        except Exception as e:
            print(f"   ⚠️ Could not check deactivated status: {e}")
        
        return False
    
    @classmethod
    def _check_character_level(cls, did: str) -> Optional[str]:
        """
        Check character level from lore.farm.
        
        Returns: 'revered', 'well_known', 'known', or None
        """
        try:
            # Check if character is registered
            print(f"   🔍 Checking character registration...")
            response = requests.get(
                'https://lore.farm/api/characters/status',
                params={'did': did, 'world': 'reverie.house'},
                timeout=5
            )
            
            if response.status_code != 200:
                return None
            
            char_data = response.json()
            is_registered = char_data.get('registered', False)
            
            if not is_registered:
                return None
            
            character = char_data.get('character', {})
            print(f"   🎭 Character found: {character.get('name')}")
            
            # Check permissions for level
            try:
                perms_response = requests.get(
                    f'https://lore.farm/api/worlds/reverie.house/permissions?did={did}',
                    timeout=5
                )
                
                if perms_response.status_code == 200:
                    perms_data = perms_response.json()
                    
                    if perms_data.get('can_auto_canon'):
                        print(f"   🎭 Character level: revered")
                        return 'revered'
                    elif perms_data.get('can_auto_lore'):
                        print(f"   🎭 Character level: well_known")
                        return 'well_known'
            except Exception:
                pass
            
            print(f"   🎭 Character level: known")
            return 'known'
            
        except Exception as e:
            print(f"   ⚠️ Could not check character level: {e}")
        
        return None
    
    @classmethod
    def _check_work_role(cls, did: str, auth_token: str = None) -> Optional[str]:
        """
        Check if user has an EXCLUSIVE work role.
        
        Returns: 'guardian', 'greeter', 'mapper', 'cogitarian', 'provisioner', 'bursar', or None
        Priority order: guardian > greeter > mapper > cogitarian > provisioner > bursar
        
        Note: Cheerful is an AFFIX role (handled separately by _check_affix_roles)
        """
        # Exclusive work roles only (Cheerful is an affix)
        roles = ['guardian', 'greeter', 'mapper', 'cogitarian', 'provisioner', 'bursar']
        
        for role in roles:
            try:
                if auth_token:
                    # Authenticated check
                    response = requests.get(
                        f'https://reverie.house/api/work/{role}/status',
                        headers={'Authorization': f'Bearer {auth_token}'},
                        timeout=5
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('is_worker'):
                            print(f"   💼 Work role: {role}")
                            return role
                else:
                    # Public check
                    response = requests.get(
                        f'https://reverie.house/api/work/{role}/info',
                        timeout=5
                    )
                    if response.status_code == 200:
                        data = response.json()
                        workers = data.get('workers', [])
                        if any(w.get('did') == did for w in workers):
                            print(f"   💼 Work role: {role}")
                            return role
            except Exception:
                pass
        
        return None
    
    @classmethod
    def _check_affix_roles(cls, did: str, auth_token: str = None) -> Dict[str, bool]:
        """
        Check if user has any AFFIX roles (Cheerful prefix, Stylist suffix).
        
        These can compound with base identity or work roles.
        """
        result = {
            'is_cheerful': False,
            'is_stylist': False
        }
        
        # Check Cheerful (prefix affix)
        try:
            if auth_token:
                response = requests.get(
                    'https://reverie.house/api/work/cheerful/status',
                    headers={'Authorization': f'Bearer {auth_token}'},
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    result['is_cheerful'] = data.get('is_worker', False)
            else:
                response = requests.get(
                    'https://reverie.house/api/work/cheerful/info',
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    workers = data.get('workers', [])
                    result['is_cheerful'] = any(w.get('did') == did for w in workers)
            
            if result['is_cheerful']:
                print(f"   🌟 Affix: Cheerful")
        except Exception:
            pass
        
        # Check Dreamstyler (becomes Stylist suffix)
        try:
            if auth_token:
                response = requests.get(
                    'https://reverie.house/api/work/dreamstyler/status',
                    headers={'Authorization': f'Bearer {auth_token}'},
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    result['is_stylist'] = data.get('is_worker', False)
            else:
                response = requests.get(
                    'https://reverie.house/api/work/dreamstyler/info',
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    workers = data.get('workers', [])
                    result['is_stylist'] = any(w.get('did') == did for w in workers)
            
            if result['is_stylist']:
                print(f"   🎨 Affix: Stylist")
        except Exception:
            pass
        
        return result
    
    @classmethod
    def _check_stewardship(cls, did: str) -> Dict[str, Any]:
        """
        Check if user is under stewardship (Ward or Charge of a Guardian).
        
        Ward: Under protective stewardship (whitelist filtering)
        Charge: Under light stewardship (blacklist filtering)
        
        Returns dict with is_ward, is_charge, guardian_did
        """
        result = {
            'is_ward': False,
            'is_charge': False,
            'guardian_did': None
        }
        
        if not get_db_manager:
            return result
        
        try:
            db = get_db_manager()
            
            # Check if this DID appears in any guardian's wards or charges arrays
            cursor = db.execute("""
                SELECT guardian_did, 
                       %s = ANY(wards) as is_ward,
                       %s = ANY(charges) as is_charge
                FROM stewardship
                WHERE %s = ANY(wards) OR %s = ANY(charges)
                LIMIT 1
            """, (did, did, did, did))
            
            row = cursor.fetchone()
            if row:
                result['is_ward'] = row['is_ward'] or False
                result['is_charge'] = row['is_charge'] or False
                result['guardian_did'] = row['guardian_did']
                
                if result['is_ward']:
                    print(f"   🛡️ Stewardship: Ward of {result['guardian_did']}")
                elif result['is_charge']:
                    print(f"   ⚡ Stewardship: Charge of {result['guardian_did']}")
        
        except Exception as e:
            print(f"   ⚠️ Could not check stewardship: {e}")
        
        return result
    
    @classmethod
    def _get_patronage(cls, did: str) -> int:
        """Get total patronage amount in points (cents equivalent for tier calculation)."""
        if not get_db_manager:
            return 0
        
        try:
            db = get_db_manager()
            
            # Get all book orders for this user
            cursor = db.execute(
                "SELECT event FROM events WHERE did = %s AND type = 'order'",
                (did,)
            )
            rows = cursor.fetchall()
            
            patronage = 0
            for row in rows:
                book_count = cls._parse_book_count(row['event'])
                patronage += book_count * cls.POINTS_PER_BOOK
            
            if patronage > 0:
                print(f"   💰 Patronage: {patronage} points (${patronage/100:.2f})")
            
            return patronage
            
        except Exception as e:
            print(f"   ⚠️ Could not get patronage: {e}")
        
        return 0
    
    # =========================================================================
    # DATABASE
    # =========================================================================
    
    @classmethod
    def _save_to_db(cls, did: str, designation: str) -> bool:
        """Save designation to database."""
        if not get_db_manager:
            print(f"   ⚠️ Database not available, skipping save")
            return False
        
        try:
            db = get_db_manager()
            db.execute(
                "UPDATE dreamers SET designation = %s, updated_at = %s WHERE did = %s",
                (designation, int(time.time()), did)
            )
            print(f"   💾 Saved to database")
            return True
        except Exception as e:
            print(f"   ❌ Failed to save: {e}")
            return False


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def calculate_designation(did: str, handle: str = None, server: str = None,
                          auth_token: str = None) -> str:
    """Calculate designation for a user."""
    return Designation.calculate(did, handle, server, auth_token)


def calculate_and_save_designation(did: str, handle: str = None,
                                   server: str = None, auth_token: str = None) -> str:
    """Calculate and save designation for a user."""
    return Designation.calculate_and_save(did, handle, server, auth_token)


# =============================================================================
# CLI
# =============================================================================

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python designation.py <did> [handle] [server]")
        print("\nExamples:")
        print("  python designation.py did:plc:abc123")
        print("  python designation.py did:plc:abc123 user.reverie.house")
        print("  python designation.py did:plc:abc123 user.bsky.social https://bsky.social")
        sys.exit(1)
    
    did = sys.argv[1]
    handle = sys.argv[2] if len(sys.argv) > 2 else None
    server = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = Designation.calculate(did, handle, server)
    print(f"\nFinal designation: {result}")
