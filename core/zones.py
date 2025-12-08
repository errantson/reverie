#!/usr/bin/env python3
"""
🌌 REVERIE ZONES SYSTEM
Defines volumetric regions in spectrum space and processes zone membership/effects.

This module handles:
- Zone definitions (spheres and convex hulls)
- Zone membership detection
- Zone effect processing (runs on world tick)
- Dynamic zone updates
"""

import json
import sys
import time
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

from core.database import DatabaseManager
from utils.spectrum import SpectrumManager

try:
    import numpy as np
    from scipy.spatial import ConvexHull, Delaunay
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    SCIPY_AVAILABLE = False


class Zone:
    """Base class for all zone types."""
    
    def __init__(self, zone_id: str, name: str, zone_type: str,
                 color: Optional[Dict[str, int]] = None,
                 description: str = "",
                 effects: Optional[Dict[str, Any]] = None):
        """
        Args:
            zone_id: Unique identifier (e.g., "keeper_inner_circle")
            name: Display name (e.g., "Keeper's Inner Circle")
            zone_type: 'sphere' or 'hull'
            color: RGB color dict with r, g, b, a (0-255, 0-1.0)
            description: Narrative description
            effects: Dict of zone effects to apply on tick
        """
        self.zone_id = zone_id
        self.name = name
        self.zone_type = zone_type
        self.color = color or {'r': 120, 'g': 120, 'b': 120, 'a': 0.15}
        self.description = description
        self.effects = effects or {}
    
    def contains(self, did: str, spectrum_manager: SpectrumManager) -> bool:
        """Check if a dreamer is within this zone."""
        raise NotImplementedError("Subclasses must implement contains()")
    
    def get_members(self, spectrum_manager: SpectrumManager) -> List[Dict]:
        """Get all dreamers currently in this zone."""
        raise NotImplementedError("Subclasses must implement get_members()")
    
    def to_dict(self) -> Dict:
        """Convert zone to dictionary for JSON serialization."""
        return {
            'zone_id': self.zone_id,
            'name': self.name,
            'type': self.zone_type,
            'color': self.color,
            'description': self.description,
            'effects': self.effects
        }


class SphereZone(Zone):
    """
    A spherical zone defined by center point + radius.
    Most efficient and simple zone type.
    """
    
    def __init__(self, zone_id: str, name: str,
                 center_did: Optional[str] = None,
                 center_coords: Optional[Dict[str, int]] = None,
                 radius: float = 30.0,
                 axes: Optional[List[str]] = None,
                 color: Optional[Dict[str, int]] = None,
                 description: str = "",
                 effects: Optional[Dict[str, Any]] = None):
        """
        Args:
            center_did: DID to use as center (dynamic - follows dreamer)
            center_coords: Fixed coordinates (static center)
            radius: Distance from center
            axes: Which dimensions to use (default: ['entropy', 'oblivion', 'liberty'])
        """
        super().__init__(zone_id, name, 'sphere', color, description, effects)
        self.center_did = center_did
        self.center_coords = center_coords
        self.radius = radius
        self.axes = axes or ['entropy', 'oblivion', 'liberty']
    
    def get_center(self, spectrum_manager: SpectrumManager) -> Optional[Dict[str, int]]:
        """Get the current center coordinates."""
        if self.center_did:
            return spectrum_manager.get_spectrum(self.center_did)
        return self.center_coords
    
    def contains(self, did: str, spectrum_manager: SpectrumManager) -> bool:
        """Check if a dreamer is within this zone."""
        center = self.get_center(spectrum_manager)
        if not center:
            return False
        
        if self.center_did:
            distance = spectrum_manager.get_distance_between(
                self.center_did, did, axes=self.axes
            )
        else:
            dreamer_spectrum = spectrum_manager.get_spectrum(did)
            if not dreamer_spectrum:
                return False
            distance = spectrum_manager._calculate_distance(
                center, dreamer_spectrum, axes=self.axes
            )
        
        return distance is not None and distance <= self.radius
    
    def get_members(self, spectrum_manager: SpectrumManager) -> List[Dict]:
        """Get all dreamers in this zone."""
        if self.center_did:
            members = spectrum_manager.get_dreamers_in_radius(
                self.center_did, self.radius, axes=self.axes
            )
            return members
        else:
            all_dreamers = spectrum_manager.load_dreamers()
            members = []
            center = self.center_coords
            
            for dreamer in all_dreamers:
                if dreamer.get('spectrum'):
                    distance = spectrum_manager._calculate_distance(
                        center, dreamer['spectrum'], axes=self.axes
                    )
                    if distance <= self.radius:
                        members.append({
                            'did': dreamer['did'],
                            'name': dreamer['name'],
                            'handle': dreamer['handle'],
                            'distance': distance
                        })
            
            members.sort(key=lambda x: x['distance'])
            return members
    
    def to_dict(self) -> Dict:
        """Convert zone to dictionary."""
        data = super().to_dict()
        data.update({
            'center_did': self.center_did,
            'center_coords': self.center_coords,
            'radius': self.radius,
            'axes': self.axes
        })
        return data


class ConvexHullZone(Zone):
    """
    A zone defined by convex hull of multiple points.
    More complex but very flexible for arbitrary shapes.
    """
    
    def __init__(self, zone_id: str, name: str,
                 point_dids: Optional[List[str]] = None,
                 point_coords: Optional[List[Dict[str, int]]] = None,
                 axes: Optional[List[str]] = None,
                 color: Optional[Dict[str, int]] = None,
                 description: str = "",
                 effects: Optional[Dict[str, Any]] = None):
        """
        Args:
            point_dids: List of DIDs whose positions define hull (dynamic)
            point_coords: List of fixed coordinate dicts (static)
            axes: Which dimensions to use (default: entropy, oblivion, liberty)
        """
        super().__init__(zone_id, name, 'hull', color, description, effects)
        self.point_dids = point_dids or []
        self.point_coords = point_coords or []
        self.axes = axes or ['entropy', 'oblivion', 'liberty']
        self._hull = None
        self._delaunay = None
        self._last_computed = 0
        self._cache_duration = 60
    
    def _get_points_array(self, spectrum_manager: SpectrumManager) -> Optional[Any]:
        """Convert points to numpy array for computation."""
        if not SCIPY_AVAILABLE:
            return None
        
        points = []
        
        if self.point_dids:
            for did in self.point_dids:
                spectrum = spectrum_manager.get_spectrum(did)
                if spectrum:
                    point = [spectrum[axis] for axis in self.axes]
                    points.append(point)
        
        if self.point_coords:
            for coords in self.point_coords:
                point = [coords[axis] for axis in self.axes]
                points.append(point)
        
        if len(points) < 4:
            return None
        
        return np.array(points)
    
    def compute_hull(self, spectrum_manager: SpectrumManager, force: bool = False) -> bool:
        """Compute convex hull from current points."""
        if not SCIPY_AVAILABLE:
            return False
        
        now = time.time()
        if not force and self._delaunay and (now - self._last_computed) < self._cache_duration:
            return True
        
        points = self._get_points_array(spectrum_manager)
        
        if points is None:
            return False
        
        try:
            self._hull = ConvexHull(points)
            self._delaunay = Delaunay(points)
            self._last_computed = now
            return True
        except Exception as e:
            print(f"⚠️ Failed to compute hull for {self.zone_id}: {e}")
            return False
    
    def contains(self, did: str, spectrum_manager: SpectrumManager) -> bool:
        """Check if dreamer is inside convex hull."""
        if not SCIPY_AVAILABLE:
            return False
        
        if not self.compute_hull(spectrum_manager):
            return False
        
        spectrum = spectrum_manager.get_spectrum(did)
        if not spectrum:
            return False
        
        point = np.array([spectrum[axis] for axis in self.axes])
        
        return self._delaunay.find_simplex(point) >= 0
    
    def get_members(self, spectrum_manager: SpectrumManager) -> List[Dict]:
        """Get all dreamers in this zone."""
        if not SCIPY_AVAILABLE or not self.compute_hull(spectrum_manager):
            return []
        
        all_dreamers = spectrum_manager.load_dreamers()
        members = []
        
        for dreamer in all_dreamers:
            if dreamer.get('spectrum') and self.contains(dreamer['did'], spectrum_manager):
                members.append({
                    'did': dreamer['did'],
                    'name': dreamer['name'],
                    'handle': dreamer['handle']
                })
        
        return members
    
    def get_hull_vertices(self, spectrum_manager: SpectrumManager) -> Optional[List]:
        """Get the vertices of the convex hull for rendering."""
        if not SCIPY_AVAILABLE or not self.compute_hull(spectrum_manager):
            return None
        
        points = self._get_points_array(spectrum_manager)
        if points is None or self._hull is None:
            return None
        
        return points[self._hull.vertices].tolist()
    
    def to_dict(self) -> Dict:
        """Convert zone to dictionary."""
        data = super().to_dict()
        data.update({
            'point_dids': self.point_dids,
            'point_coords': self.point_coords,
            'axes': self.axes
        })
        return data


class ZoneManager:
    """
    Manages all spectrum zones and their processing.
    """
    
    def __init__(self, db: Optional[DatabaseManager] = None):
        self.db = db if db else DatabaseManager()
        self.spectrum = SpectrumManager(db=self.db)
        self.zones: Dict[str, Zone] = {}
    
    def load_zones_from_db(self):
        """Load zone definitions from database."""
        # TODO: Zones table was removed during schema simplification
        # Zones are now calculated dynamically based on spectrum clustering
        # For now, return empty zones list
        self.zones = {}
        return
        
        # Old code (disabled):
        # cursor = self.db.execute("""
        #     SELECT zone_id, name, type, definition, color, description, effects, enabled
        #     FROM zones
        #     WHERE enabled = 1
        #     ORDER BY zone_id
        # """)
        
        self.zones = {}
        
        for row in cursor.fetchall():
            zone_id = row['zone_id']
            name = row['name']
            zone_type = row['type']
            definition = json.loads(row['definition']) if row['definition'] else {}
            color = json.loads(row['color']) if row['color'] else None
            description = row['description'] or ""
            effects = json.loads(row['effects']) if row['effects'] else {}
            
            if zone_type == 'sphere':
                zone = SphereZone(
                    zone_id=zone_id,
                    name=name,
                    center_did=definition.get('center_did'),
                    center_coords=definition.get('center_coords'),
                    radius=definition.get('radius', 30.0),
                    axes=definition.get('axes'),
                    color=color,
                    description=description,
                    effects=effects
                )
            elif zone_type == 'hull':
                zone = ConvexHullZone(
                    zone_id=zone_id,
                    name=name,
                    point_dids=definition.get('point_dids'),
                    point_coords=definition.get('point_coords'),
                    axes=definition.get('axes'),
                    color=color,
                    description=description,
                    effects=effects
                )
            else:
                print(f"⚠️ Unknown zone type '{zone_type}' for zone {zone_id}")
                continue
            
            self.zones[zone_id] = zone
    
    def get_zone(self, zone_id: str) -> Optional[Zone]:
        """Get a specific zone by ID."""
        return self.zones.get(zone_id)
    
    def get_all_zones(self) -> List[Zone]:
        """Get all zones."""
        return list(self.zones.values())
    
    def get_dreamer_zones(self, did: str) -> List[str]:
        """Get all zones a dreamer is currently in."""
        memberships = []
        for zone in self.zones.values():
            if zone.contains(did, self.spectrum):
                memberships.append(zone.zone_id)
        return memberships
    
    def get_zone_population(self, zone_id: str) -> int:
        """Get number of dreamers in a zone."""
        zone = self.zones.get(zone_id)
        if not zone:
            return 0
        return len(zone.get_members(self.spectrum))
    
    def process_zones(self, verbose: bool = False) -> Dict[str, Any]:
        """
        Process all zones - count members and apply effects.
        Called by world tick.
        
        Returns:
            Dict with processing statistics
        """
        if verbose:
            print("🌌 Processing zones...")
        
        stats = {
            'zones_processed': 0,
            'total_memberships': 0,
            'effects_applied': 0,
            'zones': {}
        }
        
        epoch = int(time.time())
        
        for zone_id, zone in self.zones.items():
            members = zone.get_members(self.spectrum)
            member_count = len(members)
            
            if verbose:
                print(f"  {zone.name}: {member_count} dreamers")
            
            stats['zones'][zone_id] = {
                'name': zone.name,
                'member_count': member_count,
                'members': [m['did'] for m in members]
            }
            
            self._update_spectrum(zone_id, members, epoch)
            
            effects_count = self._apply_zone_effects(zone, members, verbose=verbose)
            stats['effects_applied'] += effects_count
            
            stats['zones_processed'] += 1
            stats['total_memberships'] += member_count
        
        return stats
    
    def _update_spectrum(self, zone_id: str, members: List[Dict], epoch: int):
        """Update the spectrum table with current membership."""
        self.db.execute("DELETE FROM spectrum WHERE zone_id = %s", (zone_id,))
        
        for member in members:
            self.db.execute("""
                INSERT INTO spectrum (zone_id, did, entered_epoch)
                VALUES (?, ?, ?)
            """, (zone_id, member['did'], epoch))
    
    def _apply_zone_effects(self, zone: Zone, members: List[Dict], verbose: bool = False) -> int:
        """
        Apply zone effects to members.
        
        Current supported effects:
        - spectrum_drift: {'axis': 'entropy', 'delta': 1}
        - heading_override: {'heading': 'keeper'}
        - canon_event: {'event': 'entered_void', 'once': True}
        
        Returns:
            Number of effects applied
        """
        if not zone.effects:
            return 0
        
        effects_applied = 0
        
        for effect_type, effect_config in zone.effects.items():
            if effect_type == 'spectrum_drift':
                axis = effect_config.get('axis')
                delta = effect_config.get('delta', 0)
                
                if axis and delta:
                    for member in members:
                        try:
                            result = self.spectrum.move_dreamer(
                                member['did'],
                                {axis: delta},
                                reason=f"zone_effect:{zone.zone_id}"
                            )
                            if result.get('success'):
                                effects_applied += 1
                                if verbose:
                                    print(f"    Applied drift to {member['name']}: {axis}{delta:+d}")
                        except Exception as e:
                            if verbose:
                                print(f"    ⚠️ Failed to apply drift to {member['name']}: {e}")
            
            elif effect_type == 'canon_event':
                event = effect_config.get('event')
                once = effect_config.get('once', False)
                
                if event:
                    for member in members:
                        if once:
                            cursor = self.db.execute("""
                                SELECT id FROM canon 
                                WHERE did = %s AND event LIKE ?
                                LIMIT 1
                            """, (member['did'], f"%{event}%"))
                            if cursor.fetchone():
                                continue
                        
                        epoch = int(time.time())
                        self.db.execute("""
                            INSERT INTO canon (did, event, epoch, created_at)
                            VALUES (?, ?, ?, ?)
                        """, (member['did'], event, epoch, epoch))
                        effects_applied += 1
                        
                        if verbose:
                            print(f"    Canon event '{event}' for {member['name']}")
            
            elif effect_type == 'heading_override':
                heading = effect_config.get('heading')
                
                if heading:
                    epoch = int(time.time())
                    for member in members:
                        self.db.execute("""
                            UPDATE dreamers 
                            SET heading = %s, heading_changed_at = %s
                            WHERE did = %s
                        """, (heading, epoch, member['did']))
                        effects_applied += 1
                        
                        if verbose:
                            print(f"    Set heading '{heading}' for {member['name']}")
        
        return effects_applied
    
    def create_zone(self, zone_id: str, name: str, zone_type: str,
                   definition: Dict, color: Optional[Dict] = None,
                   description: str = "", effects: Optional[Dict] = None,
                   enabled: bool = True) -> bool:
        """
        Create a new zone in the database.
        
        Args:
            zone_id: Unique identifier
            name: Display name
            zone_type: 'sphere' or 'hull'
            definition: Zone-specific config (center, radius, points, etc.)
            color: RGB color dict
            description: Narrative description
            effects: Dict of zone effects
            enabled: Whether zone is active
        
        Returns:
            True if created successfully
        """
        try:
            epoch = int(time.time())
            self.db.execute("""
                INSERT INTO zones (zone_id, name, type, definition, color, description, effects, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                zone_id,
                name,
                zone_type,
                json.dumps(definition),
                json.dumps(color) if color else None,
                description,
                json.dumps(effects) if effects else None,
                1 if enabled else 0,
                epoch,
                epoch
            ))
            
            self.db._get_connection().commit()
            
            self.load_zones_from_db()
            return True
        except Exception as e:
            print(f"⚠️ Failed to create zone: {e}")
            return False
    
    def create_hull_from_points(self, zone_id: str, name: str, points: List[Dict[str, int]],
                                axes: Optional[List[str]] = None,
                                color: Optional[Dict] = None,
                                description: str = "",
                                effects: Optional[Dict] = None,
                                enabled: bool = True) -> bool:
        """
        Convenience function to create a convex hull zone from a list of points.
        
        Args:
            zone_id: Unique identifier
            name: Display name
            points: List of coordinate dicts, e.g. [{'entropy': 0, 'oblivion': 0, ...}, ...]
            axes: Which dimensions to use (default: all 6)
            color: RGB color dict
            description: Narrative description
            effects: Dict of zone effects
            enabled: Whether zone is active
        
        Returns:
            True if created successfully
        
        Example:
            points = [
                {'entropy': 0, 'oblivion': 0, 'liberty': 0, 'authority': 0, 'receptive': 0, 'skeptic': 0},
                {'entropy': 100, 'oblivion': 50, 'liberty': 50, 'authority': 100, 'receptive': 50, 'skeptic': 50},
                {'entropy': 0, 'oblivion': 100, 'liberty': 50, 'authority': 100, 'receptive': 50, 'skeptic': 50}
            ]
            mgr.create_hull_from_points('test_pyramid', 'Test Pyramid', points)
        """
        if not axes:
            axes = ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']
        
        definition = {
            'point_coords': points,
            'axes': axes
        }
        
        return self.create_zone(
            zone_id=zone_id,
            name=name,
            zone_type='hull',
            definition=definition,
            color=color,
            description=description,
            effects=effects,
            enabled=enabled
        )
    
    def update_zone_definition(self, zone_id: str, definition: Dict) -> bool:
        """
        Update a zone's definition (center, radius, points, etc.).
        This allows zones to be dynamic and change over time.
        
        Returns:
            True if updated successfully
        """
        try:
            epoch = int(time.time())
            self.db.execute("""
                UPDATE zones
                SET definition = %s, updated_at = %s
                WHERE zone_id = %s
            """, (json.dumps(definition), epoch, zone_id))
            
            self.db._get_connection().commit()
            
            self.load_zones_from_db()
            return True
        except Exception as e:
            print(f"⚠️ Failed to update zone: {e}")
            return False
    
    def get_zone_stats(self) -> Dict[str, Any]:
        """Get statistics about all zones."""
        stats = {
            'total_zones': len(self.zones),
            'zones': {}
        }
        
        for zone_id, zone in self.zones.items():
            members = zone.get_members(self.spectrum)
            stats['zones'][zone_id] = {
                'name': zone.name,
                'type': zone.zone_type,
                'member_count': len(members),
                'description': zone.description
            }
        
        return stats


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Reverie Zones System')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    parser_list = subparsers.add_parser('list', help='List all zones')
    
    parser_show = subparsers.add_parser('show', help='Show zone details')
    parser_show.add_argument('zone_id', help='Zone ID to show')
    
    parser_process = subparsers.add_parser('process', help='Process all zones')
    parser_process.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    parser_create_sphere = subparsers.add_parser('create-sphere', help='Create a sphere zone')
    parser_create_sphere.add_argument('zone_id', help='Zone ID')
    parser_create_sphere.add_argument('name', help='Zone name')
    parser_create_sphere.add_argument('--center-did', help='Center DID')
    parser_create_sphere.add_argument('--radius', type=float, default=30.0, help='Radius')
    
    parser_examples = subparsers.add_parser('create-examples', help='Create example zones for testing')
    parser_examples.add_argument('--keeper-did', help='Keeper DID (auto-detected if not provided)')
    
    parser_pyramid = subparsers.add_parser('create-authority-pyramid', help='Create authority pyramid zone')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    mgr = ZoneManager()
    mgr.load_zones_from_db()
    
    if args.command == 'list':
        zones = mgr.get_all_zones()
        print(f"\n🌌 {len(zones)} zones loaded:\n")
        for zone in zones:
            print(f"  {zone.zone_id:30} {zone.name}")
            print(f"  {'':30} Type: {zone.zone_type}, Members: {mgr.get_zone_population(zone.zone_id)}")
            print()
    
    elif args.command == 'show':
        zone = mgr.get_zone(args.zone_id)
        if not zone:
            print(f"❌ Zone '{args.zone_id}' not found")
            sys.exit(1)
        
        print(f"\n🌌 Zone: {zone.name}")
        print(f"   ID: {zone.zone_id}")
        print(f"   Type: {zone.zone_type}")
        print(f"   Description: {zone.description}")
        print(f"\n   Members: {mgr.get_zone_population(args.zone_id)}")
        
        members = zone.get_members(mgr.spectrum)
        for member in members[:10]:
            dist = member.get('distance', '?')
            print(f"     - {member['name']} ({dist})")
        
        if len(members) > 10:
            print(f"     ... and {len(members) - 10} more")
        
        print()
    
    elif args.command == 'process':
        stats = mgr.process_zones(verbose=args.verbose)
        print(f"\n✅ Processed {stats['zones_processed']} zones")
        print(f"   Total memberships: {stats['total_memberships']}")
        print(f"   Effects applied: {stats['effects_applied']}")
        print()
    
    elif args.command == 'create-sphere':
        if not args.center_did:
            print("❌ --center-did required for sphere zone")
            sys.exit(1)
        
        definition = {
            'center_did': args.center_did,
            'radius': args.radius,
            'axes': ['entropy', 'oblivion', 'liberty']
        }
        
        success = mgr.create_zone(
            zone_id=args.zone_id,
            name=args.name,
            zone_type='sphere',
            definition=definition
        )
        
        if success:
            print(f"✅ Created zone '{args.zone_id}'")
        else:
            print(f"❌ Failed to create zone")
            sys.exit(1)
    
    elif args.command == 'create-examples':
        keeper_did = args.keeper_did
        if not keeper_did:
            keeper_did = mgr.spectrum.get_keeper_did()
        
        if not keeper_did:
            print("❌ Could not determine keeper DID")
            sys.exit(1)
        
        print(f"🌌 Creating Example Zones (Keeper: {keeper_did})\n")
        
        print("Creating: Keeper's Inner Circle...")
        if mgr.create_zone(
            zone_id='keeper_inner_circle',
            name="Keeper's Inner Circle",
            zone_type='sphere',
            definition={
                'center_did': keeper_did,
                'radius': 30.0,
                'axes': ['entropy', 'oblivion', 'liberty']
            },
            color={'r': 255, 'g': 215, 'b': 180, 'a': 0.25},
            description="Dreamers close to the keeper's origin point"
        ):
            print("  ✅ Created")
        else:
            print("  ⚠️ Already exists or failed")
        
        print("\nCreating: The Outer Reaches...")
        if mgr.create_zone(
            zone_id='outer_reaches',
            name="The Outer Reaches",
            zone_type='sphere',
            definition={
                'center_did': keeper_did,
                'radius': 100.0,
                'axes': ['entropy', 'oblivion', 'liberty']
            },
            color={'r': 150, 'g': 100, 'b': 200, 'a': 0.15},
            description="All dreamers in the outer spectrum"
        ):
            print("  ✅ Created")
        else:
            print("  ⚠️ Already exists or failed")
        
        print("\nCreating: The Void...")
        if mgr.create_zone(
            zone_id='the_void',
            name="The Void",
            zone_type='sphere',
            definition={
                'center_coords': {
                    'entropy': 100,
                    'oblivion': 100,
                    'liberty': 100,
                    'authority': 0,
                    'receptive': 0,
                    'skeptic': 100
                },
                'radius': 20.0,
                'axes': ['entropy', 'oblivion', 'liberty']
            },
            color={'r': 100, 'g': 50, 'b': 150, 'a': 0.3},
            description="Extreme chaos and dissolution - rare souls venture here",
            effects={
                'canon_event': {
                    'event': 'entered_the_void',
                    'once': True
                }
            }
        ):
            print("  ✅ Created")
        else:
            print("  ⚠️ Already exists or failed")
        
        print("\nCreating: The Ordered Core...")
        if mgr.create_zone(
            zone_id='ordered_core',
            name="The Ordered Core",
            zone_type='sphere',
            definition={
                'center_coords': {
                    'entropy': 10,
                    'oblivion': 10,
                    'liberty': 10,
                    'authority': 10,
                    'receptive': 10,
                    'skeptic': 10
                },
                'radius': 15.0,
                'axes': ['entropy', 'oblivion', 'liberty']
            },
            color={'r': 100, 'g': 150, 'b': 255, 'a': 0.25},
            description="Stability and structure - closest to perfect order"
        ):
            print("  ✅ Created")
        else:
            print("  ⚠️ Already exists or failed")
        
        print("\n" + "="*50)
        mgr.load_zones_from_db()
        zones = mgr.get_all_zones()
        print(f"\n✅ {len(zones)} zones created\n")
        
        for zone in zones:
            members = zone.get_members(mgr.spectrum)
            print(f"  {zone.name:30} {len(members):3} dreamers")
        
        print("\n🌌 Example zones ready!")
    
    elif args.command == 'create-authority-pyramid':
        print("🔺 Creating Authority Pyramid Zone\n")
        
        points = [
            {'entropy': 0, 'oblivion': 0, 'liberty': 0, 'authority': 0, 'receptive': 0, 'skeptic': 0},
            
            {'entropy': 100, 'oblivion': 50, 'liberty': 50, 'authority': 100, 'receptive': 50, 'skeptic': 50},
            {'entropy': 0, 'oblivion': 50, 'liberty': 50, 'authority': 100, 'receptive': 50, 'skeptic': 50},
            {'entropy': 50, 'oblivion': 100, 'liberty': 50, 'authority': 100, 'receptive': 50, 'skeptic': 50},
            {'entropy': 50, 'oblivion': 0, 'liberty': 50, 'authority': 100, 'receptive': 50, 'skeptic': 50},
            {'entropy': 50, 'oblivion': 50, 'liberty': 100, 'authority': 100, 'receptive': 50, 'skeptic': 50},
            {'entropy': 50, 'oblivion': 50, 'liberty': 0, 'authority': 100, 'receptive': 50, 'skeptic': 50},
        ]
        
        print("📐 Pyramid Structure:")
        print("  Peak:    E=0   O=0   L=0   A=0   R=0   S=0")
        print("  Base 1:  E=100 O=50  L=50  A=100 R=50  S=50")
        print("  Base 2:  E=0   O=50  L=50  A=100 R=50  S=50")
        print("  Base 3:  E=50  O=100 L=50  A=100 R=50  S=50")
        print("  Base 4:  E=50  O=0   L=50  A=100 R=50  S=50")
        print("  Base 5:  E=50  O=50  L=100 A=100 R=50  S=50")
        print("  Base 6:  E=50  O=50  L=0   A=100 R=50  S=50\n")
        
        success = mgr.create_hull_from_points(
            zone_id='authority_pyramid',
            name='Authority Pyramid',
            points=points,
            axes=['entropy', 'oblivion', 'liberty'],
            color={'r': 200, 'g': 140, 'b': 80, 'a': 0.3},
            description="A pyramid from keeper's origin toward maximum authority - represents the gradient of leadership and structure",
            effects={
                'canon_event': {
                    'event': 'entered_authority_pyramid',
                    'once': True
                }
            }
        )
        
        if success:
            print("✅ Authority Pyramid zone created!\n")
            
            mgr.load_zones_from_db()
            zone = mgr.get_zone('authority_pyramid')
            
            if zone and SCIPY_AVAILABLE:
                print("🔍 Computing convex hull...")
                if zone.compute_hull(mgr.spectrum, force=True):
                    print("✅ Convex hull computed successfully\n")
                    
                    members = zone.get_members(mgr.spectrum)
                    print(f"👥 Current members: {len(members)}")
                    
                    if members:
                        print("\nFirst 10 members:")
                        for i, member in enumerate(members[:10], 1):
                            print(f"  {i}. {member['name']} (@{member['handle']})")
                        
                        if len(members) > 10:
                            print(f"  ... and {len(members) - 10} more")
                    
                    if zone._hull:
                        print(f"\n📊 Hull Statistics:")
                        print(f"  Vertices: {len(zone._hull.vertices)}")
                        print(f"  Simplices: {len(zone._hull.simplices)}")
                        print(f"  Volume: {zone._hull.volume:.2f} (6D hyperpyramid)")
                else:
                    print("⚠️ Failed to compute convex hull")
            elif not SCIPY_AVAILABLE:
                print("⚠️ scipy/numpy not available - hull zones will not function")
            
            print("\n🎯 Zone created successfully!")
        else:
            print("❌ Failed to create zone (may already exist)")
            sys.exit(1)
