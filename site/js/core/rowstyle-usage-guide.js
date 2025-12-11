/**
 * RowStyle System - Usage Guide
 * 
 * This document shows how to use the new RowStyle system for defining and applying
 * consistent row styling across Reverie House.
 */

// ============================================================================
// BASIC USAGE
// ============================================================================

// 1. Get a rowstyle definition by name
const style = window.getRowStyle('strangewave');
console.log(style);
// Returns: { name: "strangewave", color: {...}, highlight: "highlight", ... }

// 2. Get rowstyle from event (computes if needed)
const event = {
    key: 'strange',
    color_source: 'souvenir',
    color_intensity: 'highlight',
    // ... other event fields
};
const computedStyle = window.getRowStyle(event);
console.log(computedStyle.name); // "strangewave"

// 3. Generate classes for a row
const classes = window.rowStyleEngine.getRowClasses(event);
console.log(classes); // "row-entry souvenir-strange intensity-highlight"

// 4. Generate inline styles for a row
const styles = window.rowStyleEngine.getRowStyles(event);
console.log(styles); // "--strange-purple: #7B5A9E; --strange-dark: #4A2D5F; ..."

// 5. Apply effects to rendered rows
const container = document.getElementById('rows-container');
window.rowStyleEngine.applyEffects(container);
// Automatically applies snake charmer to .souvenir-strange rows

// ============================================================================
// IN YOUR RENDERING CODE
// ============================================================================

// Example: Rendering in EventStack widget
function buildEventRow(event) {
    const rowClass = window.rowStyleEngine.getRowClasses(event);
    const rowStyle = window.rowStyleEngine.getRowStyles(event);
    
    return `
        <div class="${rowClass}" style="${rowStyle}">
            <!-- row content -->
        </div>
    `;
}

// After rendering, apply effects
function render(events, container) {
    const html = events.map(e => buildEventRow(e)).join('');
    container.innerHTML = html;
    
    // Single call applies all effects based on classes present
    window.rowStyleEngine.applyEffects(container);
}

// ============================================================================
// DEFINING NEW ROWSTYLES
// ============================================================================

// Add a new rowstyle to the registry
window.RowStyleRegistry.devotionpath = {
    name: "devotionpath",
    description: "Devotion souvenir with soft golden glow",
    category: "souvenir",
    souvenirKey: "devotion",
    
    color: {
        source: "fixed",
        vars: {
            "--devotion-gold": "#d4af37",
            "--devotion-light": "#f5e6c8"
        }
    },
    
    highlight: "highlight",
    
    background: {
        type: "gradient",
        intensity: 0.15,
        borderLeft: "3px solid var(--devotion-gold)",
        boxShadow: "0 0 10px rgba(212, 175, 55, 0.2)"
    },
    
    effects: [
        { name: "goldenshimmer" } // Custom effect (need to register handler)
    ],
    
    cssClasses: ['row-entry', 'souvenir-devotion', 'intensity-highlight']
};

// ============================================================================
// REGISTERING CUSTOM EFFECTS
// ============================================================================

// Register a new effect handler
window.rowStyleEngine.registerEffect('goldenshimmer', (rows, options) => {
    rows.forEach(row => {
        // Apply custom effect
        row.style.animation = 'goldenShimmer 3s ease-in-out infinite';
    });
});

// ============================================================================
// QUERYING ROWSTYLES
// ============================================================================

// List all available rowstyles
const allStyles = window.listRowStyles();
console.log(allStyles); // ["default", "userbasic", "userhighlight", ...]

// Get all souvenir styles
const souvenirStyles = window.getRowStylesByCategory('souvenir');
console.log(souvenirStyles); // [{ name: "strangewave", ... }, { name: "arrivalwelcome", ... }]

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

// The system automatically computes rowstyle from legacy fields:
const legacyEvent = {
    color_source: 'user',
    color_intensity: 'special',
    key: 'canon',
    color_hex: '#8b7355'
};

const computedStyleName = window.computeRowStyle(legacyEvent);
console.log(computedStyleName); // "usercanon"

// ============================================================================
// MIGRATION EXAMPLE
// ============================================================================

// BEFORE (database.html):
/*
let colorSystemClasses = '';
if (colorSource !== 'none') colorSystemClasses += ` color-${colorSource}`;
if (colorIntensity !== 'none') colorSystemClasses += ` intensity-${colorIntensity}`;
if (colorSource === 'souvenir' && key) colorSystemClasses += ` souvenir-${key}`;
// ... 30+ more lines ...

html += `<div class="row-entry${colorSystemClasses}">...`;

// After render:
applySnakeCharmerEffect();
*/

// AFTER (with RowStyle system):
/*
const rowClass = window.rowStyleEngine.getRowClasses(row);
const rowStyle = window.rowStyleEngine.getRowStyles(row);

html += `<div class="${rowClass}" style="${rowStyle}">...`;

// After render:
window.rowStyleEngine.applyEffects(container);
*/

// ============================================================================
// FUTURE: DATABASE COLUMN
// ============================================================================

// Eventually, add explicit rowstyle column to events table:
/*
ALTER TABLE events ADD COLUMN rowstyle TEXT;

-- Migrate existing events
UPDATE events SET rowstyle = 'usercanon' 
WHERE color_source = 'user' AND (key = 'canon' OR color_intensity = 'special');

UPDATE events SET rowstyle = 'strangewave'
WHERE color_source = 'souvenir' AND key = 'strange' AND color_intensity = 'highlight';

-- Then in Python, when creating events:
event_data = {
    'rowstyle': 'strangewave',  # Explicit style reference
    # Legacy fields can remain for backward compat or be phased out
}
*/

// ============================================================================
// TESTING ROWSTYLES
// ============================================================================

// Test a rowstyle by creating a preview element
function previewRowStyle(styleName) {
    const style = window.getRowStyle(styleName);
    
    // Create mock event
    const mockEvent = {
        rowstyle: styleName,
        name: 'Test Dreamer',
        event: 'does a test action',
        key: style.souvenirKey || 'test',
        color_hex: '#8b7355'
    };
    
    // Create preview element
    const preview = document.createElement('div');
    preview.className = window.rowStyleEngine.getRowClasses(mockEvent);
    preview.style = window.rowStyleEngine.getRowStyles(mockEvent);
    preview.innerHTML = `
        <div class="cell epoch">NOW</div>
        <div class="cell type">test</div>
        <div class="cell canon">
            <span style="font-weight: 500;">${mockEvent.name}</span>
            <span style="font-style: italic;">${mockEvent.event}</span>
        </div>
    `;
    
    // Apply effects
    const container = document.createElement('div');
    container.appendChild(preview);
    window.rowStyleEngine.applyEffects(container);
    
    return preview;
}

// Usage:
// const preview = previewRowStyle('strangewave');
// document.body.appendChild(preview);
