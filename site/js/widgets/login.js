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
            <div class="login-content login-compact">
                <img src="/assets/logo.png" alt="Reverie House" class="login-logo">
                <div class="login-form">
                    <p class="login-prompt-text">enter your name or handle</p>
                    <div class="login-handle-input-group">
                        <span class="login-handle-prefix">@</span>
                        <input 
                            type="text" 
                            id="loginHandle" 
                            class="login-handle-input" 
                            placeholder="loading..."
                            autocomplete="username"
                            autocapitalize="off"
                            spellcheck="false"
                        >
                    </div>
                    <div id="loginPasswordGroup" class="login-password-group">
                        <div class="login-handle-input-group">
                            <span class="login-handle-prefix">🔑</span>
                            <input 
                                type="password" 
                                id="loginPassword" 
                                class="login-handle-input" 
                                placeholder="app-password"
                                autocomplete="current-password"
                                autocapitalize="off"
                                spellcheck="false"
                            >
                        </div>
                    </div>
                    <div id="loginStatusMessage" class="login-status-message">
                        <img src="/assets/icon.png" alt="" style="width: 16px; height: 16px;">
                        <span>enter your handle to continue</span>
                    </div>
                    <div class="login-buttons-row">
                        <button id="loginSideDoor" class="login-side-door-btn" disabled>
                            <span id="loginSideDoorText">Side Door</span>
                            <span class="login-side-door-sub">(just visiting)</span>
                        </button>
                        <button id="loginSubmit" class="login-method-btn login-main-btn" disabled>
                            <span id="loginSubmitText">Main Entrance</span>
                        </button>
                    </div>
                    <div class="login-new-section">
                        <p class="login-new-text">new to our wild mindscape?</p>
                        <button id="loginBecomeResident" class="login-method-btn login-become-btn" style="border-color: ${coreColor}; color: ${coreColor};">
                            <img src="/assets/icon.png" alt="" style="width: 16px; height: 16px;">
                            <span>Become a Dreamweaver</span>
                        </button>
                    </div>
                </div>
                <button id="loginCancel" class="login-cancel-btn">Close</button>
            </div>
        `;
        
        overlay.appendChild(loginBox);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.classList.add('visible');
            loginBox.classList.add('visible');
        }, 10);
        
        const handleInput = document.getElementById('loginHandle');
        const passwordInput = document.getElementById('loginPassword');
        const passwordGroup = document.getElementById('loginPasswordGroup');
        const statusMessage = document.getElementById('loginStatusMessage');
        const submitBtn = document.getElementById('loginSubmit');
        const submitText = document.getElementById('loginSubmitText');
        const sideDoorBtn = document.getElementById('loginSideDoor');
        const sideDoorText = document.getElementById('loginSideDoorText');
        
        let authMode = null;
        let resolvedHandle = null;
        let useSideDoor = false;  // Track if user chose side door
        let checkTimeout = null;
        
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
                        handleInput.placeholder = `${names[0]} or handle.bsky.social`;
                        
                        const rotatePlaceholder = () => {
                            if (document.activeElement === handleInput && handleInput.value.length > 0) return;
                            handleInput.style.transition = 'opacity 0.3s ease';
                            handleInput.style.opacity = '0.5';
                            setTimeout(() => {
                                currentIndex = (currentIndex + 1) % names.length;
                                handleInput.placeholder = `${names[currentIndex]} or handle.bsky.social`;
                                handleInput.style.opacity = '1';
                            }, 300);
                        };
                        
                        const rotationInterval = setInterval(rotatePlaceholder, 3000);
                        overlay.addEventListener('remove', () => clearInterval(rotationInterval));
                    } else {
                        handleInput.placeholder = 'name or handle.bsky.social';
                    }
                } else {
                    handleInput.placeholder = 'name or handle.bsky.social';
                }
            } catch (error) {
                handleInput.placeholder = 'name or handle.bsky.social';
            }
        })();
        
        // Check handle as user types
        const checkHandle = async (inputValue) => {
            let handle = inputValue.replace(/^@/, '').trim();
            if (!handle) {
                resetStatus();
                return;
            }
            
            // Show checking status
            statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
            statusMessage.style.border = '1px solid rgba(135, 64, 141, 0.2)';
            statusMessage.style.color = '#555';
            statusMessage.innerHTML = `
                <img src="/assets/icon_face.png" alt="" style="width: 18px; height: 18px; animation: spin 2s linear infinite;">
                <span>Checking...</span>
            `;
            if (!document.getElementById('spin-keyframes')) {
                const style = document.createElement('style');
                style.id = 'spin-keyframes';
                style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
                document.head.appendChild(style);
            }
            
            try {
                // Check database for name match first (only for inputs without a dot)
                if (!handle.includes('.') && !handle.startsWith('did:')) {
                    const dbResponse = await fetch('/api/database/all');
                    if (dbResponse.ok) {
                        const dbData = await dbResponse.json();
                        const dreamers = dbData.tables?.dreamers || dbData.dreamers || [];
                        const dreamerByName = dreamers.find(d => d.name && d.name.toLowerCase() === handle.toLowerCase());
                        if (dreamerByName && dreamerByName.handle) {
                            // Found exact name match in database - use their handle
                            handle = dreamerByName.handle;
                        } else {
                            // No name match found - wait for user to type a complete handle
                            // Don't auto-append .bsky.social for partial input
                            statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
                            statusMessage.style.border = '1px solid rgba(135, 64, 141, 0.2)';
                            statusMessage.style.color = '#888';
                            statusMessage.innerHTML = `
                                <img src="/assets/icon.png" alt="" style="width: 18px; height: 18px;">
                                <span>enter full handle (eg. name.bsky.social)</span>
                            `;
                            submitBtn.disabled = true;
                            submitBtn.style.opacity = '0.5';
                            submitBtn.style.cursor = 'not-allowed';
                            return;
                        }
                    } else {
                        // Database check failed - require full handle
                        statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
                        statusMessage.style.border = '1px solid rgba(135, 64, 141, 0.2)';
                        statusMessage.style.color = '#888';
                        statusMessage.innerHTML = `
                            <img src="/assets/icon.png" alt="" style="width: 18px; height: 18px;">
                            <span>enter full handle (eg. name.bsky.social)</span>
                        `;
                        submitBtn.disabled = true;
                        submitBtn.style.opacity = '0.5';
                        submitBtn.style.cursor = 'not-allowed';
                        return;
                    }
                }
                
                // Resolve handle to DID
                const didResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
                if (!didResponse.ok) {
                    showNotFound();
                    return;
                }
                
                const didData = await didResponse.json();
                const did = didData.did;
                resolvedHandle = handle;
                
                // Fetch DID document to find PDS
                let didDocResponse;
                if (did.startsWith('did:web:')) {
                    const domain = did.replace('did:web:', '');
                    didDocResponse = await fetch(`https://${domain}/.well-known/did.json`);
                } else {
                    didDocResponse = await fetch(`https://plc.directory/${did}`);
                }
                
                if (!didDocResponse.ok) {
                    showNotFound();
                    return;
                }
                
                const didDoc = await didDocResponse.json();
                const service = didDoc.service?.find(s => s.id === '#atproto_pds');
                const serviceEndpoint = service?.serviceEndpoint || '';
                
                // Get heraldry from the heraldry system (includes reverie.house and bsky.network)
                let heraldry = window.heraldrySystem ? window.heraldrySystem.getByServer(serviceEndpoint) : null;
                let accountIcon = heraldry ? heraldry.icon : '/assets/wild_mindscape.png';
                let accountColor = heraldry ? heraldry.color : '#2d3748';
                let accountName = heraldry ? heraldry.fullName : 'Honoured Guest';
                
                // Residents use password auth (OAuth same-origin doesn't work with PDS)
                // Everyone else uses OAuth
                if (serviceEndpoint === 'https://reverie.house') {
                    authMode = 'pds';
                    // Fetch resident's personal color from the database
                    try {
                        const dbResponse = await fetch('/api/database/all');
                        if (dbResponse.ok) {
                            const dbData = await dbResponse.json();
                            const dreamers = dbData.tables?.dreamers || dbData.dreamers || [];
                            const resident = dreamers.find(d => d.did === did);
                            if (resident && resident.color_hex) {
                                accountColor = resident.color_hex;
                                console.log(`🎨 [Login] Found resident color: ${accountColor}`);
                            }
                        }
                    } catch (colorError) {
                        console.warn('🎨 [Login] Could not fetch resident color:', colorError);
                    }
                    // Show password field for residents
                    passwordGroup.style.display = 'block';
                    // Hide side door for residents (they already have full access)
                    sideDoorBtn.classList.remove('visible');
                    setTimeout(() => passwordInput.focus(), 100);
                } else {
                    authMode = 'oauth';
                    passwordGroup.style.display = 'none';
                    // Show side door for OAuth users (guests/awakened)
                    sideDoorBtn.classList.add('visible');
                    sideDoorBtn.disabled = false;
                    sideDoorBtn.style.borderColor = accountColor;
                    sideDoorBtn.style.color = accountColor;
                }
                
                // Convert color to rgba for backgrounds
                const hexToRgba = (hex, alpha) => {
                    const r = parseInt(hex.slice(1,3), 16);
                    const g = parseInt(hex.slice(3,5), 16);
                    const b = parseInt(hex.slice(5,7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                
                // Apply styling based on heraldry
                statusMessage.style.background = hexToRgba(accountColor, 0.05);
                statusMessage.style.border = `1px solid ${hexToRgba(accountColor, 0.2)}`;
                statusMessage.style.color = accountColor;
                statusMessage.innerHTML = `
                    <img src="${accountIcon}" alt="" style="width: 16px; height: 16px;">
                    <strong>${accountName}</strong>
                `;
                
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.style.background = accountColor;
                submitBtn.style.borderColor = accountColor;
                submitBtn.style.color = 'white';
                
                // Determine button text based on account type
                if (serviceEndpoint === 'https://reverie.house') {
                    submitText.textContent = 'Welcome Home';
                } else if (serviceEndpoint.includes('bsky.network')) {
                    submitText.textContent = 'Continue with Bluesky';
                } else {
                    submitText.textContent = 'Enter as Guest';
                }
            } catch (error) {
                console.error('Handle check error:', error);
                showError();
            }
        };
        
        const resetStatus = () => {
            authMode = null;
            resolvedHandle = null;
            useSideDoor = false;
            passwordGroup.style.display = 'none';
            passwordInput.value = '';
            sideDoorBtn.classList.remove('visible');
            sideDoorBtn.disabled = true;
            statusMessage.style.background = 'rgba(135, 64, 141, 0.05)';
            statusMessage.style.border = '1px solid rgba(135, 64, 141, 0.2)';
            statusMessage.style.color = '#555';
            statusMessage.innerHTML = `
                <img src="/assets/icon.png" alt="" style="width: 16px; height: 16px;">
                <span>enter your handle to continue</span>
            `;
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.style.background = '';
            submitBtn.style.borderColor = '';
            submitBtn.style.color = '';
            submitText.textContent = 'Main Entrance';
        };
        
        const showNotFound = () => {
            authMode = null;
            passwordGroup.style.display = 'none';
            passwordInput.value = '';
            sideDoorBtn.classList.remove('visible');
            statusMessage.style.background = 'rgba(217, 72, 72, 0.05)';
            statusMessage.style.border = '1px solid rgba(217, 72, 72, 0.2)';
            statusMessage.style.color = '#d94848';
            statusMessage.innerHTML = `
                <img src="/assets/icon_face.png" alt="" style="width: 16px; height: 16px;">
                <span>Account not found</span>
            `;
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
        };
        
        const showError = () => {
            authMode = null;
            passwordGroup.style.display = 'none';
            passwordInput.value = '';
            sideDoorBtn.classList.remove('visible');
            statusMessage.style.background = 'rgba(217, 72, 72, 0.05)';
            statusMessage.style.border = '1px solid rgba(217, 72, 72, 0.2)';
            statusMessage.style.color = '#d94848';
            statusMessage.innerHTML = `
                <img src="/assets/icon_face.png" alt="" style="width: 16px; height: 16px;">
                <span>Error checking account</span>
            `;
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
        };
        
        // Debounced input handler
        handleInput.addEventListener('input', () => {
            clearTimeout(checkTimeout);
            const value = handleInput.value.trim();
            if (!value) {
                resetStatus();
                return;
            }
            checkTimeout = setTimeout(() => checkHandle(value), 500);
        });
        
        // Handle Enter key
        handleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (authMode === 'pds' && passwordGroup.style.display !== 'none') {
                    passwordInput.focus();
                } else if (authMode && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !submitBtn.disabled) {
                submitBtn.click();
            }
        });
        
        // Submit handler (Main Door - prompts for credentials after OAuth)
        submitBtn.addEventListener('click', async () => {
            if (!authMode || submitBtn.disabled) return;
            
            const handle = resolvedHandle || handleInput.value.trim().replace(/^@/, '');
            
            if (authMode === 'oauth') {
                // OAuth flow for bsky.network and foreign PDS
                // Main door = full access scope
                localStorage.setItem('mainDoorLogin', 'true');
                localStorage.removeItem('sideDoorLogin');
                
                submitText.textContent = 'Connecting...';
                submitBtn.disabled = true;
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                try {
                    // Full scope for main door (default)
                    await this.oauthManager.login(handle, null, { scope: 'atproto transition:generic' });
                } catch (error) {
                    console.error('OAuth error:', error);
                    localStorage.removeItem('mainDoorLogin');
                    this.showMessage('Login Failed', error.message || 'Unable to authenticate.', true);
                }
            } else if (authMode === 'pds') {
                // PDS login for residents (app password)
                const password = passwordInput.value.trim();
                if (!password) {
                    passwordInput.focus();
                    passwordInput.parentElement.classList.add('error-shake');
                    setTimeout(() => passwordInput.parentElement.classList.remove('error-shake'), 500);
                    return;
                }
                
                submitText.textContent = 'Authenticating...';
                submitBtn.disabled = true;
                handleInput.disabled = true;
                passwordInput.disabled = true;
                
                try {
                    const response = await fetch('/api/reverie-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ handle, password })
                    });
                    
                    const result = await response.json();
                    
                    if (!response.ok) {
                        if (result.code === 'account_deactivated') {
                            overlay.classList.remove('visible');
                            loginBox.classList.remove('visible');
                            setTimeout(() => overlay.remove(), 300);
                            this.showDeactivatedPanel(result.former, result.events || [], handle);
                            return;
                        }
                        throw new Error(result.error || 'Authentication failed');
                    }
                    
                    // Store session
                    if (result.token) localStorage.setItem('oauth_token', result.token);
                    this.oauthManager.currentSession = result.session;
                    localStorage.setItem('BSKY_AGENT(sub)', result.session.sub || result.session.did);
                    localStorage.setItem('pds_session', JSON.stringify(result.session));
                    
                    window.dispatchEvent(new CustomEvent('oauth:login', { detail: { session: result.session } }));
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
                    console.error('PDS login error:', error);
                    submitBtn.disabled = false;
                    handleInput.disabled = false;
                    passwordInput.disabled = false;
                    passwordInput.value = '';
                    submitText.textContent = 'Welcome Home';
                    this.showMessage('Login Failed', error.message || 'Invalid credentials.', true);
                }
            }
        });
        
        // Side Door handler - OAuth only, minimal scope (just visiting)
        sideDoorBtn.addEventListener('click', async () => {
            if (!authMode || authMode !== 'oauth' || sideDoorBtn.disabled) return;
            
            const handle = resolvedHandle || handleInput.value.trim().replace(/^@/, '');
            
            // Mark this as a side door login (no credential prompt needed)
            useSideDoor = true;
            localStorage.setItem('sideDoorLogin', 'true');
            localStorage.removeItem('mainDoorLogin');
            
            if (sideDoorText) sideDoorText.textContent = 'Opening...';
            sideDoorBtn.disabled = true;
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            
            try {
                // Minimal scope for side door - just identity
                await this.oauthManager.login(handle, null, { scope: 'atproto' });
            } catch (error) {
                console.error('Side door OAuth error:', error);
                localStorage.removeItem('sideDoorLogin');
                this.showMessage('Login Failed', error.message || 'Unable to authenticate.', true);
            }
        });
        
        // Become a Resident button
        document.getElementById('loginBecomeResident').addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                if (window.CreateDreamer) {
                    const createDreamer = new window.CreateDreamer();
                    createDreamer.show({
                        onSuccess: (result) => console.log('✅ Account created:', result),
                        onCancel: () => console.log('❌ Account creation cancelled')
                    });
                } else {
                    this.showMessage('Error', 'Account creation system not available', true);
                }
            }, 300);
        });
        
        // Cancel button
        document.getElementById('loginCancel').addEventListener('click', () => {
            overlay.classList.remove('visible');
            loginBox.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            window.dispatchEvent(new CustomEvent('oauth:cancel'));
        });
        
        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
                loginBox.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                window.dispatchEvent(new CustomEvent('oauth:cancel'));
            }
        });
    }
    
    // REMOVED: showBlueskyLoginForm and showDreamweaverLoginForm - functionality merged into showLoginPopupEnabled()
    
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
