"""
User Status Calculator
Determines user status/role and saves it to the database
"""

import requests
import sqlite3
import time
from pathlib import Path
import os

def get_db_path():
    """Get the path to the reverie.db database"""
    try:
        from config import Config
        return Path(Config.DATA_DIR) / 'reverie.db'
    except ImportError:
        # Fallback
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return Path(project_root) / 'data' / 'reverie.db'


def calculate_user_status(did, handle, server=None, auth_token=None):
    """
    Calculate user status based on roles and permissions
    
    Priority order:
    1. House Patron (highest patronage score)
    2. Keeper of Reverie House (world GM)
    3. Greeter of Reveries (active greeter)
    4. Spectrum Mapper (active mapper)
    5. Cogitarian (Prime) (active cogitarian)
    6. Character status (Revered/Well-Known/Known)
    7. Base status (resident/dreamweaver/dreamer)
    8. Patron tier suffix (added if patronage > 0):
       - Reader: patronage < 1500 cents ($15)
       - Patron: 1500 <= patronage < 15000 cents ($15-$150)
       - Altruist: patronage >= 15000 cents ($150+)
    
    Returns: status string
    """
    status_data = {
        'is_keeper': False,
        'is_greeter': False,
        'is_mapper': False,
        'is_cogitarian': False,
        'is_character': False,
        'character_level': None,
        'pds_host': server.replace('https://', '').replace('http://', '') if server else None,
        'patronage': 0,
        'is_great_patron': False
    }
    
    # Check patronage and Great Patron status
    try:
        db_path = get_db_path()
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Calculate this user's patronage from canon table
        cursor.execute("""
            SELECT event FROM canon WHERE type = 'order' AND did = ?
        """, (did,))
        order_data = cursor.fetchall()
        
        POINTS_PER_BOOK = 150  # Flat contribution points per book
        patronage = 0
        number_words = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'fifteen': 15, 'twenty': 20, 'twenty five': 25,
            'fifty': 50, 'seventy five': 75, 'one hundred': 100
        }
        
        for row in order_data:
            event = row['event']
            if 'realizes' in event and 'book' in event:
                for word, num in number_words.items():
                    if word in event.lower():
                        patronage += num * POINTS_PER_BOOK
                        break
        
        status_data['patronage'] = patronage
        
        # Check if this user has the highest patronage (Great Patron)
        if patronage > 0:
            # Get all patronage scores
            cursor.execute("""
                SELECT did, event FROM canon WHERE type = 'order'
            """)
            all_orders = cursor.fetchall()
            
            patronage_by_did = {}
            for row in all_orders:
                event = row['event']
                order_did = row['did']
                if 'realizes' in event and 'book' in event:
                    for word, num in number_words.items():
                        if word in event.lower():
                            patronage_by_did[order_did] = patronage_by_did.get(order_did, 0) + (num * POINTS_PER_BOOK)
                            break
            
            # Check if current user has the highest patronage
            if patronage_by_did:
                max_patronage = max(patronage_by_did.values())
                if patronage == max_patronage:
                    # Check if there are ties
                    top_patrons = [d for d, p in patronage_by_did.items() if p == max_patronage]
                    if len(top_patrons) == 1:
                        status_data['is_great_patron'] = True
        
        conn.close()
        
    except Exception as e:
        print(f"Warning: Could not check patronage status: {e}")
    
    # Check Keeper status
    try:
        response = requests.get('https://lore.farm/api/worlds', timeout=5)
        if response.status_code == 200:
            data = response.json()
            reverie_world = next((w for w in data.get('worlds', []) if w.get('domain') == 'reverie.house'), None)
            if reverie_world and reverie_world.get('gm_did') == did:
                status_data['is_keeper'] = True
    except Exception as e:
        print(f"Warning: Could not check Keeper status: {e}")
    
    # Check character status via registration API
    try:
        print(f"  🔍 Checking character registration for {did}")
        response = requests.get(
            f'https://lore.farm/api/characters/status',
            params={'did': did, 'world': 'reverie.house'},
            timeout=5
        )
        if response.status_code == 200:
            char_data = response.json()
            is_registered = char_data.get('registered', False)
            
            print(f"  🎭 Character registered: {is_registered}")
            
            if is_registered:
                character = char_data.get('character', {})
                print(f"  ✅ Character: {character.get('name')}")
                
                status_data['is_character'] = True
                status_data['character_level'] = 'known'  # Default
                
                # Check permissions for character level
                try:
                    perms_response = requests.get(
                        f'https://lore.farm/api/worlds/reverie.house/permissions?did={did}',
                        timeout=5
                    )
                    if perms_response.status_code == 200:
                        perms_data = perms_response.json()
                        can_auto_canon = perms_data.get('can_auto_canon', False)
                        can_auto_lore = perms_data.get('can_auto_lore', False)
                        
                        print(f"  🔐 Permissions: auto_canon={can_auto_canon}, auto_lore={can_auto_lore}")
                        
                        if can_auto_canon:
                            status_data['character_level'] = 'revered'
                        elif can_auto_lore:
                            status_data['character_level'] = 'well-known'
                        
                        print(f"  🎖️ Character level: {status_data['character_level']}")
                except Exception as e:
                    print(f"  ⚠️ Could not check character permissions: {e}")
            else:
                print(f"  ❌ Not registered as character")
    except Exception as e:
        print(f"  ⚠️ Could not check character registration: {e}")
    
    # Check worker roles
    if auth_token:
        # Use authenticated endpoints
        headers = {'Authorization': f'Bearer {auth_token}'}
        base_url = 'https://reverie.house'  # Adjust if needed
        
        try:
            # Check greeter status
            greeter_response = requests.get(f'{base_url}/api/work/greeter/status', headers=headers, timeout=5)
            if greeter_response.status_code == 200:
                greeter_data = greeter_response.json()
                status_data['is_greeter'] = greeter_data.get('is_greeter', False)
        except Exception:
            pass
        
        try:
            # Check mapper status
            mapper_response = requests.get(f'{base_url}/api/work/mapper/status', headers=headers, timeout=5)
            if mapper_response.status_code == 200:
                mapper_data = mapper_response.json()
                status_data['is_mapper'] = mapper_data.get('is_mapper', False)
        except Exception:
            pass
        
        try:
            # Check cogitarian status
            cog_response = requests.get(f'{base_url}/api/work/cogitarian/status', headers=headers, timeout=5)
            if cog_response.status_code == 200:
                cog_data = cog_response.json()
                status_data['is_cogitarian'] = cog_data.get('is_cogitarian', False)
        except Exception:
            pass
    else:
        # Use public endpoints to check if DID is in worker list
        base_url = 'https://reverie.house'
        
        try:
            greeter_response = requests.get(f'{base_url}/api/work/greeter/info', timeout=5)
            if greeter_response.status_code == 200:
                greeter_data = greeter_response.json()
                workers = greeter_data.get('workers', [])
                status_data['is_greeter'] = any(w.get('did') == did for w in workers)
        except Exception:
            pass
        
        try:
            mapper_response = requests.get(f'{base_url}/api/work/mapper/info', timeout=5)
            if mapper_response.status_code == 200:
                mapper_data = mapper_response.json()
                workers = mapper_data.get('workers', [])
                status_data['is_mapper'] = any(w.get('did') == did for w in workers)
        except Exception:
            pass
        
        try:
            cog_response = requests.get(f'{base_url}/api/work/cogitarian/info', timeout=5)
            if cog_response.status_code == 200:
                cog_data = cog_response.json()
                workers = cog_data.get('workers', [])
                status_data['is_cogitarian'] = any(w.get('did') == did for w in workers)
        except Exception:
            pass
    
    # Determine role/title (highest priority role)
    role_title = None
    if status_data['is_great_patron']:
        role_title = 'House Patron'
    elif status_data['is_keeper']:
        role_title = 'Keeper of Reverie House'
    elif status_data['is_greeter']:
        role_title = 'Greeter of Reveries'
    elif status_data['is_mapper']:
        role_title = 'Spectrum Mapper'
    elif status_data['is_cogitarian']:
        role_title = 'Cogitarian (Prime)'
    else:
        # Determine base status if no role
        if status_data['pds_host'] == 'reverie.house':
            role_title = 'resident'
        elif handle and handle.endswith('.reverie.house'):
            role_title = 'dreamweaver'
        else:
            role_title = 'dreamer'
    
    print(f"  📊 Role determined: {role_title}")
    print(f"  🎭 Character level: {status_data.get('character_level', 'None')}")
    print(f"  💰 Patronage: {status_data.get('patronage', 0)} cents")
    
    # Add character prefix if applicable (can prefix ANY role except House Patron)
    if status_data['character_level'] and not status_data['is_great_patron']:
        prefixes = {
            'known': 'Known',
            'well-known': 'Well-Known',
            'revered': 'Revered'
        }
        prefix = prefixes.get(status_data['character_level'], '')
        if prefix:
            # Capitalize role_title only if it's a base status (lowercase)
            if role_title in ['resident', 'dreamweaver', 'dreamer']:
                role_title = role_title.capitalize()
            role_title = f'{prefix} {role_title}'
    
    # Add tiered patron suffix if they have patronage (but not if they're already House Patron)
    if status_data['patronage'] > 0 and not status_data['is_great_patron']:
        # Capitalize base statuses before adding patron suffix
        if role_title in ['resident', 'dreamweaver', 'dreamer']:
            role_title = role_title.capitalize()
        
        # Determine patron tier based on patronage amount
        patronage = status_data['patronage']
        if patronage >= 15000:
            patron_tier = 'Altruist'
        elif patronage >= 1500:
            patron_tier = 'Patron'
        else:
            patron_tier = 'Reader'
        
        role_title = f'{role_title} {patron_tier}'
    
    print(f"  ✅ Final status: {role_title}")
    return role_title


def update_user_status_in_db(did, status):
    """
    Update the status field in the dreamers table
    
    Args:
        did: User's DID
        status: Status string to save
    """
    try:
        db_path = get_db_path()
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE dreamers SET status = ?, updated_at = ? WHERE did = ?",
            (status, int(time.time()), did)
        )
        
        conn.commit()
        conn.close()
        
        print(f"✅ Updated status for {did}: {status}")
        return True
    except Exception as e:
        print(f"❌ Error updating status in database: {e}")
        return False


def calculate_and_save_status(did, handle, server=None, auth_token=None):
    """
    Calculate user status and save it to the database
    
    Args:
        did: User's DID
        handle: User's handle
        server: User's PDS server URL (optional)
        auth_token: OAuth token for checking worker status (optional)
    
    Returns:
        status string
    """
    import time
    
    print(f"🔄 Calculating status for {handle} ({did})")
    status = calculate_user_status(did, handle, server, auth_token)
    print(f"✅ Calculated status: {status}")
    
    update_user_status_in_db(did, status)
    
    return status
