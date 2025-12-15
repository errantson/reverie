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
     * @param {Object} options.columns - Column visibility configuration {type: true, epoch: true, canon: true, key: true, uri: true}
     */
    render(events, targetElement, options = {}) {
        console.log('📜 [EventStack] Rendering', events?.length || 0, 'events with options:', options);
        
        this.container = targetElement;
        
        // Default column configuration
        const defaultColumns = {
            type: true,
            epoch: true,
            canon: true,
            key: true,
            uri: true
        };
        
        this.options = {
            colorMode: 'auto',
            colorIntensity: 'highlight',
            showReactions: true, // Enable reactions by default
            sortOrder: 'desc',
            emptyMessage: 'No events recorded yet',
            ...options,
            // Merge columns separately to preserve defaults
            columns: { ...defaultColumns, ...options.columns }
        };
        this.allEvents = events || [];
        
        // Build reaction map for efficient lookup
        this.reactionMap = this.buildReactionMap(this.allEvents);
        
        // Apply filtering (exclude reactions from main filter - they'll be added back)
        this.filteredEvents = this.filterEvents(this.allEvents.filter(e => !e.reaction_to));
        
        // Add relevant reactions to filtered events
        this.addReactionsToFilteredEvents();
        
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
        
        // Render events with proper threading
        const rowsHtml = this.renderThreadedEvents(this.filteredEvents);
        this.container.innerHTML = rowsHtml;
        
        // Apply effects using RowStyle engine
        if (window.rowStyleEngine) {
            window.rowStyleEngine.applyEffects(this.container);
        } else {
            // Fallback to legacy method
            this.applySnakeCharmerEffect(this.container);
        }
        
        // Add unified click handlers for all interactive rows
        this.container.querySelectorAll('[data-row-action]').forEach(row => {
            row.addEventListener('click', (e) => {
                // Check if click originated from an actual interactive element
                // snake-word spans have pointer-events: none so they won't be targets
                const interactiveElement = e.target.closest('a[href], button');
                if (interactiveElement && interactiveElement !== row) {
                    return;
                }
                
                const action = row.getAttribute('data-row-action');
                const url = row.getAttribute('data-row-url');
                
                // Custom handler takes precedence
                if (action === 'custom' && this.options.onRowClick) {
                    this.options.onRowClick(url);
                    return;
                }
                
                // Standard actions
                switch (action) {
                    case 'navigate':
                        if (url) window.location.href = url;
                        break;
                    case 'external':
                        if (url) window.open(url, '_blank');
                        break;
                    case 'showpost':
                        if (url && window.showPost) {
                            window.showPost(url);
                        }
                        break;
                }
            });
        });
    }
    
    /**
     * Filter events based on options.filter criteria
     */
    filterEvents(events) {
        return events.filter(event => {
            // Always filter out events that are reactions - they'll be shown beneath their parent
            if (event.reaction_to) {
                return false;
            }
            
            // If no additional filters specified, include this event
            if (!this.options.filter) return true;
            
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
    buildEventRow(event, level = 0) {
        // Format timestamp exactly like database.html
        const epoch = event.epoch || event.created_at || 0;
        const date = new Date(epoch * 1000);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        // Format based on dateFormat option
        const dateStr = this.options.dateFormat === 'date' 
            ? `${day}/${month}/${year}` 
            : `${day}/${month}/${year} ${hours}:${minutes}`;
        
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
        let colorSystemStyles = colorConfig.customStyles || '';
        
        // Use RowStyle engine for inline styles if using rowstyle system
        if (colorConfig.source === 'rowstyle' && window.rowStyleEngine) {
            colorSystemStyles = window.rowStyleEngine.getRowStyles(event);
        }
        
        // Base row class
        let rowClass = 'row-entry';
        
        // Add thread level classes for background/border styling
        if (level > 0) {
            rowClass += ` thread-level-${level}`;
            if (key) rowClass += ` reaction-${key}`;
        }
        const finalRowClass = rowClass + colorSystemClasses;
        
        // Determine row click behavior via data attributes (no inline onclick)
        let rowClickData = {};
        
        if (url && !this.options.onRowClick) {
            if (url.includes('bsky.app')) {
                if (url.includes('/profile/') && !url.includes('/post/')) {
                    // Profile URL - navigate to dreamer page
                    const didMatch = url.match(/profile\/(did:plc:[a-z0-9]+)/);
                    if (didMatch && didMatch[1]) {
                        rowClickData.action = 'navigate';
                        rowClickData.url = `/dreamer?did=${encodeURIComponent(didMatch[1])}`;
                    }
                } else {
                    // Post URL - use showPost
                    rowClickData.action = 'showpost';
                    rowClickData.url = url;
                }
            } else if (url.startsWith('/')) {
                rowClickData.action = 'navigate';
                rowClickData.url = url;
            } else {
                rowClickData.action = 'external';
                rowClickData.url = url;
            }
        }
        
        // Custom click handler - will use onRowClick option
        if (this.options.onRowClick) {
            rowClickData.action = 'custom';
            rowClickData.url = url;
        }
        
        // Build style attribute
        let rowStyles = [];
        if (rowClickData.action) rowStyles.push('cursor: pointer');
        if (colorSystemStyles) rowStyles.push(colorSystemStyles);
        
        const rowStyleAttr = rowStyles.length > 0 ? ` style="${rowStyles.join('; ')}"` : '';
        // Build data attributes for click handling
        let dataAttrs = '';
        if (rowClickData.action) {
            dataAttrs += ` data-row-action="${rowClickData.action}"`;
            if (rowClickData.url) {
                dataAttrs += ` data-row-url="${rowClickData.url.replace(/"/g, '&quot;')}"`;
            }
        }
        
        // Build the row HTML
        let html = `<div class="${finalRowClass}"${rowStyleAttr}${dataAttrs}>`;
        
        // Type cell (before epoch) - better padding
        if (this.options.columns.type) {
            const typeDisplay = type ? `<span style="font-size: 0.85em; text-transform: lowercase;">${type}</span>` : '<span>—</span>';
            html += `<div class="cell type" style="padding-left: 12px; padding-right: 6px;">${typeDisplay}</div>`;
        }
        
        // Epoch cell - reduced right margin
        if (this.options.columns.epoch) {
            html += `<div class="cell epoch" style="padding: 0 2px;">${dateStr}</div>`;
        }
        
        // Thread arrow for reactions (positioned before avatar)
        const threadArrowStyle = level > 0 ? ` style="margin-left: ${level * 20}px;"` : '';
        if (level > 0) {
            html += `<div class="cell thread-arrow"${threadArrowStyle}><span class="thread-arrow-icon">↳</span></div>`;
        } else {
            html += `<div class="cell thread-arrow"${threadArrowStyle}></div>`; // Empty spacer for alignment
        }
        
        // Avatar cell (no margin for threaded items to group with arrow)
        const avatarMargin = level > 0 ? 0 : 2;
        const avatarStyle = ` style="margin-left: ${avatarMargin}px;"`;
        const dreamerLink = did ? `/dreamer?did=${encodeURIComponent(did)}` : '#';
        html += `<div class="cell avatar"${avatarStyle}>`;
        if (did) {
            html += `<a href="${dreamerLink}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(did)}" onclick="event.stopPropagation()"><img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'" style="cursor: pointer;"></a>`;
        } else {
            html += `<img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">`;
        }
        html += `</div>`;
        
        // Canon cell (keep normal padding, indent is handled by thread-arrow)
        if (this.options.columns.canon) {
            const canonPadding = level > 0 ? 8 : 12;
            const canonStyle = ` style="padding-left: ${canonPadding}px;"`;
            const nameLink = did ? `<a href="/dreamer?did=${encodeURIComponent(did)}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(did)}" onclick="event.stopPropagation()" style="font-weight: 500; color: inherit; text-decoration: none;">${name}</a>` : `<span style="font-weight: 500;">${name}</span>`;
            const eventSpan = `<span style="font-style: italic; color: var(--text-secondary);">${eventText}</span>`;
            html += `<div class="cell canon"${canonStyle}><span style="white-space: normal;">${nameLink} ${eventSpan}</span></div>`;
        }
        
        // Key cell
        if (this.options.columns.key) {
            const keyDisplay = key ? `<span style="font-size: 0.85em; font-family: monospace;">${key}</span>` : '<span>—</span>';
            html += `<div class="cell key">${keyDisplay}</div>`;
        }
        
        // URI cell - show just endpoint if relevant
        if (this.options.columns.uri) {
            let uriDisplay = '';
            if (uri) {
                uriDisplay = `<span style="font-size: 0.85em; font-family: monospace;">${uri}</span>`;
            } else if (url) {
                // Extract just the path/endpoint from URLs
                let endpoint = url;
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    try {
                        const urlObj = new URL(url);
                        endpoint = urlObj.pathname + urlObj.search + urlObj.hash;
                        if (!endpoint || endpoint === '/') {
                            endpoint = urlObj.hostname;
                        }
                    } catch (e) {
                        endpoint = url;
                    }
                }
                uriDisplay = `<span style="font-size: 0.85em; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;" title="${url}">${endpoint}</span>`;
            } else {
                uriDisplay = '<span>—</span>';
            }
            html += `<div class="cell uri">${uriDisplay}</div>`;
        }
        
        html += `</div>`;
        
        return html;
    }
    
    /**
     * Determine color system based on event data and options
     * Returns {source, intensity, key, customStyles}
     */
    determineColorSystem(event) {
        // Use the RowStyle system instead of the old color system
        if (window.getRowStyle) {
            const rowstyle = window.getRowStyle(event);
            return {
                source: 'rowstyle',
                rowstyle: rowstyle,
                intensity: 'auto', // RowStyle handles its own intensity
                key: ''
            };
        }
        
        // Fallback to old system if RowStyle not available
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
        const roleKeys = ['greeter', 'mapper', 'cogitarian', 'provisioner', 'architect'];
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
        // Use RowStyle system if available
        if (colorConfig.source === 'rowstyle' && colorConfig.rowstyle && window.rowStyleEngine) {
            return ' ' + window.rowStyleEngine.getRowClasses(event).replace('row-entry', '').trim();
        }
        
        // Fallback to old color system
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
        
        
        if (key === 'greeter' && event.reactionary) {
            classes += ' greeter-reactionary';
        }
        
        return classes;
    }
    
    /**
     * Build a map of reactions grouped by their parent event ID
     * @param {Array} events - All events including reactions
     * @returns {Map} Map of parentId -> [reaction events]
     */
    buildReactionMap(events) {
        const reactionMap = new Map();
        
        events.forEach(event => {
            // Direct reactions (from separate reaction events)
            if (event.reaction_to) {
                if (!reactionMap.has(event.reaction_to)) {
                    reactionMap.set(event.reaction_to, []);
                }
                // Avoid duplicates
                if (!reactionMap.get(event.reaction_to).find(r => r.id === event.id)) {
                    reactionMap.get(event.reaction_to).push(event);
                }
            }
            
            // Reactions from joined data (single reaction per event from API)
            if (event.reaction_id) {
                const reactionEvent = {
                    id: event.reaction_id,
                    did: event.reaction_did,
                    event: event.reaction_event,
                    type: event.reaction_type,
                    key: event.reaction_key,
                    uri: event.reaction_uri,
                    url: event.reaction_url,
                    epoch: event.reaction_epoch || null,
                    name: event.reaction_name,
                    avatar: event.reaction_avatar,
                    color_hex: event.reaction_color_hex,
                    octant: event.reaction_octant,
                    origin_octant: event.reaction_origin_octant,
                    color_source: event.reaction_color_source,
                    color_intensity: event.reaction_color_intensity,
                    reaction_to: event.id // Mark this as a reaction
                };
                
                if (!reactionMap.has(event.id)) {
                    reactionMap.set(event.id, []);
                }
                // Avoid duplicates
                if (!reactionMap.get(event.id).find(r => r.id === reactionEvent.id)) {
                    reactionMap.get(event.id).push(reactionEvent);
                }
            }
        });
        
        // Sort reactions by epoch for each parent
        reactionMap.forEach(reactions => {
            reactions.sort((a, b) => (a.epoch || 0) - (b.epoch || 0));
        });
        
        return reactionMap;
    }
    
    /**
     * Add relevant reactions to filtered events based on showReactions option
     */
    addReactionsToFilteredEvents() {
        if (!this.options.showReactions) return;
        
        // For each filtered event, add its reactions
        this.filteredEvents.forEach(event => {
            if (this.reactionMap.has(event.id)) {
                // Add reactions to the event for rendering
                event._reactions = this.reactionMap.get(event.id);
            }
        });
    }
    
    /**
     * Render events with proper threading (reactions indented beneath parents)
     * @param {Array} events - Events to render (may include reaction data)
     * @returns {string} HTML string
     */
    renderThreadedEvents(events) {
        let html = '';
        
        events.forEach(event => {
            // Render the main event
            html += this.buildEventRow(event, 0); // Level 0 = top level
            
            // Render reactions if they exist and showReactions is enabled
            if (this.options.showReactions && event._reactions) {
                event._reactions.forEach(reaction => {
                    html += this.buildEventRow(reaction, 1); // Level 1 = reaction level
                });
            }
        });
        
        return html;
    }
    
    /**
     * Apply snake charmer word animation to strange souvenir rows
     */
    applySnakeCharmerEffect(container) {
        // Find all strange souvenir rows within the container
        const strangeRows = container.querySelectorAll('.souvenir-strange.intensity-highlight, .souvenir-strange.intensity-special');
        
        strangeRows.forEach(row => {
            // Get all cells in the row (including key cell for wobble)
            const cells = row.querySelectorAll('.cell');
            
            cells.forEach((cell, cellIndex) => {
                // Skip if cell only contains images or empty content
                const hasOnlyImages = cell.querySelectorAll('img').length > 0 && !cell.textContent.trim();
                if (hasOnlyImages) return;
                
                let wordIndex = 0;
                
                // Recursively process all text nodes within the cell
                function processNode(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent;
                        const wordParts = text.split(/(\s+)/);
                        const fragment = document.createDocumentFragment();
                        
                        wordParts.forEach(part => {
                            if (part.trim()) {
                                const wordSpan = document.createElement('span');
                                wordSpan.textContent = part;
                                wordSpan.className = 'snake-word';
                                const totalDelay = (cellIndex * 8 + wordIndex * 2) * 0.1;
                                wordSpan.style.animationDelay = `${totalDelay}s`;
                                fragment.appendChild(wordSpan);
                                wordIndex++;
                            } else if (part) {
                                fragment.appendChild(document.createTextNode(part));
                            }
                        });
                        
                        node.parentNode.replaceChild(fragment, node);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // Recursively process child nodes
                        Array.from(node.childNodes).forEach(child => processNode(child));
                    }
                }
                
                // Start processing from the cell
                Array.from(cell.childNodes).forEach(child => processNode(child));
            });
        });
    }
}

// Make globally available
window.EventStack = EventStack;
console.log('✅ [EventStack] Widget loaded');
