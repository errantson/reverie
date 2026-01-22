/**
 * Reverie House - Live Events Page
 * 
 * Fetches and displays events from specific DIDs using the community.lexicon.calendar
 * lexicons (compatible with Smoke Signal Events).
 * 
 * Events are fetched directly from each organizer's AT Protocol PDS.
 */

// ===== CONFIGURATION =====
// Reverie House official DID for filtered view
const REVERIE_HOUSE_DID = 'did:plc:yauphjufk7phkwurn266ybx2';

// Handle mappings for display purposes (will be resolved from profiles)
const HANDLE_CACHE = {};

// PDS endpoint cache (resolved from PLC directory)
const PDS_CACHE = {};

// API endpoints
const PLC_DIRECTORY = 'https://plc.directory';
const PUBLIC_API = 'https://public.api.bsky.app';

// Current view state
let currentView = 'upcoming';
let currentEventList = 'reverie'; // 'reverie' or 'community'
let allEvents = [];
let userRsvps = {}; // Map of eventUri -> rsvp status ('attending', 'interested', 'notgoing')
let currentUser = null; // { did, handle, avatar, color }
let eventAttendees = {}; // Map of eventUri -> { total: number, dreamweavers: [{did, handle, avatar}] }
let eventAttendanceCounts = {}; // Map of eventUri -> total RSVP count from Smoke Signal
let allDreamweavers = []; // All dreamweavers from our database

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initEventsPage();
});

async function initEventsPage() {
    // Check if user is logged in for RSVP functionality
    await checkLoginStatus();
    
    // Apply user color to page
    applyUserColor();
    
    // Load dreamweavers from database FIRST (needed for community events)
    await loadDreamweavers();
    
    // Load events (uses dreamweavers list)
    await loadEvents();
    
    // Load dreamweaver attendance for events
    await loadDreamweaverAttendance();
    
    // Load attendance counts from Smoke Signal (async, renders when ready)
    loadSmokesignalAttendance();
    
    // Load user's RSVPs if logged in
    if (currentUser) {
        await loadUserRsvps();
    }
    
    // Final render with all data
    renderEvents();
}

// ===== PDS RESOLUTION =====
async function resolvePDS(did) {
    // Check cache first
    if (PDS_CACHE[did]) {
        return PDS_CACHE[did];
    }
    
    try {
        const response = await fetch(`${PLC_DIRECTORY}/${did}`);
        if (!response.ok) {
            console.warn(`Failed to resolve PDS for ${did}`);
            return null;
        }
        
        const data = await response.json();
        const pdsService = data.service?.find(s => s.id === '#atproto_pds');
        const pdsEndpoint = pdsService?.serviceEndpoint;
        
        if (pdsEndpoint) {
            PDS_CACHE[did] = pdsEndpoint;
            return pdsEndpoint;
        }
        
        return null;
    } catch (error) {
        console.error(`Error resolving PDS for ${did}:`, error);
        return null;
    }
}

// ===== EVENT LOADING =====
async function loadEvents() {
    showLoading();
    
    try {
        // Get DIDs to fetch events from based on current filter
        let didsToFetch = [];
        
        if (currentEventList === 'reverie') {
            // Reverie House Events: events created by OR RSVP'd to by Reverie House
            didsToFetch = [REVERIE_HOUSE_DID];
        } else {
            // Community: all dreamweavers
            didsToFetch = allDreamweavers.map(d => d.did);
            
            // Always include Reverie House even if not in dreamweavers list
            if (!didsToFetch.includes(REVERIE_HOUSE_DID)) {
                didsToFetch.push(REVERIE_HOUSE_DID);
            }
        }
        
        console.log(`📅 [Events] Fetching events from ${didsToFetch.length} sources (mode: ${currentEventList})`);
        
        // First, resolve all PDS endpoints in parallel
        await Promise.all(didsToFetch.map(did => resolvePDS(did)));
        
        // Collect all unique event URIs from:
        // 1. Events created by these DIDs
        // 2. Events these DIDs have RSVP'd to (attending/interested)
        
        const batchSize = 20;
        let createdEvents = [];
        let rsvpEventUris = new Set();
        
        // Fetch created events and RSVPs in parallel batches
        for (let i = 0; i < didsToFetch.length; i += batchSize) {
            const batch = didsToFetch.slice(i, i + batchSize);
            
            // Fetch created events
            const createdResults = await Promise.all(batch.map(did => fetchEventsFromDID(did)));
            createdEvents.push(...createdResults.flat());
            
            // Fetch RSVPs to find events they're attending/interested in
            const rsvpResults = await Promise.all(batch.map(did => fetchRsvpsFromDID(did)));
            rsvpResults.flat().forEach(uri => rsvpEventUris.add(uri));
        }
        
        // Remove URIs we already have from created events
        const createdUris = new Set(createdEvents.map(e => e.uri));
        const missingUris = [...rsvpEventUris].filter(uri => !createdUris.has(uri));
        
        console.log(`📅 [Events] Found ${missingUris.length} additional events from RSVPs`);
        
        // Fetch the missing events by URI
        let rsvpEvents = [];
        if (missingUris.length > 0) {
            rsvpEvents = await fetchEventsByUris(missingUris);
        }
        
        // Combine all events and deduplicate by URI
        const eventMap = new Map();
        [...createdEvents, ...rsvpEvents].forEach(event => {
            if (!eventMap.has(event.uri)) {
                eventMap.set(event.uri, event);
            }
        });
        
        allEvents = [...eventMap.values()];
        
        console.log(`📅 [Events] Loaded ${allEvents.length} total unique events`);
        
        // Sort events by start date
        allEvents.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
        
        // Resolve handles for all organizers
        await resolveHandles();
        
        // Render based on current view
        renderEvents();
        
    } catch (error) {
        console.error('Error loading events:', error);
        showError();
    }
}

// Fetch RSVPs from a user's PDS and return event URIs they're attending/interested in
async function fetchRsvpsFromDID(did) {
    try {
        const pdsEndpoint = PDS_CACHE[did];
        if (!pdsEndpoint) return [];
        
        const response = await fetch(
            `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=community.lexicon.calendar.rsvp&limit=100`
        );
        
        if (!response.ok) return [];
        
        const data = await response.json();
        const eventUris = [];
        
        for (const record of (data.records || [])) {
            const status = record.value?.status || '';
            // Only include going or interested (not notGoing)
            if (status.includes('#going') || status.includes('#interested')) {
                const eventUri = record.value?.subject?.uri;
                if (eventUri) {
                    eventUris.push(eventUri);
                }
            }
        }
        
        return eventUris;
    } catch (error) {
        return [];
    }
}

// Fetch events by their URIs (from various organizers' PDSes)
async function fetchEventsByUris(uris) {
    const events = [];
    
    // Group URIs by organizer DID
    const urisByDid = {};
    for (const uri of uris) {
        // URI format: at://did:plc:xxx/community.lexicon.calendar.event/rkey
        const match = uri.match(/^at:\/\/(did:[^\/]+)\//);
        if (match) {
            const did = match[1];
            if (!urisByDid[did]) urisByDid[did] = [];
            urisByDid[did].push(uri);
        }
    }
    
    // Resolve PDS for each unique DID
    const dids = Object.keys(urisByDid);
    await Promise.all(dids.map(did => resolvePDS(did)));
    
    // Fetch events from each organizer's PDS
    for (const did of dids) {
        const pdsEndpoint = PDS_CACHE[did];
        if (!pdsEndpoint) continue;
        
        for (const uri of urisByDid[did]) {
            try {
                // Extract rkey from URI
                const rkey = uri.split('/').pop();
                
                const response = await fetch(
                    `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=community.lexicon.calendar.event&rkey=${rkey}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    events.push({
                        uri: data.uri,
                        cid: data.cid,
                        organizerDid: did,
                        ...data.value
                    });
                }
            } catch (e) {
                // Skip failed fetches
            }
        }
    }
    
    return events;
}

async function fetchEventsFromDID(did) {
    try {
        // Get the PDS endpoint for this DID
        const pdsEndpoint = PDS_CACHE[did];
        if (!pdsEndpoint) {
            console.warn(`No PDS endpoint found for ${did}`);
            return [];
        }
        
        const response = await fetch(
            `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=community.lexicon.calendar.event&limit=50`
        );
        
        if (!response.ok) {
            console.warn(`Failed to fetch events from ${did} at ${pdsEndpoint}:`, response.status);
            return [];
        }
        
        const data = await response.json();
        
        // Transform records and add organizer DID
        const events = (data.records || []).map(record => ({
            uri: record.uri,
            cid: record.cid,
            organizerDid: did,
            ...record.value
        }));
        
        return events;
        
    } catch (error) {
        console.error(`Error fetching events from ${did}:`, error);
        return [];
    }
}

async function resolveHandles() {
    // Get unique DIDs that need handle resolution
    const didsToResolve = [...new Set(allEvents.map(e => e.organizerDid))];
    
    // Fetch profiles in parallel
    const profilePromises = didsToResolve.map(async did => {
        if (HANDLE_CACHE[did]) return;
        
        try {
            const response = await fetch(
                `${PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${did}`
            );
            
            if (response.ok) {
                const profile = await response.json();
                HANDLE_CACHE[did] = {
                    handle: profile.handle,
                    displayName: profile.displayName || profile.handle,
                    avatar: profile.avatar
                };
            }
        } catch (error) {
            console.warn(`Failed to resolve handle for ${did}:`, error);
            HANDLE_CACHE[did] = {
                handle: did.slice(0, 20) + '...',
                displayName: 'Unknown',
                avatar: null
            };
        }
    });
    
    await Promise.all(profilePromises);
}

// ===== VIEW MANAGEMENT =====
function switchEventView(view) {
    currentView = view;
    
    // Update button states (only view buttons, not list buttons)
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    renderEvents();
}

function switchEventList(list) {
    currentEventList = list;
    
    // Update button states (only list buttons, not view buttons)
    document.querySelectorAll('.view-btn[data-list]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.list === list);
    });
    
    // Reload events with new filter
    loadEvents();
}

// Make them available globally for onclick handlers
window.switchEventView = switchEventView;
window.switchEventList = switchEventList;

// ===== RENDERING =====
function renderEvents() {
    const listContainer = document.getElementById('events-list');
    const loadingEl = document.getElementById('events-loading');
    const errorEl = document.getElementById('events-error');
    const emptyEl = document.getElementById('events-empty');
    
    // Hide loading and error states
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    emptyEl.style.display = 'none';
    
    const now = new Date();
    
    // Filter events based on current view
    let filteredEvents;
    if (currentView === 'upcoming') {
        filteredEvents = allEvents.filter(event => {
            const endDate = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
            return endDate >= now;
        });
        
        // Sort upcoming: Attending first, then Interested, then chronological, Not Going last
        filteredEvents.sort((a, b) => {
            const aRsvp = userRsvps[a.uri];
            const bRsvp = userRsvps[b.uri];
            
            // Priority: attending=0, interested=1, none=2, notgoing=3
            const getPriority = (rsvp) => {
                if (rsvp === 'attending') return 0;
                if (rsvp === 'interested') return 1;
                if (rsvp === 'notgoing') return 3;
                return 2;
            };
            
            const aPriority = getPriority(aRsvp);
            const bPriority = getPriority(bRsvp);
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // Within same priority, sort by date
            return new Date(a.startsAt) - new Date(b.startsAt);
        });
    } else {
        filteredEvents = allEvents.filter(event => {
            const endDate = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
            return endDate < now;
        });
        // Sort past events most recent first
        filteredEvents.reverse();
    }
    
    // Check if empty
    if (filteredEvents.length === 0) {
        emptyEl.style.display = 'flex';
        listContainer.style.display = 'none';
        return;
    }
    
    // Render event cards
    listContainer.innerHTML = filteredEvents.map(event => renderEventCard(event)).join('');
    listContainer.style.display = 'flex';
}

function renderEventCard(event) {
    const organizer = HANDLE_CACHE[event.organizerDid] || { handle: 'unknown', displayName: 'Unknown' };
    const mode = getEventMode(event.mode);
    const headerImage = getEventHeaderImage(event);
    
    // Format date/time
    const startDate = new Date(event.startsAt);
    const dateStr = formatEventDate(startDate);
    const timeStr = formatEventTime(startDate, event.endsAt);
    
    // Get location string
    const locationStr = formatLocation(event.locations);
    
    // Truncate description
    const description = event.description || '';
    
    // Extract rkey and build smokesignal URL
    const rkey = event.uri.split('/').pop();
    const smokesignalUrl = `https://smokesignal.events/${event.organizerDid}/${rkey}`;
    
    // Campfire SVG for Smoke Signal link
    const campfireSvg = `<svg width="16" height="16" viewBox="0 0 100 100" fill="none">
        <path fill="currentColor" d="M78.9,84.7H21.1c-5.1,0-9.2-4.1-9.2-9.2s4.1-9.2,9.2-9.2h57.8c5.1,0,9.2,4.1,9.2,9.2S84,84.7,78.9,84.7z M21.1,69.2c-3.4,0-6.2,2.8-6.2,6.2c0,3.4,2.8,6.2,6.2,6.2h57.8c3.4,0,6.2-2.8,6.2-6.2c0-3.4-2.8-6.2-6.2-6.2H21.1z M50,68.4c-11.3,0-20.5-9.2-20.5-20.5c0-10.5,1.1-16.5,3.6-18.9c2.3-2.2,4.7-0.3,6.4,1c1.6,1.2,2.7,2,3.8,1.7c1.4-0.4,3.6-2.8,6.4-11.6c1.4-4.3,3.6-5,5.2-4.7c7.1,1.1,15.6,24,15.6,32.5C70.5,59.2,61.3,68.4,50,68.4z M35.5,31c-0.1,0-0.2,0-0.3,0.1c-1.2,1.2-2.7,5.1-2.7,16.7c0,9.6,7.8,17.5,17.5,17.5s17.5-7.8,17.5-17.5c0-9-8.8-28.9-13.1-29.5c-0.9-0.1-1.6,1.8-1.9,2.7c-2.7,8.4-5.2,12.6-8.3,13.6c-2.7,0.8-4.9-0.9-6.6-2.2C36.3,31.4,35.8,31,35.5,31z M50,68.4c-6.1,0-11-4.9-11-11c0-5.5,0.6-8.6,2-10c1.6-1.6,3.3-0.2,4.2,0.4c0.4,0.3,1,0.8,1.2,0.7c0.1,0,1.2-0.5,2.7-5.3c0.9-2.8,2.5-3,3.4-2.9c4.2,0.7,8.4,12.8,8.4,17C61,63.4,56.1,68.4,50,68.4z M42.9,49.9c-0.4,0.7-0.9,2.5-0.9,7.5c0,4.4,3.6,8,8,8s8-3.6,8-8c0-4.1-3.9-12.9-5.7-13.9c-0.1,0.1-0.2,0.4-0.3,0.7c-1.4,4.5-2.8,6.7-4.7,7.3c-1.7,0.5-3.1-0.5-4-1.2C43.2,50.1,43,50,42.9,49.9z M36.6,75.8c0-0.8-0.7-1.5-1.5-1.5h-9.7c-0.8,0-1.5,0.7-1.5,1.5s0.7,1.5,1.5,1.5h9.7C36,77.3,36.6,76.6,36.6,75.8z M76.4,75.8c0-0.8-0.7-1.5-1.5-1.5h-9.7c-0.8,0-1.5,0.7-1.5,1.5s0.7,1.5,1.5,1.5h9.7C75.7,77.3,76.4,76.6,76.4,75.8z"/>
    </svg>`;
    
    return `
        <div class="event-card" onclick="openEventModal('${event.uri}')">
            <div class="event-card-main">
                <img src="${headerImage}" alt="" class="event-header-image" loading="lazy">
                <div class="event-card-header">
                    <h3 class="event-title">${escapeHtml(event.name)}</h3>
                    <span class="event-mode-badge ${mode.class}">${mode.label}</span>
                </div>
                <div class="event-datetime">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>${dateStr} • ${timeStr}</span>
                </div>
                <div class="event-location-row">
                    ${locationStr ? `
                        <div class="event-location">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>${escapeHtml(locationStr)}</span>
                        </div>
                    ` : ''}
                    <div class="event-attendance-count" data-attendance-uri="${event.uri}" style="display: ${eventAttendanceCounts[event.uri] ? 'flex' : 'none'}">
                        ${renderAttendanceCountHtml(eventAttendanceCounts[event.uri])}
                    </div>
                </div>
                <p class="event-description">${escapeHtml(description)}</p>
                <div class="event-footer">
                    <div class="event-organizer">
                        ${organizer.avatar ? `<img src="${organizer.avatar}" alt="" class="event-organizer-avatar">` : ''}
                        <span>by</span>
                        <a href="https://bsky.app/profile/${organizer.handle}" target="_blank" 
                           class="event-organizer-handle" onclick="event.stopPropagation()">
                            @${organizer.handle}
                        </a>
                        ${renderDreamweaverAvatars(event.uri)}
                    </div>
                    <a href="${smokesignalUrl}" target="_blank" class="event-smokesignal-link" onclick="event.stopPropagation()">
                        ${campfireSvg}
                        <span>Smoke Signal</span>
                    </a>
                </div>
            </div>
            <div class="event-action-box" onclick="event.stopPropagation()">
                <div class="event-action-label">RSVP</div>
                <div class="event-rsvp-btns">
                    ${renderRsvpButton(event.uri, 'attending', 'Attending')}
                    ${renderRsvpButton(event.uri, 'interested', 'Interested')}
                    ${renderRsvpButton(event.uri, 'notgoing', 'Not Going')}
                </div>
            </div>
        </div>
    `;
}

// ===== EVENT MODAL =====
async function openEventModal(eventUri) {
    const event = allEvents.find(e => e.uri === eventUri);
    if (!event) return;
    
    const modalOverlay = document.getElementById('event-modal-overlay');
    const modalContent = document.getElementById('event-modal-content');
    
    const organizer = HANDLE_CACHE[event.organizerDid] || { handle: 'unknown', displayName: 'Unknown' };
    const mode = getEventMode(event.mode);
    const headerImage = getEventHeaderImage(event);
    
    // Format date/time
    const startDate = new Date(event.startsAt);
    const dateStr = formatEventDate(startDate);
    const timeStr = formatEventTime(startDate, event.endsAt);
    
    // Get location
    const locationStr = formatLocation(event.locations);
    const locationFull = formatLocationFull(event.locations);
    
    // Extract rkey from URI
    const rkey = event.uri.split('/').pop();
    const smokesignalUrl = `https://smokesignal.events/${event.organizerDid}/${rkey}`;
    const icsUrl = `https://smokesignal.events/ics/${event.uri.replace('at://', 'at://')}`;
    
    modalContent.innerHTML = `
        ${headerImage ? `<img src="${headerImage}" alt="" class="modal-event-header-image">` : ''}
        <div class="modal-event-content">
            <h2 class="modal-event-title">${escapeHtml(event.name)}</h2>
            <div class="modal-event-organizer">
                ${organizer.avatar ? `<img src="${organizer.avatar}" alt="" class="modal-organizer-avatar">` : ''}
                <span>Organized by</span>
                <a href="https://bsky.app/profile/${organizer.handle}" target="_blank" 
                   class="event-organizer-handle">@${organizer.handle}</a>
            </div>
            
            <div class="modal-event-meta">
                <div class="modal-meta-row">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <div>
                        <div class="modal-meta-label">When</div>
                        <div class="modal-meta-value">${dateStr} • ${timeStr}</div>
                    </div>
                </div>
                ${locationFull ? `
                    <div class="modal-meta-row">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <div>
                            <div class="modal-meta-label">Where</div>
                            <div class="modal-meta-value">${escapeHtml(locationFull)}</div>
                        </div>
                    </div>
                ` : ''}
                <div class="modal-meta-row">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${mode.class === 'virtual' ? `
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        ` : mode.class === 'hybrid' ? `
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        ` : `
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        `}
                    </svg>
                    <div>
                        <div class="modal-meta-label">Format</div>
                        <div class="modal-meta-value">${mode.label}</div>
                    </div>
                </div>
            </div>
            
            ${event.description ? `
                <div class="modal-event-description">${escapeHtml(event.description)}</div>
            ` : ''}
            
            ${event.uris && event.uris.length > 0 ? `
                <div class="modal-event-links">
                    <div class="modal-links-label">Event Links</div>
                    ${event.uris.map(link => `
                        <a href="${escapeHtml(link.uri)}" target="_blank" class="modal-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            <span>${escapeHtml(link.name || link.uri)}</span>
                        </a>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="modal-rsvp-section">
                <div class="modal-rsvp-label">RSVP</div>
                <p class="rsvp-login-prompt">
                    To RSVP, visit this event on <a href="${smokesignalUrl}" target="_blank">Smoke Signal</a> and sign in with your AT Protocol account.
                </p>
            </div>
            
            <div class="modal-external-links">
                <a href="${smokesignalUrl}" target="_blank" class="external-link-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    View on Smoke Signal
                </a>
                <a href="https://bsky.app/intent/compose?text=${encodeURIComponent(`Check out "${event.name}" ${smokesignalUrl}`)}" 
                   target="_blank" class="external-link-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                        <polyline points="16 6 12 2 8 6"></polyline>
                        <line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                    Share on Bluesky
                </a>
            </div>
        </div>
    `;
    
    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Close on overlay click
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeEventModal();
        }
    };
    
    // Close on escape key
    document.addEventListener('keydown', handleModalEscape);
}

function closeEventModal() {
    const modalOverlay = document.getElementById('event-modal-overlay');
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalEscape);
}

function handleModalEscape(e) {
    if (e.key === 'Escape') {
        closeEventModal();
    }
}

// Make modal functions available globally
window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;

// ===== HELPER FUNCTIONS =====
function getEventMode(mode) {
    if (!mode) return { label: 'In Person', class: 'inperson' };
    
    if (mode.includes('#virtual')) {
        return { label: 'Virtual', class: 'virtual' };
    } else if (mode.includes('#hybrid')) {
        return { label: 'Hybrid', class: 'hybrid' };
    }
    return { label: 'In Person', class: 'inperson' };
}

// Default banners for events without header images
const DEFAULT_EVENT_BANNERS = [
    '/assets/banners/banner01.png',
    '/assets/banners/banner02.png',
    '/assets/banners/banner03.png'
];

function getEventHeaderImage(event) {
    if (event.media && event.media.length > 0) {
        const headerMedia = event.media.find(m => m.role === 'header');
        if (headerMedia && headerMedia.content) {
            // Construct CDN URL from blob reference
            const blobRef = headerMedia.content.ref?.$link;
            if (blobRef) {
                return `https://cdn.bsky.app/img/feed_fullsize/plain/${event.organizerDid}/${blobRef}@jpeg`;
            }
        }
    }
    
    // Return a consistent default banner based on event URI (so same event always gets same banner)
    const hash = event.uri.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return DEFAULT_EVENT_BANNERS[hash % DEFAULT_EVENT_BANNERS.length];
}

function formatEventDate(date) {
    const options = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

function formatEventTime(startDate, endsAt) {
    const timeOptions = { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZoneName: 'short'
    };
    
    const startTime = startDate.toLocaleTimeString('en-US', timeOptions);
    
    if (endsAt) {
        const endDate = new Date(endsAt);
        // Check if same day
        if (startDate.toDateString() === endDate.toDateString()) {
            const endTimeOptions = { hour: 'numeric', minute: '2-digit' };
            const endTime = endDate.toLocaleTimeString('en-US', endTimeOptions);
            return `${startTime.replace(/\s[A-Z]+$/, '')} - ${endTime}`;
        } else {
            // Multi-day event
            return `${startTime} - ${formatEventDate(endDate)}`;
        }
    }
    
    return startTime;
}

function formatLocation(locations) {
    if (!locations || locations.length === 0) return null;
    
    const loc = locations[0];
    if (loc.name) return loc.name;
    if (loc.locality && loc.country) return `${loc.locality}, ${loc.country}`;
    if (loc.locality) return loc.locality;
    return null;
}

function formatLocationFull(locations) {
    if (!locations || locations.length === 0) return null;
    
    const loc = locations[0];
    const parts = [];
    
    if (loc.name) parts.push(loc.name);
    if (loc.street) parts.push(loc.street);
    
    const cityParts = [];
    if (loc.locality) cityParts.push(loc.locality);
    if (loc.region) cityParts.push(loc.region);
    if (loc.postalCode) cityParts.push(loc.postalCode);
    if (loc.country) cityParts.push(loc.country);
    
    if (cityParts.length > 0) {
        parts.push(cityParts.join(', '));
    }
    
    return parts.join('\n');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== UI STATE HELPERS =====
function showLoading() {
    document.getElementById('events-loading').style.display = 'flex';
    document.getElementById('events-error').style.display = 'none';
    document.getElementById('events-empty').style.display = 'none';
    document.getElementById('events-list').style.display = 'none';
}

function showError() {
    document.getElementById('events-loading').style.display = 'none';
    document.getElementById('events-error').style.display = 'flex';
    document.getElementById('events-empty').style.display = 'none';
    document.getElementById('events-list').style.display = 'none';
}

// Make loadEvents available globally for retry button
window.loadEvents = loadEvents;

// ===== LOGIN STATUS =====
async function checkLoginStatus() {
    // This integrates with the existing oauth-manager.js
    // Try to get session, but if oauthManager isn't ready yet, wait for the event
    try {
        // First check if oauthManager exists and has a session
        let session = window.oauthManager?.getSession?.();
        
        // If no session found, also check currentSession directly (used by oauth-manager)
        if (!session) {
            session = window.oauthManager?.currentSession;
        }
        
        // Also check for PDS session (app password login)
        if (!session) {
            const pdsSessionStr = localStorage.getItem('pds_session');
            if (pdsSessionStr) {
                try {
                    session = JSON.parse(pdsSessionStr);
                } catch (e) {}
            }
        }
        
        if (session && (session.did || session.sub)) {
            const did = session.did || session.sub;
            
            // Get user's dreamer record from database for color
            let userColor = '#8b60af'; // default
            let dbAvatar = null;
            try {
                const dreamerResp = await fetch(`/api/dreamers/${did}`);
                if (dreamerResp.ok) {
                    const dreamer = await dreamerResp.json();
                    userColor = dreamer.color_hex || '#8b60af';
                    dbAvatar = dreamer.avatar;
                    console.log('📅 [Events] Got dreamer color from DB:', userColor);
                }
            } catch (e) {
                console.log('📅 [Events] Could not fetch dreamer record:', e);
            }
            
            // Fallback to profile API for avatar if not in DB
            let avatar = dbAvatar;
            if (!avatar) {
                try {
                    const profileResp = await fetch(`${PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${did}`);
                    const profile = profileResp.ok ? await profileResp.json() : {};
                    avatar = profile.avatar || null;
                } catch (e) {}
            }
            
            currentUser = {
                did: did,
                handle: session.handle,
                avatar: avatar || session.avatar || null,
                color: userColor
            };
            
            console.log('📅 [Events] User logged in:', currentUser.handle, 'color:', currentUser.color);
        } else {
            console.log('📅 [Events] No session found');
        }
    } catch (e) {
        console.log('📅 [Events] Not logged in or error:', e);
        currentUser = null;
    }
}

// Listen for OAuth events to update login status
window.addEventListener('oauth:profile-loaded', async (e) => {
    console.log('📅 [Events] OAuth profile loaded event received');
    await checkLoginStatus();
    applyUserColor();
    if (currentUser) {
        await loadUserRsvps();
    }
    renderEvents(); // Re-render with new login state
});

window.addEventListener('oauth:login', async (e) => {
    console.log('📅 [Events] OAuth login event received');
    await checkLoginStatus();
    applyUserColor();
    if (currentUser) {
        await loadUserRsvps();
    }
    renderEvents(); // Re-render with new login state
});

window.addEventListener('oauth:logout', () => {
    console.log('📅 [Events] OAuth logout event received');
    currentUser = null;
    userRsvps = {}; // Clear RSVPs on logout
    applyUserColor();
    renderEvents(); // Re-render without login
});

function applyUserColor() {
    const userColor = currentUser?.color || window.colorManager?.color || '#8b60af';
    document.documentElement.style.setProperty('--user-color', userColor);
}

// ===== DREAMWEAVER & ATTENDANCE LOADING =====
async function loadDreamweavers() {
    try {
        const response = await fetch('/api/dreamers');
        if (!response.ok) {
            console.log('📅 [Events] Could not fetch dreamweavers');
            return;
        }
        
        const dreamers = await response.json();
        allDreamweavers = dreamers.map(d => ({
            did: d.did,
            handle: d.handle,
            avatar: d.avatar,
            name: d.name || d.display_name,
            color: d.color_hex || '#8b60af'  // Store user's color
        }));
        
        console.log(`📅 [Events] Loaded ${allDreamweavers.length} dreamweavers from database`);
    } catch (e) {
        console.error('📅 [Events] Error loading dreamweavers:', e);
    }
}

// Load which dreamweavers have RSVP'd to events (from their PDS directly)
async function loadDreamweaverAttendance() {
    // Check which dreamweavers have RSVP'd going to events
    const dreamweaversToCheck = allDreamweavers.slice(0, 50); // Check first 50 dreamweavers
    
    console.log(`📅 [Events] Checking RSVPs for ${dreamweaversToCheck.length} dreamweavers...`);
    
    // Fetch RSVPs from each dreamweaver's PDS in parallel (batched)
    const batchSize = 10;
    for (let i = 0; i < dreamweaversToCheck.length; i += batchSize) {
        const batch = dreamweaversToCheck.slice(i, i + batchSize);
        await Promise.all(batch.map(dw => fetchDreamweaverRsvps(dw)));
    }
    
    console.log('📅 [Events] Dreamweaver attendance:', eventAttendees);
}

// Fetch attendance counts from Smoke Signal (async, updates UI when ready)
async function loadSmokesignalAttendance() {
    console.log('📅 [Events] Loading attendance counts from Smoke Signal...');
    
    // Fetch attendance for all events in parallel (batched to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < allEvents.length; i += batchSize) {
        const batch = allEvents.slice(i, i + batchSize);
        await Promise.all(batch.map(event => fetchEventAttendanceCount(event)));
    }
    
    console.log('📅 [Events] Attendance counts loaded:', eventAttendanceCounts);
}

// Fetch RSVP count for a single event from Smoke Signal
async function fetchEventAttendanceCount(event) {
    try {
        // Parse event URI: at://did:plc:xxx/community.lexicon.calendar.event/rkey
        const uriMatch = event.uri.match(/at:\/\/(did:[^/]+)\/community\.lexicon\.calendar\.event\/([^/]+)/);
        if (!uriMatch) return;
        
        const [, did, rkey] = uriMatch;
        const attendeesUrl = `https://smokesignal.events/${did}/${rkey}/attendees`;
        
        const response = await fetch(attendeesUrl);
        if (!response.ok) return;
        
        const html = await response.text();
        
        // Extract count from: <strong>148</strong> people have RSVP'd
        const match = html.match(/<strong>(\d+)<\/strong>\s*people have RSVP/);
        if (match) {
            const count = parseInt(match[1], 10);
            eventAttendanceCounts[event.uri] = count;
            
            // Update the UI element if it exists
            const countEl = document.querySelector(`[data-attendance-uri="${event.uri}"]`);
            if (countEl) {
                countEl.innerHTML = renderAttendanceCountHtml(count);
                countEl.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    } catch (e) {
        // Silently ignore errors for individual events
    }
}

// Helper to render attendance count HTML
function renderAttendanceCountHtml(count) {
    if (!count || count === 0) return '';
    return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span>${count} attending</span>
    `;
}

async function fetchDreamweaverRsvps(dreamweaver) {
    try {
        const pds = await resolvePDS(dreamweaver.did);
        if (!pds) return;
        
        const response = await fetch(
            `${pds}/xrpc/com.atproto.repo.listRecords?repo=${dreamweaver.did}&collection=community.lexicon.calendar.rsvp&limit=50`
        );
        
        if (!response.ok) return;
        
        const data = await response.json();
        const rsvps = data.records || [];
        
        for (const rsvp of rsvps) {
            const eventUri = rsvp.value?.subject?.uri;
            const status = rsvp.value?.status;
            
            if (!eventUri || !status) continue;
            
            // Only count 'going' as attending
            const statusType = status.split('#')[1];
            if (statusType !== 'going') continue;
            
            // Initialize event entry if needed
            if (!eventAttendees[eventUri]) {
                eventAttendees[eventUri] = { total: 0, dreamweavers: [] };
            }
            
            // Add dreamweaver if not already counted
            const alreadyCounted = eventAttendees[eventUri].dreamweavers.some(d => d.did === dreamweaver.did);
            if (!alreadyCounted) {
                eventAttendees[eventUri].total++;
                eventAttendees[eventUri].dreamweavers.push({
                    did: dreamweaver.did,
                    handle: dreamweaver.handle,
                    avatar: dreamweaver.avatar,
                    name: dreamweaver.name,
                    color: dreamweaver.color || '#8b60af'
                });
            }
        }
    } catch (e) {
        // Silently ignore errors for individual dreamweavers
    }
}

// Renders dreamweaver avatars for the organizer/by line
function renderDreamweaverAvatars(eventUri) {
    const attendance = eventAttendees[eventUri];
    if (!attendance || attendance.dreamweavers.length === 0) return '';
    
    const dreamweavers = attendance.dreamweavers.slice(0, 5); // Show max 5 avatars
    const remaining = attendance.dreamweavers.length - dreamweavers.length;
    
    const avatarsHtml = dreamweavers.map(dw => `
        <a href="/dreamer.html?did=${dw.did}" class="dreamweaver-avatar" title="${dw.handle}" 
           style="--dw-color: ${dw.color || '#8b60af'}" onclick="event.stopPropagation()">
            ${dw.avatar 
                ? `<img src="${dw.avatar}" alt="${dw.handle}">` 
                : `<span class="avatar-placeholder">${(dw.name || dw.handle || '?')[0].toUpperCase()}</span>`}
        </a>
    `).join('');
    
    return `
        <div class="dreamweaver-avatars">
            <span class="dreamweavers-label">Attending Dreamweavers:</span>
            ${avatarsHtml}
            ${remaining > 0 ? `<span class="dreamweaver-more">+${remaining}</span>` : ''}
        </div>
    `;
}

// ===== RSVP LOADING FROM PDS =====
// Map of eventUri -> { status, rkey, cid } for tracking existing records
let userRsvpRecords = {};

async function loadUserRsvps() {
    if (!currentUser?.did) return;
    
    try {
        // Resolve user's PDS
        const userPds = await resolvePDS(currentUser.did);
        if (!userPds) {
            console.log('📅 [Events] Could not resolve user PDS for RSVPs');
            return;
        }
        
        // Fetch all RSVP records from user's PDS
        const response = await fetch(
            `${userPds}/xrpc/com.atproto.repo.listRecords?repo=${currentUser.did}&collection=community.lexicon.calendar.rsvp&limit=100`
        );
        
        if (!response.ok) {
            console.log('📅 [Events] Could not fetch RSVPs:', response.status);
            return;
        }
        
        const data = await response.json();
        const rsvpRecords = data.records || [];
        
        console.log(`📅 [Events] Loaded ${rsvpRecords.length} RSVP records from user's PDS`);
        
        // Build maps of event URI -> RSVP status and record info
        userRsvps = {};
        userRsvpRecords = {};
        
        for (const record of rsvpRecords) {
            const eventUri = record.value?.subject?.uri;
            const status = record.value?.status;
            const rkey = record.uri.split('/').pop();
            
            if (eventUri && status) {
                // Convert status like "community.lexicon.calendar.rsvp#going" to "attending"
                const statusType = status.split('#')[1];
                let normalizedStatus;
                if (statusType === 'going') {
                    normalizedStatus = 'attending';
                } else if (statusType === 'interested' || statusType === 'maybe') {
                    normalizedStatus = 'interested';
                } else if (statusType === 'notGoing' || statusType === 'notgoing') {
                    normalizedStatus = 'notgoing';
                }
                
                if (normalizedStatus) {
                    userRsvps[eventUri] = normalizedStatus;
                    userRsvpRecords[eventUri] = {
                        rkey: rkey,
                        cid: record.cid,
                        subjectCid: record.value?.subject?.cid
                    };
                }
            }
        }
        
        console.log('📅 [Events] User RSVPs:', userRsvps);
        
    } catch (e) {
        console.error('📅 [Events] Error loading RSVPs:', e);
    }
}

// ===== RSVP MANAGEMENT =====
function renderRsvpButton(eventUri, type, label) {
    const isSelected = userRsvps[eventUri] === type;
    const hasSelection = userRsvps[eventUri] !== undefined;
    const isLoggedIn = !!currentUser;
    
    // Build class list
    let classes = `event-rsvp-btn ${type}`;
    if (isSelected) classes += ' selected';
    if (hasSelection && !isSelected) classes += ' faded';
    if (!isLoggedIn) classes += ' disabled';
    
    // Avatar for selected state
    const avatarHtml = isSelected && currentUser?.avatar 
        ? `<img src="${currentUser.avatar}" alt="" class="rsvp-user-avatar">` 
        : '';
    
    if (!isLoggedIn) {
        return `<span class="${classes}" title="Log in to RSVP">${avatarHtml}${label}</span>`;
    }
    
    // Use data attributes to pass event info
    return `<button class="${classes}" data-event-uri="${eventUri}" data-rsvp-type="${type}" onclick="toggleRsvp(this)">${avatarHtml}${label}</button>`;
}

async function toggleRsvp(button) {
    const eventUri = button.dataset.eventUri;
    const type = button.dataset.rsvpType;
    
    if (!currentUser?.did) {
        console.log('📅 [Events] Cannot RSVP - not logged in');
        return;
    }
    
    // Show loading state
    button.disabled = true;
    button.classList.add('loading');
    
    try {
        const currentStatus = userRsvps[eventUri];
        const existingRecord = userRsvpRecords[eventUri];
        
        if (currentStatus === type) {
            // Deselecting - delete the RSVP record
            if (existingRecord) {
                await deleteRsvpRecord(existingRecord.rkey);
                delete userRsvps[eventUri];
                delete userRsvpRecords[eventUri];
                console.log('📅 [Events] Deleted RSVP for:', eventUri);
            }
        } else {
            // Selecting a new status
            const event = allEvents.find(e => e.uri === eventUri);
            if (!event) {
                throw new Error('Event not found');
            }
            
            if (existingRecord) {
                // Update existing record by deleting and creating new
                await deleteRsvpRecord(existingRecord.rkey);
            }
            
            // Create new RSVP record
            const result = await createRsvpRecord(event, type);
            userRsvps[eventUri] = type;
            userRsvpRecords[eventUri] = {
                rkey: result.uri.split('/').pop(),
                cid: result.cid
            };
            console.log('📅 [Events] Created RSVP:', type, 'for:', eventUri);
        }
        
        // Re-render events to update button states and attendance
        renderEvents();
        
    } catch (e) {
        console.error('📅 [Events] Error toggling RSVP:', e);
        alert('Failed to update RSVP: ' + e.message);
    }
}

async function createRsvpRecord(event, type) {
    const userPds = await resolvePDS(currentUser.did);
    if (!userPds) throw new Error('Could not resolve user PDS');
    
    // Map our type to lexicon status
    const statusMap = {
        'attending': 'community.lexicon.calendar.rsvp#going',
        'interested': 'community.lexicon.calendar.rsvp#interested',
        'notgoing': 'community.lexicon.calendar.rsvp#notGoing'
    };
    
    const record = {
        '$type': 'community.lexicon.calendar.rsvp',
        status: statusMap[type],
        subject: {
            uri: event.uri,
            cid: event.cid
        },
        createdAt: new Date().toISOString()
    };
    
    // Try to create the record
    const response = await fetchWithAuth(`${userPds}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            repo: currentUser.did,
            collection: 'community.lexicon.calendar.rsvp',
            record: record
        })
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create record: ${response.status}`);
    }
    
    return await response.json();
}

async function deleteRsvpRecord(rkey) {
    const userPds = await resolvePDS(currentUser.did);
    if (!userPds) throw new Error('Could not resolve user PDS');
    
    const response = await fetchWithAuth(`${userPds}/xrpc/com.atproto.repo.deleteRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            repo: currentUser.did,
            collection: 'community.lexicon.calendar.rsvp',
            rkey: rkey
        })
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Failed to delete record: ${response.status}`);
    }
    
    return true;
}

// Helper to make authenticated requests
async function fetchWithAuth(url, options = {}) {
    // Try PDS session first
    const pdsSessionStr = localStorage.getItem('pds_session');
    if (pdsSessionStr) {
        try {
            const pdsSession = JSON.parse(pdsSessionStr);
            if (pdsSession.accessJwt) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${pdsSession.accessJwt}`
                };
                return await fetch(url, options);
            }
        } catch (e) {
            console.log('📅 [Events] PDS session auth failed:', e);
        }
    }
    
    // Try OAuth
    if (window.oauthManager?.client && currentUser?.did) {
        try {
            const agent = await window.oauthManager.client.restore(currentUser.did);
            if (agent?.fetchHandler) {
                // Extract path from URL for OAuth agent
                const urlObj = new URL(url);
                return await agent.fetchHandler(urlObj.pathname, options);
            }
        } catch (e) {
            console.log('📅 [Events] OAuth auth failed:', e);
        }
    }
    
    throw new Error('No authentication method available');
}

// Make toggleRsvp available globally
window.toggleRsvp = toggleRsvp;
