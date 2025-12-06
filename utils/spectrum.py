#!/usr/bin/env python3
"""
Spectrum Management Utility

Generates and maintains psychometric spectrum values for all dreamers.
- Deterministic generation from DID (repeatable)
- Server-based weighting (reverie.house users closer to center)
- Loads algorithm spec from /srv/site/algo/spectrum.json
- Integrates with database (reverie.db)
- Movement functions for adjusting coordinates
"""

import json
import hashlib
import sys
import time
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.database import DatabaseManager


class SpectrumManager:
    # Hardcoded algorithm constants
    KEEPER_DID = "did:plc:yauphjufk7phkwurn266ybx2"
    PRIMES = [2, 3, 5, 7, 11, 13]
    PRIME_MOD_1 = 100000019
    PRIME_MOD_2 = 99999989
    OFFSET_PRIME = 7919
    VARIANCE_MULTIPLIER = 31
    CENTER_POINT = 50
    MIN_VALUE = 0
    MAX_VALUE = 100
    VARIANCE_LOWER_MULT = 0.3
    VARIANCE_UPPER_MULT = 0.2
    VARIANCE_THRESHOLD = 0.5
    SERVER_WEIGHTS = {
        "reverie.house": 0.7,
        "bsky.social": 1.15,
        "bsky.network": 1.15,
        "default": 1.0
    }
    AXES = [
        {"index": 0, "name": "entropy", "description": "a force of expansion"},
        {"index": 1, "name": "oblivion", "description": "a force of destruction"},
        {"index": 2, "name": "liberty", "description": "a force of possibility"},
        {"index": 3, "name": "authority", "description": "a force of control"},
        {"index": 4, "name": "receptive", "description": "a force of experience"},
        {"index": 5, "name": "skeptic", "description": "a force of definition"}
    ]
    
    def __init__(self, db: DatabaseManager = None):
        self.base_dir = Path(__file__).parent.parent
        self.data_dir = self.base_dir / 'site' / 'data'
        
        self.db = db if db else DatabaseManager()
        
        self._keeper_did = None
    
    def get_keeper_did(self) -> str:
        """
        Get the keeper's DID.
        The keeper serves as the origin point (zero) for all spectrum calculations.
        """
        return self.KEEPER_DID
        
    def load_dreamers(self) -> List[Dict]:
        """Load dreamers from database"""
        cursor = self.db.execute("""
            SELECT 
                d.did, d.handle, d.name, d.server,
                s.entropy, s.oblivion, s.liberty, 
                s.authority, s.receptive, s.skeptic
            FROM dreamers d
            LEFT JOIN spectrum s ON d.did = s.did
        """)
        rows = cursor.fetchall()
        
        dreamers = []
        for row in rows:
            dreamer = {
                'did': row['did'],
                'handle': row['handle'],
                'name': row['name'],
                'server': row['server'] or ''
            }
            
            if row['entropy'] is not None:
                dreamer['spectrum'] = {
                    'entropy': row['entropy'],
                    'oblivion': row['oblivion'],
                    'liberty': row['liberty'],
                    'authority': row['authority'],
                    'receptive': row['receptive'] or 0,
                    'skeptic': row['skeptic']
                }
            
            dreamers.append(dreamer)
        
        return dreamers
    
    def save_spectrum_to_db(self, did: str, spectrum: Dict[str, int]):
        """
        Save spectrum values to database with octant calculation.
        Automatically calculates and stores the nominal octant name.
        """
        from utils.octant import calculate_octant_code
        
        # Calculate octant nominal name from spectrum
        octant = calculate_octant_code(spectrum)
        
        self.db.execute("""
            INSERT OR REPLACE INTO spectrum (
                did, entropy, oblivion, liberty, authority, receptive, skeptic, octant, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            did,
            spectrum.get('entropy', 0),
            spectrum.get('oblivion', 0),
            spectrum.get('liberty', 0),
            spectrum.get('authority', 0),
            spectrum.get('receptive', 0),
            spectrum.get('skeptic', 0),
            octant,  # Store nominal octant name
            int(__import__('time').time())
        ))
        self.db.commit()
    
    def hash_did_to_seed(self, did: str) -> int:
        """
        Convert DID to deterministic seed value, relative to the keeper's DID.
        
        The keeper's DID serves as the origin point (zero). All other DIDs
        are hashed in relation to this center, creating a spectrum space
        where the keeper is inherently at the center.
        """
        hash_bytes = hashlib.sha256(did.encode()).digest()
        did_seed = int.from_bytes(hash_bytes[:8], byteorder='big')
        
        keeper_did = self.get_keeper_did()
        keeper_hash = hashlib.sha256(keeper_did.encode()).digest()
        keeper_seed = int.from_bytes(keeper_hash[:8], byteorder='big')
        
        # Calculate relative distance from keeper
        # This ensures keeper's DID always results in zero distance
        relative_seed = abs(did_seed - keeper_seed)
        
        return relative_seed
    
    def generate_spectrum_value(self, seed: int, offset: int) -> int:
        """
        Generate a single spectrum value (0-100) deterministically using
        constants from spectrum.json algorithm spec.
        
        When seed is 0 (keeper's DID), returns 0 (origin/zero point).
        All other values are calculated relative to this origin.
        
        Args:
            seed: Relative seed from keeper's DID (0 for keeper)
            offset: Offset for this specific axis (0-5)
        
        Returns:
            Value between 0 and 100
        """
        if seed == 0:
            return 0
        
        combined = seed * self.PRIMES[offset] + (offset * self.OFFSET_PRIME)
        
        raw_value = (combined % self.PRIME_MOD_1) / self.PRIME_MOD_1
        
        variance_seed = (combined * self.VARIANCE_MULTIPLIER) % self.PRIME_MOD_2
        variance = (variance_seed % self.PRIME_MOD_1) / self.PRIME_MOD_1
        
        if raw_value < self.VARIANCE_THRESHOLD:
            adjusted = raw_value + (variance * self.VARIANCE_LOWER_MULT)
        else:
            adjusted = raw_value - (variance * self.VARIANCE_UPPER_MULT)
        
        adjusted = max(0.0, min(1.0, adjusted))
        
        value = int(adjusted * 100)
        
        return max(self.MIN_VALUE, min(self.MAX_VALUE, value))
    
    def get_server_weight(self, server: str) -> float:
        """
        Get weighting factor based on server using weights from spec.
        
        Returns:
            float: Multiplier for distance from center
        """
        if not server:
            return self.SERVER_WEIGHTS.get('default', 1.0)
        
        server_lower = server.lower()
        
        for server_key, weight in self.SERVER_WEIGHTS.items():
            if server_key == 'default':
                continue
            if server_key.lower() in server_lower:
                return weight
        
        return self.SERVER_WEIGHTS.get('default', 1.0)
    
    def apply_server_weighting(self, value: int, server: str) -> int:
        """
        Apply server-based weighting to a spectrum value.
        
        Args:
            value: Base value (0-100)
            server: Server URL
        
        Returns:
            Adjusted value (0-100)
        """
        weight = self.get_server_weight(server)
        
        distance_from_center = value - self.CENTER_POINT
        
        weighted_distance = distance_from_center * weight
        
        weighted_value = self.CENTER_POINT + weighted_distance
        
        return max(self.MIN_VALUE, min(self.MAX_VALUE, int(weighted_value)))
    
    def generate_spectrum(self, did: str, server: str = "") -> Dict[str, int]:
        """
        Generate complete spectrum for a dreamer based on their DID.
        
        The keeper is intrinsically at the origin (0, 0, 0...) because all
        calculations are relative to the keeper's DID. When the input DID
        equals the keeper's DID, the relative distance is zero, resulting
        in zero values for all axes.
        
        Args:
            did: Dreamer's DID
            server: Dreamer's server (for weighting)
        
        Returns:
            Dict with all 6 spectrum axes (0-100 each)
        """
        # If did == keeper_DID, this will be 0
        seed = self.hash_did_to_seed(did)
        
        # Keeper has seed=0, which produces all zeros (no weighting applied)
        if seed == 0:
            return {
                'entropy': 0,
                'oblivion': 0,
                'liberty': 0,
                'authority': 0,
                'receptive': 0,
                'skeptic': 0
            }
        
        # Generate base values for each axis using spec
        spectrum = {}
        
        for i, axis_info in enumerate(self.AXES):
            axis = axis_info['name']
            base_value = self.generate_spectrum_value(seed, i)
            weighted_value = self.apply_server_weighting(base_value, server)
            spectrum[axis] = weighted_value
        
        return spectrum
    
    def dreamer_has_spectrum(self, dreamer: Dict) -> bool:
        """Check if dreamer already has spectrum data"""
        if 'spectrum' not in dreamer:
            return False
        
        spectrum = dreamer['spectrum']
        required_axes = ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']
        
        # Check all axes exist and are valid numbers
        for axis in required_axes:
            if axis not in spectrum:
                return False
            if not isinstance(spectrum[axis], (int, float)):
                return False
            if spectrum[axis] < 0 or spectrum[axis] > 100:
                return False
        
        return True
    
    def update_all_spectrums(self, force_regenerate: bool = False, verbose: bool = True) -> Dict:
        """
        Update spectrum data for all dreamers in database.
        
        Args:
            force_regenerate: If True, regenerate all spectrums even if they exist
            verbose: Print progress messages
        
        Returns:
            Dict with statistics about the update
        """
        dreamers = self.load_dreamers()
        
        stats = {
            'total_dreamers': len(dreamers),
            'had_spectrum': 0,
            'generated': 0,
            'regenerated': 0,
            'errors': 0
        }
        
        for dreamer in dreamers:
            try:
                did = dreamer.get('did')
                if not did:
                    stats['errors'] += 1
                    continue
                
                server = dreamer.get('server', '')
                
                # Check if dreamer has valid spectrum
                has_spectrum = self.dreamer_has_spectrum(dreamer)
                
                if has_spectrum:
                    stats['had_spectrum'] += 1
                    
                    if force_regenerate:
                        # Regenerate from algorithm
                        spectrum = self.generate_spectrum(did, server)
                        self.save_spectrum_to_db(did, spectrum)
                        stats['regenerated'] += 1
                        if verbose:
                            print(f"  Regenerated: {dreamer.get('name', 'unknown')} ({did[:20]}...)")
                else:
                    # Generate new spectrum
                    spectrum = self.generate_spectrum(did, server)
                    self.save_spectrum_to_db(did, spectrum)
                    stats['generated'] += 1
                    if verbose:
                        print(f"  Generated: {dreamer.get('name', 'unknown')} ({did[:20]}...)")
                    
            except Exception as e:
                print(f"Error processing dreamer {dreamer.get('name', 'unknown')}: {e}")
                stats['errors'] += 1
        
        return stats
    
    def get_spectrum(self, did: str) -> Dict[str, int]:
        """
        Get spectrum for a specific DID (from database if exists, generate if not).
        
        Args:
            did: Dreamer's DID
        
        Returns:
            Spectrum dict or None if not found
        """
        dreamers = self.load_dreamers()
        
        for dreamer in dreamers:
            if dreamer.get('did') == did:
                if self.dreamer_has_spectrum(dreamer):
                    return dreamer['spectrum']
                else:
                    # Generate and save
                    server = dreamer.get('server', '')
                    spectrum = self.generate_spectrum(did, server)
                    self.save_spectrum_to_db(did, spectrum)
                    return spectrum
        
        return None
    
    def verify_test_vectors(self) -> Dict:
        """
        Verify that our implementation matches the test vectors in spectrum.json.
        
        Returns:
            Dict with test results
        """
        test_vectors = self.algo_spec.get('test_vectors', [])
        results = {
            'total_tests': len(test_vectors),
            'passed': 0,
            'failed': 0,
            'failures': []
        }
        
        for test in test_vectors:
            did = test['did']
            server = test['server']
            expected = test['expected']
            name = test['name']
            
            # Generate spectrum
            calculated = self.generate_spectrum(did, server)
            
            # Convert to list for comparison
            calc_values = [
                calculated['entropy'],
                calculated['oblivion'],
                calculated['liberty'],
                calculated['authority'],
                calculated['receptive'],
                calculated['skeptic']
            ]
            
            # Check if matches
            if calc_values == expected:
                results['passed'] += 1
                print(f"✓ {name}: PASS")
            else:
                results['failed'] += 1
                results['failures'].append({
                    'name': name,
                    'expected': expected,
                    'calculated': calc_values
                })
                print(f"✗ {name}: FAIL")
                print(f"  Expected:   {expected}")
                print(f"  Calculated: {calc_values}")
        
        return results
    
    # === Movement Functions ===
    
    def _clamp_value(self, value: int) -> int:
        """Ensure spectrum value stays within 0-100 range"""
        return max(self.MIN_VALUE, min(self.MAX_VALUE, int(value)))
    
    def _get_current_spectrum(self, did: str) -> Optional[Dict[str, int]]:
        """Get current spectrum values from database"""
        cursor = self.db.execute("""
            SELECT entropy, oblivion, liberty, authority, receptive, skeptic
            FROM spectrum WHERE did = ?
        """, (did,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        return {
            'entropy': row['entropy'],
            'oblivion': row['oblivion'],
            'liberty': row['liberty'],
            'authority': row['authority'],
            'receptive': row['receptive'],
            'skeptic': row['skeptic']
        }
    
    def _save_spectrum(self, did: str, spectrum: Dict[str, int], epoch: int = None):
        """Save spectrum to database with timestamp and calculated octant"""
        from utils.octant import calculate_octant_code
        
        timestamp = epoch if epoch else int(time.time())
        
        # Calculate octant from spectrum values
        octant = calculate_octant_code(spectrum)
        
        self.db.execute("""
            INSERT OR REPLACE INTO spectrum 
            (did, entropy, oblivion, liberty, authority, receptive, skeptic, octant, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            did,
            spectrum['entropy'],
            spectrum['oblivion'],
            spectrum['liberty'],
            spectrum['authority'],
            spectrum['receptive'],
            spectrum['skeptic'],
            octant,
            timestamp
        ))
        self.db.commit()
    
    def _calculate_distance(self, spectrum_a: Dict[str, int], spectrum_b: Dict[str, int],
                           axes: Optional[List[str]] = None) -> float:
        """
        Calculate Euclidean distance between two spectrums.
        
        Args:
            spectrum_a: First spectrum dict
            spectrum_b: Second spectrum dict
            axes: Optional list of axes to include (default: all 6)
        
        Returns:
            Euclidean distance as float
        """
        if axes is None:
            axes = ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']
        
        sum_squares = 0
        for axis in axes:
            if axis in spectrum_a and axis in spectrum_b:
                diff = spectrum_a[axis] - spectrum_b[axis]
                sum_squares += diff * diff
        
        return math.sqrt(sum_squares)
    
    def move_dreamer(self, did: str, deltas: Dict[str, int], 
                     reason: Optional[str] = None, epoch: Optional[int] = None) -> Dict:
        """
        Adjust a dreamer's spectrum coordinates by specified deltas.
        
        Args:
            did: Dreamer's DID
            deltas: Dict of axis names to delta values, e.g.:
                   {'entropy': 5, 'liberty': -10, 'authority': 3}
            reason: Optional description of why movement occurred
            epoch: Optional timestamp (defaults to current time)
        
        Returns:
            Dict with success, old_spectrum, new_spectrum, applied_deltas, distance_moved
        """
        # KEEPER PROTECTION: The keeper cannot be moved
        if 'yauphjufk7phkwurn266ybx2' in did:
            return {
                'success': False,
                'error': 'Keeper cannot be moved - position is fixed at origin',
                'did': did
            }
        
        # Get current spectrum
        old_spectrum = self._get_current_spectrum(did)
        
        if old_spectrum is None:
            return {
                'success': False,
                'error': f'Dreamer {did} not found or has no spectrum',
                'did': did
            }
        
        # Apply deltas with bounds checking
        new_spectrum = old_spectrum.copy()
        applied_deltas = {}
        
        for axis, delta in deltas.items():
            if axis in new_spectrum:
                old_value = new_spectrum[axis]
                new_value = self._clamp_value(old_value + delta)
                new_spectrum[axis] = new_value
                applied_deltas[axis] = new_value - old_value  # Actual delta after clamping
        
        # Calculate distance moved
        distance = self._calculate_distance(old_spectrum, new_spectrum)
        
        # Save to database
        self._save_spectrum(did, new_spectrum, epoch)
        
        return {
            'success': True,
            'did': did,
            'old_spectrum': old_spectrum,
            'new_spectrum': new_spectrum,
            'requested_deltas': deltas,
            'applied_deltas': applied_deltas,
            'distance_moved': distance,
            'reason': reason,
            'timestamp': epoch if epoch else int(time.time())
        }
    
    def set_dreamer_position(self, did: str, coordinates: Dict[str, int],
                            reason: Optional[str] = None, epoch: Optional[int] = None) -> Dict:
        """
        Set a dreamer's spectrum coordinates to absolute values.
        
        Args:
            did: Dreamer's DID
            coordinates: Dict of axis names to absolute values (0-100), e.g.:
                        {'entropy': 75, 'liberty': 80}
            reason: Optional description
            epoch: Optional timestamp
        
        Returns:
            Dict with success, old_spectrum, new_spectrum, distance_moved
        """
        # KEEPER PROTECTION: The keeper cannot be moved
        if 'yauphjufk7phkwurn266ybx2' in did:
            return {
                'success': False,
                'error': 'Keeper cannot be moved - position is fixed at origin',
                'did': did
            }
        
        # Get current spectrum
        old_spectrum = self._get_current_spectrum(did)
        
        if old_spectrum is None:
            return {
                'success': False,
                'error': f'Dreamer {did} not found or has no spectrum',
                'did': did
            }
        
        # Build new spectrum with bounds checking
        new_spectrum = old_spectrum.copy()
        
        for axis, value in coordinates.items():
            if axis in new_spectrum:
                new_spectrum[axis] = self._clamp_value(value)
        
        # Calculate distance moved
        distance = self._calculate_distance(old_spectrum, new_spectrum)
        
        # Save to database
        self._save_spectrum(did, new_spectrum, epoch)
        
        return {
            'success': True,
            'did': did,
            'old_spectrum': old_spectrum,
            'new_spectrum': new_spectrum,
            'distance_moved': distance,
            'reason': reason,
            'timestamp': epoch if epoch else int(time.time())
        }
    
    def move_dreamer_toward(self, did: str, target_did: str, 
                           percentage: float = 0.1, 
                           axes: Optional[List[str]] = None,
                           reason: Optional[str] = None,
                           epoch: Optional[int] = None) -> Dict:
        """
        Move a dreamer toward another dreamer's position by a percentage.
        
        Args:
            did: Dreamer to move
            target_did: Dreamer to move toward
            percentage: How far to move (0.0 to 1.0), e.g., 0.1 = 10% closer
            axes: Optional list of axes to affect (default: all 6)
            reason: Optional description
            epoch: Optional timestamp
        
        Returns:
            Dict with success, old_spectrum, new_spectrum, distance_moved, initial_distance
        """
        # KEEPER PROTECTION: The keeper cannot be moved
        if 'yauphjufk7phkwurn266ybx2' in did:
            return {
                'success': False,
                'error': 'Keeper cannot be moved - position is fixed at origin',
                'did': did
            }
        
        # Get both spectrums
        source_spectrum = self._get_current_spectrum(did)
        target_spectrum = self._get_current_spectrum(target_did)
        
        if source_spectrum is None:
            return {
                'success': False,
                'error': f'Source dreamer {did} not found or has no spectrum',
                'did': did
            }
        
        if target_spectrum is None:
            return {
                'success': False,
                'error': f'Target dreamer {target_did} not found or has no spectrum',
                'target_did': target_did
            }
        
        # Default to all axes
        if axes is None:
            axes = ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']
        
        # Clamp percentage
        percentage = max(0.0, min(1.0, percentage))
        
        # Calculate initial distance
        initial_distance = self._calculate_distance(source_spectrum, target_spectrum, axes)
        
        # Move toward target
        new_spectrum = source_spectrum.copy()
        
        for axis in axes:
            if axis in source_spectrum and axis in target_spectrum:
                current = source_spectrum[axis]
                target = target_spectrum[axis]
                delta = (target - current) * percentage
                new_spectrum[axis] = self._clamp_value(current + delta)
        
        # Calculate distance moved
        distance_moved = self._calculate_distance(source_spectrum, new_spectrum)
        final_distance = self._calculate_distance(new_spectrum, target_spectrum, axes)
        
        # Save to database
        self._save_spectrum(did, new_spectrum, epoch)
        
        return {
            'success': True,
            'did': did,
            'target_did': target_did,
            'old_spectrum': source_spectrum,
            'new_spectrum': new_spectrum,
            'target_spectrum': target_spectrum,
            'distance_moved': distance_moved,
            'initial_distance': initial_distance,
            'final_distance': final_distance,
            'percentage': percentage,
            'affected_axes': axes,
            'reason': reason,
            'timestamp': epoch if epoch else int(time.time())
        }
    
    def get_distance_between(self, did_a: str, did_b: str, 
                            axes: Optional[List[str]] = None) -> Optional[float]:
        """
        Calculate Euclidean distance between two dreamers.
        
        Args:
            did_a: First dreamer's DID
            did_b: Second dreamer's DID
            axes: Optional list of axes to include (default: all 6)
        
        Returns:
            Float distance value, or None if either dreamer not found
        """
        spectrum_a = self._get_current_spectrum(did_a)
        spectrum_b = self._get_current_spectrum(did_b)
        
        if spectrum_a is None or spectrum_b is None:
            return None
        
        return self._calculate_distance(spectrum_a, spectrum_b, axes)
    
    def get_dreamers_in_radius(self, center_did: str, radius: float,
                              axes: Optional[List[str]] = None,
                              limit: Optional[int] = None) -> List[Dict]:
        """
        Find all dreamers within specified distance from center.
        
        Args:
            center_did: Center point dreamer's DID
            radius: Maximum distance
            axes: Optional list of axes to consider (default: all 6)
            limit: Optional maximum number of results
        
        Returns:
            List of dicts with dreamer info and distance, sorted by distance
        """
        center_spectrum = self._get_current_spectrum(center_did)
        
        if center_spectrum is None:
            return []
        
        # Get all dreamers with spectrum
        cursor = self.db.execute("""
            SELECT d.did, d.handle, d.name, d.server,
                   s.entropy, s.oblivion, s.liberty, s.authority, s.receptive, s.skeptic
            FROM dreamers d
            INNER JOIN spectrum s ON d.did = s.did
            WHERE d.did != ?
        """, (center_did,))
        
        results = []
        
        for row in cursor.fetchall():
            dreamer_spectrum = {
                'entropy': row['entropy'],
                'oblivion': row['oblivion'],
                'liberty': row['liberty'],
                'authority': row['authority'],
                'receptive': row['receptive'],
                'skeptic': row['skeptic']
            }
            
            distance = self._calculate_distance(center_spectrum, dreamer_spectrum, axes)
            
            if distance <= radius:
                results.append({
                    'did': row['did'],
                    'handle': row['handle'],
                    'name': row['name'],
                    'server': row['server'],
                    'spectrum': dreamer_spectrum,
                    'distance': distance
                })
        
        # Sort by distance
        results.sort(key=lambda x: x['distance'])
        
        # Apply limit if specified
        if limit is not None and limit > 0:
            results = results[:limit]
        
        return results
    
    def reset_to_origin(self, did: str, server: Optional[str] = None,
                       reason: Optional[str] = None, epoch: Optional[int] = None) -> Dict:
        """
        Reset a dreamer's spectrum to their algorithmically-generated origin position.
        
        Args:
            did: Dreamer's DID
            server: Optional server (if None, will look up from database)
            reason: Optional description
            epoch: Optional timestamp
        
        Returns:
            Dict with success, old_spectrum, new_spectrum, distance_moved
        """
        # Get current spectrum
        old_spectrum = self._get_current_spectrum(did)
        
        if old_spectrum is None:
            return {
                'success': False,
                'error': f'Dreamer {did} not found or has no spectrum',
                'did': did
            }
        
        # Get server if not provided
        if server is None:
            cursor = self.db.execute("SELECT server FROM dreamers WHERE did = %s", (did,))
            row = cursor.fetchone()
            server = row['server'] if row else ''
        
        # Generate origin spectrum
        new_spectrum = self.generate_spectrum(did, server)
        
        # Calculate distance moved
        distance = self._calculate_distance(old_spectrum, new_spectrum)
        
        # Save to database
        self._save_spectrum(did, new_spectrum, epoch)
        
        return {
            'success': True,
            'did': did,
            'old_spectrum': old_spectrum,
            'new_spectrum': new_spectrum,
            'distance_moved': distance,
            'reason': reason or 'reset to algorithmic origin',
            'timestamp': epoch if epoch else int(time.time())
        }


def main():
    """Run spectrum update (can be called from sync scripts)"""
    manager = SpectrumManager()
    
    print("Updating dreamer spectrums...")
    print(f"Algorithm version: {manager.algo_spec['version']}")
    print(f"Keeper DID: {manager.KEEPER_DID}")
    print()
    
    stats = manager.update_all_spectrums(verbose=True)
    
    print(f"\nSpectrum Update Complete:")
    print(f"  Total dreamers: {stats['total_dreamers']}")
    print(f"  Already had spectrum: {stats['had_spectrum']}")
    print(f"  Generated new: {stats['generated']}")
    print(f"  Regenerated: {stats['regenerated']}")
    print(f"  Errors: {stats['errors']}")
    
    # Verify test vectors
    print("\nVerifying test vectors...")
    test_results = manager.verify_test_vectors()
    print(f"\nTest Results: {test_results['passed']}/{test_results['total_tests']} passed")
    
    if test_results['failed'] > 0:
        print(f"⚠️  {test_results['failed']} tests failed!")
        return 1
    else:
        print("✓ All tests passed!")
        return 0


if __name__ == '__main__':
    exit(main())
