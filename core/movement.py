#!/usr/bin/env python3
"""
🌍 REVERIE MOVEMENT SYSTEM
Core movement functionality for spectrum positioning and heading-based movement.

This module handles:
- Heading-based movement processing
- Movement utilities (reset, toward, etc.)
- CLI interface for movement operations
"""

import sys
import time
from typing import Dict, List, Optional
from collections import Counter
from core.database import DatabaseManager
from utils.spectrum import SpectrumManager


class HeadingManager:
    """Manages heading-based movement for dreamers in the spectrum."""
    
    VALID_AXES = ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']
    KEEPER_DID = 'did:plc:yauphjufk7phkwurn266ybx2'
    
    def __init__(self):
        self.db = DatabaseManager()
        self.spectrum = SpectrumManager()
    
    def get_all_headings(self) -> Dict[str, Optional[str]]:
        """Get all dreamers and their current headings."""
        cursor = self.db.execute(
            "SELECT did, heading FROM dreamers ORDER BY did"
        )
        return {row['did']: row['heading'] for row in cursor.fetchall()}
    
    def get_most_common_heading(self, headings: Dict[str, Optional[str]]) -> Optional[str]:
        """Determine the most common heading (excluding NULL, 'affix', and DIDs)."""
        valid_headings = [
            h for h in headings.values() 
            if h and h != 'affix' and not h.startswith('did:')
        ]
        
        if not valid_headings:
            return None
        
        counter = Counter(valid_headings)
        most_common = counter.most_common(1)
        return most_common[0][0] if most_common else None
    
    def parse_heading(self, heading: Optional[str]) -> Dict:
        """
        Parse a heading into actionable movement data.
        
        Returns dict with:
            - type: 'axis' | 'toward_dreamer' | 'toward_keeper' | 'affix' | 'home' | 'origin' | 'drift'
            - axis: axis name (for type='axis')
            - direction: +1 (for type='axis')
            - target_did: DID to move toward (for type='toward_dreamer')
        """
        if not heading or heading == 'drift':
            return {'type': 'drift'}
        
        if heading == 'affix':
            return {'type': 'affix'}
        
        if heading == 'home':
            return {'type': 'home'}
        
        if heading == 'origin':
            return {'type': 'origin'}
        
        if heading == 'keeper':
            return {
                'type': 'toward_keeper',
                'target_did': self.KEEPER_DID
            }
        
        if heading.startswith('did:'):
            return {
                'type': 'toward_dreamer',
                'target_did': heading
            }
        
        if heading in self.VALID_AXES:
            return {
                'type': 'axis',
                'axis': heading,
                'direction': 1
            }
        
        for axis in self.VALID_AXES:
            if heading.startswith(axis):
                direction_char = heading[len(axis):]
                if direction_char == '+':
                    return {
                        'type': 'axis',
                        'axis': axis,
                        'direction': 1
                    }
                elif direction_char == '-':
                    opposite_axis_map = {
                        'entropy': 'oblivion',
                        'oblivion': 'entropy',
                        'liberty': 'authority',
                        'authority': 'liberty',
                        'receptive': 'skeptic',
                        'skeptic': 'receptive'
                    }
                    opposite_axis = opposite_axis_map.get(axis, axis)
                    return {
                        'type': 'axis',
                        'axis': opposite_axis,
                        'direction': 1
                    }
        
        return {'type': 'drift'}
    
    def set_heading(self, did: str, heading: str) -> Dict:
        """Set a dreamer's heading."""
        import time
        now = int(time.time())
        
        result = self.db.execute(
            "UPDATE dreamers SET heading = %s, heading_changed_at = %s WHERE did = %s",
            (heading, now, did)
        )
        self.db.commit()
        
        return {
            'success': result.rowcount > 0,
            'did': did,
            'heading': heading
        }
    
    def get_heading(self, did: str) -> Optional[str]:
        """Get a dreamer's heading."""
        cursor = self.db.execute(
            "SELECT heading FROM dreamers WHERE did = %s",
            (did,)
        )
        row = cursor.fetchone()
        return row['heading'] if row else None
    
    def clear_heading(self, did: str) -> bool:
        """Clear a dreamer's heading."""
        result = self.db.execute(
            "UPDATE dreamers SET heading = NULL WHERE did = %s",
            (did,)
        )
        self.db.commit()
        return result.rowcount > 0
    
    def execute_tick(self, verbose: bool = True) -> Dict:
        """
        Execute one world tick - move all dreamers according to their headings.
        
        Returns dict with statistics about the tick.
        """
        import time as time_module
        epoch = int(time_module.time())
        headings = self.get_all_headings()
        default_heading = self.get_most_common_heading(headings)
        
        stats = {
            'total_dreamers': len(headings),
            'moved': 0,
            'affixed': 0,
            'failed': 0,
            'default_heading': default_heading,
            'movements': []
        }
        
        if verbose:
            print(f"🌍 World Tick | Epoch: {epoch}")
            print(f"   Default heading: {default_heading or '(none)'}")
            print()
        
        for did, heading in headings.items():
            effective_heading = heading or default_heading
            heading_data = self.parse_heading(effective_heading)
            
            if heading_data['type'] == 'affix':
                stats['affixed'] += 1
                if verbose:
                    print(f"   ⚓ {self._get_handle(did):20} | affixed")
                continue
            
            elif heading_data['type'] == 'home':
                if verbose:
                    print(f"   🏠 {self._get_handle(did):20} | home (not yet implemented)")
                continue
            
            elif heading_data['type'] == 'origin':
                result = self.spectrum.move_dreamer_toward(
                    did=did,
                    target_did=self.KEEPER_DID,
                    percentage=0.01,
                    reason=f"world_tick_heading:origin",
                    epoch=epoch
                )
                
                if result['success']:
                    stats['moved'] += 1
                    stats['movements'].append({
                        'did': did,
                        'heading': effective_heading,
                        'type': 'toward_origin'
                    })
                    if verbose:
                        print(f"   🎯 {self._get_handle(did):20} | toward origin")
                else:
                    stats['failed'] += 1
                    if verbose:
                        print(f"   ❌ {self._get_handle(did):20} | failed: {result.get('error', 'unknown')}")
            
            elif heading_data['type'] == 'axis':
                axis = heading_data['axis']
                direction = heading_data['direction']
                delta = {axis: direction}
                
                result = self.spectrum.move_dreamer(
                    did=did,
                    deltas=delta,
                    reason=f"world_tick_heading:{effective_heading}",
                    epoch=epoch
                )
                
                if result['success']:
                    stats['moved'] += 1
                    stats['movements'].append({
                        'did': did,
                        'heading': effective_heading,
                        'type': 'axis',
                        'delta': delta
                    })
                    if verbose:
                        print(f"   ➡️  {self._get_handle(did):20} | {axis}{'+' if direction > 0 else '-'} by 1")
                else:
                    stats['failed'] += 1
                    if verbose:
                        print(f"   ❌ {self._get_handle(did):20} | failed: {result.get('error', 'unknown')}")
            
            elif heading_data['type'] in ('toward_dreamer', 'toward_keeper'):
                target_did = heading_data['target_did']
                
                result = self.spectrum.move_dreamer_toward(
                    did=did,
                    target_did=target_did,
                    percentage=0.01,
                    reason=f"world_tick_heading:{effective_heading}",
                    epoch=epoch
                )
                
                if result['success']:
                    stats['moved'] += 1
                    stats['movements'].append({
                        'did': did,
                        'heading': effective_heading,
                        'type': 'toward',
                        'target': target_did
                    })
                    target_name = 'keeper' if target_did == self.KEEPER_DID else self._get_handle(target_did)
                    if verbose:
                        print(f"   🎯 {self._get_handle(did):20} | toward {target_name}")
                else:
                    stats['failed'] += 1
                    if verbose:
                        print(f"   ❌ {self._get_handle(did):20} | failed: {result.get('error', 'unknown')}")
            
            else:
                if verbose:
                    print(f"   ⏸️  {self._get_handle(did):20} | no heading")
        
        if verbose:
            print()
            print(f"✅ Tick complete: {stats['moved']} moved, {stats['affixed']} affixed, {stats['failed']} failed")
        
        # === World items proximity check: award unclaimed items ===
        try:
            # Query unclaimed items
            cursor = self.db.execute("SELECT * FROM world WHERE owner_did IS NULL")
            items = cursor.fetchall()

            for item in items:
                try:
                    # Build item spectrum point
                    item_point = {
                        'entropy': item['entropy'] if item['entropy'] is not None else 0,
                        'oblivion': item['oblivion'] if item['oblivion'] is not None else 0,
                        'liberty': item['liberty'] if item['liberty'] is not None else 0,
                        'authority': item['authority'] if item['authority'] is not None else 0,
                        'receptive': item['receptive'] if item['receptive'] is not None else 0,
                        'skeptic': item['skeptic'] if item['skeptic'] is not None else 0
                    }

                    # Find closest dreamer within radius
                    candidates = []
                    cur2 = self.db.execute("SELECT d.did, d.name, d.handle, s.entropy, s.oblivion, s.liberty, s.authority, s.receptive, s.skeptic FROM dreamers d JOIN spectrum s ON d.did = s.did")
                    for row in cur2.fetchall():
                        dreamer_spec = {
                            'entropy': row['entropy'],
                            'oblivion': row['oblivion'],
                            'liberty': row['liberty'],
                            'authority': row['authority'],
                            'receptive': row['receptive'],
                            'skeptic': row['skeptic']
                        }
                        dist = self.spectrum._calculate_distance(item_point, dreamer_spec)
                        candidates.append((dist, dict(row)))

                    candidates.sort(key=lambda x: x[0])

                    if candidates and candidates[0][0] <= (item['radius'] or 5.0):
                        # Award to closest dreamer
                        closest = candidates[0][1]
                        did = closest['did']

                        # Award souvenir (idempotent)
                        import time
                        try:
                            self.db.execute("INSERT INTO dreamer_souvenirs (did, souvenir_key, earned_epoch) VALUES (%s, %s, %s) ON CONFLICT (did, souvenir_key) DO NOTHING", (did, item['key'], int(time.time())))
                            self.db.execute("UPDATE world SET owner_did = %s, claimed_epoch = %s WHERE id = %s", (did, int(time.time()), item['id']))
                            self.db.commit()

                            # Record event
                            try:
                                from core.events import EventsManager
                                em = EventsManager(self.db)
                                em.record_event(
                                    did=did, 
                                    event=f"found {item['key']}", 
                                    event_type='souvenir', 
                                    key=item['key']
                                )
                            except Exception:
                                # Non-fatal
                                pass

                            stats.setdefault('items_awarded', 0)
                            stats['items_awarded'] += 1
                            if verbose:
                                print(f"   🎁 {closest.get('handle') or did:20} found item '{item['key']}' (id={item['id']})")

                        except Exception as e:
                            try:
                                self.db.rollback()
                            except Exception:
                                pass
                            if verbose:
                                print(f"❌ Error awarding item {item['key']} to {did}: {e}")

                except Exception as e:
                    if verbose:
                        print(f"⚠️  World item check error for item id={item.get('id')}: {e}")

        except Exception as e:
            if verbose:
                print(f"⚠️  Error while checking world items: {e}")

        return stats
    
    def _get_handle(self, did: str) -> str:
        """Get handle for a DID (for display purposes)."""
        try:
            cursor = self.db.execute("SELECT handle FROM dreamers WHERE did = %s", (did,))
            row = cursor.fetchone()
            return row['handle'] if row else did[:20]
        except Exception:
            return did[:20]


class MovementUtilities:
    """Utility functions for spectrum movement operations."""
    
    def __init__(self):
        self.spectrum = SpectrumManager()
        self.db = DatabaseManager()
    
    def reset_all_to_origin(self, verbose: bool = True) -> Dict:
        """Reset all dreamers to their algorithmic origin positions."""
        cursor = self.db.execute("SELECT did, handle, name FROM dreamers ORDER BY name")
        dreamers = cursor.fetchall()
        
        if verbose:
            print(f"Resetting {len(dreamers)} dreamers to origin...")
            print()
        
        success_count = 0
        failed = []
        
        for dreamer in dreamers:
            result = self.spectrum.reset_to_origin(
                did=dreamer['did'],
                server=None,
                reason="bulk_reset",
                epoch=int(time.time())
            )
            
            if result['success']:
                success_count += 1
                if verbose:
                    print(f"✅ {dreamer['name']:20} | Distance moved: {result['distance_moved']:6.2f}")
            else:
                failed.append(dreamer['name'])
                if verbose:
                    print(f"❌ {dreamer['name']:20} | Failed: {result.get('error', 'unknown')}")
        
        if verbose:
            print()
            print(f"Reset complete: {success_count}/{len(dreamers)} dreamers")
        
        return {
            'total': len(dreamers),
            'success': success_count,
            'failed': len(failed),
            'failed_names': failed
        }
    
    def move_dreamer(self, did: str, deltas: Dict[str, int], reason: str = None) -> Dict:
        """Move a dreamer by specified deltas."""
        return self.spectrum.move_dreamer(
            did=did,
            deltas=deltas,
            reason=reason,
            epoch=int(time.time())
        )
    
    def set_position(self, did: str, coordinates: Dict[str, int], reason: str = None) -> Dict:
        """Set a dreamer to specific coordinates."""
        return self.spectrum.set_dreamer_position(
            did=did,
            coordinates=coordinates,
            reason=reason,
            epoch=int(time.time())
        )
    
    def move_toward(self, did: str, target_did: str, percentage: float = 0.1, 
                    axes: List[str] = None, reason: str = None) -> Dict:
        """Move a dreamer toward another dreamer."""
        return self.spectrum.move_dreamer_toward(
            did=did,
            target_did=target_did,
            percentage=percentage,
            axes=axes,
            reason=reason,
            epoch=int(time.time())
        )
    
    def get_distance(self, did_a: str, did_b: str, axes: List[str] = None) -> Optional[float]:
        """Get distance between two dreamers."""
        return self.spectrum.get_distance_between(did_a, did_b, axes)
    
    def get_nearby(self, did: str, radius: float, axes: List[str] = None) -> List[Dict]:
        """Get dreamers within radius of specified dreamer."""
        return self.spectrum.get_dreamers_in_radius(did, radius, axes)
