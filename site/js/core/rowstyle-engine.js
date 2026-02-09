/**
 * RowStyle Engine
 * Applies RowStyle definitions to DOM elements
 * Handles class generation, inline styles, and effect application
 */

class RowStyleEngine {
    constructor() {
        this.effectHandlers = new Map();
        this.appliedEffects = new WeakMap(); // Track which elements have effects applied
        
        this.registerCoreEffects();
        console.log('🎨 [RowStyleEngine] Initialized');
    }
    
    /**
     * Get CSS classes for an event based on its rowstyle
     * @param {object} event - Event object
     * @returns {string} Space-separated CSS classes
     */
    getRowClasses(event) {
        const style = window.getRowStyle(event);
        
        // All rowstyles MUST have rendering.cssClasses defined
        if (!style.rendering || !style.rendering.cssClasses || style.rendering.cssClasses.length === 0) {
            console.error(`❌ [RowStyleEngine] RowStyle "${style.name}" has no rendering.cssClasses defined!`);
            return 'row-entry';  // Minimal fallback
        }
        
        return style.rendering.cssClasses.join(' ');
    }
    
    /**
     * Get inline styles for an event based on its rowstyle
     * @param {object} event - Event object
     * @returns {string} Inline style string
     */
    getRowStyles(event) {
        const style = window.getRowStyle(event);
        const styles = [];
        
        // User color - set CSS variable if event has user color source
        if (event.color_source === 'user') {
            // Use event's color_hex if available, otherwise use Reverie House brand color
            const userColor = event.color_hex || '#734ba1';
            styles.push(`--user-color: ${userColor}`);
        }
        
        // Kindred gradient - set both user colors from quantities JSON
        if (event.color_source === 'kindred-gradient' || event.type === 'kindred') {
            // Parse quantities if it's a string
            let quantities = event.quantities;
            if (typeof quantities === 'string') {
                try {
                    quantities = JSON.parse(quantities);
                } catch (e) {
                    quantities = {};
                }
            }
            
            // Extract colors from quantities
            const colorA = quantities?.color_a || event.color_hex || '#888888';
            const colorB = quantities?.color_b || '#888888';
            styles.push(`--kindred-color-a: ${colorA}`);
            styles.push(`--kindred-color-b: ${colorB}`);
        }
        
        return styles.join('; ');
    }
    
    /**
     * Apply all effects to rows in a container
     * @param {HTMLElement} container - Container with rows
     * @param {object} options - Effect options
     */
    applyEffects(container, options = {}) {
        // Track applied effects to avoid double-application
        if (this.appliedEffects.has(container)) {
            return;
        }
        this.appliedEffects.set(container, true);
        
        // Find all rows that need effects
        const rowsNeedingEffects = new Map();
        
        // Scan for rows with effect-requiring classes
        this._scanForEffectRows(container, rowsNeedingEffects);
        
        // Apply each effect type once
        rowsNeedingEffects.forEach((rows, effectName) => {
            const handler = this.effectHandlers.get(effectName);
            if (handler) {
                handler(rows, options);
            } else {
                console.warn(`[RowStyleEngine] No handler for effect: ${effectName}`);
            }
        });
        
        console.log(`🎨 [RowStyleEngine] Applied ${rowsNeedingEffects.size} effect types to ${container.querySelectorAll('.row-entry').length} rows`);
    }    /**
     * Scan container for rows that need effects
     * Uses explicit effects from rowstyle rendering metadata
     * @private
     */
    _scanForEffectRows(container, effectMap) {
        const rows = container.querySelectorAll('.row-entry');
        
        rows.forEach(row => {
            // Try to determine rowstyle from the row's classes
            const rowstyle = this._getRowStyleFromElement(row);
            if (rowstyle && rowstyle.rendering && rowstyle.rendering.effects) {
                // Register each effect this rowstyle requires
                rowstyle.rendering.effects.forEach(effectName => {
                    if (!effectMap.has(effectName)) {
                        effectMap.set(effectName, []);
                    }
                    effectMap.get(effectName).push(row);
                });
            }
        });
    }
    
    /**
     * Determine which rowstyle a DOM element is using
     * @private
     */
    _getRowStyleFromElement(element) {
        // Check for souvenir-strange classes
        if (element.classList.contains('souvenir-strange')) {
            return element.classList.contains('intensity-special') 
                ? window.RowStyleRegistry.strangedreamintense 
                : window.RowStyleRegistry.strangedream;
        }
        
        // Could expand this to detect other rowstyles if needed
        // For now, only strange souvenir needs effects
        
        return null;
    }
    
    /**
     * Register core effect handlers
     * @private
     */
    registerCoreEffects() {
        // Snake charmer text animation
        this.effectHandlers.set('snakecharmer', (rows, options) => {
            rows.forEach(row => this._applySnakeCharmer(row, options));
        });
        
        // Future effects can be registered here
        // this.effectHandlers.set('borderpulse', ...);
        // this.effectHandlers.set('scanlines', ...);
    }
    
    /**
     * Apply snake charmer effect to a single row
     * @private
     */
    _applySnakeCharmer(row, options = {}) {
        // Check if already applied
        if (row.dataset.snakeCharmApplied) return;
        row.dataset.snakeCharmApplied = 'true';
        
        const cells = row.querySelectorAll('.cell');
        
        cells.forEach((cell, cellIndex) => {
            // Skip cells with only images
            const hasOnlyImages = cell.querySelectorAll('img').length > 0 
                                  && !cell.textContent.trim();
            if (hasOnlyImages) return;
            
            let wordIndex = 0;
            
            // Process text nodes recursively
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    const wordParts = text.split(/(\s+)/);
                    const fragment = document.createDocumentFragment();
                    
                    wordParts.forEach(part => {
                        if (part.trim()) {
                            const wordSpan = document.createElement('span');
                            wordSpan.textContent = part;
                            wordSpan.className = 'snake-word';
                            
                            // Stagger animation delay
                            const totalDelay = (cellIndex * 8 + wordIndex * 2) * 0.1;
                            wordSpan.style.animationDelay = `${totalDelay}s`;
                            
                            fragment.appendChild(wordSpan);
                            wordIndex++;
                        } else if (part) {
                            // Preserve whitespace
                            fragment.appendChild(document.createTextNode(part));
                        }
                    });
                    
                    node.parentNode.replaceChild(fragment, node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Recursively process child nodes
                    Array.from(node.childNodes).forEach(child => processNode(child));
                }
            };
            
            // Process all children of the cell
            Array.from(cell.childNodes).forEach(child => processNode(child));
        });
    }
    
    /**
     * Register a custom effect handler
     * @param {string} name - Effect name
     * @param {function} handler - Handler function (rows, options) => void
     */
    registerEffect(name, handler) {
        this.effectHandlers.set(name, handler);
        console.log(`🎨 [RowStyleEngine] Registered effect: ${name}`);
    }
    
    /**
     * Clear applied effects tracking (for re-rendering)
     * @param {HTMLElement} container - Container to clear
     */
    clearEffects(container) {
        this.appliedEffects.delete(container);
    }
}

// Create global singleton
window.rowStyleEngine = new RowStyleEngine();

console.log('✅ [RowStyleEngine] Loaded and ready');
