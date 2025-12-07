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
    
    // Determine if this is a canon row
    const isCanonRow = event.key === 'canon';
    const rowClass = isCanonRow ? 'row-entry canon-row' : 'row-entry';
    
    // Build style attribute with canon colors if applicable
    let rowStyles = [];
    if (isCanonRow) {
        rowStyles.push(`--canon-color: ${eventColor}`);
        rowStyles.push(`--canon-color-rgb: ${r}, ${g}, ${b}`);
    }
    
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
        const keyValue = event.key || '<span style="color: var(--text-dim);">—</span>';
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
    
    if (did) {
        return `<a href="${dreamerLink}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(did)}" onclick="event.stopPropagation()"><img src="${avatarUrl}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'" style="cursor: pointer;"></a>`;
    } else {
        return `<img src="${avatarUrl}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">`;
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
    
    // Check if this is the current dreamer's event
    const isCurrentDreamer = currentDid && did.toLowerCase() === currentDid.toLowerCase();
    const displayName = isCurrentDreamer ? 'you' : name;
    
    // Name links to dreamer page (stop propagation to prevent row click)
    let nameLink;
    if (did) {
        nameLink = `<a href="/dreamer?did=${encodeURIComponent(did)}" onclick="event.stopPropagation()" style="font-weight: 500; color: inherit; text-decoration: none;">${displayName}</a>`;
    } else {
        nameLink = `<span style="font-weight: 500;">${displayName}</span>`;
    }
    
    // Event text is non-clickable (row click will open URL)
    const eventSpan = `<span style="font-style: italic; color: var(--text-secondary);">${eventText}</span>`;
    
    return `<span style="white-space: normal;">${nameLink} ${eventSpan}</span>`;
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
