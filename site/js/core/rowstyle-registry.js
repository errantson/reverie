/**
 * RowStyle Registry
 * Central definition system for all row styling in Reverie House
 */

const RowStyleRegistry = {
    
    // =========================================================================
    // BASIC STYLES
    // =========================================================================
    
    default: {
        name: "default",
        description: "Plain white/grey default row",
        category: "basic",
        rendering: {
            cssClasses: ['row-entry'],
            cssFiles: [],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'White/transparent',
                border: 'None',
                color: 'Black text (#333)',
                animation: 'None'
            }
        },
        matches: (event) => {
            // Default style when nothing else matches
            return true;
        }
    },
    
    user: {
        name: "user",
        description: "Minimal highlight with user color",
        category: "basic",
        rendering: {
            cssClasses: ['row-entry', 'color-user', 'intensity-none'],
            cssFiles: ['color-rows.css'],
            cssVariables: ['--user-color'],  // Dynamic per-user color
            effects: [],
            appearance: {
                background: 'Subtle gradient with user color tint (~15% opacity)',
                border: '2px solid user color (left)',
                color: 'User color mixed with black',
                animation: 'None'
            }
        },
        matches: (event) => {
            return event.color_source === 'user' && event.color_intensity === 'none';
        }
    },
    
    userhigh: {
        name: "userhigh",
        description: "User color with highlight background",
        category: "basic",
        rendering: {
            cssClasses: ['row-entry', 'color-user', 'intensity-highlight'],
            cssFiles: ['color-rows.css'],
            cssVariables: ['--user-color'],
            effects: [],
            appearance: {
                background: 'Noticeable gradient with user color (15-3% fade)',
                border: '2px solid user color (left)',
                color: 'Strong user color (85% mix with black)',
                animation: 'None'
            }
        },
        matches: (event) => {
            return event.color_source === 'user' 
                && event.color_intensity === 'highlight'
                && event.key !== 'canon'
                && event.key !== 'dream';
        }
    },
    
    canon: {
        name: "canon",
        description: "Special emphasis for canon events",
        category: "basic",
        rendering: {
            cssClasses: ['row-entry', 'color-user', 'intensity-special', 'event-key-canon'],
            cssFiles: ['color-rows.css'],
            cssVariables: ['--user-color'],
            effects: [],
            appearance: {
                background: 'Strong gradient with user color (30-8% fade)',
                border: '4px solid user color (left)',
                color: 'Very strong user color (92% mix with black)',
                animation: 'None',
                special: 'Inset border shadow, bold font weight'
            }
        },
        matches: (event) => {
            return event.color_source === 'user' 
                && (event.key === 'canon' || event.color_intensity === 'special')
                && event.key !== 'dream';
        }
    },
    
    dream: {
        name: "dream",
        description: "Extra pronounced with shimmer effect for dream events",
        category: "basic",
        rendering: {
            cssClasses: ['row-entry', 'event-key-dream', 'color-user', 'intensity-special'],
            cssFiles: ['color-rows.css'],
            cssVariables: ['--user-color'],
            effects: [],
            appearance: {
                background: 'Very strong gradient (35-10% fade)',
                border: '4px solid user color (left)',
                color: 'Intense user color (95% mix with black)',
                animation: 'Pulsing shimmer glow (3s infinite)',
                special: 'Glowing box shadow, bold font'
            }
        },
        matches: (event) => {
            return event.key === 'dream' 
                && event.color_source === 'user'
                && !event.souvenir_key;  // Not a souvenir dream
        }
    },
    
    // =========================================================================
    // NIGHTMARE STYLE - For "prepares for the ending" events
    // =========================================================================
    
    nightmare: {
        name: "nightmare",
        description: "Enhanced dark smokey animated nightmare with pulsing tension for preparation events",
        category: "special",
        rendering: {
            cssClasses: ['row-entry', 'event-type-nightmare', 'event-key-prepare', 'intensity-special'],
            cssFiles: ['color-rows.css'],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'Multi-layered animated smoke gradients with atmospheric depth',
                border: '3px solid dark charcoal (#2a2a35)',
                color: 'White (#ffffff) with text shadow',
                animation: 'Complex smoke drift (25s) + tension pulse (8s) + particle float (18s)',
                special: 'Enhanced smoke particles, pulsing brightness, multiple gradient layers'
            }
        },
        matches: (event) => {
            // Match events with type 'nightmare' or key 'prepare' 
            return event.type === 'nightmare' || event.key === 'prepare';
        }
    },
    
    // =========================================================================
    // DISSIPATE STYLE - Faded away appearance
    // =========================================================================
    
    dissipate: {
        name: "dissipate",
        description: "Enhanced faded grey mist with subtle particles and gentle drift for departed dreamers",
        category: "special",
        rendering: {
            cssClasses: ['row-entry', 'event-type-dissipate', 'intensity-faded'],
            cssFiles: ['color-rows.css'],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'Layered misty gradients with floating particles and subtle opacity',
                border: '2px solid faded grey with transparency',
                color: 'Muted grey (#888) with blur filter',
                animation: 'Gentle mist drift (45s) with opacity variation',
                special: 'Multiple particle gradients, greyscale filter, border fade overlay'
            }
        },
        matches: (event) => {
            return event.key === 'dissipate' || event.type === 'departure';
        }
    },
    
    // =========================================================================
    // SOUVENIR STYLES - STRANGE DREAM
    // =========================================================================
    
    strangedream: {
        name: "strangedream",
        description: "Reality-bending psychedelic pattern with word sway",
        category: "souvenir",
        rendering: {
            cssClasses: ['row-entry', 'color-souvenir', 'souvenir-strange', 'intensity-highlight'],
            cssFiles: ['souvenirs.css'],
            cssVariables: [],  // No dynamic variables - uses static souvenir colors
            effects: ['snakecharmer'],  // EXPLICIT: triggers word sway animation
            appearance: {
                background: 'Psychedelic crosshatch pattern with hue-shifting pastels (45deg repeating gradients)',
                border: '3px solid purple (#7B5A9E) with glow overlay',
                color: 'Dark purple (#4A2D5F)',
                animation: 'Rolling pattern (45s) + gentle hue shift (36s) + scanlines (18s)',
                special: 'Individual words sway with staggered delays (snakecharmer effect)'
            }
        },
        matches: (event) => {
            return event.color_source === 'souvenir' 
                && event.key === 'strange' 
                && event.color_intensity !== 'special';
        }
    },
    
    strangedreamintense: {
        name: "strangedreamintense",
        description: "Intense reality-bending with dramatic word dance",
        category: "souvenir",
        extends: "strangedream",
        rendering: {
            cssClasses: ['row-entry', 'color-souvenir', 'souvenir-strange', 'intensity-special'],
            cssFiles: ['souvenirs.css'],
            cssVariables: [],
            effects: ['snakecharmer'],
            appearance: {
                background: 'Same as strangedream but MORE intense',
                border: '4px solid bright purple with stronger glow',
                color: 'Very dark purple',
                animation: 'Faster rolling + more dramatic hue shifts + intense scanlines',
                special: 'More pronounced word sway with larger amplitude'
            }
        },
        matches: (event) => {
            return event.color_source === 'souvenir' 
                && event.key === 'strange' 
                && event.color_intensity === 'special';
        }
    },
    
    // =========================================================================
    // SOUVENIR STYLES - ARRIVAL
    // =========================================================================
    
    arrival: {
        name: "arrival",
        description: "Welcoming banner background for arrival events",
        category: "souvenir",
        rendering: {
            cssClasses: ['row-entry', 'color-souvenir', 'souvenir-arrival', 'intensity-highlight'],
            cssFiles: ['souvenirs.css'],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'Warm welcoming gradient (peachy-golden tones)',
                border: '3px solid warm orange',
                color: 'Rich brown',
                animation: 'None',
                special: 'Banner-like appearance for new arrivals'
            }
        },
        matches: (event) => {
            return event.color_source === 'souvenir' && event.key === 'arrival';
        }
    },
    
    // =========================================================================
    // SOUVENIR STYLES - BELL
    // =========================================================================
    
    bell: {
        name: "bell",
        description: "Burgundy with animated audio waveform signal",
        category: "souvenir",
        rendering: {
            cssClasses: ['row-entry', 'color-souvenir', 'souvenir-bell', 'intensity-highlight'],
            cssFiles: ['souvenirs.css'],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'Deep burgundy to burnt orange gradient with animated audio waveform',
                border: '3px solid burgundy (#8B1538)',
                color: 'Warm cream (#F5E6D3)',
                animation: 'Audio waveform pulse (2.5s infinite ease-in-out)',
                special: 'Animated sound wave pattern through center, burgundy/deep orange palette'
            }
        },
        matches: (event) => {
            return event.color_source === 'souvenir' && event.key === 'bell';
        }
    },
    
    // =========================================================================
    // SOUVENIR STYLES - RESIDENCE
    // =========================================================================
    
    residence: {
        name: "residence",
        description: "Lapis to ultramarine animated gradient with floating wave",
        category: "souvenir",
        rendering: {
            cssClasses: ['row-entry', 'color-souvenir', 'souvenir-residence', 'intensity-highlight'],
            cssFiles: ['souvenirs.css'],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'Lapis to ultramarine animated gradient',
                border: '3px solid deep blue',
                color: 'Yellow-gold (#ebd08b)',
                animation: 'Slow gradient shift (8s infinite) + rolling light wave (4s infinite)',
                special: 'Gold text with rolling lightness wave sweeping across background'
            }
        },
        matches: (event) => {
            return event.color_source === 'souvenir' 
                && event.key === 'residence' 
                && event.color_intensity !== 'special';
        }
    },
    
    residenceintense: {
        name: "residenceintense",
        description: "Dramatic lapis gradient with intense shifting",
        category: "souvenir",
        extends: "residence",
        rendering: {
            cssClasses: ['row-entry', 'color-souvenir', 'souvenir-residence', 'intensity-special'],
            cssFiles: ['souvenirs.css'],
            cssVariables: [],
            effects: [],
            appearance: {
                background: 'More dramatic lapis gradient',
                border: '4px solid very deep blue',
                color: 'Yellow-gold (#ebd08b)',
                animation: 'Faster gradient shift (6s infinite) with bubbles',
                special: 'Bold gold text with floating bubbles effect'
            }
        },
        matches: (event) => {
            return event.color_source === 'souvenir' 
                && event.key === 'residence' 
                && event.color_intensity === 'special';
        }
    },
    
    
    // =========================================================================
    // ROLE STYLES
    // =========================================================================
    
    greeter: {
        name: "greeter",
        description: "Cyan highlight for greeter work",
        category: "role",
        rendering: {
            cssClasses: ['row-entry', 'color-role', 'role-greeter', 'intensity-highlight'],
            cssFiles: ['color-rows.css', 'roles.css'],
            cssVariables: ['--role-greeter', '--role-greeter-light', '--role-greeter-medium', '--role-greeter-dark'],
            effects: [],
            appearance: {
                background: 'Calm cyan gradient (medium to light to transparent)',
                border: '3px solid cyan (--role-greeter)',
                color: 'Dark cyan',
                animation: 'None',
                special: 'Welcoming, serene cyan tones'
            }
        },
        matches: (event) => {
            return (event.color_source === 'role' && event.key === 'greeter') || (event.type === 'welcome' && event.key === 'greeter');
        }
    },
    
    mapper: {
        name: "mapper",
        description: "Lime highlight for mapper work",
        category: "role",
        rendering: {
            cssClasses: ['row-entry', 'color-role', 'role-mapper', 'intensity-highlight'],
            cssFiles: ['color-rows.css', 'roles.css'],
            cssVariables: ['--role-mapper', '--role-mapper-light', '--role-mapper-medium', '--role-mapper-dark'],
            effects: [],
            appearance: {
                background: 'Natural lime gradient (medium to light to transparent)',
                border: '3px solid lime (--role-mapper)',
                color: 'Dark lime green',
                animation: 'None',
                special: 'Exploration, growth lime tones'
            }
        },
        matches: (event) => {
            return (event.color_source === 'role' && event.key === 'mapper') || (event.type === 'welcome' && event.key === 'mapper');
        }
    },
    
    cogitarian: {
        name: "cogitarian",
        description: "Orange-red highlight for cogitarian work",
        category: "role",
        rendering: {
            cssClasses: ['row-entry', 'color-role', 'role-cogitarian', 'intensity-highlight'],
            cssFiles: ['color-rows.css', 'roles.css'],
            cssVariables: ['--role-cogitarian', '--role-cogitarian-light', '--role-cogitarian-medium', '--role-cogitarian-dark'],
            effects: [],
            appearance: {
                background: 'Warm orange-red gradient (light to transparent)',
                border: '2px solid orange-red (--role-cogitarian)',
                color: 'Orange-red mixed with black',
                animation: 'None',
                special: 'Wisdom, knowledge orange-red tones'
            }
        },
        matches: (event) => {
            return (event.color_source === 'role' && event.key === 'cogitarian') || (event.type === 'welcome' && event.key === 'cogitarian');
        }
    },

    provisioner: {
        name: "provisioner",
        description: "Harvest wheat yellow for provisioner work",
        category: "role",
        rendering: {
            cssClasses: ['row-entry', 'color-role', 'role-provisioner', 'intensity-highlight'],
            cssFiles: ['color-rows.css', 'roles.css'],
            cssVariables: ['--role-provisioner', '--role-provisioner-light', '--role-provisioner-medium', '--role-provisioner-dark'],
            effects: [],
            appearance: {
                background: 'Wheat-yellow gradient (warm to light to transparent)',
                border: '3px solid wheat (--role-provisioner)',
                color: 'Warm brownish yellow',
                animation: 'None',
                special: 'Nourishment and warmth tones for provisioning role'
            }
        },
        matches: (event) => {
            return (event.color_source === 'role' && event.key === 'provisioner') || (event.type === 'work' && event.key === 'provisioner');
        }
    },
    
    // =========================================================================
    // OCTANT STYLES (Generated dynamically)
    // =========================================================================
    
    // Note: Octant styles are generated by generateOctantStyles()
    // Each octant has dynamic CSS variables from octants.css
    
};

/**
 * Generate octant styles dynamically with full metadata
 */
function generateOctantStyles() {
    const octants = ['adaptive', 'chaotic', 'intended', 'prepared', 'contented', 'assertive', 'ordered', 'guarded', 'equilibrium', 'confused', 'singling', 'uncertain'];
    
    const octantDescriptions = {
        'adaptive': 'Flow - Entropy • Liberty • Receptive',
        'chaotic': 'Experiment - Entropy • Liberty • Skeptic',
        'intended': 'Command - Entropy • Authority • Skeptic',
        'prepared': 'Strategy - Entropy • Authority • Receptive',
        'contented': 'Peace - Oblivion • Liberty • Receptive',
        'assertive': 'Wisdom - Oblivion • Liberty • Skeptic',
        'ordered': 'Order - Oblivion • Authority • Receptive',
        'guarded': 'Guard - Oblivion • Authority • Skeptic',
        'equilibrium': 'Balanced center point',
        'confused': 'Balanced on one axis',
        'singling': 'Balanced on two axes',
        'uncertain': 'Legacy uncertain state'
    };
    
    octants.forEach(octantKey => {
        RowStyleRegistry[octantKey] = {
            name: octantKey,
            description: `${octantDescriptions[octantKey] || octantKey} octant`,
            category: "octant",
            rendering: {
                cssClasses: ['row-entry', 'color-octant', `octant-${octantKey}`, 'intensity-highlight'],
                cssFiles: ['color-rows.css', 'octants.css'],
                cssVariables: [
                    `--octant-${octantKey}`,
                    `--octant-${octantKey}-light`,
                    `--octant-${octantKey}-dark`,
                    `--octant-${octantKey}-darker`
                ],
                effects: [],
                appearance: {
                    background: `Gradient using octant ${octantKey} color palette`,
                    border: `3px solid octant ${octantKey} base color`,
                    color: `Dark octant ${octantKey} color`,
                    animation: 'None',
                    special: `Uses ${octantKey} color scheme from spectrum system`
                }
            },
            matches: (event) => {
                return event.color_source === 'octant' && event.octant === octantKey;
            }
        };
    });
}

/**
 * Determine rowstyle from event data
 * Uses matches() functions defined in each rowstyle
 * @param {object} event - Event object with color_source, key, intensity, etc.
 * @returns {string} Rowstyle name
 */
function computeRowStyle(event) {
    // Iterate through all registered rowstyles and find first match
    // Order matters - more specific styles should be checked first
    const styleOrder = [
        // Nightmare first (very specific)
        'nightmare',
        // Dissipate
        'dissipate',
        // Dreams (most specific)
        'dream',
        // Canon
        'canon',
        // Souvenir styles (specific keys)
        'strangedreamintense', 'strangedream',
        'residenceintense', 'residence',
        'arrival',
        // User color variations
        'userhigh', 'user',
        // Role styles
        'greeter', 'mapper', 'cogitarian', 'provisioner',
        // Octant styles (checked dynamically)
        ...['adaptive', 'chaotic', 'intended', 'prepared', 'contented', 'assertive', 'ordered', 'guarded', 'equilibrium', 'confused', 'singling', 'uncertain']
    ];
    
    for (const styleName of styleOrder) {
        const style = RowStyleRegistry[styleName];
        if (style && style.matches && style.matches(event)) {
            return styleName;
        }
    }
    
    // Default fallback
    return 'default';
}

/**
 * Get rowstyle definition
 * @param {string|object} input - Either rowstyle name or full event object
 * @returns {object} RowStyle definition
 */
function getRowStyle(input) {
    let styleName;
    
    if (typeof input === 'string') {
        styleName = input;
    } else if (typeof input === 'object') {
        // Event object - compute or use explicit rowstyle
        // Special case: rowstyle="octant" means use the user's actual octant
        if (input.rowstyle === 'octant' && input.octant) {
            styleName = input.octant;
        } else {
            styleName = input.rowstyle || computeRowStyle(input);
        }
    }
    
    const style = RowStyleRegistry[styleName];
    if (!style) {
        console.warn(`RowStyle "${styleName}" not found, using default`);
        return RowStyleRegistry.default;
    }
    
    return style;
}

/**
 * Get all rowstyles in a category
 */
function getRowStylesByCategory(category) {
    return Object.values(RowStyleRegistry).filter(style => style.category === category);
}

/**
 * List all available rowstyles
 */
function listRowStyles() {
    return Object.keys(RowStyleRegistry);
}

/**
 * Validate all rowstyles for completeness
 * Checks that CSS files are loaded and styles are properly defined
 */
function validateRowStyles() {
    const warnings = [];
    const loadedStylesheets = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return sheet.href ? sheet.href.split('/').pop() : null;
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
    
    Object.entries(RowStyleRegistry).forEach(([name, style]) => {
        if (!style.rendering) {
            warnings.push(`⚠️ RowStyle "${name}" missing rendering metadata`);
            return;
        }
        
        // Check CSS files are loaded
        style.rendering.cssFiles.forEach(file => {
            if (!loadedStylesheets.includes(file)) {
                warnings.push(`⚠️ RowStyle "${name}" requires ${file} but it's not loaded`);
            }
        });
        
        // Check matches function exists
        if (typeof style.matches !== 'function' && name !== 'default') {
            warnings.push(`⚠️ RowStyle "${name}" missing matches() function`);
        }
        
        // Check cssClasses is non-empty
        if (!style.rendering.cssClasses || style.rendering.cssClasses.length === 0) {
            warnings.push(`⚠️ RowStyle "${name}" has no CSS classes defined`);
        }
    });
    
    if (warnings.length > 0) {
        console.group('🔍 RowStyle Validation Warnings');
        warnings.forEach(w => console.warn(w));
        console.groupEnd();
    } else {
        console.log('✅ All rowstyles validated successfully');
    }
    
    return warnings;
}

/**
 * Get complete information about a rowstyle (for debugging/docs)
 */
function inspectRowStyle(name) {
    const style = RowStyleRegistry[name];
    if (!style) {
        console.error(`❌ RowStyle "${name}" not found`);
        return null;
    }
    
    console.group(`🎨 RowStyle: ${name}`);
    console.log('Description:', style.description);
    console.log('Category:', style.category);
    if (style.extends) console.log('Extends:', style.extends);
    console.log('\n📦 Rendering:');
    console.log('  CSS Classes:', style.rendering.cssClasses.join(', '));
    console.log('  CSS Files:', style.rendering.cssFiles.join(', '));
    console.log('  CSS Variables:', style.rendering.cssVariables.join(', ') || 'None');
    console.log('  Effects:', style.rendering.effects.join(', ') || 'None');
    console.log('\n🎭 Appearance:');
    Object.entries(style.rendering.appearance).forEach(([key, value]) => {
        console.log(`  ${key}:`, value);
    });
    console.groupEnd();
    
    return style;
}

// Initialize octant styles when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        generateOctantStyles();
        validateRowStyles();
    });
} else {
    generateOctantStyles();
    // Defer validation slightly to ensure CSS is loaded
    setTimeout(validateRowStyles, 100);
}

// Export to window
window.RowStyleRegistry = RowStyleRegistry;
window.getRowStyle = getRowStyle;
window.computeRowStyle = computeRowStyle;
window.getRowStylesByCategory = getRowStylesByCategory;
window.listRowStyles = listRowStyles;
window.validateRowStyles = validateRowStyles;
window.inspectRowStyle = inspectRowStyle;

console.log('✅ [RowStyleRegistry] Loaded with', Object.keys(RowStyleRegistry).length, 'base styles');
