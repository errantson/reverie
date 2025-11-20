#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Quest Commands - Command execution for quest actions

Executes commands when quest conditions are met.
"""

import time
from datetime import datetime
from typing import List, Dict
from core.database import DatabaseManager
from core.network import NetworkClient
from utils.names import NameManager
from utils.registration import register_dreamer


def iso_to_unix(iso_timestamp: str) -> int:
    """
    Convert ISO8601 timestamp string to unix timestamp integer.
    
    Bluesky returns timestamps like: '2025-05-03T15:35:06.069Z'
    We need to store them as unix timestamps in the database.
    
    Args:
        iso_timestamp: ISO8601 formatted timestamp string
        
    Returns:
        Unix timestamp as integer
    """
    if not iso_timestamp:
        return int(time.time())
    
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        return int(dt.timestamp())
    except (ValueError, AttributeError):
        # Fallback to current time if parsing fails
        return int(time.time())


def execute_quest_commands(commands: List[str], replies: List[Dict], 
                          quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Execute a list of quest commands.
    
    Args:
        commands: List of command strings (e.g., ['name_dreamer', 'like_post'])
        replies: List of reply objects that matched the condition
        quest_config: Quest configuration dictionary
        verbose: Whether to print output
        
    Returns:
        {
            'success': bool,
            'commands_executed': List[str],
            'errors': List[str]
        }
    """
    result = {
        'success': True,
        'commands_executed': [],
        'errors': []
    }
    
    for command in commands:
        try:
            if ':' in command:
                cmd_name, param = command.split(':', 1)
            else:
                cmd_name, param = command, None
            
            if cmd_name == 'name_dreamer':
                # Support forced name: name_dreamer:watson
                forced_name = param if param else None
                cmd_result = name_dreamer(replies, quest_config, forced_name=forced_name, verbose=verbose)
            elif cmd_name == 'add_kindred':
                cmd_result = add_kindred(replies, quest_config, verbose=verbose)
            elif cmd_name == 'mod_spectrum':
                multiplier = float(param) if param else 1.0
                cmd_result = mod_spectrum(replies, quest_config, multiplier=multiplier, verbose=verbose)
            elif cmd_name == 'like_post':
                cmd_result = like_post(replies, quest_config, verbose=verbose)
            elif cmd_name == 'add_canon':
                # Support: add_canon:key:event or add_canon:key:event:type
                if param and ':' in param:
                    parts = param.split(':', 2)
                    canon_key = parts[0]
                    canon_event = parts[1] if len(parts) > 1 else 'event occurred'
                    canon_type = parts[2] if len(parts) > 2 else 'event'
                    cmd_result = add_canon(replies, quest_config, canon_key, canon_event, canon_type, verbose=verbose)
                else:
                    result['errors'].append(f"Invalid add_canon format: {command}")
                    result['success'] = False
                    continue
            elif cmd_name == 'add_name':
                # Support: add_name:watson
                new_name = param if param else None
                if new_name:
                    cmd_result = add_name(replies, quest_config, new_name, verbose=verbose)
                else:
                    result['errors'].append(f"Invalid add_name format: {command}")
                    result['success'] = False
                    continue
            elif cmd_name == 'register_if_needed':
                # Support: register_if_needed (simple registration, no "spoke their name")
                cmd_result = register_if_needed(replies, quest_config, verbose=verbose)
            elif cmd_name == 'award_souvenir':
                # Support: award_souvenir:letter
                souvenir_key = param if param else None
                if souvenir_key:
                    cmd_result = award_souvenir(replies, quest_config, souvenir_key, verbose=verbose)
                else:
                    result['errors'].append(f"Invalid award_souvenir format: {command}")
                    result['success'] = False
                    continue
            elif cmd_name == 'disable_quest':
                # Support: disable_quest (disables the current quest after execution)
                cmd_result = disable_quest(replies, quest_config, verbose=verbose)
            elif cmd_name == 'reply_origin_spectrum':
                # Support: reply_origin_spectrum (replies with origin spectrum values)
                cmd_result = reply_origin_spectrum(replies, quest_config, verbose=verbose)
            elif cmd_name == 'greet_newcomer':
                # Support: greet_newcomer (greets newly named dreamers)
                from ops.commands.greet_newcomer import greet_newcomer
                cmd_result = greet_newcomer(replies, quest_config, verbose=verbose)
            else:
                result['errors'].append(f"Unknown command: {cmd_name}")
                result['success'] = False
                continue
            
            if cmd_result.get('success'):
                result['commands_executed'].append(cmd_name)
            else:
                result['errors'].extend(cmd_result.get('errors', []))
                result['success'] = False
                
        except Exception as e:
            result['errors'].append(f"Error executing {command}: {e}")
            result['success'] = False
    
    return result


def name_dreamer(replies: List[Dict], quest_config: Dict, forced_name: str = None, verbose: bool = False) -> Dict:
    """
    Extract name from reply and register/update dreamer (namegiver quest).
    
    Handles multiple entry paths:
    1. New user (no dreamer record) → Full registration with "spoke their name" canon
    2. OAuth user with auto-name → Add "spoke their name" canon, optionally rename
    3. Existing user wanting new name → Add to alts, add canon if not present
    4. User re-speaking same name → Just add canon if not present (idempotent)
    
    ONE-TIME USE per dreamer: Only creates 'name' canon once, but may update name/alts.
    
    Args:
        forced_name: If provided, use this name instead of extracting from reply.
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    network = NetworkClient()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            author_handle = reply['author']['handle']
            reply_text = reply['record']['text']
            reply_uri = reply['uri']
            reply_created_at = reply['record'].get('createdAt', '')
            
            # Extract proposed name (always lowercase for namegiver)
            if forced_name:
                proposed_name = forced_name.lower()
            else:
                proposed_name = reply_text.strip().split('\n')[0][:50].strip().lower()
            
            # Check if dreamer already has a "spoke their name" canon entry
            cursor = db.execute("""
                SELECT did FROM canon 
                WHERE did = ? AND type = 'name' AND key LIKE '%name%'
            """, (author_did,))
            has_name_canon = cursor.fetchone()
            
            # Check if dreamer exists (might be from OAuth or previous registration)
            cursor = db.execute("SELECT did, name, alts FROM dreamers WHERE did = %s", (author_did,))
            existing = cursor.fetchone()
            
            # Check if dreamer exists (might be from OAuth or previous registration)
            cursor = db.execute("SELECT did, name, alts FROM dreamers WHERE did = %s", (author_did,))
            existing = cursor.fetchone()
            
            # CASE 1: User already has "spoke their name" canon
            # They've completed namegiver before - truly skip
            if has_name_canon:
                if verbose:
                    print(f"   ℹ️  Already has 'spoke their name' canon, skipping")
                result['success'] = True
                continue
            
            # CASE 2: User doesn't exist at all
            # Full registration with "spoke their name" canon
            if not existing:
                profile = network.get_profile(author_did)
                if not profile:
                    result['errors'].append(f"Could not fetch profile for {author_handle}")
                    continue
                
                reply_url = reply_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
                
                # Parse reply timestamp for the "spoke their name" canon entry
                # Parse reply timestamp using helper
                reply_epoch = iso_to_unix(reply_created_at)
                
                canon_entries = [
                    {
                        'event': 'found our wild mindscape',
                        'type': 'arrival',
                        'key': 'arrival',
                        'uri': f"{author_did}/app.bsky.actor.profile/self",
                        'url': f"https://bsky.app/profile/{author_did}"
                    },
                    {
                        'event': 'spoke their name',
                        'type': 'name',
                        'key': 'name',
                        'uri': reply_uri,
                        'url': reply_url,
                        'epoch': reply_epoch
                    }
                ]
                
                reg_result = register_dreamer(
                    did=author_did,
                    handle=author_handle,
                    profile=profile,
                    proposed_name=proposed_name,
                    canon_entries=canon_entries,
                    verbose=verbose
                )
                
                if not reg_result['success']:
                    result['errors'].extend(reg_result['errors'])
                    continue
                
                dreamer = reg_result['dreamer']
                
                if verbose:
                    print(f"   🧙 NEW DREAMER: {dreamer['name']} (@{author_handle})")
                
                result['success'] = True
                continue
            
            # CASE 3: User exists (from OAuth or other), needs "spoke their name" canon
            # Sub-cases: same name, different name, name already taken
            
            current_name = existing['name']
            current_alts = existing['alts'] or ''
            alt_list = [a.strip() for a in current_alts.split(',') if a.strip()]
            
            # Sub-case 3a: They're speaking the exact same name they already have
            # Just add the canon entry (OAuth users confirming their auto-name)
            if proposed_name == current_name:
                reply_url = reply_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
                
                # Parse reply timestamp
                # Parse reply timestamp using helper
                reply_epoch = iso_to_unix(reply_created_at)
                
                if not reply_epoch:
                    reply_epoch = int(time.time())
                
                # Add "spoke their name" canon entry
                db.execute("""
                    INSERT INTO canon (did, event, type, key, uri, url, epoch, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    author_did,
                    'spoke their name',
                    'name',
                    'name',
                    reply_uri,
                    reply_url,
                    reply_epoch,
                    int(time.time())
                ))
                
                db.commit()
                
                if verbose:
                    print(f"   ✅ Confirmed name: {current_name}")
                
                result['success'] = True
                continue
            
            # Sub-case 3b: They're proposing a different name
            # Check if it's already taken by someone else
            cursor = db.execute("""
                SELECT did, name FROM dreamers 
                WHERE name = ? AND did != ?
            """, (proposed_name, author_did))
            name_owner = cursor.fetchone()
            
            if name_owner:
                # Name is taken - add canon but keep current name
                if verbose:
                    print(f"   ⚠️  Name '{proposed_name}' already taken by {name_owner['name']}")
                    print(f"   ℹ️  Keeping current name: {current_name}")
                
                reply_url = reply_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
                
                # Parse reply timestamp using helper
                reply_epoch = iso_to_unix(reply_created_at)
                
                # Add canon with CURRENT name (not proposed)
                db.execute("""
                    INSERT INTO canon (did, event, type, key, uri, url, epoch, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    author_did,
                    'spoke their name',
                    'name',
                    'name',
                    reply_uri,
                    reply_url,
                    reply_epoch,
                    int(time.time())
                ))
                
                db.commit()
                
                result['success'] = True
                continue
            
            # Sub-case 3c: Different name, available - rename and add to alts
            if proposed_name in alt_list:
                # They already have it as an alt - just confirm
                if verbose:
                    print(f"   ℹ️  '{proposed_name}' already in alts, keeping {current_name}")
            else:
                # Move current name to alts, adopt new name
                if current_name not in alt_list:
                    alt_list.append(current_name)
                
                new_alts = ','.join(alt_list)
                
                db.execute("""
                    UPDATE dreamers 
                    SET name = ?, alts = ?, updated_at = ?
                    WHERE did = ?
                """, (proposed_name, new_alts, int(time.time()), author_did))
                
                if verbose:
                    print(f"   🔄 Renamed: {current_name} → {proposed_name}")
                    print(f"      Old name in alts: {new_alts}")
            
            # Add "spoke their name" canon entry with NEW name
            reply_url = reply_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
            
            reply_epoch = None
            # Parse reply timestamp using helper
            reply_epoch = iso_to_unix(reply_created_at)
            
            db.execute("""
                INSERT INTO canon (did, event, type, key, uri, url, epoch, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                author_did,
                'spoke their name',
                'name',
                'name',
                reply_uri,
                reply_url,
                reply_epoch,
                int(time.time())
            ))
            
            db.commit()
            
            # Rebuild Caddy for subdomain changes
            if proposed_name != current_name:
                try:
                    import subprocess
                    subprocess.run(['python3', '/srv/caddy/caddybuilder.py'], 
                                 capture_output=True, timeout=30)
                    if verbose:
                        print(f"   ✅ Caddy rebuilt for subdomains")
                except Exception as e:
                    if verbose:
                        print(f"   ⚠️  Caddy rebuild error: {e}")
            
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error naming dreamer: {e}")
            if verbose:
                import traceback
                traceback.print_exc()
    
    # Try to like the reply posts
    try:
        like_result = like_post(replies, quest_config, verbose=verbose)
        if not like_result.get('success') and verbose:
            print(f"   ⚠️  Failed to like posts: {like_result.get('errors')}")
    except Exception as e:
        if verbose:
            print(f"   ⚠️  Error liking posts: {e}")
    
    return result


def register_if_needed(replies: List[Dict], quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Simple registration for quest participants (letter quests, etc).
    Creates ONLY "arrival" canon - no "spoke their name".
    Skips if user already registered.
    
    Different from name_dreamer which creates "spoke their name" canon.
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    network = NetworkClient()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            author_handle = reply['author']['handle']
            reply_text = reply['record']['text']
            reply_uri = reply['uri']
            
            # Check if dreamer already registered
            cursor = db.execute("SELECT did, name FROM dreamers WHERE did = %s", (author_did,))
            existing = cursor.fetchone()
            
            if existing:
                if verbose:
                    print(f"   ℹ️  Already registered as {existing['name']}, skipping")
                result['success'] = True
                continue
            
            # Extract name from reply text (first line, up to 50 chars)
            proposed_name = reply_text.strip().split('\n')[0][:50].strip()
            
            profile = network.get_profile(author_did)
            if not profile:
                result['errors'].append(f"Could not fetch profile for {author_handle}")
                continue
            
            # Simple registration: ONLY arrival canon (no "spoke their name")
            canon_entries = [{
                'event': 'found our wild mindscape',
                'type': 'arrival',
                'key': 'arrival',
                'uri': f"{author_did}/app.bsky.actor.profile/self",
                'url': f"https://bsky.app/profile/{author_did}"
            }]
            
            reg_result = register_dreamer(
                did=author_did,
                handle=author_handle,
                profile=profile,
                proposed_name=proposed_name,
                canon_entries=canon_entries,
                verbose=verbose
            )
            
            if not reg_result['success']:
                result['errors'].extend(reg_result['errors'])
                continue
            
            dreamer = reg_result['dreamer']
            
            if verbose:
                print(f"   ✅ Registered: {dreamer['name']} (@{author_handle})")
            
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error registering user: {e}")
            if verbose:
                import traceback
                traceback.print_exc()
    
    return result


def add_kindred(replies: List[Dict], quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Extract mentions from reply and add kindred relationships.
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            reply_text = reply['record']['text']
            
            import re
            mentions = re.findall(r'@([a-zA-Z0-9.-]+)', reply_text)
            
            if not mentions:
                continue
            
            for handle in mentions:
                cursor = db.execute("SELECT did FROM dreamers WHERE handle = %s", (handle,))
                row = cursor.fetchone()
                
                if not row:
                    continue
                
                target_did = row['did']
                
                did_a, did_b = sorted([author_did, target_did])
                epoch = int(time.time())
                
                db.execute("""
                    INSERT OR IGNORE INTO kindred (did_a, did_b, discovered_epoch)
                    VALUES (?, ?, ?)
                """, (did_a, did_b, epoch))
                
                if verbose:
                    print(f"   🤝 Added kindred: {author_did[:12]}... <-> {target_did[:12]}...")
            
            db.commit()
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error adding kindred: {e}")
            db.rollback()
    
    return result


def mod_spectrum(replies: List[Dict], quest_config: Dict, 
                multiplier: float = 1.0, verbose: bool = False) -> Dict:
    """
    Analyze reply text and modify spectrum based on content.
    """
    result = {'success': False, 'errors': []}
    
    try:
        from utils.spectrum import SpectrumManager
    except ImportError:
        result['errors'].append("Spectrum utilities not available")
        return result
    
    db = DatabaseManager()
    spectrum_mgr = SpectrumManager(db)
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            reply_text = reply['record']['text']
            reply_uri = reply['uri']
            
            
            modifications = analyze_text_for_spectrum(reply_text, multiplier)
            
            if not modifications:
                continue
            
            # Apply modifications
            cursor = db.execute("SELECT * FROM spectrum WHERE did = %s", (author_did,))
            current = cursor.fetchone()
            
            if current:
                # Update existing spectrum
                updates = []
                values = []
                for axis, change in modifications.items():
                    new_value = (current[axis] or 0) + change
                    updates.append(f"{axis} = ?")
                    values.append(new_value)
                
                values.append(int(time.time()))
                values.append(author_did)
                
                db.execute(f"""
                    UPDATE spectrum 
                    SET {', '.join(updates)}, updated_at = ?
                    WHERE did = ?
                """, tuple(values))
            else:
                # Create new spectrum entry
                db.execute("""
                    INSERT INTO spectrum (did, entropy, oblivion, liberty, authority, receptive, skeptic, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    author_did,
                    modifications.get('entropy', 0),
                    modifications.get('oblivion', 0),
                    modifications.get('liberty', 0),
                    modifications.get('authority', 0),
                    modifications.get('receptive', 0),
                    modifications.get('skeptic', 0),
                    int(time.time())
                ))
            
            # Create canon entry
            canon_config = quest_config.get('canon', {})
            canon_event = canon_config.get('event', 'recalls their last dream')
            
            db.execute("""
                INSERT INTO canon (did, event, epoch, uri, type, key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                author_did,
                canon_event,
                int(time.time()),
                reply_uri,
                'spectrum',
                'lastdream',
                int(time.time())
            ))
            
            db.commit()
            
            if verbose:
                mod_str = ', '.join(f"{k}: {v:+d}" for k, v in modifications.items())
                print(f"   🌈 Spectrum modified: {mod_str}")
            
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error modifying spectrum: {e}")
            db.rollback()
    
    return result


def analyze_text_for_spectrum(text: str, multiplier: float = 1.0) -> Dict[str, int]:
    """
    Simple keyword-based spectrum analysis.
    In production, this would use proper semantic analysis.
    """
    text_lower = text.lower()
    modifications = {}
    
    # Keywords for each axis (simplified)
    keywords = {
        'entropy': ['chaos', 'random', 'wild', 'unpredictable', 'creative'],
        'oblivion': ['forget', 'loss', 'memory', 'fade', 'disappear'],
        'liberty': ['free', 'freedom', 'independent', 'escape', 'release'],
        'authority': ['control', 'order', 'structure', 'discipline', 'rule'],
        'receptive': ['open', 'accept', 'listen', 'receive', 'welcome'],
        'skeptic': ['doubt', 'question', 'critical', 'challenge', 'suspicious']
    }
    
    # Count keyword matches
    for axis, words in keywords.items():
        count = sum(1 for word in words if word in text_lower)
        if count > 0:
            # Apply multiplier
            value = int(count * 5 * multiplier)
            modifications[axis] = value
    
    return modifications


def like_post(replies: List[Dict], quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Like all reply posts.
    """
    result = {'success': False, 'errors': []}
    
    network = NetworkClient()
    
    for reply in replies:
        try:
            reply_uri = reply['uri']
            
            if network.create_like(reply_uri):
                result['success'] = True
                if verbose:
                    print(f"   💚 Liked post")
            else:
                result['errors'].append(f"Failed to like {reply_uri}")
                
        except Exception as e:
            result['errors'].append(f"Error liking post: {e}")
    
    return result


def add_canon(replies: List[Dict], quest_config: Dict, canon_key: str, 
              canon_event: str, canon_type: str = 'event', verbose: bool = False) -> Dict:
    """
    Add canon entry for quest reply authors.
    IDEMPOTENT: Won't create duplicates if same type/key already exists for dreamer.
    
    Args:
        canon_key: The canon key/tag (e.g., 'bell', 'watson', 'invite')
        canon_event: The event description (e.g., 'answered the call', 'received a letter')
        canon_type: The canon type (e.g., 'event', 'souvenir') - defaults to 'event'
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            author_handle = reply['author']['handle']
            reply_uri = reply['uri']
            
            # Convert URI to URL
            reply_url = reply_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
            
            # Get reply timestamp and convert to unix timestamp
            reply_created_at = reply.get('record', {}).get('createdAt', '')
            reply_epoch = iso_to_unix(reply_created_at)
            
            # Check if dreamer exists
            cursor = db.execute("SELECT did, name FROM dreamers WHERE did = %s", (author_did,))
            dreamer = cursor.fetchone()
            
            if not dreamer:
                result['errors'].append(f"Dreamer not found: {author_handle}")
                continue
            
            # IDEMPOTENCY CHECK: Does this canon entry already exist?
            cursor = db.execute("""
                SELECT id FROM canon 
                WHERE did = ? AND type = ? AND key = ?
            """, (author_did, canon_type, canon_key))
            
            existing = cursor.fetchone()
            
            if existing:
                if verbose:
                    print(f"   ℹ️  Canon already exists: {dreamer['name']} {canon_event}")
                result['success'] = True
                continue
            
            # Add canon entry
            db.execute("""
                INSERT INTO canon (did, event, type, key, uri, url, epoch, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                author_did,
                canon_event,
                canon_type,
                canon_key,
                reply_uri,
                reply_url,
                reply_epoch,
                int(time.time())
            ))
            
            db.commit()
            
            if verbose:
                print(f"   📖 Canon: {dreamer['name']} {canon_event}")
            
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error adding canon: {e}")
            db.rollback()
            if verbose:
                import traceback
                traceback.print_exc()
    
    return result


def add_name(replies: List[Dict], quest_config: Dict, new_name: str, 
             verbose: bool = False) -> Dict:
    """
    Quest reward: Add a new name to a dreamer (pushes old name to alts).
    NO RESTRICTIONS - can be used multiple times for quest rewards.
    
    This is "deserves a new name" - a reward, not initial registration.
    
    Args:
        new_name: The new name to grant (e.g., 'watson', 'seeker')
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    network = NetworkClient()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            author_handle = reply['author']['handle']
            
            # Check if dreamer exists
            cursor = db.execute("SELECT did, name, alts FROM dreamers WHERE did = %s", (author_did,))
            dreamer = cursor.fetchone()
            
            if not dreamer:
                # Dreamer doesn't exist - register them with new_name as primary
                if verbose:
                    print(f"   ℹ️  Dreamer not registered, registering as {new_name}")
                
                profile = network.get_profile(author_did)
                if not profile:
                    result['errors'].append(f"Could not fetch profile for {author_handle}")
                    continue
                
                reply_uri = reply['uri']
                reply_url = reply_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
                
                canon_config = quest_config.get('canon', {})
                canon_event = canon_config.get('event', 'deserves a new name')
                canon_keys = canon_config.get('keys', [new_name])
                canon_key_str = ','.join(canon_keys) if isinstance(canon_keys, list) else canon_keys
                
                canon_entries = [
                    {
                        'event': 'found our wild mindscape',
                        'type': 'arrival',
                        'key': 'arrival',
                        'uri': f"{author_did}/app.bsky.actor.profile/self",
                        'url': f"https://bsky.app/profile/{author_did}"
                    },
                    {
                        'event': canon_event,
                        'type': 'quest_reward',
                        'key': canon_key_str,
                        'uri': reply_uri,
                        'url': reply_url
                    }
                ]
                
                reg_result = register_dreamer(
                    did=author_did,
                    handle=author_handle,
                    profile=profile,
                    proposed_name=new_name,
                    canon_entries=canon_entries,
                    verbose=verbose
                )
                
                if not reg_result['success']:
                    result['errors'].extend(reg_result['errors'])
                    continue
                
                if verbose:
                    print(f"   ✨ Registered new dreamer: {new_name}")
                
                # Rebuild Caddy for new subdomain
                try:
                    import subprocess
                    subprocess.run(['python3', '/srv/caddy/caddybuilder.py'], 
                                 capture_output=True, timeout=30)
                except Exception as e:
                    if verbose:
                        print(f"   ⚠️  Caddy rebuild error: {e}")
                
                result['success'] = True
                continue
            
            # Dreamer exists - rename them (old name → alts)
            current_name = dreamer['name']
            
            # Check if this is already their primary name
            if current_name == new_name:
                if verbose:
                    print(f"   ℹ️  {new_name} is already their primary name")
                result['success'] = True
                continue
            
            # Check if new_name is already in their alts
            current_alts = dreamer['alts'] or ''
            alt_list = [a.strip() for a in current_alts.split(',') if a.strip()]
            
            if new_name in alt_list:
                # They have it as alt, promote it to primary
                alt_list.remove(new_name)
                alt_list.append(current_name)
                new_alts = ', '.join(alt_list)
                
                db.execute("""
                    UPDATE dreamers SET name = ?, alts = ?, updated_at = ?
                    WHERE did = ?
                """, (new_name, new_alts, int(time.time()), author_did))
                
                db.commit()
                
                if verbose:
                    print(f"   🔄 Promoted alt to primary: {current_name} → {new_name}")
                
                result['success'] = True
                continue
            
            # Check if new_name is already in use by another dreamer
            cursor = db.execute("""
                SELECT name FROM dreamers 
                WHERE (name = ? OR alts LIKE ? OR alts LIKE ? OR alts LIKE ?) AND did != ?
            """, (new_name, f"{new_name},%", f"%,{new_name},%", f"%,{new_name}", author_did))
            
            existing = cursor.fetchone()
            if existing:
                result['errors'].append(f"Name '{new_name}' already in use by {existing['name']}")
                continue
            
            # Rename: current_name → alts, new_name → primary
            if current_name not in alt_list:
                alt_list.append(current_name)
            
            new_alts = ', '.join(alt_list)
            
            db.execute("""
                UPDATE dreamers SET name = ?, alts = ?, updated_at = ?
                WHERE did = ?
            """, (new_name, new_alts, int(time.time()), author_did))
            
            db.commit()
            
            if verbose:
                print(f"   ✨ Renamed: {current_name} → {new_name}")
                print(f"      Old name preserved in alts: {new_alts}")
            
            # Rebuild Caddy for updated subdomains
            try:
                import subprocess
                subprocess.run(['python3', '/srv/caddy/caddybuilder.py'], 
                             capture_output=True, timeout=30)
                if verbose:
                    print(f"   ✅ Caddy rebuilt - {new_name}.reverie.house and {current_name}.reverie.house both active")
            except Exception as e:
                if verbose:
                    print(f"   ⚠️  Caddy rebuild error: {e}")
            
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error adding name: {e}")
            db.rollback()
            if verbose:
                import traceback
                traceback.print_exc()
    
    return result


def disable_quest(replies: List[Dict], quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Disable the current quest after successful execution.
    Used for one-time quests that should auto-disable.
    """
    result = {'success': False, 'errors': []}
    
    try:
        from ops.quests import QuestManager
        qm = QuestManager()
        
        quest_title = quest_config.get('title')
        if not quest_title:
            result['errors'].append("Quest title not found in config")
            return result
        
        if qm.disable_quest(quest_title):
            if verbose:
                print(f"   🔒 Quest '{quest_title}' auto-disabled")
            result['success'] = True
        else:
            result['errors'].append(f"Failed to disable quest: {quest_title}")
            
    except Exception as e:
        result['errors'].append(f"Error disabling quest: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
    
    return result


def award_souvenir(replies: List[Dict], quest_config: Dict, souvenir_key: str, 
                  verbose: bool = False) -> Dict:
    """
    Award a souvenir to quest participants.
    Idempotent: INSERT OR IGNORE ensures no duplicates.
    
    Args:
        souvenir_key: The souvenir key to grant (e.g., 'letter')
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            
            # Check if dreamer exists
            cursor = db.execute("SELECT did, name FROM dreamers WHERE did = %s", (author_did,))
            dreamer = cursor.fetchone()
            
            if not dreamer:
                result['errors'].append(f"Cannot award souvenir to unregistered user: {author_did}")
                continue
            
            # Award souvenir (INSERT OR IGNORE = idempotent)
            db.execute("""
                INSERT OR IGNORE INTO dreamer_souvenirs (did, souvenir_key, earned_epoch)
                VALUES (?, ?, ?)
            """, (author_did, souvenir_key, int(time.time())))
            
            db.commit()
            
            if verbose:
                print(f"   🎁 Awarded souvenir '{souvenir_key}' to {dreamer['name']}")
            
            result['success'] = True
            
        except Exception as e:
            result['errors'].append(f"Error awarding souvenir: {e}")
            db.rollback()
            if verbose:
                import traceback
                traceback.print_exc()
    
    return result


def reply_origin_spectrum(replies: List[Dict], quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Reply to origin memory post with dreamer's origin spectrum values.
    Calculates spectrum using the local algorithm from site/algo/spectrum.json.
    
    Format: "02 33 19 22 68 97" (Oblivion Authority Skeptic Receptive Liberty Entropy)
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    network = NetworkClient()
    
    for reply in replies:
        try:
            author_did = reply['author']['did']
            author_handle = reply['author']['handle']
            reply_uri = reply['uri']
            reply_cid = reply['cid']
            
            # Get root post info for threading
            root_uri = reply.get('record', {}).get('reply', {}).get('root', {}).get('uri')
            root_cid = reply.get('record', {}).get('reply', {}).get('root', {}).get('cid')
            
            if not root_uri:
                # This reply IS the root (direct reply to quest post)
                root_uri = quest_config.get('uri')
                # Try to get root CID from quest post
                try:
                    root_post = network.get_post_thread(root_uri)
                    root_cid = root_post['thread']['post']['cid']
                except:
                    root_cid = None
            
            if verbose:
                print(f"   🌟 Calculating origin spectrum for {author_handle}...")
            
            # Calculate spectrum using local algorithm
            import hashlib
            
            # Constants from spectrum.json
            keeper_did = "did:plc:yauphjufk7phkwurn266ybx2"
            primes = [2, 3, 5, 7, 11, 13]
            prime_mod_1 = 100000019
            prime_mod_2 = 99999989
            offset_prime = 7919
            variance_multiplier = 31
            
            # Get server for weighting
            cursor = db.execute("SELECT server FROM dreamers WHERE did = %s", (author_did,))
            dreamer_row = cursor.fetchone()
            server = dreamer_row['server'] if dreamer_row else None
            
            # Server weight (default for reverie.house)
            server_weight = 0.7 if server and 'reverie.house' in server else 1.0
            
            # Hash DIDs
            user_hash = hashlib.sha256(author_did.encode()).digest()
            keeper_hash = hashlib.sha256(keeper_did.encode()).digest()
            
            user_seed = int.from_bytes(user_hash[:8], 'big', signed=False)
            keeper_seed = int.from_bytes(keeper_hash[:8], 'big', signed=False)
            
            relative_seed = abs(user_seed - keeper_seed)
            
            # Calculate all 6 axes in EOLARS order (algorithm order)
            # [0:Entropy, 1:Oblivion, 2:Liberty, 3:Authority, 4:Receptive, 5:Skeptic]
            
            spectrum_eolars = []
            
            if relative_seed == 0:
                # Keeper at origin
                spectrum_eolars = [0, 0, 0, 0, 0, 0]
            else:
                for axis in range(6):
                    combined = relative_seed * primes[axis] + (axis * offset_prime)
                    raw_value = (combined % prime_mod_1) / prime_mod_1
                    
                    variance_seed = (combined * variance_multiplier) % prime_mod_2
                    variance = (variance_seed % prime_mod_1) / prime_mod_1
                    
                    if raw_value < 0.5:
                        adjusted = raw_value + (variance * 0.3)
                    else:
                        adjusted = raw_value - (variance * 0.2)
                    
                    # Clamp to [0.0, 1.0]
                    adjusted = max(0.0, min(1.0, adjusted))
                    
                    base_value = int(adjusted * 100)
                    distance_from_center = base_value - 50
                    weighted_distance = distance_from_center * server_weight
                    final_value = 50 + weighted_distance
                    
                    # Clamp to [0, 100]
                    final_value = max(0, min(100, int(final_value)))
                    spectrum_eolars.append(final_value)
            
            # spectrum_eolars is [E, O, L, A, R, S]
            # Reorder for display as OASRLE: [O, A, S, R, L, E]
            # Indices: O=1, A=3, S=5, R=4, L=2, E=0
            display_values = [
                spectrum_eolars[1],  # Oblivion
                spectrum_eolars[3],  # Authority
                spectrum_eolars[5],  # Skeptic
                spectrum_eolars[4],  # Receptive
                spectrum_eolars[2],  # Liberty
                spectrum_eolars[0]   # Entropy
            ]
            
            # Format as "O01 A22 S98 R11 L09 E66"
            labels = ['O', 'A', 'S', 'R', 'L', 'E']
            spectrum_text = " ".join(f"{label}{v:02d}" for label, v in zip(labels, display_values))
            
            if verbose:
                print(f"   📊 Origin spectrum: {spectrum_text}")
            
            # Post reply
            try:
                reply_result = network.create_post(
                    text=spectrum_text,
                    reply_to=reply_uri
                )
                
                if reply_result:
                    if verbose:
                        print(f"   💬 Posted spectrum reply to {author_handle}")
                    result['success'] = True
                else:
                    result['errors'].append(f"Failed to post reply for {author_handle}")
                    
            except Exception as e:
                result['errors'].append(f"Error posting reply: {e}")
                if verbose:
                    import traceback
                    traceback.print_exc()
                continue
                
        except Exception as e:
            result['errors'].append(f"Error in reply_origin_spectrum: {e}")
            if verbose:
                import traceback
                traceback.print_exc()
    
    return result
