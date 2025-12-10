/**
 * Event Stack Widget
 * Universal event renderer using database.html's color system
 * Supports filtering by user, key, type, date range, and custom coloring
 * Handles reactions, octants, roles, souvenirs, and user colors
 */

class EventStack {
    constructor() {
        this.container = null;
        this.options = {};
        this.allEvents = [];
        this.filteredEvents = [];
    }
    
    /**
     * Render the event stack with intelligent filtering and coloring
     * @param {Array} events - Array of event objects from API
     * @param {HTMLElement} targetElement - Element to render into
     * @param {Object} options - Configuration options
     * @param {string} options.colorMode - 'auto' | 'souvenir' | 'role' | 'octant' | 'user' | 'none'
     * @param {string} options.colorKey - Specific key for coloring (souvenir-key, role-key, etc)
     * @param {string} options.colorIntensity - 'highlight' | 'special' | 'faded' | 'none'
     * @param {Object} options.filter - Filtering configuration
     * @param {string} options.filter.did - Filter to events involving this DID
     * @param {string|Array} options.filter.keys - Filter to specific event keys
     * @param {string|Array} options.filter.types - Filter to specific event types
     * @param {Object} options.filter.dateRange - {start: epoch, end: epoch}
     * @param {boolean} options.filter.excludeReactions - Don't show reaction events
     * @param {boolean} options.showReactions - Show reactions beneath parent events
     * @param {number} options.limit - Maximum events to display
     * @param {string} options.sortOrder - 'desc' | 'asc' (by epoch)
     * @param {Function} options.onRowClick - Custom click handler (event) => {}
     * @param {string} options.emptyMessage - Custom message when no events
     */
    render(events, targetElement, options = {}) {
        console.log('📜 [EventStack] Rendering', events?.length || 0, 'events with options:', options);
        console.log('📜 [EventStack] Rendering', events?.length || 0, 'events with options:', options);
        
        this.container = targetElement;
        this.options = {
            colorMode: 'auto',
            colorIntensity: 'highlight',
            showReactions: false,
            sortOrder: 'desc',
            emptyMessage: 'No events recorded yet',
            ...options
        };
        this.allEvents = events || [];
        
        // Apply filtering
        this.filteredEvents = this.filterEvents(this.allEvents);
        
        // Apply sorting
        this.sortEvents(this.filteredEvents);
        
        // Apply limit
        if (this.options.limit && this.options.limit > 0) {
            this.filteredEvents = this.filteredEvents.slice(0, this.options.limit);
        }
        
        if (this.filteredEvents.length === 0) {
            this.container.innerHTML = `
                <div class="row-entry" style="text-align: center; display: block; font-style: italic; color: var(--text-dim);">
                    ${this.options.emptyMessage}
                </div>
            `;
            return;
        }
        
        const rowsHtml = this.filteredEvents.map(event => this.buildEventRow(event)).join('');
        this.container.innerHTML = rowsHtml;
        
        // Add click handlers for bsky URLs
        this.container.querySelectorAll('[data-bsky-url]').forEach(row => {
            const url = row.getAttribute('data-bsky-url');
            row.addEventListener('click', () => {
                if (this.options.onRowClick) {
                    this.options.onRowClick(url);
                } else if (window.showPost) {
                    window.showPost(url);
                }
            });
        });
    }
    
    /**
     * Filter events based on options.filter criteria
     */
    filterEvents(events) {
        if (!this.options.filter) return events;
        
        return events.filter(event => {
            const filter = this.options.filter;
            
            // Filter by DID
            if (filter.did && event.did !== filter.did) {
                return false;
            }
            
            // Filter by keys (single or array)
            if (filter.keys) {
                const keys = Array.isArray(filter.keys) ? filter.keys : [filter.keys];
                if (!keys.includes(event.key)) {
                    return false;
                }
            }
            
            // Filter by types (single or array)
            if (filter.types) {
                const types = Array.isArray(filter.types) ? filter.types : [filter.types];
                if (!types.includes(event.type)) {
                    return false;
                }
            }
            
            // Filter by date range
            if (filter.dateRange) {
                const epoch = event.epoch || event.created_at || 0;
                if (filter.dateRange.start && epoch < filter.dateRange.start) {
                    return false;
                }
                if (filter.dateRange.end && epoch > filter.dateRange.end) {
                    return false;
                }
            }
            
            // Filter out reactions if requested
            if (filter.excludeReactions && event.reaction_to) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * Sort events by epoch
     */
    sortEvents(events) {
        events.sort((a, b) => {
            const epochA = a.epoch || a.created_at || 0;
            const epochB = b.epoch || b.created_at || 0;
            return this.options.sortOrder === 'desc' ? epochB - epochA : epochA - epochB;
        });
    }
    
    /**
     * Build a single event row with intelligent color system
     * @param {Object} event - Event data from API
     * @returns {string} HTML string for the row
     */
    buildEventRow(event) {
        // Format timestamp exactly like database.html
        const epoch = event.epoch || event.created_at || 0;
        const date = new Date(epoch * 1000);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
        
        const avatar = event.avatar || '/assets/icon_face.png';
        const name = event.name || 'unknown';
        const eventText = event.event || 'Event recorded';
        const uri = event.uri || '';
        const url = event.url || '';
        const did = event.did || '';
        const type = event.type || 'unknown';
        const key = event.key || '';
        
        // Determine color system intelligently
        const colorConfig = this.determineColorSystem(event);
        const colorSystemClasses = this.buildColorClasses(colorConfig, event);
        const colorSystemStyles = colorConfig.customStyles || '';
        
        // Base row class
        let rowClass = 'row-entry';
        
        // Add special row classes
        if (event.reaction_to) {
            rowClass += ' reaction-row';
            if (key) rowClass += ` reaction-${key}`;
        }
        const finalRowClass = rowClass + colorSystemClasses;
        
        // Handle clickability
        let rowOnClick = '';
        let bskyDataAttr = '';
        
        if (url) {
            if (url.includes('bsky.app')) {
                if (url.includes('/profile/') && !url.includes('/post/')) {
                    // Profile URL - navigate to dreamer page
                    const didMatch = url.match(/profile\/(did:plc:[a-z0-9]+)/);
                    if (didMatch && didMatch[1]) {
                        rowOnClick = `window.location.href='/dreamer?did=${encodeURIComponent(didMatch[1])}'`;
                    }
                } else {
                    // Post URL - use showPost
                    bskyDataAttr = ` data-bsky-url="${url.replace(/"/g, '&quot;')}"`;
                }
            } else if (url.startsWith('/')) {
                rowOnClick = `window.location.href='${url}'`;
            } else {
                rowOnClick = `window.open('${url}', '_blank')`;
            }
        }
        
        // Custom click handler override
        if (this.options.onRowClick) {
            rowOnClick = '';  // Will be handled by event delegation
        }
        
        // Build style attribute
        let rowStyles = [];
        if (rowOnClick) rowStyles.push('cursor: pointer');
        if (colorSystemStyles) rowStyles.push(colorSystemStyles);
        
        const rowStyleAttr = rowStyles.length > 0 ? ` style="${rowStyles.join('; ')}"` : '';
        const rowOnClickAttr = rowOnClick ? ` onclick="${rowOnClick}"` : '';
        
        // Build the row HTML
        let html = `<div class="${finalRowClass}"${rowOnClickAttr}${rowStyleAttr}${bskyDataAttr}>`;
        
        // Epoch cell
        html += `<div class="cell epoch">${dateStr}</div>`;
        
        // Avatar cell with reaction indicator
        const dreamerLink = did ? `/dreamer?did=${encodeURIComponent(did)}` : '#';
        html += `<div class="cell avatar">`;
        if (event.reaction_to) {
            html += `<span style="color: var(--primary); font-size: 1em; margin-right: 8px;">↳</span>`;
        }
        if (did) {
            html += `<a href="${dreamerLink}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(did)}" onclick="event.stopPropagation()"><img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'" style="cursor: pointer;"></a>`;
        } else {
            html += `<img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">`;
        }
        html += `</div>`;
        
        // Canon cell - unified "name event" display
        const nameLink = did ? `<a href="/dreamer?did=${encodeURIComponent(did)}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(did)}" onclick="event.stopPropagation()" style="font-weight: 500; color: inherit; text-decoration: none;">${name}</a>` : `<span style="font-weight: 500;">${name}</span>`;
        const eventSpan = `<span style="font-style: italic; color: var(--text-secondary);">${eventText}</span>`;
        const reactionPadding = event.reaction_to ? 'padding-left: 4px;' : '';
        html += `<div class="cell canon"><span style="white-space: normal; ${reactionPadding}">${nameLink} ${eventSpan}</span></div>`;
        
        html += `</div>`;
        
        return html;
    }
    
    /**
     * Determine color system based on event data and options
     * Returns {source, intensity, key, customStyles}
     */
    determineColorSystem(event) {
        const mode = this.options.colorMode;
        const key = event.key || '';
        const type = event.type || '';
        
        // Explicit mode override
        if (mode === 'none') {
            return { source: 'none', intensity: 'none', key: '' };
        }
        
        if (mode === 'user') {
            return {
                source: 'user',
                intensity: this.options.colorIntensity || 'highlight',
                key: '',
                customStyles: event.color_hex ? `--user-color: ${event.color_hex};` : ''
            };
        }
        
        if (mode === 'souvenir') {
            return {
                source: 'souvenir',
                intensity: this.options.colorIntensity || 'highlight',
                key: this.options.colorKey || key
            };
        }
        
        if (mode === 'role') {
            return {
                source: 'role',
                intensity: this.options.colorIntensity || 'highlight',
                key: this.options.colorKey || key
            };
        }
        
        if (mode === 'octant') {
            // Use origin_octant for origin/name events, regular octant for others
            const octantKey = ((key === 'origin' || key === 'name') && event.origin_octant) 
                ? event.origin_octant 
                : event.octant;
            return {
                source: 'octant',
                intensity: this.options.colorIntensity || 'highlight',
                key: octantKey
            };
        }
        
        // AUTO mode - intelligent detection from database color_source
        if (event.color_source) {
            const config = {
                source: event.color_source,
                intensity: event.color_intensity || this.options.colorIntensity || 'highlight',
                key: key
            };
            
            // Add custom user color if present
            if (event.color_source === 'user' && event.color_hex) {
                config.customStyles = `--user-color: ${event.color_hex};`;
            }
            
            // For octant events, determine correct octant
            if (event.color_source === 'octant') {
                config.key = ((key === 'origin' || key === 'name') && event.origin_octant) 
                    ? event.origin_octant 
                    : event.octant;
            }
            
            return config;
        }
        
        // Fallback heuristics when color_source not available
        // Souvenir events
        const souvenirKeys = ['residence', 'wanderer', 'devotion', 'maker', 'giver', 'reader', 'explorer'];
        if (type === 'souvenir' || souvenirKeys.includes(key)) {
            return {
                source: 'souvenir',
                intensity: 'highlight',
                key: key
            };
        }
        
        // Role events
        const roleKeys = ['greeter', 'mapper', 'cogitarian', 'architect'];
        if (type === 'work' || roleKeys.includes(key)) {
            return {
                source: 'role',
                intensity: 'highlight',
                key: key
            };
        }
        
        // Octant-related events
        if (key === 'origin' || key === 'name' || key === 'arrival') {
            const octantKey = ((key === 'origin' || key === 'name') && event.origin_octant) 
                ? event.origin_octant 
                : event.octant;
            return {
                source: 'octant',
                intensity: key === 'origin' ? 'special' : 'highlight',
                key: octantKey
            };
        }
        
        // User-colored canon events
        if (key === 'canon' && event.color_hex) {
            return {
                source: 'user',
                intensity: 'special',
                key: '',
                customStyles: `--user-color: ${event.color_hex};`
            };
        }
        
        // Default: no special coloring
        return { source: 'none', intensity: 'none', key: '' };
    }
    
    /**
     * Build CSS classes from color configuration
     */
    buildColorClasses(colorConfig, event) {
        let classes = '';
        const key = event.key || '';
        
        // Add event-key class for direct styling
        if (key) {
            classes += ` event-key-${key}`;
        }
        
        // Add color-source class
        if (colorConfig.source !== 'none') {
            classes += ` color-${colorConfig.source}`;
        }
        
        // Add intensity class
        if (colorConfig.intensity !== 'none') {
            classes += ` intensity-${colorConfig.intensity}`;
        }
        
        // Add type-specific classes
        if (colorConfig.source === 'role' && colorConfig.key) {
            classes += ` role-${colorConfig.key}`;
        }
        
        if (colorConfig.source === 'octant' && colorConfig.key) {
            classes += ` octant-${colorConfig.key}`;
        }
        
        if (colorConfig.source === 'souvenir' && colorConfig.key) {
            classes += ` souvenir-${colorConfig.key}`;
        }
        
        // Special cases
        if (key === 'prepare' && event.nightmare) {
            classes += ' nightmare-prepare';
        }
        
        if (key === 'greeter' && event.reactionary) {
            classes += ' greeter-reactionary';
        }
        
        return classes;
    }
}

// Make globally available
window.EventStack = EventStack;
console.log('✅ [EventStack] Widget loaded');

/**
 * USAGE EXAMPLES:
 * 
 * // Souvenir page - show events for specific souvenir with bespoke styling
 * eventStack.render(events, container, {
 *     colorMode: 'souvenir',
 *     colorKey: 'residence',
 *     colorIntensity: 'highlight'
 * });
 * 
 * // Profile page - show all user events with user color
 * eventStack.render(allEvents, container, {
 *     colorMode: 'user',
 *     filter: { did: 'did:plc:abc123' }
 * });
 * 
 * // Role page - show work events for a specific role
 * eventStack.render(events, container, {
 *     colorMode: 'role',
 *     colorKey: 'greeter',
 *     filter: { types: 'work' }
 * });
 * 
 * // Timeline - show events in date range with octant coloring
 * eventStack.render(events, container, {
 *     colorMode: 'octant',
 *     filter: {
 *         dateRange: { start: 1701388800, end: 1709251200 }
 *     }
 * });
 * 
 * // Multi-souvenir view - auto-detect colors from event data
 * eventStack.render(events, container, {
 *     colorMode: 'auto',
 *     filter: {
 *         keys: ['residence', 'wanderer', 'devotion']
 *     }
 * });
 * 
 * // Limited event count with custom empty message
 * eventStack.render(events, container, {
 *     colorMode: 'auto',
 *     limit: 10,
 *     emptyMessage: 'No recent activity'
 * });
 * 
 * // Show reactions beneath parent events
 * eventStack.render(events, container, {
 *     colorMode: 'auto',
 *     showReactions: true
 * });
 */
