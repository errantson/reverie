console.log('🔐 Loading login.js...');
class LoginWidget {
    constructor() {
        this.coreColor = '#87408d';
        this.loginsEnabled = false;
        this.oauthManager = null;
        this.lastPopupTime = 0; // Debounce timer
        this.popupDebounceMs = 500; // Prevent double-clicks within 500ms
        this.initOAuthManager();
        this.loadCoreColor();
        this.setupLoginTriggers();
    }
    setupLoginTriggers() {
        /**
         * Listen for oauth:login events and trigger user_login pigeons.
         * This handles OAuth logins from oauth-manager.js
         */
        window.addEventListener('oauth:login', async (e) => {
            const session = e.detail?.session;
            if (session && (session.did || session.sub)) {
                const userDid = session.did || session.sub;
                console.log('🔑 oauth:login event received, triggering user_login pigeons');
                await this.triggerUserLogin(userDid);
            }
        });
    }
    initOAuthManager() {
        const tryGetOAuthManager = (attempts = 0) => {
            if (window.oauthManager) {
                this.oauthManager = window.oauthManager;
                console.log('✅ Login widget: OAuth manager connected');
            } else if (attempts < 50) {
                setTimeout(() => tryGetOAuthManager(attempts + 1), 20);
            } else {
                console.warn('⚠️ Login widget: OAuth manager not available after 1s');
            }
        };
        tryGetOAuthManager();
    }
    async loadCoreColor() {
        try {
            // Use centralized color manager
            if (window.colorManager) {
                await window.colorManager.init();
                this.coreColor = window.colorManager.getColor();
            }
            
            // Load world config for logins flag
            if (window.worldConfigCache) {
                const data = await window.worldConfigCache.fetch();
                if (data.hasOwnProperty('logins')) {
                    this.loginsEnabled = data.logins;
                }
            }
            
            // Listen for color changes
            window.addEventListener('reverie:color-changed', (event) => {
                this.coreColor = event.detail.color;
            });
        } catch (error) {
            console.warn('Login widget: Could not load config:', error);
        }
    }
    async triggerUserLogin(userDid) {
        /**
         * Trigger user_login pigeons for this user.
         * Called after successful login (OAuth or PDS).
         */
        if (!userDid) {
            console.warn('⚠️ triggerUserLogin: No user DID provided');
            return;
        }
        
        console.log(`🕊️ Triggering user_login pigeons for ${userDid}`);
        
        try {
            // Get auth token
            const token = localStorage.getItem('oauth_token');
            
            const response = await fetch('/api/pigeons/trigger/user_login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ user_did: userDid })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ User login pigeons triggered:', result);
            } else {
                console.warn('⚠️ Failed to trigger user_login pigeons:', response.status);
            }
        } catch (error) {
            console.error('❌ Error triggering user_login pigeons:', error);
        }
    }
    showLoginPopup() {
        console.log('🔐 showLoginPopup() called');
        
        // Debounce: prevent rapid double-calls
        const now = Date.now();
        if (now - this.lastPopupTime < this.popupDebounceMs) {
            console.log('⚠️ Debounced - popup called too quickly after previous call');
            return;
        }
        this.lastPopupTime = now;
        
        console.log('   this.oauthManager:', this.oauthManager);
        console.log('   this.loginsEnabled:', this.loginsEnabled);
        
        // Check if any other modals/overlays are already visible
        const existingOverlays = document.querySelectorAll('.login-overlay, .logout-overlay, .create-dreamer-overlay, .shadowbox-overlay, .share-modal-overlay');
        const visibleOverlays = Array.from(existingOverlays).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.opacity !== '0' && el.offsetParent !== null;
        });
        
        if (visibleOverlays.length > 0) {
            console.log('⚠️ Other modals are currently visible, not showing login popup');
            return;
        }
        
        if (!this.oauthManager) {
            console.warn('⚠️ Login widget: OAuth manager not ready yet');
            this.oauthManager = window.oauthManager;
            if (!this.oauthManager) {
                alert('Login system is still loading. Please try again in a moment.');
                return;
            }
        }
        const session = this.oauthManager.getSession();
        console.log('   Current session:', session);
        if (session) {
            console.log('✅ User is logged in, showing logout popup');
            this.showLogoutPopup(session);
            return;
        }
        console.log(`📋 Showing ${this.loginsEnabled ? 'ENABLED' : 'DISABLED'} login popup`);
        if (this.loginsEnabled) {
            this.showLoginPopupEnabled();
        } else {
            this.showLoginPopupDisabled();
        }
    }
    showLoginPopupDisabled() {
        console.log('🚫 showLoginPopupDisabled() called');
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        // Ensure overlay and its box sit above header and other chrome
        overlay.style.zIndex = '99999';
        box.style.zIndex = '100000';
        console.log('   Created overlay:', overlay);
        const loginBox = document.createElement('div');
        loginBox.className = 'login-box login-disabled';
        console.log('   Created login box:', loginBox);
        const coreColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--reverie-core-color').trim() || this.coreColor || '#87408d';
        console.log('   Using core color:', coreColor);
        loginBox.innerHTML = `
            <div class="login-content">
                <img src="/assets/icon.png" alt="Reverie House" class="login-logo">
                <div class="login-disabled-message">
                    <p class="welcome-text">Welcome, dreamer.</p>
                    <p class="soon-text">Soon this place will be fully yours.</p>
                    <p class="thanks-text">Thank you for seeking.</p>
                </div>
                <button id="loginDisabledEnter" class="login-enter-btn" style="background: ${coreColor}; border: 2px solid ${coreColor}; margin-top: 2px; min-height: 36px; font-size: 1rem;">
                    <span class="enter-text">SOON</span>
                </button>
            </div>
        `;
        loginBox.style.borderColor = coreColor;
        overlay.appendChild(loginBox);
        document.body.appendChild(overlay);
        console.log('   Added overlay to document.body');
        setTimeout(() => {
            overlay.classList.add('visible');
            loginBox.classList.add('visible');
            console.log('✅ Login popup should now be visible');
        }, 10);
        const enterBtn = document.getElementById('loginDisabledEnter');
        enterBtn.addEventListener('mousedown', () => {
            enterBtn.classList.add('pressed');
        });
        enterBtn.addEventListener('mouseup', () => {
            enterBtn.classList.remove('pressed');
        });
        enterBtn.addEventListener('mouseleave', () => {
            enterBtn.classList.remove('pressed');
        });
        enterBtn.addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
            }
        });
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    showMessage(title, message, isError = false) {
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        const messageBox = document.createElement('div');
        messageBox.className = 'login-box login-message-box';
        const coreColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--reverie-core-color').trim() || this.coreColor || '#87408d';
        const iconSrc = isError ? '/assets/icon_face.png' : '/assets/icon.png';
        messageBox.innerHTML = `
            <div class="login-content">
                <img src="${iconSrc}" alt="Reverie House" class="login-logo" ${isError ? 'style="opacity: 0.7;"' : ''}>
                <h2 class="login-title" style="color: ${isError ? '#d94848' : coreColor};">${title}</h2>
                <p class="login-message-text" style="text-align: center; margin: 1rem 0 1.5rem 0; line-height: 1.5;">${message}</p>
                <button id="messageOk" class="login-method-btn" style="background: ${coreColor}; color: white; border: none;">
                    <span>OK</span>
                </button>
            </div>
        `;
        overlay.appendChild(messageBox);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('visible');
            messageBox.classList.add('visible');
        }, 10);
        const closeMessage = () => {
            overlay.classList.remove('visible');
            messageBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        };
        document.getElementById('messageOk').addEventListener('click', closeMessage);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeMessage();
            }
        });
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeMessage();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async showDeactivatedPanel(former, events, fallbackHandle) {
        // Render a compact 'dissipated' panel. Try to enrich with live DB data like Profile widget.
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        const box = document.createElement('div');
        box.className = 'login-box login-deactivated-box compact';
        const coreColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--reverie-core-color').trim() || this.coreColor || '#87408d';

        // Prefer to load archival data from /api/formers if available
        const fetchFormer = async () => {
            try {
                // Use DID first if provided either from former or fallbackHandle
                const didToTry = (former && former.did) || (fallbackHandle && fallbackHandle.startsWith('did:') && fallbackHandle) || null;
                if (didToTry) {
                    const resp = await fetch(`/api/formers/${encodeURIComponent(didToTry)}`);
                    if (resp.ok) return await resp.json();
                }

                // Then try by handle (former.handle or fallbackHandle)
                const handleToTry = (former && former.handle) || fallbackHandle || null;
                if (handleToTry) {
                    // Try archived formers by handle first
                    try {
                        const resp = await fetch(`/api/formers/${encodeURIComponent(handleToTry)}`);
                        if (resp.ok) return await resp.json();
                    } catch (e) {
                        // ignore and try live lookup
                    }

                    // As fallback, try to query live dreamers list and find match by handle
                    const resp2 = await fetch('/api/dreamers');
                    if (!resp2.ok) return null;
                    const list = await resp2.json();
                    return list.find(d => d.handle && d.handle.toLowerCase() === handleToTry.toLowerCase()) || null;
                }

                return null;
            } catch (e) {
                console.warn('Failed to fetch former/profile for deactivated panel:', e);
                return null;
            }
        };

        const dreamerData = await fetchFormer();

        // Decide values to show
        const displayName = (dreamerData && (dreamerData.display_name || dreamerData.name)) || (former && (former.display_name || former.name)) || 'A Dissipated Dreamer';
        const handle = (dreamerData && dreamerData.handle) || (former && former.handle) || (fallbackHandle || '');
        const avatar = (dreamerData && (dreamerData.avatar || dreamerData.avatar_url)) || (former && (former.avatar || former.avatar_url)) || '/assets/icon_face.png';
        const description = (dreamerData && (dreamerData.description || (dreamerData.profile && dreamerData.profile.description))) || (former && former.profile && former.profile.description) || '';

        // Try to fetch the authoritative `former` record by DID (it may contain the stored historical color)
        let authoritativeFormer = former || null;
        const getColorFromRecord = (r) => {
            if (!r) return null;
            return r.user_color || r.usercolor || r.color || r.accent_color || r.accent || (r.profile && (r.profile.user_color || r.profile.color || r.profile.accent_color)) || null;
        };

        if (!authoritativeFormer) {
            // If we have a dreamerData with a DID, try to fetch the former record by that DID
            const didCandidate = (dreamerData && dreamerData.did) || (former && former.did) || null;
            if (didCandidate) {
                try {
                    const resp = await fetch(`/api/formers/${encodeURIComponent(didCandidate)}`);
                    if (resp.ok) {
                        authoritativeFormer = await resp.json();
                    }
                } catch (e) {
                    // ignore fetch errors
                }
            }
        } else {
            // we have a `former` param, but try to re-fetch authoritative record by DID if possible
            const didCandidate = authoritativeFormer.did || (dreamerData && dreamerData.did) || null;
            if (didCandidate) {
                try {
                    const resp = await fetch(`/api/formers/${encodeURIComponent(didCandidate)}`);
                    if (resp.ok) authoritativeFormer = await resp.json();
                } catch (e) {}
            }
        }

        // Determine user's accent/color: prefer authoritativeFormer, then archival dreamerData, then fallback to coreColor
        let userColor = getColorFromRecord(authoritativeFormer) || getColorFromRecord(dreamerData) || coreColor;

        // Special-case: if the queried handle is blink.reverie.house, force the historic color #776384
        if (handle && handle.toLowerCase() === 'blink.reverie.house') {
            userColor = '#776384';
        }

        // If we have a DID, fetch canonical events and filter like profile.js
        let finalEvents = events && events.length ? events : [];
        const didForEvents = (dreamerData && dreamerData.did) || (former && former.did) || null;
        if (didForEvents) {
            try {
                const canonResp = await fetch('/api/canon');
                if (canonResp.ok) {
                    const allCanon = await canonResp.json();
                    // Filter to this dreamer's events AND events they reacted to
                    const dreamerEvents = allCanon.filter(entry => {
                        const isOwnEvent = entry.did && entry.did.toLowerCase() === didForEvents.toLowerCase();
                        const isReactedTo = entry.reaction_did && entry.reaction_did.toLowerCase() === didForEvents.toLowerCase();
                        return isOwnEvent || isReactedTo;
                    });

                    // Deduplicate by id
                    const uniqueEvents = [];
                    const seenIds = new Set();
                    for (const ev of dreamerEvents) {
                        if (!seenIds.has(ev.id)) {
                            seenIds.add(ev.id);
                            uniqueEvents.push(ev);
                        }
                    }

                    if (uniqueEvents.length > 0) finalEvents = uniqueEvents;
                }
            } catch (e) {
                console.warn('Failed to fetch canon for deactivated panel:', e);
            }
        }

        // Build events HTML
        let eventsHtml = '';
        if (finalEvents && finalEvents.length > 0) {
            eventsHtml = '<ul class="deactivated-events">' + finalEvents.slice(0,5).map(e => `<li><small>${new Date((e.epoch || 0) * 1000).toLocaleString()}</small> — ${e.event}</li>`).join('') + '</ul>';
        } else {
            eventsHtml = '<p><em>No recent public events preserved.</em></p>';
        }

        // Simplified layout: explainer, avatar|name, octant showcase, eventstack, actions
            box.innerHTML = `
                <div style="padding:8px; background: #f7fafc; border-bottom: 1px solid ${userColor}; border-top-left-radius:0; border-top-right-radius:0; margin-bottom:6px; max-width:420px; margin-left:auto; margin-right:auto;">
                    <strong id="deactivated-title" style="font-size:1.08rem;">${displayName} has Dissipated</strong>
                    <div style="color:#4a5568; margin-top:6px; font-size:0.82rem; line-height:1.18; max-width:360px; margin-left:auto; margin-right:auto; text-align:center;">
                        <div><strong id="deactivated-handle">@${handle}</strong> has dissipated their presence and can no longer roam our wild mindscape in this form.</div>
                        <div style="margin-top:6px;">Their impact on <strong id="deactivated-rh">Reverie House</strong> is remembered, and we seek their spirit in other personas.</div>
                    </div>
                </div>

            <div style="display:flex; flex-direction:row; align-items:center; justify-content:center; gap:12px; padding:8px 12px; max-width:420px; margin:0 auto;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                    <div style="width:88px; height:88px; border-radius:50%; overflow:hidden; background:#f3f3f3; display:flex; align-items:center; justify-content:center; border:2px solid ${userColor};">
                            <img src="${avatar}" alt="${displayName}" style="width:88px; height:88px; object-fit:cover; border-radius:50%;" onerror="this.src='/assets/icon_face.png'">
                        </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.98rem; font-weight:800; color:${userColor};">${displayName}</div>
                        <div style="color:${userColor}; font-weight:700; font-size:0.9rem; margin-top:2px;">@${handle}</div>
                    </div>
                </div>
                <div style="flex-shrink:0; display:flex; align-items:center; justify-content:center;">
                    <div id="deactivated-octant" style="width:240px; height:120px; margin-left:6px;"></div>
                </div>
            </div>

            <div style="padding:8px 12px; text-align:center;">
                <div id="deactivated-eventstack" style="width:100%; max-width:420px; margin: -5px auto 2px auto; max-height:240px; overflow:auto; border:1px solid ${userColor}; border-radius:0; background: #ffffff; box-shadow: none; padding:0;">
                    <!-- EventStack will render here; container constrained and scrollable when >4 events -->
                </div>
            </div>

            <div style="padding:12px; display:flex; flex-direction:column; align-items:center; gap:6px;">
                <button id="deactivatedClose" class="login-method-btn" style="width:60%; background:#eef2f7; color:#2d3748; padding:8px 12px; border:1px solid #cbd5e1; border-radius:0;">Close</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Force user color onto key elements with !important priority to avoid stylesheet overrides
        (function enforceUserColor() {
            try {
                const titleEl = box.querySelector('#deactivated-title');
                const handleEl = box.querySelector('#deactivated-handle');
                const rhEl = box.querySelector('#deactivated-rh');
                const avatarFrame = box.querySelector('div[style*="border:2px solid"]') || box.querySelector('img[alt]')?.parentElement;
                const eventstackEl = box.querySelector('#deactivated-eventstack');

                if (titleEl) titleEl.style.setProperty('color', userColor, 'important');
                if (handleEl) handleEl.style.setProperty('color', userColor, 'important');
                if (rhEl) rhEl.style.setProperty('color', userColor, 'important');
                if (avatarFrame) avatarFrame.style.setProperty('border-color', userColor, 'important');
                if (eventstackEl) eventstackEl.style.setProperty('border-color', userColor, 'important');
            } catch (e) {
                console.warn('Failed to enforce userColor on deactivated panel elements:', e);
            }
        })();
        setTimeout(() => {
            overlay.classList.add('visible');
            box.classList.add('visible');
        }, 10);

        // Asynchronously load widgets: OctantDisplay and EventStack, then initialize
        (async () => {
            const loadScript = (src, globalName) => new Promise((resolve, reject) => {
                if (globalName && window[globalName]) return resolve();
                if (document.querySelector(`script[src*="${src}"]`)) {
                    // wait briefly for global to appear
                    let waited = 0;
                    const iv = setInterval(() => {
                        waited += 50;
                        if ((globalName && window[globalName]) || waited > 2000) {
                            clearInterval(iv);
                            return resolve();
                        }
                    }, 50);
                    return;
                }
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => resolve();
                s.onerror = (e) => reject(e);
                document.head.appendChild(s);
            });

            // Initialize OctantDisplay
            try {
                await loadScript('/js/widgets/octantdisplay.js', 'OctantDisplay');
                const octantContainer = document.getElementById('deactivated-octant');
                        if (octantContainer && window.OctantDisplay) {
                    try {
                        const oct = new OctantDisplay(octantContainer, { did: didForEvents, showHeader: true, showFooter: false });
                        oct.init();
                    } catch (err) {
                        console.warn('OctantDisplay init error:', err);
                    }
                }
            } catch (e) {
                console.warn('Failed to load OctantDisplay:', e);
            }

            // Initialize EventStack
            try {
                await loadScript('/js/widgets/eventstack.js', 'EventStack');
                const evContainer = document.getElementById('deactivated-eventstack');
                if (evContainer && window.EventStack) {
                    try {
                        const eventStack = new EventStack();

                        // Local compact styles for this panel to reduce row height and tighten epoch column
                        (function(){
                            if (!document.querySelector('style[data-generated-by="login-deactivated-compact"]')) {
                                const s = document.createElement('style');
                                s.setAttribute('data-generated-by','login-deactivated-compact');
                                s.textContent = `
                                    #deactivated-eventstack .row-entry { padding: 4px 8px; font-size: 0.86rem; }
                                    #deactivated-eventstack .epoch { padding: 2px 4px; min-width: 48px; max-width: 64px; font-size:0.78rem; }
                                    #deactivated-eventstack .evt-avatar, #deactivated-eventstack img.event-avatar { width:22px; height:22px; }
                                    #deactivated-eventstack { font-size: 0.88rem; }
                                `;
                                document.head.appendChild(s);
                            }
                        })();

                        // Render up to 4 events; container scrolls if there are more
                        eventStack.render(finalEvents || [], evContainer, {
                            limit: 4,
                            showReactions: false,
                            dateFormat: 'date',
                            columns: { type: false, epoch: true, canon: true, key: false, uri: false },
                            emptyMessage: '<div style="text-align:center; font-style:italic; color:var(--text-dim);">No preserved events</div>'
                        });
                    } catch (err) {
                        console.warn('EventStack render error:', err);
                    }
                }
            } catch (e) {
                console.warn('Failed to load EventStack:', e);
            }
        })();

        document.getElementById('deactivatedClose').addEventListener('click', () => {
            overlay.classList.remove('visible');
            box.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        });
        // Contact Keepers button removed per UI update
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                box.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }
    showLoginPopupEnabled() {
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        const loginBox = document.createElement('div');
        loginBox.className = 'login-box';
        const coreColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--reverie-core-color').trim() || this.coreColor || '#87408d';
        loginBox.innerHTML = `
            <div class="login-content">
                <img src="/assets/logo.png" alt="Reverie House" class="login-logo">
                <div class="login-form">
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: #888; text-align: center;">enter your name or handle</p>
                    <div class="login-handle-input-group" style="margin-bottom: 0.5rem;">
                        <span class="login-handle-prefix">@</span>
                        <input 
                            type="text" 
                            id="loginHandleQuick" 
                            class="login-handle-input" 
                            placeholder="loading..."
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                        >
                    </div>
                    <button id="loginBluesky" class="login-method-btn login-bluesky-btn" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <img src="/assets/bluesky.png" alt="" style="width: 20px; height: 20px;">
                        <span>Visit Reverie House</span>
                    </button>
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: #888; text-align: center;">residents and dreamweavers only</p>
                    <button id="loginInviteKey" class="login-method-btn login-reverie-btn" style="margin-top: 0rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <img src="/assets/icon.png" alt="" style="width: 20px; height: 20px;">
                        <span>Become a Resident</span>
                    </button>
                </div>
                <button id="loginCancel" class="login-cancel-btn">Cancel</button>
            </div>
        `;
        overlay.appendChild(loginBox);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('visible');
            loginBox.classList.add('visible');
        }, 10);
        const quickHandleInput = document.getElementById('loginHandleQuick');
        
        // Fetch dreamer names and rotate them in the placeholder
        (async () => {
            try {
                const dbResponse = await fetch('/api/database/all');
                if (dbResponse.ok) {
                    const dbData = await dbResponse.json();
                    const dreamers = dbData.tables?.dreamers || dbData.dreamers || [];
                    const names = dreamers
                        .map(d => d.name)
                        .filter(name => name && name.trim().length > 0);
                    
                    if (names.length > 0) {
                        let currentIndex = 0;
                        
                        // Set initial placeholder
                        quickHandleInput.placeholder = `${names[0]} or name.bsky.social`;
                        
                        // Rotate names every 3 seconds with fade effect
                        const rotatePlaceholder = () => {
                            // Don't rotate if user is typing
                            if (document.activeElement === quickHandleInput && quickHandleInput.value.length > 0) {
                                return;
                            }
                            
                            // Fade out
                            quickHandleInput.style.transition = 'opacity 0.3s ease';
                            quickHandleInput.style.opacity = '0.5';
                            
                            setTimeout(() => {
                                // Change placeholder
                                currentIndex = (currentIndex + 1) % names.length;
                                quickHandleInput.placeholder = `${names[currentIndex]} or name.bsky.social`;
                                
                                // Fade in
                                quickHandleInput.style.opacity = '1';
                            }, 300);
                        };
                        
                        // Start rotation
                        const rotationInterval = setInterval(rotatePlaceholder, 3000);
                        
                        // Stop rotation when input gets focus with value
                        quickHandleInput.addEventListener('input', () => {
                            if (quickHandleInput.value.length > 0) {
                                clearInterval(rotationInterval);
                                quickHandleInput.style.opacity = '1';
                            }
                        });
                        
                        // Clean up on overlay removal
                        overlay.addEventListener('remove', () => {
                            clearInterval(rotationInterval);
                        });
                    } else {
                        quickHandleInput.placeholder = 'name or name.bsky.social';
                    }
                } else {
                    quickHandleInput.placeholder = 'name or name.bsky.social';
                }
            } catch (error) {
                console.error('Failed to load dreamer names:', error);
                quickHandleInput.placeholder = 'name or name.bsky.social';
            }
        })();
        
        document.getElementById('loginBluesky').addEventListener('click', async () => {
            let handle = quickHandleInput.value.trim();
            if (!handle) {
                quickHandleInput.focus();
                return;
            }
            if (handle.startsWith('@')) {
                handle = handle.substring(1);
            }
            if (handle.includes('did:plc:') || handle.includes('did:web:')) {
                const didMatch = handle.match(/(did:(?:plc|web):[a-zA-Z0-9]+)/);
                if (didMatch) {
                    handle = didMatch[1];
                }
            }
            
            // If no dot and not a DID, check database for name match first
            if (!handle.includes('.') && !handle.startsWith('did:')) {
                console.log(`🔍 No dot in handle "${handle}", checking database for name match...`);
                try {
                    const dbResponse = await fetch('/api/database/all');
                    if (dbResponse.ok) {
                        const dbData = await dbResponse.json();
                        const dreamers = dbData.tables?.dreamers || dbData.dreamers || [];
                        const dreamerByName = dreamers.find(d => d.name && d.name.toLowerCase() === handle.toLowerCase());
                        
                        if (dreamerByName && dreamerByName.handle) {
                            console.log(`   ✅ Found dreamer by name: ${dreamerByName.name} -> ${dreamerByName.handle}`);
                            handle = dreamerByName.handle;
                        } else {
                            console.log(`   ❌ No dreamer found with name "${handle}", using fallback: ${handle}.bsky.social`);
                            handle = `${handle}.bsky.social`;
                        }
                    } else {
                        // Database check failed, use bsky.social fallback
                        console.log(`   ⚠️ Database check failed, using fallback: ${handle}.bsky.social`);
                        handle = `${handle}.bsky.social`;
                    }
                } catch (error) {
                    console.error('   ❌ Database check error:', error);
                    // On error, use bsky.social fallback
                    console.log(`   ⚠️ Using fallback due to error: ${handle}.bsky.social`);
                    handle = `${handle}.bsky.social`;
                }
            }
            
            // Now determine which auth flow to use based on PDS endpoint
            // Resolve handle to check PDS service endpoint
            // First, normalize the handle (replace @ with .)
            handle = handle.replace('@', '.');
            
            console.log(`🔍 Checking PDS endpoint for ${handle}...`);
            try {
                // Resolve handle to DID
                const didResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
                if (didResponse.ok) {
                    const didData = await didResponse.json();
                    const did = didData.did;
                    console.log(`   DID: ${did}`);
                    
                    // Fetch DID document to find PDS
                    let didDocResponse;
                    if (did.startsWith('did:web:')) {
                        // did:web DIDs are resolved from the domain's .well-known directory
                        const domain = did.replace('did:web:', '');
                        const didDocUrl = `https://${domain}/.well-known/did.json`;
                        console.log(`   Resolving did:web from ${didDocUrl}`);
                        didDocResponse = await fetch(didDocUrl);
                    } else {
                        // did:plc DIDs are resolved from PLC directory
                        didDocResponse = await fetch(`https://plc.directory/${did}`);
                    }
                    if (didDocResponse.ok) {
                        const didDoc = await didDocResponse.json();
                        const service = didDoc.service?.find(s => s.id === '#atproto_pds');
                        const serviceEndpoint = service?.serviceEndpoint || '';
                        console.log(`   PDS endpoint: ${serviceEndpoint}`);
                        
                        // Route based on PDS endpoint
                        // If it's bsky.network, use OAuth
                        // If it's anything else (reverie.house or foreign PDS), use dreamweaver login
                        if (serviceEndpoint.includes('bsky.network')) {
                            console.log(`   📤 bsky.network detected - using OAuth`);
                            overlay.classList.remove('visible');
                            loginBox.classList.remove('visible');
                            setTimeout(() => overlay.remove(), 300);
                            await this.oauthManager.login(handle);
                            return;
                        } else {
                            console.log(`   🏠 Non-bsky.network PDS detected - routing to dreamweaver login`);
                            overlay.classList.remove('visible');
                            loginBox.classList.remove('visible');
                            setTimeout(() => {
                                overlay.remove();
                                this.showDreamweaverLoginForm(handle);
                            }, 300);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error('   ❌ PDS check error:', error);
            }
            
            // Fallback: if PDS check fails, try OAuth (will handle errors appropriately)
            console.log(`   ⚠️ PDS check failed, defaulting to OAuth`);
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            try {
                await this.oauthManager.login(handle);
            } catch (error) {
                console.error('OAuth login error:', error);
                this.showMessage('Login Failed', error.message || 'Unable to start login process', true);
            }
        });
        quickHandleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginBluesky').click();
            }
        });
        document.getElementById('loginInviteKey').addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                // Show the CreateDreamer widget
                if (window.CreateDreamer) {
                    const createDreamer = new window.CreateDreamer();
                    createDreamer.show({
                        onSuccess: (result) => {
                            console.log('✅ Account created:', result);
                        },
                        onCancel: () => {
                            console.log('❌ Account creation cancelled');
                        }
                    });
                } else {
                    console.error('CreateDreamer widget not loaded');
                    this.showMessage('Error', 'Account creation system not available', true);
                }
            }, 300);
        });
        document.getElementById('loginCancel').addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            
            // Dispatch cancel event
            window.dispatchEvent(new CustomEvent('oauth:cancel'));
            console.log('📢 [login.js] Dispatched oauth:cancel event');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                
                // Dispatch cancel event
                window.dispatchEvent(new CustomEvent('oauth:cancel'));
                console.log('📢 [login.js] Dispatched oauth:cancel event (overlay click)');
            }
        });
    }
    showBlueskyLoginForm(prefilledHandle = '') {
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        const loginBox = document.createElement('div');
        loginBox.className = 'login-box';
        loginBox.innerHTML = `
            <div class="login-content">
                <img src="/assets/logo.png" alt="Reverie House" class="login-logo">
                <h2 class="login-title">login via bluesky</h2>
                <div class="login-form">
                    <div class="login-handle-input-group">
                        <span class="login-handle-prefix">@</span>
                        <input 
                            type="text" 
                            id="loginHandle" 
                            class="login-handle-input" 
                            placeholder="name.bsky.social"
                            value="${prefilledHandle}"
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                        >
                    </div>
                    <button id="loginEnter" class="login-method-btn login-bluesky-btn">
                        <span id="loginText">Login via Bluesky</span>
                    </button>
                </div>
                <button id="loginBack" class="login-cancel-btn">Back</button>
                <p class="login-help-text">
                    Using <a href="https://atproto.com/specs/oauth" target="_blank" class="login-help-link">AT Protocol OAuth</a>. No passwords stored.
                </p>
            </div>
        `;
        overlay.appendChild(loginBox);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('visible');
            loginBox.classList.add('visible');
        }, 10);
        const handleInput = document.getElementById('loginHandle');
        const handleGroup = document.querySelector('.login-handle-input-group');
        const enterBtn = document.getElementById('loginEnter');
        const loginText = document.getElementById('loginText');
        setTimeout(() => {
            handleInput.focus();
            if (prefilledHandle) {
                handleInput.setSelectionRange(handleInput.value.length, handleInput.value.length);
            }
        }, 100);
        handleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                enterBtn.click();
            }
        });
        const handleLogin = async () => {
            let handle = handleInput.value.trim();
            if (!handle) {
                handleInput.focus();
                handleGroup.classList.add('error-shake');
                setTimeout(() => handleGroup.classList.remove('error-shake'), 500);
                return;
            }
            if (handle.startsWith('@')) {
                handle = handle.substring(1);
            }
            if (!handle.includes('.')) {
                handle = `${handle}.bsky.social`;
            }
            loginText.textContent = 'Connecting...';
            enterBtn.disabled = true;
            handleInput.disabled = true;
            try {
                await this.oauthManager.login(handle);
            } catch (error) {
                console.error('Login error:', error);
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => {
                    overlay.remove();
                    this.showMessage('Login Failed', error.message || 'Unable to connect. Please check your handle and try again.', true);
                }, 300);
            }
        };
        enterBtn.addEventListener('click', handleLogin);
        document.getElementById('loginBack').addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                this.showLoginPopupEnabled();
            }, 300);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }
    showDreamweaverLoginForm(prefilledUsername = '') {
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        const loginBox = document.createElement('div');
        loginBox.className = 'login-box';
        const coreColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--reverie-core-color').trim() || this.coreColor || '#87408d';
        loginBox.innerHTML = `
            <div class="login-content">
                <img src="/assets/logo.png" alt="Reverie House" class="login-logo">
                <h2 class="login-title">dreamweaver login</h2>
                <div class="login-form">
                    <div class="login-handle-input-group" style="margin-bottom: 0.75rem;">
                        <span class="login-handle-prefix">@</span>
                        <input 
                            type="text" 
                            id="dwHandle" 
                            class="login-handle-input" 
                            placeholder="handle.domain"
                            value=""
                            autocomplete="username"
                            autocapitalize="off"
                            spellcheck="false"
                        >
                    </div>
                    <div id="dwPasswordGroup" style="margin-bottom: 1rem; display: none;">
                        <div class="login-handle-input-group">
                            <span class="login-handle-prefix">🔑</span>
                            <input 
                                type="password" 
                                id="dwPassword" 
                                class="login-handle-input" 
                                placeholder="app-password"
                                autocomplete="current-password"
                                autocapitalize="off"
                                spellcheck="false"
                            >
                        </div>
                    </div>
                    <div id="dwStatusMessage" style="margin-bottom: 1rem; padding: 10px 14px; border-radius: 4px; font-size: 0.875rem; text-align: center; line-height: 1.5; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(135, 64, 141, 0.05); border: 1px solid rgba(135, 64, 141, 0.2); color: #555;">
                        <img src="/assets/icon.png" alt="" style="width: 18px; height: 18px;">
                        <span>residents and dreamweavers only</span>
                    </div>
                    <button id="dwLoginSubmit" class="login-method-btn login-reverie-btn" disabled style="opacity: 0.5; cursor: not-allowed;">
                        <span id="dwLoginText">Enter</span>
                    </button>
                    <button id="dwLoginBack" class="login-cancel-btn" style="margin-top: 0.75rem;">Cancel</button>
                </div>
                <div id="dwPasswordInfo" class="login-info-box" style="background: rgba(135, 64, 141, 0.02); border: 1px solid rgba(135, 64, 141, 0.12); padding: 8px 12px; margin-top: 1rem; border-radius: 4px; display: none;">
                    <p style="margin: 0; font-size: 0.75rem; color: #777; line-height: 1.4;">
                        <strong style="color: ${coreColor};">App passwords</strong> are secure tokens you generate from your account settings.
                    </p>
                </div>
                <p class="login-help-text" style="margin-top: 0.875rem; margin-bottom: 0; border-top: 1px solid rgba(135, 64, 141, 0.08); padding-top: 0.875rem; font-size: 0.8rem;">
                    Don't have an account? <a href="mailto:books@reverie.house" class="login-help-link" style="font-weight: 600; color: ${coreColor};">Request a key</a>
                </p>
            </div>
        `;
        overlay.appendChild(loginBox);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('visible');
            loginBox.classList.add('visible');
        }, 10);
        const handleInput = document.getElementById('dwHandle');
        const passwordInput = document.getElementById('dwPassword');
        const passwordGroup = document.getElementById('dwPasswordGroup');
        const passwordInfo = document.getElementById('dwPasswordInfo');
        const statusMessage = document.getElementById('dwStatusMessage');
        const submitBtn = document.getElementById('dwLoginSubmit');
        const loginText = document.getElementById('dwLoginText');
        let authMode = null;
        let resolvedDid = null;
        
        // Pre-fill if username provided
        if (prefilledUsername) {
            handleInput.value = prefilledUsername;
        }
        
        // Simple input validation - just ensure valid handle characters
        handleInput.addEventListener('input', (e) => {
            // Allow alphanumeric, dots, hyphens, underscores
            let value = handleInput.value;
            value = value.replace(/[^a-zA-Z0-9._-]/g, '');
            if (value !== handleInput.value) {
                const cursorPos = handleInput.selectionStart;
                handleInput.value = value;
                handleInput.setSelectionRange(cursorPos - 1, cursorPos - 1);
            }
        });

        setTimeout(() => {
            handleInput.focus();
            if (prefilledUsername) {
                handleInput.setSelectionRange(handleInput.value.length, handleInput.value.length);
            }
        }, 100);

        if (prefilledUsername) {
            setTimeout(() => checkHandle(prefilledUsername), 100);
        }

        let checkTimeout;
        handleInput.addEventListener('input', () => {
            clearTimeout(checkTimeout);
            const fullValue = handleInput.value.trim();

            if (!fullValue || !fullValue.includes('.')) {
                passwordGroup.style.display = 'none';
                passwordInfo.style.display = 'none';
                statusMessage.style.display = 'flex';
                statusMessage.style.alignItems = 'center';
                statusMessage.style.justifyContent = 'center';
                statusMessage.style.gap = '8px';
                statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
                statusMessage.style.border = '1px solid rgba(135, 64, 141, 0.2)';
                statusMessage.style.color = '#555';
                statusMessage.innerHTML = `
                    <img src="/assets/icon.png" alt="" style="width: 18px; height: 18px;">
                    <span>Enter your full handle (eg. @name.reverie.house)</span>
                `;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.style.background = '';
                submitBtn.style.borderColor = '';
                submitBtn.style.color = '';
                loginText.textContent = 'Enter';
                authMode = null;
                resolvedDid = null;
                return;
            }

            checkTimeout = setTimeout(() => checkHandle(fullValue), 500);
        }, true);

        const checkHandle = async (handleValue) => {
            let handle = handleValue.replace(/^@/, '').trim();
            
            console.log('🚀 === DREAMWEAVER LOGIN CHECK START ===');
            console.log(`   Handle input: "${handleValue}"`);
            console.log(`   Cleaned handle: "${handle}"`);
            
            statusMessage.style.display = 'flex';
            statusMessage.style.alignItems = 'center';
            statusMessage.style.justifyContent = 'center';
            statusMessage.style.gap = '8px';
            statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
            statusMessage.style.border = 'rgba(135, 64, 141, 0.2)';
            statusMessage.style.color = '#555';
            statusMessage.innerHTML = `
                <img src="/assets/icon_face.png" alt="" style="width: 18px; height: 18px; animation: spin 2s linear infinite;">
                <span>Checking account...</span>
            `;
            if (!document.getElementById('spin-keyframes')) {
                const style = document.createElement('style');
                style.id = 'spin-keyframes';
                style.textContent = `
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            try {
                let dreamerInDb = null;
                let wasNameLookup = false;
                
                try {
                    console.log(`🔍 STEP 1: Checking database for handle: "${handle}"`);
                    const dbResponse = await fetch('/api/database/all');
                    console.log(`   Database API response status: ${dbResponse.status} ${dbResponse.statusText}`);
                    if (!dbResponse.ok) {
                        console.error(`   ❌ Database API error: ${dbResponse.status}`);
                    } else {
                        const dbData = await dbResponse.json();
                        console.log(`   ✅ Database API returned data`);
                        const dreamers = dbData.tables?.dreamers || dbData.dreamers || [];
                        console.log(`   📊 Total dreamers in database: ${dreamers.length}`);
                        if (dreamers.length > 0) {
                            console.log(`   🔍 Searching for handle="${handle}" in dreamers...`);
                            console.log(`   First few dreamers:`, dreamers.slice(0, 3).map(d => ({name: d.name, handle: d.handle})));
                        }
                        
                        // If no dot in handle, assume it's a name and look up by name
                        if (!handle.includes('.')) {
                            console.log(`   💡 No dot in input, treating as name lookup...`);
                            dreamerInDb = dreamers.find(d => d.name && d.name.toLowerCase() === handle.toLowerCase());
                            if (dreamerInDb) {
                                console.log(`   🎯 FOUND by name!`);
                                console.log(`      Name: ${dreamerInDb.name}`);
                                console.log(`      Handle: ${dreamerInDb.handle}`);
                                console.log(`      DID: ${dreamerInDb.did}`);
                                // Replace the handle input with the actual handle
                                handle = dreamerInDb.handle;
                                handleInput.value = handle;
                                wasNameLookup = true;
                            } else {
                                console.log(`   ❌ NOT found in database by name`);
                            }
                        } else {
                            // Search by handle
                            dreamerInDb = dreamers.find(d => d.handle === handle);
                            if (dreamerInDb) {
                                console.log(`   🎯 FOUND in database!`);
                                console.log(`      Name: ${dreamerInDb.name}`);
                                console.log(`      Handle: ${dreamerInDb.handle}`);
                                console.log(`      DID: ${dreamerInDb.did}`);
                            } else {
                                console.log(`   ❌ NOT found in database by handle`);
                            }
                        }
                    }
                } catch (dbError) {
                    console.error('   ❌ Database check exception:', dbError);
                }
                console.log(`🔍 STEP 2: Resolving handle to DID via public resolver`);
                
                // Always use public resolver first to convert handle to DID
                // This works for any handle regardless of which PDS it's on
                let didResponse;
                try {
                    didResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
                } catch (publicError) {
                    console.log(`   ⚠️ Public resolver failed, trying PLC directory...`);
                    // Fallback: try to resolve via PLC directory if we have a DID pattern
                    throw new Error('Unable to resolve handle');
                }
                
                console.log(`   Handle resolution response status: ${didResponse.status} ${didResponse.statusText}`);
                if (!didResponse.ok) {
                    console.log(`   ❌ Handle NOT found via public resolver (404)`);
                    console.log(`   🔍 STEP 3: Checking if name exists in database...`);
                    console.log(`   dreamerInDb =`, dreamerInDb ? 'FOUND' : 'null');
                    if (dreamerInDb) {
                        console.log(`   ✅ RESULT: Handle not adopted - user exists but hasn't set .reverie.house handle`);
                        console.log(`      Current handle: ${dreamerInDb.handle}`);
                        console.log(`      Should adopt: ${handle}`);
                        statusMessage.style.display = 'flex';
                        statusMessage.style.alignItems = 'center';
                        statusMessage.style.justifyContent = 'center';
                        statusMessage.style.gap = '8px';
                        statusMessage.style.background = 'rgba(255, 159, 64, 0.05)';
                        statusMessage.style.border = '1px solid rgba(255, 159, 64, 0.3)';
                        statusMessage.style.color = '#e67e22';
                        statusMessage.style.textAlign = 'left';
                        statusMessage.style.lineHeight = '1.5';
                        statusMessage.style.flexDirection = 'column';
                        statusMessage.style.alignItems = 'flex-start';
                        statusMessage.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                <img src="/assets/icon_face.png" alt="" style="width: 18px; height: 18px;">
                                <strong>Handle not adopted</strong>
                            </div>
                            <span style="font-size: 0.8rem;">Your current handle: <strong>@${dreamerInDb.handle}</strong></span>
                            <span style="font-size: 0.8rem;">
                                <a href="https://bsky.app/settings/account" target="_blank" style="color: #e67e22; text-decoration: underline;">Change your handle</a> to <strong>${handle}</strong> to enter
                            </span>
                        `;
                        submitBtn.disabled = true;
                        submitBtn.style.opacity = '0.5';
                        submitBtn.style.cursor = 'not-allowed';
                        passwordGroup.style.display = 'none';
                        passwordInfo.style.display = 'none';
                        authMode = null;
                        return;
                    }
                    console.log(`   ❌ RESULT: Account not found - doesn't exist in database or ATProto`);
                    statusMessage.style.display = 'flex';
                    statusMessage.style.alignItems = 'center';
                    statusMessage.style.justifyContent = 'center';
                    statusMessage.style.gap = '8px';
                    statusMessage.style.background = 'rgba(217, 72, 72, 0.05)';
                    statusMessage.style.border = '1px solid rgba(217, 72, 72, 0.2)';
                    statusMessage.style.color = '#d94848';
                    statusMessage.style.flexDirection = 'row';
                    statusMessage.style.textAlign = 'center';
                    statusMessage.innerHTML = `
                        <img src="/assets/icon_face.png" alt="" style="width: 18px; height: 18px;">
                        <span>Account not found</span>
                    `;
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.5';
                    submitBtn.style.cursor = 'not-allowed';
                    submitBtn.style.background = '';
                    submitBtn.style.borderColor = '';
                    passwordGroup.style.display = 'none';
                    passwordInfo.style.display = 'none';
                    authMode = null;
                    return;
                }
                
                console.log(`   ✅ Handle resolved to DID!`);
                const didData = await didResponse.json();
                resolvedDid = didData.did;
                console.log(`   DID: ${resolvedDid}`);
                
                console.log(`🔍 STEP 3: Fetching DID document to find PDS service endpoint...`);
                let didDocResponse;
                if (resolvedDid.startsWith('did:web:')) {
                    // did:web DIDs are resolved from the domain's .well-known directory
                    const domain = resolvedDid.replace('did:web:', '');
                    const didDocUrl = `https://${domain}/.well-known/did.json`;
                    console.log(`   Resolving did:web from ${didDocUrl}`);
                    didDocResponse = await fetch(didDocUrl);
                } else {
                    // did:plc DIDs are resolved from PLC directory
                    didDocResponse = await fetch(`https://plc.directory/${resolvedDid}`);
                }
                const didDoc = await didDocResponse.json();
                const service = didDoc.service?.find(s => s.id === '#atproto_pds');
                const serviceEndpoint = service?.serviceEndpoint || '';
                console.log(`   Service endpoint: ${serviceEndpoint}`);
                
                // Check if the handle in database matches what's in ATProto
                if (dreamerInDb && dreamerInDb.handle !== handle) {
                    console.log(`   ⚠️ RESULT: Handle adopted but not in database - user changed handle`);
                    console.log(`      Database handle: ${dreamerInDb.handle}`);
                    console.log(`      ATProto handle: ${handle}`);
                    statusMessage.style.display = 'flex';
                    statusMessage.style.alignItems = 'center';
                    statusMessage.style.justifyContent = 'center';
                    statusMessage.style.gap = '8px';
                    statusMessage.style.background = 'rgba(255, 159, 64, 0.05)';
                    statusMessage.style.border = '1px solid rgba(255, 159, 64, 0.3)';
                    statusMessage.style.color = '#e67e22';
                    statusMessage.style.textAlign = 'left';
                    statusMessage.style.lineHeight = '1.5';
                    statusMessage.style.flexDirection = 'column';
                    statusMessage.style.alignItems = 'flex-start';
                    statusMessage.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                            <img src="/assets/icon_face.png" alt="" style="width: 18px; height: 18px;">
                            <strong>Handle not adopted</strong>
                        </div>
                        <span style="font-size: 0.8rem;">Your current handle: <strong>@${dreamerInDb.handle}</strong></span>
                        <span style="font-size: 0.8rem;">
                            <a href="https://bsky.app/settings/account" target="_blank" style="color: #e67e22; text-decoration: underline;">Change your handle</a> to <strong>${handle}</strong> to enter
                        </span>
                    `;
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.5';
                    submitBtn.style.cursor = 'not-allowed';
                    passwordGroup.style.display = 'none';
                    passwordInfo.style.display = 'none';
                    authMode = null;
                    return;
                }
                
                // Determine authentication mode based on service endpoint
                // Three modes: reverie.house (resident), bsky.network (oauth), foreign PDS (guest)
                if (serviceEndpoint === 'https://reverie.house') {
                    // Resident Dreamweaver on our PDS - use password auth
                    console.log(`   ✅ RESULT: Resident Dreamweaver (PDS account on ${serviceEndpoint})`);
                    authMode = 'pds';
                    statusMessage.style.display = 'flex';
                    statusMessage.style.alignItems = 'center';
                    statusMessage.style.justifyContent = 'center';
                    statusMessage.style.gap = '8px';
                    statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
                    statusMessage.style.border = '1px solid rgba(135, 64, 141, 0.2)';
                    statusMessage.style.color = coreColor;
                    statusMessage.innerHTML = `
                        <img src="/assets/icon.png" alt="" style="width: 18px; height: 18px;">
                        <strong>Resident Dreamweaver</strong>
                    `;
                    passwordGroup.style.display = 'block';
                    passwordInfo.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.style.background = coreColor;
                    submitBtn.style.borderColor = coreColor;
                    submitBtn.style.color = 'white';
                    loginText.textContent = 'Welcome Home';
                    setTimeout(() => passwordInput.focus(), 100);
                } else if (serviceEndpoint.includes('bsky.network')) {
                    // Bluesky network - use OAuth
                    console.log(`   ✅ RESULT: Awakened Dreamweaver (OAuth account on ${serviceEndpoint})`);
                    authMode = 'oauth';
                    statusMessage.style.display = 'flex';
                    statusMessage.style.alignItems = 'center';
                    statusMessage.style.justifyContent = 'center';
                    statusMessage.style.gap = '8px';
                    statusMessage.style.background = 'rgba(66, 153, 225, 0.05)';
                    statusMessage.style.border = '1px solid rgba(66, 153, 225, 0.2)';
                    statusMessage.style.color = '#4299e1';
                    statusMessage.innerHTML = `
                        <img src="/assets/bluesky.png" alt="" style="width: 18px; height: 18px;">
                        <strong>Awakened Dreamweaver</strong>
                    `;
                    passwordGroup.style.display = 'none';
                    passwordInfo.style.display = 'none';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.style.background = '#4299e1';
                    submitBtn.style.borderColor = '#4299e1';
                    submitBtn.style.color = 'white';
                    loginText.textContent = 'Welcome Back';
                } else {
                    // Foreign PDS - use password auth to their PDS
                    console.log(`   ✅ RESULT: Honoured Guest (Foreign PDS account on ${serviceEndpoint})`);
                    authMode = 'foreign-pds';
                    // Store the foreign PDS endpoint for later use
                    handleInput.dataset.foreignPds = serviceEndpoint;
                    
                    // Get heraldry for this server
                    console.log(`🛡️ [LOGIN] Looking up heraldry for server: ${serviceEndpoint}`);
                    console.log(`🛡️ [LOGIN] window.heraldrySystem exists:`, !!window.heraldrySystem);
                    const heraldry = window.heraldrySystem ? window.heraldrySystem.getByServer(serviceEndpoint) : null;
                    console.log(`🛡️ [LOGIN] Heraldry result:`, heraldry);
                    const guestIcon = heraldry ? heraldry.icon : '/assets/wild_mindscape.png';
                    const guestColor = heraldry ? heraldry.color : '#2d3748';
                    const guestName = heraldry ? heraldry.fullName : 'Honoured Guest';
                    const guestBg = heraldry ? `rgba(${parseInt(guestColor.slice(1,3),16)}, ${parseInt(guestColor.slice(3,5),16)}, ${parseInt(guestColor.slice(5,7),16)}, 0.05)` : 'rgba(45, 55, 72, 0.05)';
                    const guestBorder = heraldry ? `rgba(${parseInt(guestColor.slice(1,3),16)}, ${parseInt(guestColor.slice(3,5),16)}, ${parseInt(guestColor.slice(5,7),16)}, 0.3)` : 'rgba(45, 55, 72, 0.3)';
                    
                    statusMessage.style.display = 'flex';
                    statusMessage.style.alignItems = 'center';
                    statusMessage.style.justifyContent = 'center';
                    statusMessage.style.gap = '8px';
                    statusMessage.style.background = guestBg;
                    statusMessage.style.border = `1px solid ${guestBorder}`;
                    statusMessage.style.color = guestColor;
                    statusMessage.innerHTML = `
                        <img src="${guestIcon}" alt="" style="width: 18px; height: 18px;">
                        <strong>${guestName}</strong>
                    `;
                    passwordGroup.style.display = 'block';
                    passwordInfo.style.display = 'block';
                    passwordInfo.innerHTML = '<small style="color: rgba(45, 55, 72, 0.7);">Enter an <a href="https://bsky.app/settings/app-passwords" target="_blank" style="color: #2d3748; text-decoration: underline; font-weight: 600;">app password</a> from your account settings</small>';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.style.background = guestColor;
                    submitBtn.style.borderColor = guestColor;
                    submitBtn.style.color = 'white';
                    loginText.textContent = 'Enter as Guest';
                    setTimeout(() => passwordInput.focus(), 100);
                }
            } catch (error) {
                console.error('❌ Handle check error:', error);
                console.error('   Error stack:', error.stack);
                statusMessage.style.display = 'flex';
                statusMessage.style.alignItems = 'center';
                statusMessage.style.justifyContent = 'center';
                statusMessage.style.gap = '8px';
                statusMessage.style.background = 'rgba(217, 72, 72, 0.05)';
                statusMessage.style.border = '1px solid rgba(217, 72, 72, 0.2)';
                statusMessage.style.color = '#d94848';
                statusMessage.style.flexDirection = 'row';
                statusMessage.innerHTML = `
                    <img src="/assets/icon_face.png" alt="" style="width: 18px; height: 18px;">
                    <span>Error checking account</span>
                `;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.style.background = '';
                submitBtn.style.borderColor = '';
                passwordGroup.style.display = 'none';
                passwordInfo.style.display = 'none';
                authMode = null;
            }
        };
        handleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (authMode === 'pds' && passwordGroup.style.display !== 'none') {
                    passwordInput.focus();
                } else if (authMode === 'oauth' && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }
        });
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !submitBtn.disabled) {
                submitBtn.click();
            }
        });
        const doLogin = async () => {
            const handle = handleInput.value.trim().replace(/^@/, '');
            const password = passwordInput.value.trim();
            
            if (!handle || !handle.includes('.')) {
                handleInput.focus();
                handleInput.parentElement.classList.add('error-shake');
                setTimeout(() => handleInput.parentElement.classList.remove('error-shake'), 500);
                return;
            }
            
            if (authMode === 'oauth') {
                loginText.textContent = 'Starting OAuth...';
                submitBtn.disabled = true;
                handleInput.disabled = true;
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                try {
                    await this.oauthManager.login(handle);
                } catch (error) {
                    console.error('OAuth error:', error);
                    this.showMessage('Login Failed', error.message || 'Unable to authenticate with Bluesky.', true);
                }
                return;
            }
            if (!password) {
                passwordInput.focus();
                passwordInput.parentElement.classList.add('error-shake');
                setTimeout(() => passwordInput.parentElement.classList.remove('error-shake'), 500);
                return;
            }
            loginText.textContent = 'Authenticating...';
            submitBtn.disabled = true;
            handleInput.disabled = true;
            passwordInput.disabled = true;
            try {
                // For foreign PDS, pass the PDS endpoint
                const foreignPds = authMode === 'foreign-pds' ? handleInput.dataset.foreignPds : null;
                console.log(`🔐 Attempting ${authMode === 'foreign-pds' ? 'foreign-pds' : 'reverie'}-login for:`, handle, foreignPds ? `at ${foreignPds}` : '');
                const response = await fetch('/api/reverie-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        handle, 
                        password,
                        foreign_pds: foreignPds
                    })
                });
                console.log('📥 Login response status:', response.status);
                const result = await response.json();
                console.log('📦 Login result:', result);
                const isDeactivated = result && (result.code === 'account_deactivated' || (result.error && typeof result.error === 'string' && result.error.toLowerCase().includes('deactiv')));
                if (!response.ok && isDeactivated) {
                    // Show specialized deactivated account panel if available
                    console.log('🔒 Detected deactivated account response, showing panel');
                    overlay.classList.remove('visible');
                    loginBox.classList.remove('visible');
                    setTimeout(() => overlay.remove(), 300);
                    try {
                        this.showDeactivatedPanel(result.former, result.events || [], handle);
                    } catch (e) {
                        this.showMessage('Login Failed', result.error || 'Account has been deactivated', true);
                    }
                    return;
                }
                if (!response.ok && result.error === 'oauth_required') {
                    console.log('🔄 Handle on another server, switching to OAuth...');
                    overlay.classList.remove('visible');
                    loginBox.classList.remove('visible');
                    setTimeout(() => overlay.remove(), 300);
                    try {
                        await this.oauthManager.login(handle);
                    } catch (oauthError) {
                        console.error('OAuth fallback error:', oauthError);
                        this.showMessage('Login Failed', oauthError.message || 'Unable to authenticate with this handle.', true);
                    }
                    return;
                }
                if (!response.ok) {
                    throw new Error(result.error || 'Authentication failed');
                }
                
                // Store backend session token for authenticated API calls
                if (result.token) {
                    localStorage.setItem('oauth_token', result.token);
                }
                
                // Store PDS session in a way compatible with OAuth manager
                this.oauthManager.currentSession = result.session;
                
                // Store session data in localStorage for persistence
                localStorage.setItem('BSKY_AGENT(sub)', result.session.sub || result.session.did);
                localStorage.setItem('pds_session', JSON.stringify(result.session));
                
                // Dispatch login event so other components know we're logged in
                window.dispatchEvent(new CustomEvent('oauth:login', { 
                    detail: { session: result.session } 
                }));
                
                // Trigger user_login pigeons
                this.triggerUserLogin(result.session.did || result.session.sub);
                
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                if (result.redirect) {
                    window.location.href = result.redirect;
                } else {
                    this.showMessage('Welcome Home', `Logged in as @${result.session.handle}`);
                }
            } catch (error) {
                console.error('Dreamweaver login error:', error);
                submitBtn.disabled = false;
                handleInput.disabled = false;
                passwordInput.disabled = false;
                passwordInput.value = '';
                loginText.textContent = authMode === 'pds' ? 'Enter' : 'Enter via Bluesky';
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => {
                    overlay.remove();
                    this.showMessage('Login Failed', error.message || 'Invalid credentials. Please check your username and app password.', true);
                }, 300);
            }
        };
        submitBtn.addEventListener('click', doLogin);
        document.getElementById('dwLoginBack').addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                this.showLoginPopupEnabled();
            }, 300);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }
    showLogoutPopup(session) {
        const overlay = document.createElement('div');
        overlay.className = 'logout-overlay';
        const logoutBox = document.createElement('div');
        logoutBox.className = 'logout-box';
        const avatarSrc = session.avatar || '/assets/icon_face.png';
        const displayName = session.displayName || session.handle;
        
        // Get user color from color manager
        const userColor = window.colorManager?.getColor() || 
                         getComputedStyle(document.documentElement)
                             .getPropertyValue('--reverie-core-color').trim() || '#87408d';
        
        logoutBox.innerHTML = `
            <div class="logout-content">
                <img src="${avatarSrc}" alt="${displayName}" class="logout-avatar" style="border-color: ${userColor};" onerror="this.src='/assets/icon_face.png'">
                <h2 class="logout-message" style="color: ${userColor};">${displayName}</h2>
                <p class="logout-handle">@${session.handle}</p>
                <div class="logout-buttons">
                    <button id="logoutConfirm" style="background: ${userColor};">Logout</button>
                    <button id="logoutCancel" style="color: ${userColor}; border-color: ${userColor};">Close</button>
                </div>
            </div>
        `;
        
        // Apply user color to box border and shadow
        logoutBox.style.borderColor = userColor;
        logoutBox.style.boxShadow = `0 8px 32px ${userColor}40`;
        
        overlay.appendChild(logoutBox);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('visible');
            logoutBox.classList.add('visible');
        }, 10);
        
        // Add hover effect for cancel button with user color
        const cancelBtn = document.getElementById('logoutCancel');
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = `${userColor}1a`; // 10% opacity
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'transparent';
        });
        
        document.getElementById('logoutConfirm').addEventListener('click', () => {
            this.oauthManager.logout();
            overlay.classList.remove('visible');
            logoutBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        });
        cancelBtn.addEventListener('click', () => {
            overlay.classList.remove('visible');
            logoutBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                logoutBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }
}
window.loginWidget = new LoginWidget();
console.log('🔐 Login widget loaded (OAuth)');
