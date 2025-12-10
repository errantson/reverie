/**
 * Event Row Renderer - Unified component for rendering event rows
 * Used by both database.html and profile.js to ensure consistent styling
 */

/**
 * Render a single event row with database.html styling
 * @param {Object} event - Event data object
 * @param {Object} options - Rendering options
 * @param {string} options.colorHex - Dreamer's color hex (for canon rows)
 * @param {Object} options.allDreamers - Array of all dreamers (for name lookups)
 * @param {boolean} options.showAvatar - Whether to show avatar column
 * @param {boolean} options.showType - Whether to show type column
 * @param {boolean} options.showKey - Whether to show key column
 * @param {boolean} options.showUri - Whether to show URI column
 * @param {string} options.currentDid - DID of current profile (for "you" vs name)
 * @returns {string} HTML string for the event row
 */
export function renderEventRow(event, options = {}) {
    const {
        colorHex = '#8b7355',
        allDreamers = [],
        showAvatar = true,
        showType = false,
        showKey = false,
        showUri = false,
        currentDid = null
    } = options;
    
    // Use event's color_hex if available (for canon rows), otherwise use provided colorHex
    const eventColor = event.color_hex || colorHex;
    
    // Calculate RGB from hex for gradient effects
    const r = parseInt(eventColor.substr(1, 2), 16);
    const g = parseInt(eventColor.substr(3, 2), 16);
    const b = parseInt(eventColor.substr(5, 2), 16);
    
    // Build color system classes matching database.html logic
    const isReactionary = event.isReactionary || false;
    const colorSource = event.color_source || 'none';
    const colorIntensity = event.color_intensity || 'none';
    const key = event.key || '';
    
    // Build class list for the row
    let rowClasses = ['row-entry'];
    
    // Add reactionary class
    if (isReactionary) {
        rowClasses.push('reaction-row');
    }
    
    // Add event-key class for all events
    if (key) {
        rowClasses.push(`event-key-${key}`);
    }
    
    // Add color-source class
    if (colorSource !== 'none') {
        rowClasses.push(`color-${colorSource}`);
    }
    
    // Add intensity class
    if (colorIntensity !== 'none') {
        rowClasses.push(`intensity-${colorIntensity}`);
    }
    
    // Add role-specific class for work events
    if (colorSource === 'role' && key) {
        rowClasses.push(`role-${key}`);
    }
    
    // Add octant class for octant-colored events
    if (colorSource === 'octant') {
        const octant = ((key === 'origin' || key === 'name') && event.origin_octant) ? event.origin_octant : event.octant;
        if (octant) {
            rowClasses.push(`octant-${octant}`);
        }
    }
    
    // Add souvenir-specific class for bespoke souvenir styling
    if (colorSource === 'souvenir' && key) {
        rowClasses.push(`souvenir-${key}`);
    }
    
    // Add nightmare class for nightmare prepare events
    if (key === 'prepare' && event.nightmare) {
        rowClasses.push('nightmare-prepare');
    }
    
    // Add reactionary class for welcomed greeter events
    if (key === 'greeter' && event.reactionary) {
        rowClasses.push('greeter-reactionary');
    }
    
    const rowClass = rowClasses.join(' ');
    
    // Build style attribute - set color variables for the color system
    let rowStyles = [];
    
    // Set user color CSS variable for user-colored events
    if (colorSource === 'user' && eventColor) {
        rowStyles.push(`--user-color: ${eventColor}`);
    }
    
    // Legacy canon color support (for backwards compatibility)
    rowStyles.push(`--canon-color: ${eventColor}`);
    rowStyles.push(`--canon-color-rgb: ${r}, ${g}, ${b}`);
    
    // Add click handler for URL
    const rowOnClick = event.url ? `onclick="window.open('${event.url}', '_blank')"` : '';
    const cursor = event.url ? 'cursor: pointer;' : '';
    if (cursor) rowStyles.push(cursor);
    
    const rowStyleAttr = rowStyles.length > 0 ? ` style="${rowStyles.join('; ')}"` : '';
    
    // Build row HTML
    let html = `<div class="${rowClass}"${rowOnClick}${rowStyleAttr}>`;
    
    // Epoch column - always show for events
    const epochValue = formatEpochForEvents(event.epoch);
    html += `<div class="cell epoch">${epochValue}</div>`;
    
    // Type column (optional)
    if (showType) {
        const typeValue = event.type || '<span style="color: var(--text-dim);">—</span>';
        html += `<div class="cell type">${typeValue}</div>`;
    }
    
    // Avatar column (optional)
    if (showAvatar) {
        const avatarValue = renderAvatar(event, allDreamers);
        html += `<div class="cell avatar">${avatarValue}</div>`;
    }
    
    // Canon column (name + event unified)
    const canonValue = renderCanonColumn(event, allDreamers, currentDid);
    html += `<div class="cell canon">${canonValue}</div>`;
    
    // Key column (optional)
    if (showKey) {
        let keyValue = event.key || '<span style="color: var(--text-dim);">—</span>';
        
        // Color role keys with their role colors
        if (event.key === 'greeter') {
            keyValue = `<span style="color: var(--role-greeter); font-weight: 700; font-size: 0.95em;">${event.key}</span>`;
        } else if (event.key === 'mapper') {
            keyValue = `<span style="color: var(--role-mapper); font-weight: 700; font-size: 0.95em;">${event.key}</span>`;
        } else if (event.key === 'cogitarian') {
            keyValue = `<span style="color: var(--role-cogitarian); font-weight: 700; font-size: 0.95em;">${event.key}</span>`;
        } else if ((event.key === 'origin' || event.key === 'name') && event.origin_octant) {
            // Origin and name events use origin_octant color
            const octantColor = `var(--octant-${event.origin_octant}-dark)`;
            keyValue = `<span style="color: ${octantColor}; font-weight: 700; font-size: 0.95em;">${event.key}</span>`;
        } else if (event.key === 'canon' && eventColor) {
            keyValue = `<span style="color: ${eventColor}; font-weight: 700; font-size: 0.95em;">${event.key}</span>`;
        } else if (event.key) {
            keyValue = `<span style="font-size: 0.95em;">${event.key}</span>`;
        }
        
        html += `<div class="cell key">${keyValue}</div>`;
    }
    
    // URI column (optional)
    if (showUri) {
        const uriValue = renderUri(event);
        html += `<div class="cell uri">${uriValue}</div>`;
    }
    
    html += '</div>';
    return html;
}

/**
 * Format epoch timestamp for events table
 * @param {number} epoch - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatEpochForEvents(epoch) {
    if (!epoch) return '<span style="color: var(--text-dim);">—</span>';
    
    const date = new Date(epoch * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Render avatar cell with dreamer link
 * @param {Object} event - Event data
 * @param {Array} allDreamers - Array of all dreamers
 * @returns {string} Avatar HTML
 */
function renderAvatar(event, allDreamers) {
    const did = event.did || '';
    const dreamerLink = did ? `/dreamer?did=${encodeURIComponent(did)}` : '#';
    const isReactionary = event.isReactionary || false;
    
    // Find dreamer in allDreamers to get avatar
    let avatarUrl = '/assets/icon_face.png';
    if (did && allDreamers && allDreamers.length > 0) {
        const dreamer = allDreamers.find(d => d.did === did);
        if (dreamer?.avatar) {
            if (typeof dreamer.avatar === 'string') {
                avatarUrl = dreamer.avatar;
            } else if (dreamer.avatar.url) {
                avatarUrl = dreamer.avatar.url;
            } else if (dreamer.avatar.ref?.$link) {
                const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${did}/${dreamer.avatar.ref.$link}@${ext}`;
            }
        }
    } else if (event.avatar) {
        avatarUrl = event.avatar;
    }
    
    // Add arrow prefix for reactionary entries
    const arrow = isReactionary ? `<span style="color: var(--primary); font-size: 1em; margin-right: 8px;">↳</span>` : '';
    
    if (did) {
        return `${arrow}<a href="${dreamerLink}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(did)}" onclick="event.stopPropagation()"><img src="${avatarUrl}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'" style="cursor: pointer;"></a>`;
    } else {
        return `${arrow}<img src="${avatarUrl}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">`;
    }
}

/**
 * Render unified canon column (name + event)
 * @param {Object} event - Event data
 * @param {Array} allDreamers - Array of all dreamers
 * @param {string} currentDid - Current profile DID (for "you" display)
 * @returns {string} Canon column HTML
 */
function renderCanonColumn(event, allDreamers, currentDid) {
    const name = event.name || 'unknown';
    const eventText = event.event || 'an event occurred';
    const did = event.did || '';
    const isReactionary = event.isReactionary || false;
    
    // Name links to dreamer page (stop propagation to prevent row click)
    let nameLink;
    if (did) {
        nameLink = `<a href="/dreamer?did=${encodeURIComponent(did)}" onclick="event.stopPropagation()" class="dreamer-name">${name}</a>`;
    } else {
        nameLink = `<span class="dreamer-name">${name}</span>`;
    }
    
    // Event text with conditional coloring for origin/name events
    let eventSpan;
    if ((event.key === 'origin' || event.key === 'name') && event.origin_octant) {
        const octantColor = `var(--octant-${event.origin_octant}-dark)`;
        eventSpan = `<span class="event-text" style="color: ${octantColor}; font-weight: 500;">${eventText}</span>`;
    } else if (event.key === 'greeter') {
        // Greeter events use greeter role color
        eventSpan = `<span class="event-text" style="color: var(--role-greeter); font-weight: 500;">${eventText}</span>`;
    } else if (event.key === 'mapper') {
        // Mapper events use mapper role color
        eventSpan = `<span class="event-text" style="color: var(--role-mapper); font-weight: 500;">${eventText}</span>`;
    } else if (event.key === 'cogitarian') {
        // Cogitarian events use cogitarian role color
        eventSpan = `<span class="event-text" style="color: var(--role-cogitarian); font-weight: 500;">${eventText}</span>`;
    } else {
        eventSpan = `<span class="event-text">${eventText}</span>`;
    }
    
    // Add slight indent for reactionary entries (arrow is in avatar column)
    const indent = isReactionary ? 'padding-left: 4px;' : '';
    
    return `<span style="white-space: normal; ${indent}">${nameLink} ${eventSpan}</span>`;
}

/**
 * Render URI cell with appropriate links
 * @param {Object} event - Event data
 * @returns {string} URI cell HTML
 */
function renderUri(event) {
    const value = event.uri;
    
    if (!value) {
        return '<span style="color: var(--text-dim);">—</span>';
    }
    
    if (value.startsWith('stripe:')) {
        // Stripe session code - link to order page if URL available
        const sessionCode = value.substring(7); // Remove "stripe:" prefix
        if (event.url && event.url.startsWith('/')) {
            // Link to internal URL (e.g., /order)
            return `<a href="${event.url}" onclick="event.stopPropagation()" style="font-family: monospace; font-size: 0.9em; color: var(--primary); text-decoration: none;">${sessionCode}</a>`;
        } else {
            // No URL, display as non-clickable text
            return `<span style="font-family: monospace; font-size: 0.9em; color: var(--text-dim);">${sessionCode}</span>`;
        }
    } else if (value.startsWith('at://')) {
        // AT Protocol URI - convert to Bluesky web link
        const parts = value.split('/');
        const endpoint = parts[parts.length - 1] || value;
        
        // Parse AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
        const match = value.match(/^at:\/\/(did:[^\/]+)\/app\.bsky\.feed\.post\/(.+)$/);
        if (match) {
            const did = match[1];
            const rkey = match[2];
            const webUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
            return `<a href="${webUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-family: monospace; font-size: 0.9em; color: var(--primary); text-decoration: none;">${endpoint}</a>`;
        } else {
            // Other AT URIs (like profile/self) - display as text or use row.url if available
            if (event.url) {
                return `<a href="${event.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-family: monospace; font-size: 0.9em; color: var(--primary); text-decoration: none;">${endpoint}</a>`;
            } else {
                return `<span style="font-family: monospace; font-size: 0.9em; color: var(--text-dim);">${endpoint}</span>`;
            }
        }
    } else if (event.url) {
        // URL field exists - link to it directly
        const parts = value.split('/');
        const endpoint = parts[parts.length - 1] || value;
        return `<a href="${event.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-family: monospace; font-size: 0.9em; color: var(--primary); text-decoration: none;">${endpoint}</a>`;
    } else {
        // Other URIs - display as non-clickable text
        const parts = value.split('/');
        const endpoint = parts[parts.length - 1] || value;
        return `<span style="font-family: monospace; font-size: 0.9em; color: var(--text-dim);">${endpoint}</span>`;
    }
}

/**
 * Batch render multiple events
 * @param {Array} events - Array of event objects
 * @param {Object} options - Rendering options (passed to renderEventRow)
 * @returns {string} Combined HTML for all events
 */
export function renderEventRows(events, options = {}) {
    return events.map(event => renderEventRow(event, options)).join('');
}
