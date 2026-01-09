// Work.js - Extension for sidebar functionality
// This file adds sidebar user section updates to the existing work.html functionality

(function() {
    'use strict';
    
    // Store user color globally for sidebar actions
    let currentUserColor = '#8b7355'; // Default fallback
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
    
    function initSidebar() {
        console.log('🎨 [Work] Initializing sidebar extensions');
        
        // Hook into OAuth events to update sidebar
        window.addEventListener('oauth:profile-loaded', handleProfileLoaded);
        window.addEventListener('oauth:login', handleLogin);
        window.addEventListener('oauth:logout', handleLogout);
        
        // Check initial state
        checkInitialSession();
    }
    
    function checkInitialSession() {
        if (window.oauthManager) {
            const session = window.oauthManager.getSession();
            if (session && session.profile?.handle) {
                updateSidebarUser(session);
                // Also update work status if available
                setTimeout(updateSidebarWorkStatus, 500);
            } else {
                showSidebarGuest();
            }
        } else {
            // OAuth manager not ready, try again
            setTimeout(checkInitialSession, 100);
        }
    }
    
    function handleProfileLoaded(event) {
        console.log('🎨 [Work] Profile loaded event received');
        const session = event.detail.session;
        updateSidebarUser(session);
        // Update work status after a short delay to let role statuses load
        setTimeout(updateSidebarWorkStatus, 300);
    }
    
    function handleLogin(event) {
        console.log('🎨 [Work] Login event received');
        // Wait for profile to load before updating
    }
    
    function handleLogout() {
        console.log('🎨 [Work] Logout event received');
        showSidebarGuest();
    }
    
    function showSidebarLoading() {
        const loadingEl = document.getElementById('sidebar-loading');
        const guestEl = document.getElementById('sidebar-guest');
        const userEl = document.getElementById('sidebar-user');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (guestEl) guestEl.style.display = 'none';
        if (userEl) userEl.style.display = 'none';
    }
    
    function showSidebarGuest() {
        const loadingEl = document.getElementById('sidebar-loading');
        const guestEl = document.getElementById('sidebar-guest');
        const userEl = document.getElementById('sidebar-user');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (guestEl) guestEl.style.display = 'flex';
        if (userEl) userEl.style.display = 'none';
    }
    
    async function updateSidebarUser(session) {
        const loadingEl = document.getElementById('sidebar-loading');
        const guestEl = document.getElementById('sidebar-guest');
        const userEl = document.getElementById('sidebar-user');
        
        if (!session || !session.profile) {
            showSidebarGuest();
            return;
        }
        
        const profile = session.profile;
        const displayName = profile.displayName || profile.handle || 'Unknown';
        const handle = profile.handle || 'unknown';
        const avatar = profile.avatar || '/assets/icon_face.png';
        const did = session.sub || session.did;
        
        // Update avatar
        const avatarEl = document.getElementById('sidebar-avatar');
        if (avatarEl) {
            avatarEl.src = avatar;
            avatarEl.alt = displayName;
        }
        
        // Update name and handle with user color
        const nameEl = document.getElementById('sidebar-user-name');
        const handleEl = document.getElementById('sidebar-user-handle');
        
        // Fetch user color from database
        let userColor = '#8b7355'; // Default color
        try {
            const response = await fetch(`/api/dreamers/${did}`);
            if (response.ok) {
                const dreamer = await response.json();
                userColor = dreamer.color_hex || userColor;
                currentUserColor = userColor; // Store globally for sidebar actions
            }
        } catch (error) {
            console.warn('Failed to fetch user color:', error);
        }
        
        if (nameEl) {
            nameEl.textContent = displayName;
            nameEl.style.color = userColor;
        }
        if (handleEl) handleEl.textContent = `@${handle}`;
        
        // Show user section
        if (loadingEl) loadingEl.style.display = 'none';
        if (guestEl) guestEl.style.display = 'none';
        if (userEl) userEl.style.display = 'flex';
        
        console.log('🎨 [Work] Sidebar user updated:', displayName, 'color:', userColor);
    }
    
    function updateSidebarWorkStatus() {
        // Access roleStatuses from global scope (defined in work.html)
        if (typeof roleStatuses === 'undefined') {
            console.warn('🎨 [Work] roleStatuses not yet available');
            return;
        }
        
        const statusContentEl = document.getElementById('sidebar-status-content');
        if (!statusContentEl) return;
        
        // Find which role the user has
        let userRole = null;
        let roleStatus = null;
        
        if (roleStatuses.greeter && roleStatuses.greeter.is_worker) {
            userRole = 'greeter';
            roleStatus = roleStatuses.greeter;
        } else if (roleStatuses.mapper && roleStatuses.mapper.is_worker) {
            userRole = 'mapper';
            roleStatus = roleStatuses.mapper;
        } else if (roleStatuses.cogitarian && roleStatuses.cogitarian.is_worker) {
            userRole = 'cogitarian';
            roleStatus = roleStatuses.cogitarian;
        } else if (roleStatuses.provisioner && roleStatuses.provisioner.is_worker) {
            userRole = 'provisioner';
            roleStatus = roleStatuses.provisioner;
        } else if (roleStatuses.dreamstyler && roleStatuses.dreamstyler.is_worker) {
            userRole = 'dreamstyler';
            roleStatus = roleStatuses.dreamstyler;
        } else if (roleStatuses.bursar && roleStatuses.bursar.is_worker) {
            userRole = 'bursar';
            roleStatus = roleStatuses.bursar;
        }
        
        if (!userRole) {
            // Not working - show as DREAMWEAVER
            statusContentEl.innerHTML = `
                <span class="status-badge not-working">DREAMWEAVER</span>
            `;
            console.log('🎨 [Work] Sidebar status: Dreamweaver');
            return;
        }

        // Get role title - use uppercase for display
        const roleConfigs = {
            greeter: { title: 'GREETER' },
            mapper: { title: 'MAPPER' },
            cogitarian: { title: 'COGITARIAN' },
            provisioner: { title: 'PROVISIONER' },
            dreamstyler: { title: 'DREAMSTYLER' },
            bursar: { title: 'BURSAR' }
        };

        const roleTitle = roleConfigs[userRole]?.title || userRole.toUpperCase();
        const status = roleStatus.status || 'working';
        const statusClass = status === 'retiring' ? 'retiring' : 'working';
        const statusText = status === 'retiring' ? 'Retiring' : 'Working';
        
        // Use the stored user color
        const userColor = currentUserColor;
        
        // Build status content with action buttons
        let statusHtml = `
            <span class="status-badge ${statusClass} role-${userRole}">${roleTitle}</span>
        `;
        
        // Add action buttons based on current status
        // Dreamstylers don't retire - they just step down
        if (status === 'working') {
            if (userRole === 'dreamstyler') {
                // Dreamstylers only get a "Step Down" button, no retiring
                statusHtml += `
                    <div class="sidebar-work-actions">
                        <button class="sidebar-action-btn stepdown-btn" onclick="deactivateRole('${userRole}')" title="Step down from being a Dreamstyler" style="background: ${userColor}; border-color: ${userColor};">
                            Step Down
                        </button>
                    </div>
                `;
            } else {
                statusHtml += `
                    <div class="sidebar-work-actions">
                        <button class="sidebar-action-btn retiring-btn" onclick="setRoleRetiring('${userRole}')" title="Begin retiring from this role" style="background: ${userColor}; border-color: ${userColor};">
                            Begin Retiring
                        </button>
                        <button class="sidebar-action-btn stepdown-btn" onclick="deactivateRole('${userRole}')" title="Step down immediately" style="background: ${userColor}; border-color: ${userColor}; filter: brightness(0.8);">
                            Step Down
                        </button>
                    </div>
                `;
            }
        } else if (status === 'retiring') {
            statusHtml += `
                <div class="sidebar-work-actions">
                    <button class="sidebar-action-btn stepdown-btn" onclick="deactivateRole('${userRole}')" title="Step down immediately" style="background: ${userColor}; border-color: ${userColor}; filter: brightness(0.8);">
                        Step Down
                    </button>
                </div>
            `;
        }
        
        statusContentEl.innerHTML = statusHtml;        console.log('🎨 [Work] Sidebar status updated:', statusText, roleTitle);
    }
    
    // Listen for custom work status update events
    window.addEventListener('work:status-updated', function() {
        console.log('🎨 [Work] Work status updated, refreshing sidebar');
        setTimeout(updateSidebarWorkStatus, 100);
    });
    
    // Listen for WorkEvents if available
    if (window.WorkEvents) {
        // Listen for all worker status changes
        Object.keys(window.WorkEvents.EVENTS).forEach(eventKey => {
            const eventName = window.WorkEvents.EVENTS[eventKey];
            window.WorkEvents.on(eventName, () => {
                console.log('🎨 [Work] WorkEvent received:', eventName);
                setTimeout(updateSidebarWorkStatus, 200);
                
                // Dispatch a custom event so work.html can also react
                window.dispatchEvent(new CustomEvent('work:role-changed', { 
                    detail: { eventName } 
                }));
            });
        });
    }
    
    // Expose update function for manual calls if needed
    window.updateSidebarWorkStatus = updateSidebarWorkStatus;
    
    // Periodically check for status updates (fallback)
    setInterval(updateSidebarWorkStatus, 5000);
    
})();
