/**
 * Spectrum Utilities
 * Shared constants and helper functions for spectrum visualization
 */

/**
 * Octant descriptions with axes and descriptive text
 */
export const OCTANT_DESCRIPTIONS = {
    'adaptive': { 
        axes: 'Entropy • Liberty • Receptive', 
        desc: 'embracing change prolongs freedom' 
    },
    'chaotic': { 
        axes: 'Entropy • Liberty • Skeptic', 
        desc: 'increasing possibility unlocks momentum' 
    },
    'prepared': { 
        axes: 'Entropy • Authority • Receptive', 
        desc: 'contemplative foresight averts disaster' 
    },
    'intended': { 
        axes: 'Entropy • Authority • Skeptic', 
        desc: 'independent action delivers results' 
    },
    'equilibrium': { 
        axes: 'All Axes in Perfect Balance', 
        desc: 'centered only to self' 
    },
    'confused': { 
        axes: 'One Axis Resolved, Two in Tension', 
        desc: 'split decision clouds judgment' 
    },
    'singling': { 
        axes: 'Two Axes Resolved, One Dominant', 
        desc: 'narrow dogma tightens vision' 
    },
    'contented': { 
        axes: 'Oblivion • Liberty • Receptive', 
        desc: 'relentless acceptance begets peace' 
    },
    'assertive': { 
        axes: 'Oblivion • Liberty • Skeptic', 
        desc: 'outbound query solves doubt' 
    },
    'ordered': { 
        axes: 'Oblivion • Authority • Receptive', 
        desc: 'disciplined governence builds structure' 
    },
    'guarded': { 
        axes: 'Oblivion • Authority • Skeptic', 
        desc: 'protective rejection averts malinfluence' 
    }
};

/**
 * Axis colors for spectrum visualization
 */
export const AXIS_COLORS = {
    entropy: '#ff6b35',
    oblivion: '#9333ea',
    authority: '#dc2626',
    liberty: '#3b82f6',
    skeptic: '#eab308',
    receptive: '#10b981'
};

/**
 * Canvas dimensions for spectrum images
 */
export const CANVAS_DIMENSIONS = {
    width: 1200,
    height: 675
};

/**
 * Get octant info by name
 * @param {string} octantName - The name of the octant
 * @returns {Object} Octant info with axes and description
 */
export function getOctantInfo(octantName) {
    return OCTANT_DESCRIPTIONS[octantName] || OCTANT_DESCRIPTIONS['equilibrium'];
}

/**
 * Configure canvas for pixel-perfect rendering
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
export function configurePixelPerfectCanvas(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
}

/**
 * Load an image with error handling
 * @param {string} src - Image source URL
 * @returns {Promise<HTMLImageElement>} Loaded image
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}

/**
 * Calculate percentage for a spectrum axis pair
 * @param {number} value1 - First axis value
 * @param {number} value2 - Second axis value
 * @returns {number} Percentage (0-100) of first value
 */
export function calculateAxisPercentage(value1, value2) {
    const total = value1 + value2;
    return total > 0 ? (value1 / total) * 100 : 50;
}

/**
 * Draw a spectrum gradient bar
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} params - Bar parameters
 * @param {number} params.x - X position
 * @param {number} params.y - Y position
 * @param {number} params.width - Bar width
 * @param {number} params.height - Bar height
 * @param {string} params.color1 - Start color
 * @param {string} params.color2 - End color
 * @param {number} params.percentage - Percentage for gradient midpoint
 */
export function drawSpectrumBar(ctx, { x, y, width, height, color1, color2, percentage }) {
    // Background
    ctx.fillStyle = 'rgba(20, 15, 12, 0.6)';
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = 'rgba(100, 80, 60, 0.4)';
    ctx.strokeRect(x, y, width, height);
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(0.5, percentage < 50 ? color2 : color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
}

/**
 * Format coordinates text (e.g., "O A S R L E")
 * @param {Object} spectrum - Spectrum values
 * @returns {string} Formatted coordinates
 */
export function formatCoordinates(spectrum) {
    const coords = [];
    
    // Entropy-Oblivion
    if (spectrum.entropy > spectrum.oblivion) {
        coords.push('E');
    } else if (spectrum.oblivion > spectrum.entropy) {
        coords.push('O');
    }
    
    // Authority-Liberty
    if (spectrum.authority > spectrum.liberty) {
        coords.push('A');
    } else if (spectrum.liberty > spectrum.authority) {
        coords.push('L');
    }
    
    // Skeptic-Receptive
    if (spectrum.skeptic > spectrum.receptive) {
        coords.push('S');
    } else if (spectrum.receptive > spectrum.skeptic) {
        coords.push('R');
    }
    
    return coords.join(' ');
}
