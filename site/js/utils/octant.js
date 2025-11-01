/**
 * Octant Utility
 * 
 * Provides shared octant calculation and color mapping
 * Used across spectrum visualizer, database, and other components
 */

// Octant modality names based on coordinate signs
// Format: xyz where + or - represents the sign of each axis
// x = entropy - oblivion
// y = liberty - authority
// z = receptive - skeptic
export const OCTANT_MODALITIES = {
    '+++': 'adaptive',
    '++-': 'chaotic',
    '+-+': 'prepared',
    '+--': 'intended',
    '-++': 'contented',
    '-+-': 'assertive',
    '--+': 'ordered',
    '---': 'guarded',
    'equilibrium': 'equilibrium',
    'confused': 'confused',
    'singling': 'singling'
};

// Display names for each octant
export const OCTANT_DISPLAY_NAMES = {
    'adaptive': 'Adaptive',
    'chaotic': 'Chaotic',
    'prepared': 'Prepared',
    'intended': 'Intended',
    'contented': 'Contented',
    'assertive': 'Assertive',
    'ordered': 'Ordered',
    'guarded': 'Guarded',
    'equilibrium': 'Equilibrium',
    'confused': 'Confused',
    'singling': 'Singling'
};

// RGB color values for each octant
export const OCTANT_RGB = {
    'adaptive': { r: 100, g: 255, b: 200 },
    'chaotic': { r: 100, g: 200, b: 255 },
    'prepared': { r: 255, g: 180, b: 100 },
    'intended': { r: 255, g: 100, b: 150 },
    'contented': { r: 255, g: 150, b: 255 },
    'assertive': { r: 150, g: 150, b: 255 },
    'ordered': { r: 255, g: 255, b: 100 },
    'guarded': { r: 200, g: 100, b: 255 },
    'equilibrium': { r: 200, g: 200, b: 200 },
    'confused': { r: 180, g: 180, b: 200 },
    'singling': { r: 200, g: 180, b: 180 }
};

// CSS color strings for each octant
export const OCTANT_COLORS = {
    'adaptive': 'rgb(100, 255, 200)',
    'chaotic': 'rgb(100, 200, 255)',
    'prepared': 'rgb(255, 180, 100)',
    'intended': 'rgb(255, 100, 150)',
    'contented': 'rgb(255, 150, 255)',
    'assertive': 'rgb(150, 150, 255)',
    'ordered': 'rgb(255, 255, 100)',
    'guarded': 'rgb(200, 100, 255)',
    'equilibrium': 'rgb(200, 200, 200)',
    'confused': 'rgb(180, 180, 200)',
    'singling': 'rgb(200, 180, 180)'
};

/**
 * Calculate octant code from spectrum scores
 * Handles special cases: equilibrium, confused, singling
 * @param {Object} spectrum - Spectrum object with all 6 scores
 * @returns {string} Octant name (e.g., 'adaptive', 'equilibrium', etc.)
 */
export function getOctantCode(spectrum) {
    if (!spectrum) return null;
    
    // Calculate xyz coordinates
    const x = (spectrum.entropy || 0) - (spectrum.oblivion || 0);
    const y = (spectrum.liberty || 0) - (spectrum.authority || 0);
    const z = (spectrum.receptive || 0) - (spectrum.skeptic || 0);
    
    // Count balanced axes
    const balancedCount = (x === 0 ? 1 : 0) + (y === 0 ? 1 : 0) + (z === 0 ? 1 : 0);
    
    // Handle special cases
    if (balancedCount === 3) {
        return 'equilibrium';
    }
    if (balancedCount === 2) {
        return 'singling';
    }
    if (balancedCount === 1) {
        return 'confused';
    }
    
    // Normal octant - determine signs
    const xSign = x >= 0 ? '+' : '-';
    const ySign = y >= 0 ? '+' : '-';
    const zSign = z >= 0 ? '+' : '-';
    
    const code = xSign + ySign + zSign;
    return OCTANT_MODALITIES[code] || null;
}

/**
 * Get modality display name for an octant
 * @param {string} octantName - Octant name (e.g., 'adaptive', 'equilibrium')
 * @returns {string} Display name (e.g., 'Adaptive')
 */
export function getOctantName(octantName) {
    return OCTANT_DISPLAY_NAMES[octantName] || 'Unknown';
}

/**
 * Get color for an octant
 * @param {string} octantName - Octant name (e.g., 'adaptive', 'equilibrium')
 * @returns {string} CSS color string
 */
export function getOctantColor(octantName) {
    return OCTANT_COLORS[octantName] || 'rgb(128, 128, 128)';
}

/**
 * Get RGB values for an octant
 * @param {string} octantName - Octant name (e.g., 'adaptive', 'equilibrium')
 * @returns {Object} Object with r, g, b properties
 */
export function getOctantRGB(octantName) {
    return OCTANT_RGB[octantName] || { r: 128, g: 128, b: 128 };
}

/**
 * Calculate octant from spectrum with intensity-based color
 * @param {Object} spectrum - Spectrum object with all 6 scores
 * @returns {Object} Object with code, name, color, rgb, and distance
 */
export function calculateOctant(spectrum) {
    if (!spectrum) {
        return {
            code: null,
            name: 'Unknown',
            color: 'rgb(128, 128, 128)',
            rgb: { r: 128, g: 128, b: 128 },
            distance: 0
        };
    }
    
    const octantName = getOctantCode(spectrum);
    const displayName = getOctantName(octantName);
    const baseRGB = getOctantRGB(octantName);
    
    // Calculate distance from origin for intensity
    const x = (spectrum.entropy || 0) - (spectrum.oblivion || 0);
    const y = (spectrum.liberty || 0) - (spectrum.authority || 0);
    const z = (spectrum.receptive || 0) - (spectrum.skeptic || 0);
    const distance = Math.sqrt(x*x + y*y + z*z);
    
    // Apply intensity fade (same as spectrum visualizer)
    const maxDistance = 173; // sqrt(100^2 + 100^2 + 100^2) ≈ 173
    const intensity = Math.min(1, distance / maxDistance);
    const fade = 0.4 + (intensity * 0.6);
    
    const r = Math.round(255 - (255 - baseRGB.r) * fade);
    const g = Math.round(255 - (255 - baseRGB.g) * fade);
    const b = Math.round(255 - (255 - baseRGB.b) * fade);
    
    return {
        code: octantName,
        name: displayName,
        color: `rgb(${r}, ${g}, ${b})`,
        rgb: { r, g, b },
        distance,
        intensity
    };
}

// Export for non-module usage (global window)
if (typeof window !== 'undefined') {
    window.OctantUtil = {
        OCTANT_MODALITIES,
        OCTANT_RGB,
        OCTANT_COLORS,
        getOctantCode,
        getOctantName,
        getOctantColor,
        getOctantRGB,
        calculateOctant
    };
}
