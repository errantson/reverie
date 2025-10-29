#!/usr/bin/env python3
"""
Octant Calculation Utility

Provides octant calculation and color mapping for Python backend.
This mirrors the JavaScript octant.js utility for server-side use.

Note: As of database migration (2025), octants are stored as lowercase names
(flow, experiment, etc.) rather than symbolic codes (+++, ++-, etc.)
"""

from typing import Dict, Optional, Tuple


# Octant modality names - stored as nominal keys for better qualia
OCTANT_MODALITIES = {
    'adaptive': 'Adaptive',
    'chaotic': 'Chaotic',
    'intended': 'Intended',
    'prepared': 'Prepared',
    'contented': 'Contented',
    'assertive': 'Assertive',
    'ordered': 'Ordered',
    'guarded': 'Guarded',
    'equilibrium': 'Equilibrium',
    'confused': 'Confused',
    'singling': 'Singling'
}

# Mapping from coordinate signs to octant names
OCTANT_CODE_TO_NAME = {
    '+++': 'adaptive',      # Entropy • Liberty • Receptive
    '++-': 'chaotic',       # Entropy • Liberty • Skeptic
    '+-+': 'prepared',      # Entropy • Authority • Receptive
    '+--': 'intended',      # Entropy • Authority • Skeptic
    '-++': 'contented',     # Oblivion • Liberty • Receptive
    '-+-': 'assertive',     # Oblivion • Liberty • Skeptic
    '--+': 'ordered',       # Oblivion • Authority • Receptive
    '---': 'guarded'        # Oblivion • Authority • Skeptic
}

# RGB color values for each octant (by nominal name)
OCTANT_RGB = {
    'adaptive': {'r': 100, 'g': 255, 'b': 200},
    'chaotic': {'r': 100, 'g': 200, 'b': 255},
    'intended': {'r': 255, 'g': 100, 'b': 150},
    'prepared': {'r': 255, 'g': 180, 'b': 100},
    'contented': {'r': 255, 'g': 150, 'b': 255},
    'assertive': {'r': 150, 'g': 150, 'b': 255},
    'ordered': {'r': 255, 'g': 255, 'b': 100},
    'guarded': {'r': 200, 'g': 100, 'b': 255},
    'equilibrium': {'r': 200, 'g': 200, 'b': 200},
    'confused': {'r': 180, 'g': 180, 'b': 200},
    'singling': {'r': 200, 'g': 180, 'b': 180}
}


def calculate_octant_code(spectrum: Dict[str, int]) -> Optional[str]:
    """
    Calculate octant nominal name from spectrum values.
    
    Always returns nominal names (adaptive, chaotic, equilibrium, etc.) 
    instead of cryptic codes for better qualia understanding.
    
    Args:
        spectrum: Dict with entropy, oblivion, liberty, authority, receptive, skeptic
    
    Returns:
        str: Octant name like 'adaptive', 'assertive', 'equilibrium', etc., or None if spectrum is invalid
    """
    if not spectrum:
        return None
    
    # Calculate xyz differences for each axis pair
    # x = entropy - oblivion
    # y = liberty - authority  
    # z = receptive - skeptic
    x = (spectrum.get('entropy', 0) or 0) - (spectrum.get('oblivion', 0) or 0)
    y = (spectrum.get('liberty', 0) or 0) - (spectrum.get('authority', 0) or 0)
    z = (spectrum.get('receptive', 0) or 0) - (spectrum.get('skeptic', 0) or 0)
    
    # Count balanced axes
    balanced_count = sum([x == 0, y == 0, z == 0])
    
    # Check for equilibrium (all three axes balanced)
    if balanced_count == 3:
        return 'equilibrium'
    
    # Check for singling (two axes balanced, one unbalanced)
    if balanced_count == 2:
        return 'singling'
    
    # Check for confused (one axis balanced, two unbalanced)
    if balanced_count == 1:
        return 'confused'
    
    # Normal octant (no axes balanced)
    # Determine signs for octant calculation
    x_sign = '+' if x >= 0 else '-'
    y_sign = '+' if y >= 0 else '-'
    z_sign = '+' if z >= 0 else '-'
    
    # Convert to octant nominal name
    code = x_sign + y_sign + z_sign
    return OCTANT_CODE_TO_NAME.get(code)


def get_octant_name(octant: str) -> str:
    """
    Get display name for an octant.
    
    Args:
        octant: Octant name like 'adaptive' or old code like '+++'
    
    Returns:
        str: Display name like 'Adaptive'
    """
    # Handle both new names and old codes for backwards compatibility
    if octant in OCTANT_MODALITIES:
        return OCTANT_MODALITIES[octant]
    elif octant in OCTANT_CODE_TO_NAME:
        return OCTANT_MODALITIES[OCTANT_CODE_TO_NAME[octant]]
    return 'Unknown'


def get_octant_color(octant: str) -> str:
    """
    Get CSS color string for an octant.
    
    Args:
        octant: Octant name like 'adaptive' or old code like '+++'
    
    Returns:
        str: CSS rgb() string
    """
    # Handle both new names and old codes for backwards compatibility
    if octant in OCTANT_RGB:
        rgb = OCTANT_RGB[octant]
    elif octant in OCTANT_CODE_TO_NAME:
        rgb = OCTANT_RGB[OCTANT_CODE_TO_NAME[octant]]
    else:
        rgb = {'r': 128, 'g': 128, 'b': 128}
    
    return f"rgb({rgb['r']}, {rgb['g']}, {rgb['b']})"


def get_octant_rgb(octant: str) -> Dict[str, int]:
    """
    Get RGB values for an octant.
    
    Args:
        octant: Octant name like 'adaptive' or old code like '+++'
    
    Returns:
        dict: Dictionary with 'r', 'g', 'b' keys
    """
    # Handle both new names and old codes for backwards compatibility
    if octant in OCTANT_RGB:
        return OCTANT_RGB[octant]
    elif octant in OCTANT_CODE_TO_NAME:
        return OCTANT_RGB[OCTANT_CODE_TO_NAME[octant]]
    return {'r': 128, 'g': 128, 'b': 128}


def calculate_octant_with_metadata(spectrum: Dict[str, int]) -> Dict:
    """
    Calculate octant with full metadata including name and color.
    
    Args:
        spectrum: Dict with entropy, oblivion, liberty, authority, receptive, skeptic
    
    Returns:
        dict: Dictionary with octant (name), displayName, color, rgb keys
    """
    octant_name = calculate_octant_code(spectrum)
    
    if not octant_name:
        return {
            'octant': None,
            'displayName': 'Unknown',
            'color': 'rgb(128, 128, 128)',
            'rgb': {'r': 128, 'g': 128, 'b': 128}
        }
    
    return {
        'octant': octant_name,
        'displayName': get_octant_name(octant_name),
        'color': get_octant_color(octant_name),
        'rgb': get_octant_rgb(octant_name)
    }


def update_octant_in_db(db, did: str, spectrum: Dict[str, int]) -> Optional[str]:
    """
    Calculate and update octant in database for a dreamer.
    
    Args:
        db: DatabaseManager instance
        did: Dreamer's DID
        spectrum: Dict with spectrum values
    
    Returns:
        str: Updated octant name, or None if failed
    """
    octant_name = calculate_octant_code(spectrum)
    
    if octant_name:
        db.execute("""
            UPDATE spectrum
            SET octant = ?
            WHERE did = ?
        """, (octant_name, did))
    
    return octant_name
