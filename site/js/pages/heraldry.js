/**
 * Heraldry System - Herald Dashboard
 * Allows community heralds to manage their PDS heraldry
 * 
 * Security: Uses OAuth or App Password verification via PDS createSession
 */

console.log('[Heraldry] Loading heraldry.js...');

class Heraldry {
    constructor() {
        console.log('[Heraldry] Constructor called');
        this.currentHerald = null;
        this.currentHeraldry = null;
        this.coterie = [];
        this.hue = 280;
        this.resolvedProfile = null;
        this.authMode = null; // 'oauth' or 'pds'
        this.oauthManager = null;
        this.isLoggedOut = false; // Flag to prevent auto-login after logout
        this.pendingIconClear = false; // Flag for pending icon clear action
        this.redirectToMainEntrance = false; // Flag for redirect vs OAuth
        this.init();
    }

    async init() {
        console.log('[Heraldry] Initializing...');
        
        // Check if user explicitly logged out (flag in sessionStorage)
        const wasLoggedOut = sessionStorage.getItem('heraldry_logged_out');
        if (wasLoggedOut) {
            console.log('[Heraldry] User recently logged out, showing login form');
            sessionStorage.removeItem('heraldry_logged_out');
            this.setupEventListeners();
            return;
        }
        
        // Wait for OAuth manager
        await this.waitForOAuthManager();
        
        // Check for heraldry-specific session (PDS auth) FIRST
        // This takes priority over OAuth since it's heraldry-specific
        const heraldrySession = this.getHeraldrySession();
        console.log('[Heraldry] Heraldry session:', heraldrySession);
        
        if (heraldrySession && heraldrySession.did && heraldrySession.heraldryId) {
            console.log('[Heraldry] Found valid heraldry session, loading dashboard');
            await this.loadDashboard(heraldrySession);
            return;
        }
        
        // Check for existing OAuth session (only if no heraldry session)
        if (this.oauthManager) {
            const oauthSession = this.oauthManager.getSession();
            console.log('[Heraldry] OAuth session:', oauthSession ? { did: oauthSession.did, handle: oauthSession.handle } : null);
            
            if (oauthSession && oauthSession.did) {
                console.log('[Heraldry] Checking if OAuth user is a herald...');
                // Check if this user is a herald
                const heraldry = await this.checkHeraldByDid(oauthSession.did);
                console.log('[Heraldry] Ambassador check result:', heraldry);
                
                if (heraldry) {
                    console.log('[Heraldry] User is herald, loading dashboard');
                    // Create an heraldry session from OAuth
                    const heraldryData = {
                        did: oauthSession.did,
                        handle: oauthSession.handle,
                        heraldryId: heraldry.id,
                        authMode: 'oauth'
                    };
                    this.setHeraldrySession(heraldryData);
                    await this.loadDashboard(heraldryData);
                    return;
                } else {
                    console.log('[Heraldry] OAuth user is not a herald');
                }
            }
        }
        
        console.log('[Heraldry] No valid session, showing login form');
        // Setup event listeners for login form
        this.setupEventListeners();
    }

    async waitForOAuthManager() {
        console.log('[Heraldry] Waiting for OAuth manager...');
        return new Promise((resolve) => {
            const check = (attempts = 0) => {
                if (window.oauthManager) {
                    this.oauthManager = window.oauthManager;
                    console.log('[Heraldry] OAuth manager connected');
                    resolve();
                } else if (attempts < 50) {
                    setTimeout(() => check(attempts + 1), 20);
                } else {
                    console.warn('[Heraldry] OAuth manager not available after 1s');
                    resolve();
                }
            };
            check();
        });
    }

    setupEventListeners() {
        console.log('[Heraldry] Setting up event listeners');
        
        // Handle input - check on typing
        const handleInput = document.getElementById('heraldHandle');
        if (handleInput) {
            let debounceTimer = null;
            handleInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.checkHandle(), 500);
            });
            handleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.attemptLogin();
                }
            });
        }
        
        // App password input
        const passwordInput = document.getElementById('appPassword');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.attemptLogin();
                }
            });
        }
        
        // Login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.attemptLogin());
        }
        
        // OAuth button - handles both OAuth login and redirect to main entrance
        const oauthBtn = document.getElementById('oauthBtn');
        if (oauthBtn) {
            oauthBtn.addEventListener('click', () => {
                if (this.redirectToMainEntrance) {
                    window.location.href = '/?login=true';
                } else {
                    this.loginWithOAuth();
                }
            });
        }
        
        // Sign out button
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.logout());
        }
        
        // Icon upload buttons
        const uploadIconBtn = document.getElementById('uploadIconBtn');
        const clearIconBtn = document.getElementById('clearIconBtn');
        const saveIconBtn = document.getElementById('saveIconBtn');
        const iconFileInput = document.getElementById('iconFileInput');
        
        if (uploadIconBtn && iconFileInput) {
            uploadIconBtn.addEventListener('click', () => iconFileInput.click());
            iconFileInput.addEventListener('change', (e) => this.handleIconUpload(e));
        }
        
        if (clearIconBtn) {
            clearIconBtn.addEventListener('click', () => this.clearIcon());
        }
        
        if (saveIconBtn) {
            saveIconBtn.addEventListener('click', () => this.saveIcon());
        }
        
        // Color controls
        const colorHexInput = document.getElementById('colorHexInput');
        if (colorHexInput) {
            colorHexInput.addEventListener('input', (e) => this.updateColorFromHex(e.target.value));
        }
        
        const saveColorBtn = document.getElementById('saveColorBtn');
        if (saveColorBtn) {
            saveColorBtn.addEventListener('click', () => this.saveColor());
        }
        
        // Transfer select
        const transferSelect = document.getElementById('transferSelect');
        if (transferSelect) {
            transferSelect.addEventListener('change', (e) => {
                const transferBtn = document.getElementById('transferBtn');
                if (transferBtn) {
                    transferBtn.disabled = !e.target.value;
                }
            });
        }
        
        // Transfer button
        const transferBtn = document.getElementById('transferBtn');
        if (transferBtn) {
            transferBtn.addEventListener('click', () => this.transferHerald());
        }
        
        // Step down button
        const stepDownBtn = document.getElementById('stepDownBtn');
        if (stepDownBtn) {
            stepDownBtn.addEventListener('click', () => this.stepDown());
        }
    }

    setupDashboardListeners() {
        // Helper to clone and add listener (prevents duplicate listeners)
        const setupButton = (id, handler) => {
            const btn = document.getElementById(id);
            if (btn) {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', handler);
            }
        };
        
        // Sign out
        setupButton('signOutBtn', () => {
            console.log('[Heraldry] Sign out button clicked');
            this.logout();
        });
        
        // Icon buttons - need to handle file input carefully
        let iconFileInput = document.getElementById('iconFileInput');
        
        // Clone and replace file input to ensure clean event listener
        if (iconFileInput) {
            const newInput = iconFileInput.cloneNode(true);
            iconFileInput.parentNode.replaceChild(newInput, iconFileInput);
            iconFileInput = newInput;  // Update reference to the new input
            iconFileInput.addEventListener('change', (e) => {
                console.log('[Heraldry] File input change event fired');
                this.handleIconUpload(e);
            });
        }
        
        // Now set up buttons with the correct reference
        setupButton('uploadIconBtn', () => {
            console.log('[Heraldry] Upload button clicked');
            if (iconFileInput) {
                iconFileInput.click();
            } else {
                console.error('[Heraldry] iconFileInput not found!');
            }
        });
        setupButton('clearIconBtn', () => this.clearIcon());
        setupButton('saveIconBtn', () => this.saveIcon());
        
        // Color controls
        setupButton('saveColorBtn', () => this.saveColor());
        
        const colorHexInput = document.getElementById('colorHexInput');
        if (colorHexInput) {
            colorHexInput.addEventListener('input', (e) => this.updateColorFromHex(e.target.value));
        }
        
        // Transfer controls
        const transferSelect = document.getElementById('transferSelect');
        if (transferSelect) {
            transferSelect.addEventListener('change', (e) => {
                const transferBtn = document.getElementById('transferBtn');
                if (transferBtn) {
                    transferBtn.disabled = !e.target.value;
                }
            });
        }
        
        setupButton('transferBtn', () => this.transferHerald());
        setupButton('stepDownBtn', () => this.stepDown());
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    getHeraldrySession() {
        try {
            const session = localStorage.getItem('heraldry_session');
            return session ? JSON.parse(session) : null;
        } catch {
            return null;
        }
    }

    setHeraldrySession(data) {
        localStorage.setItem('heraldry_session', JSON.stringify(data));
    }

    clearHeraldrySession() {
        localStorage.removeItem('heraldry_session');
    }

    getAuthHeaders() {
        // Get headers for authenticated requests
        const session = this.getHeraldrySession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.authToken || ''}`,
            'X-Ambassador-DID': session?.did || ''
        };
    }

    logout() {
        console.log('[Heraldry] Logging out...');
        
        // Clear heraldry session
        this.clearHeraldrySession();
        
        // Set flag to prevent auto-login on next init
        // Using sessionStorage so it persists across the page reload but not browser restart
        sessionStorage.setItem('heraldry_logged_out', 'true');
        
        // Clear internal state
        this.currentHerald = null;
        this.currentHeraldry = null;
        this.resolvedProfile = null;
        this.authMode = null;
        this.isLoggedOut = true;
        
        console.log('[Heraldry] Session cleared, resetting UI');
        
        // Reset UI
        const loginView = document.getElementById('heraldryLogin');
        const dashboardView = document.getElementById('heraldryDashboard');
        const handleInput = document.getElementById('heraldHandle');
        const passwordInput = document.getElementById('appPassword');
        const passwordGroup = document.getElementById('passwordGroup');
        const oauthBtn = document.getElementById('oauthBtn');
        const loginBtn = document.getElementById('loginBtn');
        
        if (loginView) loginView.style.display = 'block';
        if (dashboardView) dashboardView.style.display = 'none';
        if (handleInput) handleInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (passwordGroup) passwordGroup.style.display = 'none';
        if (oauthBtn) oauthBtn.style.display = 'none';
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.style.display = 'block';
            const btnText = loginBtn.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'Check Status';
        }
        
        this.resetStatus();
        
        // Re-setup event listeners since we're back to login view
        this.setupEventListeners();
        
        console.log('[Heraldry] Logout complete');
    }

    // =========================================================================
    // HANDLE CHECKING & AUTHENTICATION
    // =========================================================================

    async checkHandle() {
        const handleInput = document.getElementById('heraldHandle');
        const statusMessage = document.getElementById('loginStatusMessage');
        const loginBtn = document.getElementById('loginBtn');
        const passwordGroup = document.getElementById('passwordGroup');
        const oauthBtn = document.getElementById('oauthBtn');
        const errorDiv = document.getElementById('loginError');
        
        let handle = handleInput.value.trim().toLowerCase();
        if (handle.startsWith('@')) {
            handle = handle.substring(1);
        }
        
        // Reset state
        this.resolvedProfile = null;
        this.authMode = null;
        errorDiv.style.display = 'none';
        
        if (!handle || handle.length < 3) {
            this.resetStatus();
            return;
        }
        
        // Show checking status
        statusMessage.className = 'heraldry-status-message';
        statusMessage.innerHTML = `
            <img src="/assets/icon_face.png" alt="" class="status-icon" style="animation: spin 1.5s linear infinite;">
            <span>Finding you...</span>
        `;
        this.addSpinKeyframes();
        
        try {
            // Resolve handle to DID
            const didResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
            if (!didResponse.ok) {
                this.showStatusError('Handle not found');
                return;
            }
            
            const didData = await didResponse.json();
            const did = didData.did;
            
            // Fetch DID document to find PDS
            let didDocResponse;
            if (did.startsWith('did:web:')) {
                const domain = did.replace('did:web:', '');
                didDocResponse = await fetch(`https://${domain}/.well-known/did.json`);
            } else {
                didDocResponse = await fetch(`https://plc.directory/${did}`);
            }
            
            if (!didDocResponse.ok) {
                this.showStatusError('Could not resolve identity');
                return;
            }
            
            const didDoc = await didDocResponse.json();
            const service = didDoc.service?.find(s => s.id === '#atproto_pds');
            const pdsEndpoint = service?.serviceEndpoint || '';
            
            // Get heraldry for this user's domain
            let pdsDomain = pdsEndpoint.replace(/^https?:\/\//, '').split('/')[0];
            
            // For Bluesky users on relay endpoints, normalize to bsky.social
            if (pdsDomain.includes('.host.bsky.network') || pdsDomain === 'bsky.social') {
                pdsDomain = 'bsky.social';
            }
            
            // Check if this user is a herald
            const heraldryResponse = await fetch(`/api/heraldry/for-domain/${encodeURIComponent(pdsDomain)}`);
            let heraldry = null;
            let isHerald = false;
            
            if (heraldryResponse.ok) {
                heraldry = await heraldryResponse.json();
                isHerald = heraldry.ambassador_did === did;
            }
            
            // Store resolved profile
            this.resolvedProfile = {
                did: did,
                handle: handle,
                pdsEndpoint: pdsEndpoint,
                pdsDomain: pdsDomain,
                heraldry: heraldry,
                isHerald: isHerald
            };
            
            // Determine auth mode: PDS residents use app password, others use OAuth
            if (pdsEndpoint === 'https://reverie.house') {
                this.authMode = 'pds';
            } else {
                this.authMode = 'oauth';
            }
            
            // Reset redirect flag and OAuth button content
            this.redirectToMainEntrance = false;
            oauthBtn.innerHTML = '<span class="btn-text">Sign in with Bluesky</span>';
            
            // Update UI based on ambassador status
            if (isHerald) {
                statusMessage.className = 'heraldry-status-message success';
                statusMessage.innerHTML = `
                    <img src="${heraldry.icon_path || '/assets/heraldry/default.png'}" alt="" class="status-icon">
                    <span><strong>Welcome, Ambassador</strong> of ${this.escapeHtml(heraldry.name)}</span>
                `;
                
                // Show appropriate auth method
                if (this.authMode === 'pds') {
                    passwordGroup.style.display = 'block';
                    oauthBtn.style.display = 'none';
                    loginBtn.querySelector('.btn-text').textContent = 'Sign In';
                } else {
                    passwordGroup.style.display = 'none';
                    oauthBtn.style.display = 'block';
                    loginBtn.style.display = 'none';
                }
                
                loginBtn.disabled = false;
            } else if (heraldry && heraldry.ambassador_did) {
                // Not the ambassador - show who is
                statusMessage.className = 'heraldry-status-message info';
                
                // Try to get ambassador info
                let ambassadorInfo = 'another user';
                try {
                    const ambassadorResponse = await fetch(`/api/dreamer/did/${encodeURIComponent(heraldry.ambassador_did)}`);
                    if (ambassadorResponse.ok) {
                        const ambassador = await ambassadorResponse.json();
                        ambassadorInfo = `@${ambassador.handle || 'unknown'}`;
                    }
                } catch (e) {
                    console.warn('Could not fetch ambassador info:', e);
                }
                
                statusMessage.innerHTML = `
                    <img src="${heraldry.icon_path || '/assets/heraldry/default.png'}" alt="" class="status-icon">
                    <span>The ambassador for ${this.escapeHtml(heraldry.name)} is <strong>${ambassadorInfo}</strong></span>
                `;
                
                passwordGroup.style.display = 'none';
                oauthBtn.style.display = 'none';
                loginBtn.disabled = true;
                loginBtn.querySelector('.btn-text').textContent = 'Not Ambassador';
            } else {
                // No heraldry record for this PDS yet - show invitation to enter via main site
                statusMessage.className = 'heraldry-status-message info';
                statusMessage.innerHTML = `
                    <img src="/assets/heraldry/default.png" alt="" class="status-icon" style="border: 2px solid #87408d;">
                    <span><strong>${this.escapeHtml(pdsDomain)}</strong> hasn't visited yet. <a href="/?login=true" class="status-link">Sign in</a> to become the first ambassador.</span>
                `;
                
                // Show simple button to main entrance
                passwordGroup.style.display = 'none';
                oauthBtn.style.display = 'block';
                oauthBtn.innerHTML = `<span class="btn-text">Sign In</span>`;
                this.redirectToMainEntrance = true;
                loginBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Handle check error:', error);
            this.showStatusError('Error checking handle');
        }
    }

    async checkHeraldByDid(did) {
        try {
            // Get user's PDS from DID doc
            let didDocResponse;
            if (did.startsWith('did:web:')) {
                const domain = did.replace('did:web:', '');
                didDocResponse = await fetch(`https://${domain}/.well-known/did.json`);
            } else {
                didDocResponse = await fetch(`https://plc.directory/${did}`);
            }
            
            if (!didDocResponse.ok) return null;
            
            const didDoc = await didDocResponse.json();
            const service = didDoc.service?.find(s => s.id === '#atproto_pds');
            const pdsEndpoint = service?.serviceEndpoint || '';
            const pdsDomain = pdsEndpoint.replace(/^https?:\/\//, '').split('/')[0];
            
            // Check heraldry
            const heraldryResponse = await fetch(`/api/heraldry/for-domain/${encodeURIComponent(pdsDomain)}`);
            if (!heraldryResponse.ok) return null;
            
            const heraldry = await heraldryResponse.json();
            if (heraldry.ambassador_did === did) {
                return heraldry;
            }
            
            return null;
        } catch (e) {
            console.error('Error checking ambassador by DID:', e);
            return null;
        }
    }

    async attemptLogin() {
        if (!this.resolvedProfile || !this.resolvedProfile.isHerald) {
            return;
        }
        
        const loginBtn = document.getElementById('loginBtn');
        const errorDiv = document.getElementById('loginError');
        
        // Show loading
        loginBtn.disabled = true;
        loginBtn.querySelector('.btn-text').textContent = 'Authenticating...';
        loginBtn.querySelector('.btn-spinner').style.display = 'inline-block';
        errorDiv.style.display = 'none';
        
        try {
            if (this.authMode === 'pds') {
                await this.loginWithAppPassword();
            } else {
                await this.loginWithOAuth();
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'Authentication failed');
            loginBtn.disabled = false;
            loginBtn.querySelector('.btn-text').textContent = 'Sign In';
            loginBtn.querySelector('.btn-spinner').style.display = 'none';
        }
    }

    async loginWithAppPassword() {
        const passwordInput = document.getElementById('appPassword');
        const appPassword = passwordInput.value.trim();
        
        if (!appPassword) {
            throw new Error('Please enter your app password');
        }
        
        // Verify app password by calling our backend
        const response = await fetch('/api/heraldry/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                handle: this.resolvedProfile.handle,
                appPassword: appPassword,
                did: this.resolvedProfile.did
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Invalid app password');
        }
        
        const result = await response.json();
        
        // Store session
        this.setHeraldrySession({
            did: this.resolvedProfile.did,
            handle: this.resolvedProfile.handle,
            heraldryId: this.resolvedProfile.heraldry.id,
            authToken: result.token
        });
        
        // Load dashboard
        await this.loadDashboard({
            did: this.resolvedProfile.did,
            handle: this.resolvedProfile.handle,
            heraldryId: this.resolvedProfile.heraldry.id
        });
    }

    async loginWithOAuth() {
        if (!this.oauthManager) {
            throw new Error('OAuth not available. Please try again.');
        }
        
        // Trigger OAuth flow - this will redirect
        try {
            await this.oauthManager.login(this.resolvedProfile.handle);
        } catch (e) {
            throw new Error('OAuth login failed: ' + e.message);
        }
    }

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    async loadDashboard(session) {
        console.log('[Heraldry] Loading dashboard for:', session);
        
        // Clear logout flag if present
        sessionStorage.removeItem('heraldry_logged_out');
        
        const loginView = document.getElementById('heraldryLogin');
        const dashboardView = document.getElementById('heraldryDashboard');
        
        if (loginView) loginView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'block';
        
        try {
            console.log('[Heraldry] Fetching heraldry data...');
            // Load heraldry
            const heraldryResponse = await fetch(`/api/heraldry/${session.heraldryId}`);
            if (!heraldryResponse.ok) {
                throw new Error('Could not load heraldry');
            }
            this.currentHeraldry = await heraldryResponse.json();
            console.log('[Heraldry] Heraldry loaded:', this.currentHeraldry.name);
            
            // Load ambassador profile
            console.log('[Heraldry] Fetching ambassador profile...');
            const profileResponse = await fetch(`/api/dreamer/did/${encodeURIComponent(session.did)}`);
            if (profileResponse.ok) {
                this.currentHerald = await profileResponse.json();
                console.log('[Heraldry] Ambassador profile loaded:', this.currentHerald.handle);
            } else {
                console.log('[Heraldry] Could not fetch full profile, using session data');
                this.currentHerald = { did: session.did, handle: session.handle };
            }
            
            // Load coterie
            console.log('[Heraldry] Fetching coterie...');
            const coterieResponse = await fetch(`/api/heraldry/${session.heraldryId}/coterie`);
            if (coterieResponse.ok) {
                this.coterie = await coterieResponse.json();
                console.log('[Heraldry] Coterie loaded:', this.coterie.length, 'members');
            }
            
            // Render dashboard
            console.log('[Heraldry] Rendering dashboard...');
            this.renderAmbassadorProfile();
            this.renderHeraldryPreview();
            this.renderHeraldryControls();
            this.renderCoterieStats();
            this.renderTransferOptions();
            
            // Setup dashboard button listeners
            this.setupDashboardListeners();
            
            console.log('[Heraldry] Dashboard loaded successfully');
            
        } catch (error) {
            console.error('[Heraldry] Error loading dashboard:', error);
            this.showError('Failed to load dashboard. Please try again.');
            this.logout();
        }
    }

    renderAmbassadorProfile() {
        const container = document.getElementById('heraldProfile');
        if (!container || !this.currentHerald) return;
        
        const avatar = this.currentHerald.avatar || '/assets/icon.png';
        const name = this.currentHerald.display_name || this.currentHerald.name || this.currentHerald.handle;
        const handle = this.currentHerald.handle || '';
        
        container.innerHTML = `
            <img src="${avatar}" alt="${name}" class="profile-avatar" onerror="this.src='/assets/icon.png'">
            <div class="profile-info">
                <p class="profile-name">${this.escapeHtml(name)}</p>
                <p class="profile-handle">@${this.escapeHtml(handle)}</p>
                <p class="profile-role">Ambassador</p>
            </div>
        `;
    }

    renderHeraldryPreview() {
        const container = document.getElementById('heraldryPreview');
        if (!container || !this.currentHeraldry) return;
        
        const h = this.currentHeraldry;
        const domains = h.domains || [];
        
        container.innerHTML = `
            <img src="${h.icon_path || '/assets/heraldry/default.png'}" alt="${h.name}" class="preview-icon">
            <div class="preview-info">
                <p class="preview-name" style="color: ${h.color_primary}">${this.escapeHtml(h.name)}</p>
                <p class="preview-domains">${domains.map(d => this.escapeHtml(d)).join(', ')}</p>
                <div class="preview-color-bar" style="background: ${h.color_primary}"></div>
            </div>
        `;
    }

    renderHeraldryControls() {
        // Set current icon
        const iconPreview = document.getElementById('heraldryIconPreview');
        if (iconPreview && this.currentHeraldry) {
            iconPreview.src = this.currentHeraldry.icon_path || '/assets/heraldry/default.png';
        }
        
        // Set current color
        const colorSwatch = document.getElementById('colorSwatch');
        const colorHexInput = document.getElementById('colorHexInput');
        if (this.currentHeraldry) {
            const color = this.currentHeraldry.color_primary || '#87408d';
            if (colorSwatch) colorSwatch.style.background = color;
            if (colorHexInput) colorHexInput.value = color;
            this.initColorPicker(color);
        }
    }

    renderCoterieStats() {
        const container = document.getElementById('coterieInfo');
        if (!container) return;
        
        const total = this.coterie.length;
        
        container.innerHTML = `
            <div class="coterie-stats-grid">
                <div class="coterie-stat">
                    <p class="stat-value">${total}</p>
                    <p class="stat-label">Members</p>
                </div>
            </div>
            ${total > 0 ? `
                <div class="coterie-members">
                    ${this.coterie.slice(0, 10).map(m => `
                        <div class="coterie-member">
                            <img src="${m.avatar || '/assets/icon.png'}" alt="" class="member-avatar" onerror="this.src='/assets/icon.png'">
                            <span class="member-handle">@${this.escapeHtml(m.handle || 'unknown')}</span>
                        </div>
                    `).join('')}
                    ${total > 10 ? `<div class="coterie-member"><span class="member-handle">+${total - 10} more</span></div>` : ''}
                </div>
            ` : '<p style="color: #666; font-size: 0.875rem;">No coterie members yet</p>'}
        `;
    }

    renderTransferOptions() {
        const select = document.getElementById('transferSelect');
        if (!select) return;
        
        // Filter out current ambassador
        const candidates = this.coterie.filter(m => m.did !== this.currentHerald?.did);
        
        select.innerHTML = '<option value="">Select new ambassador...</option>' +
            candidates.map(m => `
                <option value="${m.did}">@${this.escapeHtml(m.handle || 'unknown')}</option>
            `).join('');
    }

    // =========================================================================
    // COLOR PICKER
    // =========================================================================

    initColorPicker(initialColor) {
        const shadeCanvas = document.getElementById('colorShadeCanvas');
        const hueCanvas = document.getElementById('colorHueCanvas');
        
        if (!shadeCanvas || !hueCanvas) return;
        
        // Parse initial color to get hue
        const rgb = this.hexToRgb(initialColor);
        if (rgb) {
            const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
            this.hue = hsv.h;
        }
        
        this.drawHueSlider();
        this.drawShadeBox();
        
        // Setup interactions
        const shadePicker = document.getElementById('colorShadePicker');
        const hueSlider = document.getElementById('colorHueSlider');
        
        if (shadePicker) {
            shadePicker.addEventListener('mousedown', (e) => this.startShadePick(e));
        }
        if (hueSlider) {
            hueSlider.addEventListener('mousedown', (e) => this.startHuePick(e));
        }
    }

    drawHueSlider() {
        const canvas = document.getElementById('colorHueCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        
        for (let i = 0; i <= 360; i += 30) {
            gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawShadeBox() {
        const canvas = document.getElementById('colorShadeCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Draw saturation gradient (white to color)
        const satGradient = ctx.createLinearGradient(0, 0, width, 0);
        satGradient.addColorStop(0, 'white');
        satGradient.addColorStop(1, `hsl(${this.hue}, 100%, 50%)`);
        ctx.fillStyle = satGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Draw value gradient (transparent to black)
        const valGradient = ctx.createLinearGradient(0, 0, 0, height);
        valGradient.addColorStop(0, 'rgba(0,0,0,0)');
        valGradient.addColorStop(1, 'black');
        ctx.fillStyle = valGradient;
        ctx.fillRect(0, 0, width, height);
    }

    startShadePick(e) {
        const pick = (event) => {
            const rect = e.target.getBoundingClientRect();
            const x = Math.max(0, Math.min(180, (event.clientX || e.clientX) - rect.left));
            const y = Math.max(0, Math.min(180, (event.clientY || e.clientY) - rect.top));
            
            const s = x / 180;
            const v = 1 - (y / 180);
            const rgb = this.hsvToRgb(this.hue, s, v);
            const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
            
            this.updateColor(hex);
            
            // Update cursor position
            const cursor = document.getElementById('colorShadeCursor');
            if (cursor) {
                cursor.style.left = x + 'px';
                cursor.style.top = y + 'px';
            }
        };
        
        pick(e);
        
        const moveHandler = (event) => pick(event);
        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    startHuePick(e) {
        const pick = (event) => {
            const rect = e.target.getBoundingClientRect();
            const y = Math.max(0, Math.min(180, (event.clientY || e.clientY) - rect.top));
            
            this.hue = (y / 180) * 360;
            this.drawShadeBox();
            
            // Update cursor position
            const cursor = document.getElementById('colorHueCursor');
            if (cursor) {
                cursor.style.top = y + 'px';
            }
        };
        
        pick(e);
        
        const moveHandler = (event) => pick(event);
        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    updateColor(hex) {
        const colorSwatch = document.getElementById('colorSwatch');
        const colorHexInput = document.getElementById('colorHexInput');
        
        if (colorSwatch) colorSwatch.style.background = hex;
        if (colorHexInput) colorHexInput.value = hex;
    }

    updateColorFromHex(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
        
        const colorSwatch = document.getElementById('colorSwatch');
        if (colorSwatch) colorSwatch.style.background = hex;
        
        // Update hue and redraw
        const rgb = this.hexToRgb(hex);
        if (rgb) {
            const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
            this.hue = hsv.h;
            this.drawShadeBox();
        }
    }

    // =========================================================================
    // ACTIONS
    // =========================================================================

    async handleIconUpload(e) {
        console.log('[Heraldry] handleIconUpload called');
        const file = e.target.files[0];
        if (!file) {
            console.log('[Heraldry] No file selected');
            return;
        }
        
        console.log('[Heraldry] File:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        // Validate
        if (!file.type.includes('png')) {
            this.showError('Please upload a PNG image');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image must be less than 5MB');
            return;
        }
        
        console.log('[Heraldry] File validation passed, creating preview');
        
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('[Heraldry] File read complete, updating preview');
            const iconPreview = document.getElementById('heraldryIconPreview');
            if (iconPreview) {
                iconPreview.src = e.target.result;
                console.log('[Heraldry] Preview updated');
            }
            // Show save button when icon changes
            const saveBtn = document.getElementById('saveIconBtn');
            if (saveBtn) {
                saveBtn.style.display = 'inline-flex';
                console.log('[Heraldry] Save button shown');
            }
        };
        reader.readAsDataURL(file);
    }

    clearIcon() {
        const iconPreview = document.getElementById('heraldryIconPreview');
        const fileInput = document.getElementById('iconFileInput');
        const saveBtn = document.getElementById('saveIconBtn');
        
        // Reset to default icon
        if (iconPreview) {
            iconPreview.src = '/assets/heraldry/default.png';
        }
        if (fileInput) {
            fileInput.value = '';
        }
        // Show save button to save the clear action
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        
        // Mark that we want to clear the icon
        this.pendingIconClear = true;
    }

    async saveIcon() {
        console.log('[Heraldry] saveIcon called');
        const fileInput = document.getElementById('iconFileInput');
        const saveBtn = document.getElementById('saveIconBtn');
        
        console.log('[Heraldry] pendingIconClear:', this.pendingIconClear);
        console.log('[Heraldry] fileInput.files:', fileInput?.files?.length);
        
        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        
        try {
            const session = this.getHeraldrySession();
            console.log('[Heraldry] Session DID:', session?.did);
            
            if (this.pendingIconClear) {
                console.log('[Heraldry] Clearing icon...');
                // Clear the icon by sending a DELETE or empty update
                const response = await fetch(`/api/heraldry/${this.currentHeraldry.id}/icon`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${session?.authToken || ''}`,
                        'X-Ambassador-DID': session?.did || ''
                    }
                });
                
                console.log('[Heraldry] Clear response:', response.status);
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to clear icon');
                }
                
                this.currentHeraldry.icon_path = '/assets/heraldry/default.png';
                this.pendingIconClear = false;
            } else if (fileInput.files[0]) {
                console.log('[Heraldry] Uploading icon...');
                // Upload new icon
                const formData = new FormData();
                formData.append('icon', fileInput.files[0]);
                
                const response = await fetch(`/api/heraldry/${this.currentHeraldry.id}/icon`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session?.authToken || ''}`,
                        'X-Ambassador-DID': session?.did || ''
                    },
                    body: formData
                });
                
                console.log('[Heraldry] Upload response:', response.status);
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to save icon');
                }
                
                const result = await response.json();
                console.log('[Heraldry] Upload result:', result);
                this.currentHeraldry.icon_path = result.icon_path;
            } else {
                console.log('[Heraldry] Nothing to save');
            }
            
            this.renderHeraldryPreview();
            saveBtn.style.display = 'none';
            
        } catch (error) {
            console.error('Error saving icon:', error);
            this.showError(error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async saveColor() {
        const colorHexInput = document.getElementById('colorHexInput');
        const saveBtn = document.getElementById('saveColorBtn');
        const color = colorHexInput.value;
        
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            this.showError('Invalid color format');
            return;
        }
        
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        try {
            const session = this.getHeraldrySession();
            const response = await fetch(`/api/heraldry/${this.currentHeraldry.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.authToken || ''}`,
                    'X-Ambassador-DID': session?.did || ''
                },
                body: JSON.stringify({ color_primary: color })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save color');
            }
            
            this.currentHeraldry.color_primary = color;
            this.renderHeraldryPreview();
            
        } catch (error) {
            console.error('Error saving color:', error);
            this.showError(error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Color';
        }
    }

    async transferHerald() {
        console.log('[Heraldry] transferHerald called');
        const select = document.getElementById('transferSelect');
        const newDid = select.value;
        
        console.log('[Heraldry] Selected new ambassador DID:', newDid);
        
        if (!newDid) {
            console.log('[Heraldry] No DID selected');
            return;
        }
        
        if (!confirm('Are you sure you want to transfer ambassadorship? This cannot be undone.')) {
            return;
        }
        
        try {
            const session = this.getHeraldrySession();
            console.log('[Heraldry] Sending transfer request...');
            const response = await fetch(`/api/heraldry/${this.currentHeraldry.id}/transfer-ambassador`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.authToken || ''}`,
                    'X-Ambassador-DID': session?.did || ''
                },
                body: JSON.stringify({ new_ambassador_did: newDid })
            });
            
            console.log('[Heraldry] Transfer response:', response.status);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to transfer ambassadorship');
            }
            
            const result = await response.json();
            console.log('[Heraldry] Transfer successful:', result);
            alert(`Ambassadorship transferred successfully to @${result.new_ambassador_handle}!`);
            this.logout();
            
        } catch (error) {
            console.error('Error transferring ambassadorship:', error);
            this.showError(error.message);
        }
    }

    async stepDown() {
        console.log('[Heraldry] stepDown called');
        
        if (!confirm('Are you sure you want to step down as ambassador? The most active community member will be promoted.')) {
            console.log('[Heraldry] Step down cancelled by user');
            return;
        }
        
        try {
            const session = this.getHeraldrySession();
            console.log('[Heraldry] Sending step-down request...');
            const response = await fetch(`/api/heraldry/${this.currentHeraldry.id}/step-down`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.authToken || ''}`,
                    'X-Ambassador-DID': session?.did || ''
                }
            });
            
            console.log('[Heraldry] Step-down response:', response.status);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to step down');
            }
            
            const result = await response.json();
            console.log('[Heraldry] Step-down successful:', result);
            
            if (result.new_ambassador_did) {
                alert(`You have stepped down. @${result.new_ambassador_handle} is now the ambassador.`);
            } else {
                alert('You have stepped down. No successor was available.');
            }
            this.logout();
            
        } catch (error) {
            console.error('Error stepping down:', error);
            this.showError(error.message);
        }
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    resetStatus() {
        const statusMessage = document.getElementById('loginStatusMessage');
        const loginBtn = document.getElementById('loginBtn');
        const passwordGroup = document.getElementById('passwordGroup');
        const oauthBtn = document.getElementById('oauthBtn');
        
        if (statusMessage) {
            statusMessage.className = 'heraldry-status-message';
            statusMessage.innerHTML = `
                <img src="/assets/icon.png" alt="" class="status-icon">
                <span>Enter your handle to check ambassador status</span>
            `;
        }
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.style.display = 'block';
            loginBtn.querySelector('.btn-text').textContent = 'Check Status';
            loginBtn.querySelector('.btn-spinner').style.display = 'none';
        }
        if (passwordGroup) {
            passwordGroup.style.display = 'none';
        }
        if (oauthBtn) {
            oauthBtn.style.display = 'none';
        }
    }

    showStatusError(message) {
        const statusMessage = document.getElementById('loginStatusMessage');
        const loginBtn = document.getElementById('loginBtn');
        
        if (statusMessage) {
            statusMessage.className = 'heraldry-status-message error';
            statusMessage.innerHTML = `
                <img src="/assets/icon_face.png" alt="" class="status-icon">
                <span>${this.escapeHtml(message)}</span>
            `;
        }
        if (loginBtn) {
            loginBtn.disabled = true;
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    addSpinKeyframes() {
        if (!document.getElementById('heraldry-spin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'heraldry-spin-keyframes';
            style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =========================================================================
    // COLOR CONVERSION UTILITIES
    // =========================================================================

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : d / max;
        const v = max;
        
        if (d !== 0) {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        return { h: h * 360, s, v };
    }

    hsvToRgb(h, s, v) {
        h = h / 360;
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.heraldry = new Heraldry();
});
