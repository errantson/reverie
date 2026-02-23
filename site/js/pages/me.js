/**
 * me.js — Mobile Self / Profile page
 *
 * Pattern (like the dreamers page): me.html is a minimal shell.
 * All HTML is generated here. Session check → renderShell() → panels.
 *
 * Panels (lazy-loaded on first tab open):
 *   compose | messages | look | details | roles
 */

'use strict';

const MePage = {
    session:      null,
    dreamer:      null,
    panelsLoaded: {},
    currentMode:  'details',

    /* ── Boot ─────────────────────────────────────────── */
    init() {
        window.addEventListener('oauth:profile-loaded', () => {
            if (!this.session) this.loadSession();
        });
        window.addEventListener('oauth:login', () => {
            if (!this.session) this.loadSession();
        });
        // Give oauthManager ~800 ms to restore a stored session
        setTimeout(() => this._checkSession(), 800);
    },

    _checkSession() {
        if (this.session) return;
        const session = window.oauthManager?.getSession?.()
            || window.oauthManager?.currentSession
            || null;
        if (session) {
            this.loadSession();
        } else {
            this.promptLogin();
        }
    },

    promptLogin() {
        const el = document.getElementById('meLoading');
        if (el) el.style.display = 'none';
        window.loginWidget?.showLoginPopup?.();
        // After login, the persistent oauth:login listener calls loadSession()
    },

    /* ── Auth helpers ─────────────────────────────────── */
    getToken() {
        try {
            const pds = JSON.parse(localStorage.getItem('pds_session') || '{}');
            if (pds?.accessJwt) return pds.accessJwt;
        } catch (_) {}
        return localStorage.getItem('oauth_token')
            || localStorage.getItem('admin_token')
            || window.oauthManager?.getSession?.()?.accessJwt
            || null;
    },

    /* ── OAuth token (backend session token, like dashboard) ── */
    getOAuthToken() {
        const oauthToken = localStorage.getItem('oauth_token');
        const adminToken = localStorage.getItem('admin_token');
        const backendToken = oauthToken || adminToken;
        if (backendToken) return backendToken;

        const session = window.oauthManager?.getSession();
        if (session?.accessJwt) return session.accessJwt;

        try {
            const pds = JSON.parse(localStorage.getItem('pds_session') || '{}');
            if (pds?.accessJwt) return pds.accessJwt;
        } catch (_) {}

        return null;
    },

    /* ── Session load ─────────────────────────────────── */
    async loadSession() {
        try {
            let session = window.oauthManager?.getSession?.()
                || window.oauthManager?.currentSession
                || null;

            if (!session) {
                try { session = JSON.parse(localStorage.getItem('pds_session') || 'null'); } catch (_) {}
            }
            if (!session) { this.promptLogin(); return; }

            const did = session.did || session.sub;
            if (!did) { this.promptLogin(); return; }

            const resp = await fetch(`/api/dreamers/${encodeURIComponent(did)}`);
            if (!resp.ok) { this.promptLogin(); return; }

            const data = await resp.json();
            if (data.error) { this.promptLogin(); return; }

            this.session = { ...session, did };
            this.dreamer = data;

            // Expose MePage globally so header.js can read dreamer data
            window.MePage = this;

            // Refresh the Me tab label now that dreamer data is loaded
            window.headerWidget?.updateMeTabLabel?.();

            this.renderShell();
            this.renderProfile();
            this.bindModeBar();
            this.switchMode('details');
            this.loadMessageBadge();
        } catch (err) {
            console.error('[MePage] loadSession error:', err);
            this.promptLogin();
        }
    },

    /* ── Shell render ─────────────────────────────────── */
    renderShell() {
        const loading = document.getElementById('meLoading');
        if (loading) loading.style.display = 'none';

        const root = document.getElementById('meRoot');
        if (!root) return;

        root.innerHTML = `
            <div class="me-authenticated">

                <div class="me-profile-strip" id="meProfileStrip">
                    <button class="me-avatar-btn" id="meAvatarBtn" aria-label="Change avatar">
                        <img src="/assets/icon_face.png" alt="Avatar" class="me-avatar-img" id="meAvatarImg">
                    </button>
                    <div class="me-identity">
                        <div class="me-display-name" id="meDisplayName">—</div>
                        <div class="me-designation" id="meDesignation"></div>
                        <div class="me-handle" id="meHandle">@…</div>
                    </div>
                    <div class="me-strip-meta">
                        <div class="me-octant-chip" id="meOctantChip" style="display:none;"></div>
                    </div>
                </div>

                <div class="me-mode-bar" id="meModeBar" role="tablist">
                    <button class="me-mode-btn active" data-mode="details" role="tab" aria-selected="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                        Details
                    </button>
                    <button class="me-mode-btn" data-mode="compose" role="tab" aria-selected="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Post
                    </button>
                    <button class="me-mode-btn" data-mode="look" role="tab" aria-selected="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                        Looks
                    </button>
                    <button class="me-mode-btn" data-mode="messages" role="tab" aria-selected="false" id="meModeMessages">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Inbox
                        <span class="me-mode-badge" id="meMessageBadge" style="display:none;"></span>
                    </button>
                    <button class="me-mode-btn" data-mode="canon" role="tab" aria-selected="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        Canon
                    </button>
                    <button class="me-mode-btn" data-mode="tools" role="tab" aria-selected="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        Tools
                    </button>
                    <button class="me-mode-btn" data-mode="roles" role="tab" aria-selected="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                        Roles
                    </button>
                    <button class="me-mode-btn me-mode-btn--logout" data-mode="logout" role="tab" aria-selected="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Logout
                    </button>
                </div>

                <div class="me-content-zone" id="meContentZone">
                    <div class="me-panel active" id="mePanelDetails"  role="tabpanel"></div>
                    <div class="me-panel"        id="mePanelCompose"  role="tabpanel" style="display:none;"></div>
                    <div class="me-panel"        id="mePanelLook"     role="tabpanel" style="display:none;"></div>
                    <div class="me-panel"        id="mePanelMessages" role="tabpanel" style="display:none;"></div>
                    <div class="me-panel"        id="mePanelCanon"    role="tabpanel" style="display:none;"></div>
                    <div class="me-panel"        id="mePanelTools"    role="tabpanel" style="display:none;"></div>
                    <div class="me-panel"        id="mePanelRoles"    role="tabpanel" style="display:none;"></div>
                </div>

            </div>
        `;
    },

    /* ── Profile strip ────────────────────────────────── */
    renderProfile() {
        const d = this.dreamer;
        if (!d) return;

        // Phanera background
        const bgImg = document.getElementById('meBgImg');
        if (bgImg && d.phanera) {
            bgImg.src = `/souvenirs/residence/${d.phanera.toLowerCase().replace(/\s+/g, '_')}.png`;
        }

        // Avatar
        const img = document.getElementById('meAvatarImg');
        if (img) {
            img.src = d.avatar || '/assets/icon_face.png';
            img.onerror = () => { img.src = '/assets/icon_face.png'; };
        }
        document.getElementById('meAvatarBtn')?.addEventListener('click', () => {
            window.dashboardWidget?.showAvatarUpload?.();
        });

        // Name / handle
        const nameEl = document.getElementById('meDisplayName');
        if (nameEl) {
            nameEl.textContent = d.display_name || d.handle || '—';
            if (d.color_hex) nameEl.style.color = d.color_hex;
        }

        const handleEl = document.getElementById('meHandle');
        if (handleEl) handleEl.textContent = `@${d.handle || ''}`;

        // Designation (e.g. "House Patron")
        const desigEl = document.getElementById('meDesignation');
        if (desigEl) {
            const designation = d.designation || '';
            if (designation) {
                desigEl.textContent = designation.toUpperCase();
                desigEl.style.display = '';
            } else {
                desigEl.style.display = 'none';
            }
        }

        // Octant chip
        const octant = d.spectrum?.octant || d.octant || '';
        const octantEl = document.getElementById('meOctantChip');
        if (octantEl && octant) {
            octantEl.textContent = octant;
            octantEl.style.display = '';
        }

    },

    /* ── Mode bar ─────────────────────────────────────── */
    bindModeBar() {
        document.getElementById('meModeBar')?.querySelectorAll('.me-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
        });
    },

    switchMode(mode) {
        // Logout is a special action, not a panel
        if (mode === 'logout') {
            this.logout();
            return;
        }

        this.currentMode = mode;

        document.querySelectorAll('.me-mode-btn').forEach(btn => {
            const active = btn.dataset.mode === mode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
        });

        const panels = {
            details:  'mePanelDetails',
            compose:  'mePanelCompose',
            look:     'mePanelLook',
            messages: 'mePanelMessages',
            canon:    'mePanelCanon',
            tools:    'mePanelTools',
            roles:    'mePanelRoles',
        };
        Object.entries(panels).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = key === mode ? '' : 'none';
        });

        if (!this.panelsLoaded[mode]) {
            this.panelsLoaded[mode] = true;
            const name = `load${mode.charAt(0).toUpperCase() + mode.slice(1)}Panel`;
            this[name]?.call(this);
        }

        document.getElementById('meContentZone')?.scrollTo(0, 0);
    },

    /* ── Message badge ────────────────────────────────── */
    async loadMessageBadge() {
        try {
            const did = this.session?.did;
            if (!did) return;

            const resp = await fetch(`/api/messages/inbox?user_did=${encodeURIComponent(did)}&limit=1`);
            if (!resp.ok) return;
            const result = await resp.json();
            const unread = result.data?.unread || 0;

            const badge = document.getElementById('meMessageBadge');
            if (badge) {
                badge.textContent = unread > 9 ? '9+' : String(unread);
                badge.style.display = unread > 0 ? '' : 'none';
            }
        } catch (_) {}
    },

    /* ── COMPOSE panel ────────────────────────────────── */
    loadComposePanel() {
        const area = document.getElementById('mePanelCompose');
        if (!area) return;

        area.innerHTML = `
            <div class="me-share-lore-section">
                <button class="me-share-lore-btn" id="meShareLoreBtn">
                    <svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor"><path d="M29.98,8.875c-0.079-0.388-0.181-0.774-0.299-1.152c-0.112-0.367-0.266-0.718-0.411-1.073c-0.172-0.424-0.351-0.824-0.606-1.206c-0.253-0.378-0.531-0.743-0.793-1.117c-0.1-0.144-0.223-0.247-0.375-0.317c-0.02-0.015-0.033-0.037-0.055-0.05c-0.031-0.018-0.065-0.027-0.098-0.041c-0.012-0.334-0.226-0.656-0.565-0.739c-0.405-0.098-0.83-0.116-1.245-0.141c-0.363-0.023-0.726-0.039-1.088-0.044c-0.785-0.015-1.571-0.008-2.356-0.014c-0.645-0.003-1.292-0.016-1.939-0.016c-0.14,0-0.281,0.001-0.421,0.002c-0.826,0.008-1.65,0.01-2.474,0.016c-0.986,0.004-1.97,0.017-2.954,0.021c-0.507,0.002-1.013-0.002-1.519-0.008c-0.538-0.004-1.079-0.01-1.617-0.008c-0.26,0.001-0.484,0.139-0.63,0.338c-0.018,0.015-0.041,0.021-0.057,0.039c-0.301,0.318-0.596,0.673-0.807,1.061c-0.21,0.39-0.369,0.805-0.502,1.225C8.932,6.399,8.726,7.167,8.585,7.937C8.29,9.559,8.132,11.203,7.941,12.84c-0.108,0.929-0.219,1.858-0.338,2.788c-0.154,1.12-0.348,2.235-0.608,3.335c-0.133,0.558-0.278,1.113-0.457,1.659c-0.17,0.525-0.376,1.04-0.59,1.549c-0.16,0.365-0.324,0.739-0.545,1.073c-0.019,0.021-0.027,0.048-0.044,0.071c-0.006,0-0.013,0-0.019,0c-0.805,0-1.61,0.004-2.414,0.017c-0.211,0.004-0.404,0.091-0.548,0.229c-0.288,0.188-0.442,0.542-0.35,0.889c0.096,0.367,0.172,0.745,0.303,1.102c0.149,0.409,0.328,0.801,0.527,1.187c0.191,0.372,0.405,0.716,0.668,1.044c0.22,0.274,0.479,0.505,0.749,0.729c0.164,0.134,0.33,0.219,0.54,0.233c0.109,0.052,0.228,0.087,0.356,0.09c1.731,0.041,3.462-0.019,5.193-0.031c1.686-0.012,3.373-0.004,5.061-0.014c0.87-0.006,1.742,0.01,2.613,0.023c0.262,0.006,0.527,0.006,0.791,0.004c0.536-0.002,1.077-0.002,1.611,0.044c0.011,0.001,0.021-0.006,0.032-0.005c0.307,0.239,0.802,0.258,1.072-0.051c0.291-0.336,0.563-0.695,0.801-1.071c0.247-0.39,0.413-0.818,0.579-1.247c0.284-0.729,0.527-1.491,0.683-2.258c0.342-1.663,0.567-3.352,0.753-5.04c0.061-0.56,0.123-1.12,0.195-1.679c0.136-0.949,0.285-1.896,0.414-2.846c0.18-1.298,0.4-2.589,0.68-3.871c0.068-0.311,0.139-0.622,0.214-0.932c0.003,0.003,0.004,0.007,0.006,0.009c0.141,0.141,0.372,0.259,0.579,0.239c0.834-0.081,1.665-0.131,2.503-0.179c0.112-0.006,0.218-0.035,0.316-0.079c0.057-0.002,0.115,0.005,0.171-0.011C29.864,9.72,30.067,9.294,29.98,8.875z M15.566,27.231c-1.683-0.01-3.365-0.004-5.048-0.01c-0.878-0.004-1.754,0-2.632-0.006c-0.886-0.006-1.774-0.04-2.66-0.07c-0.192-0.164-0.376-0.332-0.545-0.523c-0.294-0.409-0.528-0.86-0.732-1.32c-0.049-0.136-0.087-0.273-0.128-0.41c0.557-0.016,1.114-0.033,1.67-0.049c0.81-0.023,1.625-0.021,2.435-0.021c1.58,0.002,3.164,0.019,4.743,0.098c1.708,0.082,3.421,0.131,5.129,0.244c0.046,0.159,0.089,0.319,0.139,0.476c0.112,0.345,0.262,0.677,0.421,1.005c0.102,0.213,0.22,0.409,0.347,0.601c-0.212-0.002-0.424-0.003-0.636-0.005C17.233,27.237,16.4,27.237,15.566,27.231z M24.486,9.036c-0.415,1.617-0.745,3.251-0.998,4.901c-0.089,0.583-0.168,1.167-0.257,1.748c-0.083,0.536-0.174,1.073-0.249,1.609c-0.166,1.186-0.268,2.375-0.416,3.56c-0.13,0.936-0.281,1.87-0.469,2.798c-0.191,0.941-0.498,1.864-0.856,2.756c-0.14,0.294-0.316,0.561-0.501,0.826c-0.056-0.072-0.111-0.145-0.189-0.195c-0.159-0.141-0.298-0.297-0.432-0.461c-0.213-0.301-0.371-0.623-0.519-0.956c-0.172-0.457-0.286-0.934-0.412-1.404c-0.003-0.01-0.009-0.017-0.012-0.026c-0.021-0.07-0.051-0.132-0.089-0.191c-0.01-0.015-0.019-0.028-0.03-0.042c-0.043-0.056-0.089-0.106-0.146-0.149c-0.019-0.015-0.04-0.026-0.061-0.04c-0.053-0.033-0.106-0.065-0.166-0.087c-0.029-0.011-0.06-0.014-0.09-0.021c-0.054-0.013-0.104-0.034-0.161-0.038c-0.378-0.023-0.756-0.025-1.135-0.041c-0.405-0.019-0.81-0.039-1.218-0.052c-0.791-0.025-1.582-0.039-2.373-0.077c-0.778-0.037-1.555-0.089-2.335-0.106c-0.78-0.017-1.559-0.027-2.341-0.027c-0.651,0-1.303-0.002-1.954-0.005c0.024-0.054,0.052-0.11,0.076-0.163c0.181-0.394,0.336-0.799,0.492-1.202c0.286-0.747,0.523-1.499,0.726-2.271c0.407-1.557,0.668-3.143,0.863-4.739c0.193-1.582,0.348-3.167,0.545-4.748c0.108-0.788,0.226-1.574,0.385-2.355c0.079-0.388,0.195-0.772,0.301-1.154c0.106-0.375,0.223-0.744,0.359-1.108c0.111-0.237,0.241-0.456,0.394-0.671c0.096-0.115,0.198-0.226,0.301-0.336c1.588-0.029,3.174-0.083,4.76-0.108c0.834-0.014,1.667-0.017,2.501-0.016c0.822,0.002,1.642,0.027,2.464,0.048c0.843,0.021,1.686,0.035,2.528,0.039c0.76,0.002,1.519,0.02,2.274,0.105c0.029,0.005,0.058,0.011,0.087,0.016c-0.354,0.632-0.67,1.284-0.916,1.967C24.932,7.415,24.696,8.22,24.486,9.036z M26.214,8.523c0.176-0.605,0.371-1.205,0.602-1.792c0.102-0.224,0.215-0.441,0.329-0.657c0.02,0.026,0.039,0.053,0.058,0.079c0.209,0.284,0.375,0.58,0.519,0.9c0.138,0.328,0.274,0.656,0.392,0.99c0.039,0.111,0.062,0.227,0.097,0.34c-0.59,0.015-1.179,0.042-1.766,0.093C26.362,8.482,26.288,8.502,26.214,8.523z M20.026,10.52c0.102,0.174,0.129,0.386,0.077,0.579c-0.052,0.187-0.177,0.351-0.345,0.45c-0.178,0.104-0.359,0.113-0.554,0.08c-0.218-0.017-0.438-0.016-0.656-0.016c-0.118,0-0.233,0.002-0.349-0.002c-0.415-0.008-0.832-0.017-1.247-0.012c-0.974,0.016-1.947,0.081-2.919,0.104c-0.399,0.01-0.731-0.34-0.731-0.731c0-0.401,0.332-0.727,0.731-0.731c0.349-0.002,0.7,0.002,1.052,0.008c0.656,0.008,1.312,0.017,1.97-0.023c0.424-0.025,0.849-0.037,1.274-0.042c0.206-0.004,0.411-0.01,0.616-0.019c0.113-0.006,0.229-0.016,0.345-0.016c0.031,0,0.061,0.001,0.092,0.002C19.648,10.165,19.887,10.283,20.026,10.52z M18.925,13.447c0.135,0.135,0.212,0.32,0.212,0.509c0,0.378-0.328,0.741-0.722,0.722c-0.814-0.041-1.638-0.031-2.453-0.004c-0.45,0.016-0.899,0.012-1.349,0.025c-0.484,0.014-0.969,0.041-1.455,0.066c-0.403,0.021-0.741-0.353-0.741-0.741c0-0.411,0.338-0.729,0.741-0.741c0.411-0.01,0.822,0,1.233,0.008c0.523,0.012,1.046,0.023,1.571-0.006c0.436-0.025,0.874-0.027,1.312-0.025c0.38,0,0.764,0.014,1.14-0.023c0.013-0.001,0.027-0.002,0.04-0.002C18.627,13.235,18.811,13.332,18.925,13.447z M18.864,16.706c0.102,0.176,0.129,0.388,0.075,0.581c-0.05,0.189-0.178,0.353-0.345,0.452c-0.193,0.112-0.369,0.104-0.581,0.075c-0.013-0.002-0.025-0.004-0.039-0.004c0.068,0.008,0.133,0.017,0.201,0.027c-0.855-0.11-1.725-0.106-2.584-0.087c-0.496,0.012-0.994,0.012-1.49,0.017c-0.517,0.004-1.032,0.048-1.548,0.064c-0.417,0.016-0.762-0.355-0.762-0.76c0-0.417,0.345-0.762,0.762-0.762c0.536,0,1.071,0.037,1.607,0.041c0.484,0.004,0.969-0.008,1.453-0.01c0.48-0.002,0.959-0.008,1.438-0.029c0.139-0.006,0.278-0.009,0.419-0.009c0.248,0,0.498,0.01,0.743,0.032C18.483,16.356,18.721,16.461,18.864,16.706z"/></svg>
                    <div class="me-share-lore-text">
                        <span class="me-share-lore-title">Share Lore</span>
                        <span class="me-share-lore-sub">Declare an existing post as lore</span>
                    </div>
                </button>
            </div>
            <div class="me-compose-area">
                <div class="me-composer">
                    <textarea
                        class="me-composer-textarea"
                        id="meComposerText"
                        placeholder="What dreams have you, lately?"
                        maxlength="300"
                    ></textarea>
                    <div class="me-composer-footer">
                        <label class="me-lore-label" title="Tag this post as lore">
                            <input type="checkbox" id="meIsLore" checked>
                            <span class="me-lore-chip">LORE</span>
                        </label>
                        <span class="me-composer-char-count" id="meCharCount">300</span>
                        <div class="me-composer-tools">
                            <button class="me-image-btn" id="meImageBtn" title="Attach image">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                <span class="me-image-count" id="meImageCount">0/4</span>
                            </button>
                            <input type="file" id="meImageInput" accept="image/jpeg,image/png,image/gif,image/webp" multiple style="display:none">
                            <button class="me-schedule-btn" id="meScheduleBtn" title="Schedule post">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </button>
                            <button class="me-composer-send-btn" id="meComposerSendBtn" disabled>Post</button>
                        </div>
                    </div>
                    <div class="me-schedule-row" id="meScheduleRow" style="display:none;">
                        <label class="me-schedule-row-label">Schedule for:</label>
                        <input type="datetime-local" id="meScheduleTime" class="me-schedule-input">
                        <button class="me-schedule-clear-btn" id="meScheduleClearBtn" title="Clear schedule">✕</button>
                    </div>
                    <div class="me-images-strip" id="meImagesStrip" style="display:none;"></div>
                </div>
            </div>
            <div class="me-section" id="meScheduledSection">
                <div class="me-section-header">
                    <span class="me-section-title">Scheduled</span>
                    <span class="me-scheduled-count" id="meScheduledCount" style="display:none;"></span>
                </div>
                <div id="meScheduledList"><div class="me-panel-loading">Loading…</div></div>
            </div>
        `;
        this.bindComposer();
        this.meSelectedImages = [];
        this.loadScheduledPosts();

        // Share Lore button
        document.getElementById('meShareLoreBtn')?.addEventListener('click', () => this.handleShareLore());
    },

    bindComposer() {
        const textarea  = document.getElementById('meComposerText');
        const charCount = document.getElementById('meCharCount');
        const sendBtn   = document.getElementById('meComposerSendBtn');
        if (!textarea) return;

        textarea.addEventListener('input', () => {
            const left = 300 - textarea.value.length;
            if (charCount) {
                charCount.textContent = String(left);
                charCount.className = 'me-composer-char-count'
                    + (left <= 20 ? ' near-limit' : '')
                    + (left <= 0  ? ' at-limit'   : '');
            }
            if (sendBtn) sendBtn.disabled = textarea.value.length === 0;
        });

        sendBtn?.addEventListener('click', () => this.submitPost());

        // Schedule toggle
        document.getElementById('meScheduleBtn')?.addEventListener('click', () => {
            const row = document.getElementById('meScheduleRow');
            if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
        });
        document.getElementById('meScheduleClearBtn')?.addEventListener('click', () => {
            const input = document.getElementById('meScheduleTime');
            if (input) input.value = '';
            const row = document.getElementById('meScheduleRow');
            if (row) row.style.display = 'none';
        });

        // Image attach
        this.meSelectedImages = [];
        document.getElementById('meImageBtn')?.addEventListener('click', () => {
            document.getElementById('meImageInput')?.click();
        });
        document.getElementById('meImageInput')?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(file => {
                if (this.meSelectedImages.length >= 4) return;
                if (file.size > 1000000) { alert(`"${file.name}" exceeds 1 MB limit.`); return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.meSelectedImages.push({ file, dataUrl: ev.target.result, alt: '' });
                    this.updateImageStrip();
                };
                reader.readAsDataURL(file);
            });
            e.target.value = '';
        });
    },

    updateImageStrip() {
        const strip = document.getElementById('meImagesStrip');
        if (!strip) return;
        const imgs = this.meSelectedImages || [];
        const countEl = document.getElementById('meImageCount');
        if (countEl) countEl.textContent = `${imgs.length}/4`;
        if (!imgs.length) { strip.style.display = 'none'; strip.innerHTML = ''; return; }
        strip.style.display = '';
        strip.innerHTML = imgs.map((img, i) => `
            <div class="me-img-thumb">
                <img src="${img.dataUrl}" alt="">
                <button class="me-img-remove" data-idx="${i}" title="Remove">✕</button>
            </div>
        `).join('');
        strip.querySelectorAll('.me-img-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.meSelectedImages.splice(+btn.dataset.idx, 1);
                this.updateImageStrip();
            });
        });
    },

    async submitPost() {
        const textarea  = document.getElementById('meComposerText');
        const sendBtn   = document.getElementById('meComposerSendBtn');
        const isLore    = document.getElementById('meIsLore')?.checked ?? true;
        const scheduleInput = document.getElementById('meScheduleTime');
        if (!textarea?.value.trim()) return;

        const scheduleVal = scheduleInput?.value;
        const scheduledFor = scheduleVal ? Math.floor(new Date(scheduleVal).getTime() / 1000) : null;

        sendBtn.disabled = true;
        sendBtn.textContent = '…';

        try {
            // If scheduled, use courier API
            if (scheduledFor) {
                const did = this.session?.did;
                const resp = await fetch(`/api/courier/schedule?user_did=${encodeURIComponent(did || '')}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.getToken()}`,
                    },
                    body: JSON.stringify({
                        post_text: textarea.value.trim(),
                        scheduled_for: scheduledFor,
                        is_lore: isLore,
                    }),
                });
                if (resp.ok) {
                    textarea.value = '';
                    if (scheduleInput) scheduleInput.value = '';
                    const row = document.getElementById('meScheduleRow');
                    if (row) row.style.display = 'none';
                    sendBtn.textContent = '✓ Scheduled';
                    const cc = document.getElementById('meCharCount');
                    if (cc) cc.textContent = '300';
                    // Reload scheduled list
                    this.panelsLoaded.compose = false;
                    setTimeout(() => {
                        sendBtn.textContent = 'Post';
                        sendBtn.disabled = true;
                        this.loadScheduledPosts();
                    }, 1500);
                } else {
                    const err = await resp.json().catch(() => ({}));
                    sendBtn.textContent = err.error || 'Error';
                    setTimeout(() => { sendBtn.textContent = 'Post'; sendBtn.disabled = false; }, 3000);
                }
                return;
            }

            // Immediate post — use oauthManager directly (supports images)
            const hasImages = this.meSelectedImages && this.meSelectedImages.length > 0;
            if (!window.oauthManager) throw new Error('OAuth manager not available. Please log in again.');

            const record = { text: textarea.value.trim(), createdAt: new Date().toISOString() };

            // Upload and embed images if any
            if (hasImages) {
                const embedImages = [];
                for (const img of this.meSelectedImages) {
                    const uploadResult = await window.oauthManager.uploadBlob(img.file, img.file.type);
                    embedImages.push({ alt: img.alt || '', image: uploadResult.blob });
                }
                record.embed = { $type: 'app.bsky.embed.images', images: embedImages };
            }

            await window.oauthManager.createPost(textarea.value.trim(), record);

            textarea.value = '';
            this.meSelectedImages = [];
            this.updateImageStrip();
            sendBtn.textContent = '✓ Posted';
            const cc = document.getElementById('meCharCount');
            if (cc) cc.textContent = '300';
            setTimeout(() => { sendBtn.textContent = 'Post'; sendBtn.disabled = true; }, 2000);
        } catch (_) {
            sendBtn.textContent = 'Error';
            setTimeout(() => { sendBtn.textContent = 'Post'; sendBtn.disabled = false; }, 2000);
        }
    },

    async loadScheduledPosts() {
        const list    = document.getElementById('meScheduledList');
        const countEl = document.getElementById('meScheduledCount');
        if (!list) return;

        try {
            const did = this.session?.did;
            if (!did) { list.innerHTML = ''; return; }

            const resp = await fetch(
                `/api/courier/scheduled?user_did=${encodeURIComponent(did)}&status=pending&limit=20`,
                { headers: { 'Authorization': `Bearer ${this.getToken()}` } }
            );
            if (!resp.ok) { list.innerHTML = '<div class="me-messages-empty">Could not load scheduled posts.</div>'; return; }

            const data = await resp.json();
            const posts = data.posts || data.scheduled || [];

            if (!posts.length) {
                list.innerHTML = '<div class="me-messages-empty">No scheduled posts.</div>';
                if (countEl) countEl.style.display = 'none';
                return;
            }

            if (countEl) {
                countEl.textContent = String(posts.length);
                countEl.style.display = '';
            }

            list.innerHTML = '';
            posts.forEach(post => {
                const schedTime = post.scheduled_for
                    ? new Date(post.scheduled_for * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—';
                const item = document.createElement('div');
                item.className = 'me-scheduled-item';
                item.innerHTML = `
                    <div class="me-scheduled-time">${this.escHtml(schedTime)}</div>
                    <div class="me-scheduled-text">${this.escHtml((post.post_text || '').slice(0, 120))}</div>
                    <button class="me-scheduled-cancel-btn" data-id="${post.id}" aria-label="Cancel">✕</button>
                `;
                item.querySelector('.me-scheduled-cancel-btn')?.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (!id) return;
                    if (!confirm('Cancel this scheduled post?')) return;
                    try {
                        await fetch(`/api/courier/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${this.getToken()}` },
                        });
                        item.remove();
                    } catch (_) {}
                });
                list.appendChild(item);
            });
        } catch (e) {
            console.error('[MePage] loadScheduledPosts error:', e);
            list.innerHTML = '<div class="me-messages-empty">Could not load scheduled posts.</div>';
        }
    },

    pickImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
    },

    /* ── MESSAGES panel ───────────────────────────────── */
    async loadMessagesPanel() {
        const area = document.getElementById('mePanelMessages');
        if (!area) return;
        area.innerHTML = '<div class="me-messages-area"><div class="me-panel-loading">Loading messages…</div></div>';

        // Initialize pagination state if not exists
        if (!this._msgPagination) {
            this._msgPagination = { page: 0, perPage: 6, showingTrash: false };
        }

        try {
            const did = this.session?.did;
            if (!did) {
                area.innerHTML = '<div class="me-messages-area"><div class="me-messages-empty">Log in to view messages.</div></div>';
                return;
            }

            // Fetch messages from the inbox API
            // Active view: default (server excludes dismissed). Trash view: request dismissed only.
            const statusParam = this._msgPagination.showingTrash ? '&status=dismissed' : '';
            const resp = await fetch(`/api/messages/inbox?user_did=${encodeURIComponent(did)}&limit=100${statusParam}`);
            const result = await resp.json();

            if (result.status !== 'success') throw new Error('Failed to load messages');

            const allMessages = result.data?.messages || [];
            const filtered = allMessages; // Server already filtered by status

            // Sort: unread first, then newest
            filtered.sort((a, b) => {
                if (a.status !== b.status) return a.status === 'unread' ? -1 : 1;
                return b.created_at - a.created_at;
            });

            // Update badge from server-side count
            const unreadCount = result.data?.unread || 0;
            const badge = document.getElementById('meMessageBadge');
            if (badge) {
                if (unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = ''; }
                else badge.style.display = 'none';
            }

            // Paginate
            const totalPages = Math.max(1, Math.ceil(filtered.length / this._msgPagination.perPage));
            this._msgPagination.page = Math.min(this._msgPagination.page, totalPages - 1);
            const start = this._msgPagination.page * this._msgPagination.perPage;
            const page = filtered.slice(start, start + this._msgPagination.perPage);

            // Build HTML
            let html = '<div class="me-messages-area">';

            if (this._msgPagination.showingTrash) {
                html += '<div class="me-msg-trash-notice">Messages are removed after one week</div>';
            }

            html += '<div class="me-message-list">';

            if (filtered.length === 0) {
                const emptyTitle = this._msgPagination.showingTrash ? 'Trash is empty' : 'No messages yet';
                const emptySub = this._msgPagination.showingTrash
                    ? 'Dismissed messages appear here temporarily.'
                    : 'Messages from other dreamweavers will appear here.';
                html += `<div class="me-messages-empty">${emptyTitle}<div class="me-messages-empty-sub">${emptySub}</div></div>`;
            } else {
                page.forEach(msg => {
                    const isUnread = msg.status === 'unread';
                    const isDismissed = msg.status === 'dismissed';
                    // Time ago
                    const timeStr = this.meTimeAgo(msg.created_at);
                    // Preview from API
                    const preview = msg.preview || '';
                    const title = msg.title || msg.dialogue_key || '(message)';
                    // Action button
                    const actionBtn = isDismissed
                        ? `<button class="me-msg-action-btn me-msg-restore-btn" data-id="${msg.id}">RESTORE</button>`
                        : `<button class="me-msg-action-btn me-msg-dismiss-btn" data-id="${msg.id}">DISMISS</button>`;

                    html += `
                        <div class="me-message-item${isUnread ? ' unread' : ''}" data-id="${msg.id}">
                            <div class="me-message-body">
                                <div class="me-message-title-row">
                                    <span class="me-message-sender">${this.escHtml(title)}</span>
                                    <span class="me-message-time">${timeStr}</span>
                                </div>
                                <div class="me-message-preview">${this.escHtml(preview)}</div>
                                <div class="me-message-meta">
                                    <span class="me-message-source">errantson</span>
                                    ${actionBtn}
                                </div>
                            </div>
                        </div>`;
                });
            }

            html += '</div>';

            // Pagination nav
            html += `
                <div class="me-msg-nav">
                    <button class="me-msg-nav-btn me-msg-trash-toggle">${this._msgPagination.showingTrash ? '← Messages' : 'Trash'}</button>
                    <div class="me-msg-nav-right">
                        <button class="me-msg-nav-btn me-msg-prev" ${this._msgPagination.page === 0 ? 'disabled' : ''}>←</button>
                        <span class="me-msg-nav-info">${filtered.length > 0 ? `${this._msgPagination.page + 1}/${totalPages}` : '—'}</span>
                        <button class="me-msg-nav-btn me-msg-next" ${this._msgPagination.page >= totalPages - 1 ? 'disabled' : ''}>→</button>
                    </div>
                </div>`;

            html += '</div>';
            area.innerHTML = html;

            // Bind handlers
            area.querySelectorAll('.me-message-item').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.me-msg-action-btn')) return;
                    const id = parseInt(row.dataset.id);
                    const msg = allMessages.find(m => m.id === id);
                    if (msg) this.openMessage(msg);
                });
            });
            area.querySelectorAll('.me-msg-dismiss-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    await fetch(`/api/messages/${id}/dismiss?user_did=${encodeURIComponent(did)}`, { method: 'POST' });
                    this.panelsLoaded.messages = false;
                    this.loadMessagesPanel();
                    this.loadMessageBadge();
                });
            });
            area.querySelectorAll('.me-msg-restore-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    await fetch(`/api/messages/${id}/read?user_did=${encodeURIComponent(did)}`, { method: 'POST' });
                    this.panelsLoaded.messages = false;
                    this.loadMessagesPanel();
                    this.loadMessageBadge();
                });
            });
            area.querySelector('.me-msg-trash-toggle')?.addEventListener('click', () => {
                this._msgPagination.showingTrash = !this._msgPagination.showingTrash;
                this._msgPagination.page = 0;
                this.panelsLoaded.messages = false;
                this.loadMessagesPanel();
            });
            area.querySelector('.me-msg-prev')?.addEventListener('click', () => {
                this._msgPagination.page = Math.max(0, this._msgPagination.page - 1);
                this.panelsLoaded.messages = false;
                this.loadMessagesPanel();
            });
            area.querySelector('.me-msg-next')?.addEventListener('click', () => {
                this._msgPagination.page++;
                this.panelsLoaded.messages = false;
                this.loadMessagesPanel();
            });

        } catch (e) {
            console.error('[MePage] loadMessagesPanel error:', e);
            area.innerHTML = '<div class="me-messages-area"><div class="me-messages-empty">Could not load messages.</div></div>';
        }
    },

    /* Time-ago helper for unix timestamps (seconds) */
    meTimeAgo(ts) {
        if (!ts) return '';
        const seconds = Math.floor(Date.now() / 1000) - ts;
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },

    async openMessage(msg) {
        try {
            const did = this.session?.did;
            const resp = await fetch(`/api/messages/${msg.id}?user_did=${encodeURIComponent(did)}`);
            if (!resp.ok) return;
            const result = await resp.json();
            const fullMsg = result.data || result;

            let messages;
            try { messages = JSON.parse(fullMsg.messages_json); } catch (_) { return; }

            const d = this.dreamer || {};
            const userContext = {
                name:   d.display_name || d.name || d.handle || 'dreamer',
                handle: d.handle || 'reverie.house',
                did:    did,
            };

            if (window.Shadowbox) {
                const sb = new window.Shadowbox({
                    showCloseButton: true,
                    onClose: async () => {
                        await fetch(`/api/messages/${msg.id}/read?user_did=${encodeURIComponent(did)}`, { method: 'POST' });
                        this.loadMessageBadge();
                        this.panelsLoaded.messages = false;
                        this.loadMessagesPanel();
                    },
                });
                await sb.showDialogueData({ key: fullMsg.dialogue_key, messages, userContext }, {});
            }
        } catch (e) {
            console.error('[MePage] openMessage error:', e);
        }
    },

    /* ── LOOK panel ───────────────────────────────────── */
    async loadLookPanel() {
        const area = document.getElementById('mePanelLook');
        if (!area) return;
        const d     = this.dreamer || {};
        const color = d.color_hex || '#734ba1';

        // Parse colour into R/G/B for the sliders
        const hexToRgb = (h) => {
            const c = h.replace('#', '');
            return { r: parseInt(c.slice(0,2),16)||0, g: parseInt(c.slice(2,4),16)||0, b: parseInt(c.slice(4,6),16)||0 };
        };
        const { r, g, b } = hexToRgb(color);

        // Fetch user's souvenir events to build owned-phanera list
        const currentPhanera = d.phanera || '';
        const allPhanera = [
            { key: '',               label: 'Collective' },
            { key: 'bell',           label: 'Bell' },
            { key: 'dream',          label: 'Dream' },
            { key: 'dream/strange',  label: 'Dream — Strange' },
            { key: 'invite',         label: 'Invite' },
            { key: 'letter',         label: 'Letter' },
            { key: 'residence',      label: 'Residence' },
            { key: 'residence/home', label: 'Residence — Home' },
        ];
        let availablePhanera = allPhanera; // fallback: show all
        try {
            const evResp = await fetch(
                `/api/events?did=${encodeURIComponent(d.did || '')}&type=souvenir&limit=200`
            );
            if (evResp.ok) {
                const evData = await evResp.json();
                const ownedKeys = new Set(
                    (Array.isArray(evData) ? evData : []).map(e => e.key).filter(Boolean)
                );
                availablePhanera = allPhanera.filter(o => o.key === '' || ownedKeys.has(o.key));
            }
        } catch (_) {}

        // Image path for phanera: collective → residence/phanera.png
        const getPhanImg = (k) => k ? `/souvenirs/${k}/phanera.png` : '/souvenirs/residence/phanera.png';
        const phaneraImg = getPhanImg(currentPhanera);

        const avatarUrl = d.avatar || '/assets/icon_face.png';

        area.innerHTML = `
            <div class="me-look-area">
                <div class="me-section">
                    <div class="me-section-header">
                        <span class="me-section-title">Avatar</span>
                    </div>
                    <div class="me-avatar-look-row">
                        <img class="me-avatar-look-img" id="meLookAvatarImg"
                             src="${this.escHtml(avatarUrl)}"
                             alt="Your avatar"
                             onerror="this.src='/assets/icon_face.png'">
                        <div class="me-avatar-look-actions">
                            <p class="me-avatar-look-explainer">Changing your avatar will update your profile across our wild mindscape, and may alter your appearance beyond the confines of <strong>Reverie House</strong>.</p>
                            <button class="me-tool-btn wide" id="meLookChangeAvatarBtn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Change Avatar
                            </button>
                            <span class="me-avatar-look-format">PNG or JPEG</span>
                        </div>
                    </div>
                </div>

                <div class="me-section">
                    <div class="me-section-header">
                        <span class="me-section-title">Colour</span>
                    </div>
                    <div class="me-colour-layout">
                        <div class="me-rgb-picker">
                            <div class="me-rgb-preview-row">
                                <div class="me-rgb-preview" id="meRgbPreview" style="background:${this.escHtml(color)}"></div>
                                <input type="text" class="me-rgb-hex" id="meRgbHex" value="${this.escHtml(color)}" maxlength="7" spellcheck="false">
                                <span class="me-colour-explainer">Affects how you appear across <strong>Reverie House</strong> and within our <strong>Shared History</strong>.</span>
                            </div>
                            <div class="me-rgb-row">
                                <span class="me-rgb-label me-rgb-r-label">R</span>
                                <input type="range" class="me-rgb-slider me-rgb-r" id="meRgbR" min="0" max="255" value="${r}">
                                <span class="me-rgb-val" id="meRgbRVal">${r}</span>
                            </div>
                            <div class="me-rgb-row">
                                <span class="me-rgb-label me-rgb-g-label">G</span>
                                <input type="range" class="me-rgb-slider me-rgb-g" id="meRgbG" min="0" max="255" value="${g}">
                                <span class="me-rgb-val" id="meRgbGVal">${g}</span>
                            </div>
                            <div class="me-rgb-row">
                                <span class="me-rgb-label me-rgb-b-label">B</span>
                                <input type="range" class="me-rgb-slider me-rgb-b" id="meRgbB" min="0" max="255" value="${b}">
                                <span class="me-rgb-val" id="meRgbBVal">${b}</span>
                            </div>
                            <div class="me-color-btn-row">
                                <button class="me-color-change-btn" id="meColorSaveBtn">Save</button>
                                <button class="me-color-reset-btn" id="meColorResetBtn">Reset</button>
                            </div>
                            <div class="me-phanera-save-msg" id="meColorSaveMsg"></div>
                        </div>
                    </div>
                </div>

                <div class="me-section">
                    <div class="me-section-header">
                        <span class="me-section-title">Phanera</span>
                    </div>
                    <select class="me-phanera-select" id="mePhaneraSel">
                        ${availablePhanera.map(o =>
                            `<option value="${this.escHtml(o.key)}"${o.key === currentPhanera ? ' selected' : ''}>${this.escHtml(o.label)}</option>`
                        ).join('')}
                    </select>
                    <div class="me-phanera-preview-wrap">
                        <img class="me-phanera-preview-img" id="mePhaneraPreviewImg"
                             src="${this.escHtml(phaneraImg)}"
                             alt="Phanera preview"
                             onerror="this.src='/assets/icon_face.png'">
                    </div>
                    <div class="me-phanera-save-msg" id="mePhaneraSaveMsg"></div>
                </div>
            </div>
        `;

        this.bindColorPicker();
        this.bindPhaneraSelect();

        // Avatar change button in Looks tab
        document.getElementById('meLookChangeAvatarBtn')?.addEventListener('click', () => {
            if (window.uploadAvatar?.initiate) {
                window.uploadAvatar.initiate();
            } else {
                window.dashboardWidget?.showAvatarUpload?.();
            }
        });
    },

    bindColorPicker() {
        const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
        const update = () => {
            const rv = +(document.getElementById('meRgbR')?.value ?? 0);
            const gv = +(document.getElementById('meRgbG')?.value ?? 0);
            const bv = +(document.getElementById('meRgbB')?.value ?? 0);
            const hex = `#${toHex(rv)}${toHex(gv)}${toHex(bv)}`;
            const prev = document.getElementById('meRgbPreview');
            const hexEl = document.getElementById('meRgbHex');
            if (prev) prev.style.background = hex;
            if (hexEl) hexEl.value = hex;
            const rVal = document.getElementById('meRgbRVal');
            const gVal = document.getElementById('meRgbGVal');
            const bVal = document.getElementById('meRgbBVal');
            if (rVal) rVal.textContent = rv;
            if (gVal) gVal.textContent = gv;
            if (bVal) bVal.textContent = bv;
        };
        ['meRgbR', 'meRgbG', 'meRgbB'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', update);
        });
        const hexInput = document.getElementById('meRgbHex');
        hexInput?.addEventListener('input', () => {
            let val = hexInput.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                const rr = parseInt(val.slice(1,3), 16);
                const gg = parseInt(val.slice(3,5), 16);
                const bb = parseInt(val.slice(5,7), 16);
                const rSlider = document.getElementById('meRgbR');
                const gSlider = document.getElementById('meRgbG');
                const bSlider = document.getElementById('meRgbB');
                if (rSlider) rSlider.value = rr;
                if (gSlider) gSlider.value = gg;
                if (bSlider) bSlider.value = bb;
                const prev = document.getElementById('meRgbPreview');
                if (prev) prev.style.background = val;
                const rVal = document.getElementById('meRgbRVal');
                const gVal = document.getElementById('meRgbGVal');
                const bVal = document.getElementById('meRgbBVal');
                if (rVal) rVal.textContent = rr;
                if (gVal) gVal.textContent = gg;
                if (bVal) bVal.textContent = bb;
            }
        });
        document.getElementById('meColorSaveBtn')?.addEventListener('click', () => this.saveColor());
        document.getElementById('meColorResetBtn')?.addEventListener('click', () => {
            // Reset sliders back to the stored color_hex
            const stored = this.dreamer?.color_hex || '#734ba1';
            const c = stored.replace('#', '');
            const rr = parseInt(c.slice(0,2), 16) || 0;
            const gg = parseInt(c.slice(2,4), 16) || 0;
            const bb = parseInt(c.slice(4,6), 16) || 0;
            const rSlider = document.getElementById('meRgbR');
            const gSlider = document.getElementById('meRgbG');
            const bSlider = document.getElementById('meRgbB');
            if (rSlider) rSlider.value = rr;
            if (gSlider) gSlider.value = gg;
            if (bSlider) bSlider.value = bb;
            update();
        });
    },

    bindPhaneraSelect() {
        const sel = document.getElementById('mePhaneraSel');
        const img = document.getElementById('mePhaneraPreviewImg');
        const msg = document.getElementById('mePhaneraSaveMsg');
        if (!sel) return;

        sel.addEventListener('change', async () => {
            const key = sel.value;
            // Update preview: empty = Collective → residence/phanera.png
            if (img) img.src = key ? `/souvenirs/${key}/phanera.png` : '/souvenirs/residence/phanera.png';

            if (msg) { msg.textContent = 'Saving…'; msg.className = 'me-phanera-save-msg'; }
            const token = this.getToken();
            if (!token) { if (msg) msg.textContent = 'Not logged in'; return; }

            try {
                const resp = await fetch('/api/dreamers/phanera', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ did: this.dreamer?.did, phanera: key }),
                });
                if (resp.ok) {
                    if (this.dreamer) this.dreamer.phanera = key;
                    if (msg) { msg.textContent = '✓ Saved'; msg.className = 'me-phanera-save-msg success'; }
                    setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
                } else {
                    const err = await resp.json().catch(() => ({}));
                    if (msg) { msg.textContent = err.error || 'Save failed'; msg.className = 'me-phanera-save-msg error'; }
                }
            } catch (e) {
                if (msg) { msg.textContent = 'Save failed'; msg.className = 'me-phanera-save-msg error'; }
            }
        });
    },

    async saveColor() {
        const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
        const rv = +(document.getElementById('meRgbR')?.value ?? -1);
        const gv = +(document.getElementById('meRgbG')?.value ?? -1);
        const bv = +(document.getElementById('meRgbB')?.value ?? -1);
        if (rv < 0) return;
        const val = `#${toHex(rv)}${toHex(gv)}${toHex(bv)}`;

        const msg = document.getElementById('meColorSaveMsg');

        const token = this.getToken();
        if (!token) return;

        try {
            const resp = await fetch('/api/dreamers/color', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ did: this.dreamer.did, color_hex: val }),
            });
            if (resp.ok) {
                document.documentElement.style.setProperty('--reverie-core-color', val);
                document.documentElement.style.setProperty('--user-color', val);
                if (this.dreamer) this.dreamer.color_hex = val;
                const saveBtn = document.getElementById('meColorSaveBtn');
                if (saveBtn) {
                    saveBtn.textContent = '✓ Saved';
                    setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
                }
            }
        } catch (e) {
            console.error('[MePage] saveColor error:', e);
        }
    },

    /* ── DETAILS panel ────────────────────────────────── */
    async loadDetailsPanel() {
        const area = document.getElementById('mePanelDetails');
        if (!area) return;
        const d        = this.dreamer || {};
        const bio      = d.description || '';
        const didShort = d.did ? d.did.replace('did:plc:', '') : '—';

        // Fetch the true arrival date from the events database
        let arrival = this.formatDate(d.arrival || d.created_at);
        try {
            const evResp = await fetch(
                `/api/events?did=${encodeURIComponent(d.did || '')}&type=arrival&limit=1`
            );
            if (evResp.ok) {
                const evData = await evResp.json();
                const evList = Array.isArray(evData) ? evData : [];
                if (evList.length > 0 && evList[0].epoch) {
                    arrival = new Date(evList[0].epoch * 1000).toLocaleDateString(
                        undefined, { month: 'short', day: 'numeric', year: 'numeric' }
                    );
                }
            }
        } catch (_) {}

        // Spectrum competing-bars section
        const sp = d.spectrum;

        // Octant box (centered, larger, with octant.css colors)
        const octantName = sp?.octant || '';
        const octantKey = octantName ? octantName.toLowerCase().replace(/\s+/g, '') : '';
        const octantBoxHtml = octantName ? `
            <div class="me-octant-box-wrap">
                <div class="me-octant-box octant-${this.escHtml(octantKey)}">
                    <span class="me-octant-box-label">${this.escHtml(octantName)}</span>
                </div>
            </div>` : '';

        const spectrumHtml = sp ? (() => {
            const pairs = [
                { l: { name: 'Oblivion',  val: sp.oblivion  ?? 0, col: '#9678b4' },
                  r: { name: 'Entropy',   val: sp.entropy   ?? 0, col: '#ff7850' } },
                { l: { name: 'Authority', val: sp.authority ?? 0, col: '#c83c3c' },
                  r: { name: 'Liberty',   val: sp.liberty   ?? 0, col: '#50b4ff' } },
                { l: { name: 'Skeptic',   val: sp.skeptic   ?? 0, col: '#ffc850' },
                  r: { name: 'Receptive', val: sp.receptive ?? 0, col: '#78dc9c' } },
            ];
            const barsHtml = pairs.map(({ l, r }) => {
                const total = (l.val + r.val) || 1;
                const pct   = Math.round((l.val / total) * 100);
                return `
                <div class="me-sp-pair">
                    <div class="me-sp-labels">
                        <span class="me-sp-label-l" style="color:${l.col}">${l.name}</span>
                        <span class="me-sp-label-r" style="color:${r.col}">${r.name}</span>
                    </div>
                    <div class="me-sp-track">
                        <div class="me-sp-gradient" style="background:linear-gradient(90deg,${l.col} 0%,${l.col}88 ${pct}%,${r.col}88 ${pct}%,${r.col} 100%)"></div>
                        <div class="me-sp-midline" style="left:${pct}%"></div>
                    </div>
                    <div class="me-sp-vals">
                        <span class="me-sp-val-l">${l.val}</span>
                        <span class="me-sp-val-r">${r.val}</span>
                    </div>
                </div>`;
            }).join('');
            return `
            <div class="me-section">
                <div class="me-section-header">
                    <span class="me-section-title">Spectrum</span>
                </div>
                ${octantBoxHtml}
                <div class="me-sp-bars">${barsHtml}</div>
            </div>`;
        })() : `
            <div class="me-section">
                <div class="me-section-header">
                    <span class="me-section-title">Spectrum</span>
                    <a href="/spectrum" class="me-section-action">Calculate</a>
                </div>
                <div class="me-messages-empty">No spectrum data yet.</div>
            </div>`;

        // Souvenirs section
        const souvenirs = d.souvenirs || {};
        const souvenirKeys = Object.keys(souvenirs);
        const souvenirsHtml = souvenirKeys.length > 0 ? (() => {
            const items = souvenirKeys.map(key => {
                const name = key.split('/').pop() || key;
                return `
                <div class="me-souvenir-bubble" title="${this.escHtml(name)}">
                    <img src="/souvenirs/${this.escHtml(key)}/icon.png"
                         alt="${this.escHtml(name)}"
                         onerror="this.src='/assets/icon_face.png'">
                </div>`;
            }).join('');
            return `
            <div class="me-section">
                <div class="me-section-header">
                    <span class="me-section-title">Souvenirs</span>
                </div>
                <div class="me-souvenirs-grid">${items}</div>
            </div>`;
        })() : '';

        // Pseudonyms display (clickable to swap)
        const pseudonymsHtml = (() => {
            if (!d.alt_names || !d.alt_names.trim() || d.alt_names === 'none') return 'none';
            const names = d.alt_names.split(',').map(n => n.trim()).filter(n => n);
            return names.map(name =>
                `<span class="me-alt-name-link" data-name="${this.escHtml(name)}" title="Tap to set as primary">${this.escHtml(name)}</span>`
            ).join(', ');
        })();

        // Delete Account: only for reverie.house residents
        const handle = d.handle || '';
        const isResident = handle === 'reverie.house' || handle.endsWith('.reverie.house');
        const deleteAccountHtml = isResident ? `
            <div class="me-section me-delete-section">
                <button class="me-delete-account-btn" id="meDeleteAccountBtn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete Account
                </button>
            </div>` : '';

        area.innerHTML = `
            <div class="me-details-area">

                <div class="me-section me-account-section">
                    <div class="me-section-header">
                        <span class="me-section-title">Account</span>
                    </div>
                    <div class="me-info-grid">
                        <div class="me-info-cell me-info-cell--wide">
                            <div class="me-info-cell-label">Contribution</div>
                            <div class="me-info-cell-value me-contribution-row" id="meContributionValue"><span class="me-contrib-loading">…</span></div>
                        </div>
                        <div class="me-info-cell">
                            <div class="me-info-cell-label">Arrived</div>
                            <div class="me-info-cell-value">${this.escHtml(arrival)}</div>
                        </div>
                        <div class="me-info-cell">
                            <div class="me-info-cell-label">Name</div>
                            <div class="me-info-cell-value" id="meDetailName">${this.escHtml(d.name || d.display_name || d.handle || '—')}</div>
                        </div>
                        <div class="me-info-cell">
                            <div class="me-info-cell-label">Handle</div>
                            <div class="me-info-cell-value">${this.escHtml(d.handle || '—')}</div>
                        </div>
                        <div class="me-info-cell">
                            <div class="me-info-cell-label">Pseudonyms</div>
                            <div class="me-info-cell-value me-info-cell-value--dim" id="mePseudonyms" title="${this.escHtml(d.alt_names || 'none')}">${pseudonymsHtml}</div>
                        </div>
                        <div class="me-info-cell me-info-cell--wide">
                            <div class="me-info-cell-label">Dreamer ID</div>
                            <div class="me-info-cell-value" id="meDreamerIdValue" title="${this.escHtml(d.did || '')}">${this.escHtml(didShort)}</div>
                        </div>
                    </div>
                </div>

                <div class="me-section">
                    <div class="me-section-header">
                        <span class="me-section-title">Bio</span>
                    </div>
                    <div class="me-bio-block">
                        <textarea class="me-bio-textarea" id="meBioText"
                            placeholder="Tell the mindscape who you are…"
                            maxlength="256"
                            rows="4">${this.escHtml(bio)}</textarea>
                        <div class="me-bio-footer">
                            <button class="me-save-btn" id="meBioSaveBtn">Save Bio</button>
                        </div>
                    </div>
                </div>

                ${spectrumHtml}

                ${souvenirsHtml}

                ${deleteAccountHtml}

            </div>
        `;

        document.getElementById('meBioSaveBtn')?.addEventListener('click', () => {
            const btn = document.getElementById('meBioSaveBtn');
            if (btn) { btn.textContent = 'Coming soon'; setTimeout(() => { btn.textContent = 'Save Bio'; }, 2000); }
        });

        // Async contribution calculation
        this.loadContribution(d);

        // Pseudonym swap handlers
        area.querySelectorAll('.me-alt-name-link').forEach(link => {
            link.addEventListener('click', () => this.swapNameWithAlt(link.dataset.name));
        });

        // Delete Account handler
        document.getElementById('meDeleteAccountBtn')?.addEventListener('click', () => this.handleDeleteAccount());

        // Click-to-copy Dreamer ID
        const didEl = document.getElementById('meDreamerIdValue');
        if (didEl && d.did) {
            didEl.style.cursor = 'pointer';
            didEl.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(d.did);
                    const orig = didEl.textContent;
                    didEl.textContent = 'copied!';
                    setTimeout(() => { didEl.textContent = orig; }, 1200);
                } catch (_) {}
            });
        }
    },

    /* ── Contribution loader (async, like dashboard) ── */
    async loadContribution(d) {
        const el = document.getElementById('meContributionValue');
        if (!el || !d.did) return;

        let canonCount = 0, loreCount = 0;

        const renderContrib = (canon, lore, patron) => {
            const total = (canon * 30) + (lore * 10) + patron;
            el.innerHTML = `
                <span class="me-contrib-total">${total}</span>
                <span class="me-contrib-breakdown">${canon} canon · ${lore} lore · ${patron} patron</span>`;
        };

        // Check sessionStorage cache (5 min TTL)
        const cacheKey = `lore_counts_${d.did}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < 5 * 60 * 1000) {
                    renderContrib(data.canonCount, data.loreCount, d.patronage || 0);
                    return;
                }
            } catch (_) {}
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const resp = await fetch(
                `https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=at://${d.did}/*&limit=1000`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (resp.ok) {
                const data = await resp.json();
                (data.labels || []).forEach(label => {
                    if (label.uri?.startsWith(`at://${d.did}/`)) {
                        if (label.val === 'canon:reverie.house') canonCount++;
                        else if (label.val === 'lore:reverie.house') loreCount++;
                    }
                });
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(), data: { canonCount, loreCount }
                }));
            }
        } catch (_) {
            canonCount = d.canon_contribution || 0;
            loreCount = d.lore_contribution || 0;
        }

        renderContrib(canonCount, loreCount, d.patronage || 0);
    },

    /* ── Pseudonym swap (like dashboard) ── */
    async swapNameWithAlt(altName) {
        try {
            const token = this.getOAuthToken();
            if (!token) { alert('You must be logged in to change your primary name'); return; }

            const resp = await fetch('/api/user/set-primary-name', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: altName })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to swap name');
            }

            const result = await resp.json();

            // Update local dreamer data
            if (this.dreamer) {
                this.dreamer.name = result.primary_name;
                this.dreamer.alt_names = result.alt_names;
            }

            // Update Name cell in detail grid
            const nameEl = document.getElementById('meDetailName');
            if (nameEl) nameEl.textContent = result.primary_name;

            // Update Pseudonyms cell
            const pseudEl = document.getElementById('mePseudonyms');
            if (pseudEl) {
                if (!result.alt_names || !result.alt_names.trim() || result.alt_names === 'none') {
                    pseudEl.textContent = 'none';
                } else {
                    const names = result.alt_names.split(',').map(n => n.trim()).filter(n => n);
                    pseudEl.innerHTML = names.map(name =>
                        `<span class="me-alt-name-link" data-name="${this.escHtml(name)}" title="Tap to set as primary">${this.escHtml(name)}</span>`
                    ).join(', ');
                    pseudEl.querySelectorAll('.me-alt-name-link').forEach(link => {
                        link.addEventListener('click', () => this.swapNameWithAlt(link.dataset.name));
                    });
                }
                pseudEl.title = result.alt_names || 'none';
            }

            // Update header display name
            const headerName = document.getElementById('meDisplayName');
            if (headerName) headerName.textContent = result.primary_name;

        } catch (e) {
            console.error('[MePage] swapNameWithAlt error:', e);
            alert(`Failed to swap name: ${e.message}`);
        }
    },

    /* ── Delete Account handler ── */
    handleDeleteAccount() {
        const session = window.oauthManager?.getSession?.();
        if (!session) return;

        const handle = this.dreamer?.handle || '';
        const isResident = handle === 'reverie.house' || handle.endsWith('.reverie.house');
        if (!isResident) return;

        // Ensure deleteaccount.js is loaded
        const openModal = () => {
            if (window.deleteAccountModal) {
                window.deleteAccountModal.open(session);
            } else if (window.DeleteAccountModal) {
                window.deleteAccountModal = new window.DeleteAccountModal();
                window.deleteAccountModal.open(session);
            } else {
                alert('Delete Account feature is loading. Please try again in a moment.');
            }
        };

        // Lazy-load the script if not present
        if (!document.querySelector('script[src*="js/widgets/deleteaccount.js"]')) {
            const s = document.createElement('script');
            s.src = '/js/widgets/deleteaccount.js';
            s.onload = openModal;
            document.head.appendChild(s);
        } else {
            openModal();
        }
    },

    logout() {
        // Use the styled logout popup from loginWidget
        if (window.loginWidget && typeof window.loginWidget.showLogoutPopup === 'function') {
            const session = this.session || {};
            window.loginWidget.showLogoutPopup({
                avatar: this.dreamer?.avatar || session.avatar || '/assets/icon_face.png',
                displayName: this.dreamer?.display_name || session.displayName || session.handle || 'Dreamer',
                handle: this.dreamer?.handle || session.handle || ''
            });
        } else if (window.oauthManager && typeof window.oauthManager.logout === 'function') {
            window.oauthManager.logout();
        } else {
            localStorage.removeItem('oauth_token');
            localStorage.removeItem('admin_token');
            window.location.reload();
        }
    },

    /* ── ROLES panel ──────────────────────────────────── */
    async loadRolesPanel() {
        const area = document.getElementById('mePanelRoles');
        if (!area) return;
        area.innerHTML = '<div class="me-roles-area"><div class="me-panel-loading">Loading roles…</div></div>';

        try {
            const did = this.session?.did;
            if (!did) {
                area.innerHTML = '<div class="me-roles-area"><div class="me-messages-empty">Log in to view roles.</div></div>';
                return;
            }

            // Load RoleConfigs if not already available
            if (!window.RoleConfigs) {
                await new Promise((resolve, reject) => {
                    if (document.querySelector('script[src*="roleConfigs.js"]')) { resolve(); return; }
                    const s = document.createElement('script');
                    s.src = '/js/roles/roleConfigs.js';
                    s.onload = resolve;
                    s.onerror = () => reject(new Error('Failed to load roleConfigs'));
                    document.head.appendChild(s);
                });
            }

            // Pre-load StepDown widget
            if (!window.StepDownWidget && !document.querySelector('script[src*="stepdown.js"]')) {
                const s = document.createElement('script');
                s.src = '/js/widgets/stepdown.js';
                document.head.appendChild(s);
            }

            const resp = await fetch(`/api/dreamers/${encodeURIComponent(did)}/roles`);
            const roles = resp.ok ? await resp.json() : [];

            if (!roles.length) {
                area.innerHTML = `
                    <div class="me-roles-area">
                        <div class="me-messages-empty">
                            No active roles yet.<br>
                            Visit the <a href="/work" style="color:var(--reverie-core-color,#734ba1)">Open Workshop</a> to get involved.
                        </div>
                    </div>`;
                return;
            }

            area.innerHTML = `
                <div class="me-roles-area">
                    <div class="me-section">
                        <div class="me-section-header">
                            <span class="me-section-title">Your Roles</span>
                            <span class="me-section-count">${roles.length}</span>
                        </div>
                    </div>
                    <div class="me-role-list" id="meRoleList"></div>
                    <div class="me-roles-cta"><a href="/work">Open Workshop →</a></div>
                </div>`;

            const list = document.getElementById('meRoleList');
            roles.forEach(({ role, work_status, last_activity, activated_at }) => {
                const key = (role || '').toLowerCase();
                const cfg = window.RoleConfigs?.getRole?.(key) || {};
                const title = cfg.title || (role ? role.charAt(0).toUpperCase() + role.slice(1) : role);
                const icon = cfg.icon || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
                const colorVar = cfg.color || 'var(--reverie-core-color, #734ba1)';
                const colorDarkVar = cfg.colorDark || colorVar;
                const colorLightVar = cfg.colorLight || 'rgba(115,75,161,0.12)';

                // Relative time for last activity
                let activityLabel = '';
                if (last_activity) {
                    const diff = Date.now() - new Date(last_activity).getTime();
                    const mins = Math.floor(diff / 60000);
                    const hours = Math.floor(mins / 60);
                    const days = Math.floor(hours / 24);
                    if (days > 0) activityLabel = `${days}d ago`;
                    else if (hours > 0) activityLabel = `${hours}h ago`;
                    else if (mins > 0) activityLabel = `${mins}m ago`;
                    else activityLabel = 'just now';
                }

                // Tenure since activation
                let tenureLabel = '';
                if (activated_at) {
                    const diff = Date.now() - new Date(activated_at).getTime();
                    const days = Math.floor(diff / 86400000);
                    const months = Math.floor(days / 30);
                    const years = Math.floor(months / 12);
                    const remMonths = months % 12;
                    if (years > 1) tenureLabel = remMonths ? `since ${years} years, ${remMonths} month${remMonths > 1 ? 's' : ''} ago` : `since ${years} years ago`;
                    else if (years === 1) tenureLabel = remMonths ? `since 1 year, ${remMonths} month${remMonths > 1 ? 's' : ''} ago` : `since 1 year ago`;
                    else if (months > 1) tenureLabel = `since ${months} months ago`;
                    else if (months === 1) tenureLabel = `since 1 month ago`;
                    else if (days > 1) tenureLabel = `since ${days} days ago`;
                    else if (days === 1) tenureLabel = `since yesterday`;
                    else tenureLabel = 'since today';
                }

                const desc = cfg.description || '';

                const item = document.createElement('div');
                item.className = 'me-role-card';
                item.style.cssText = `border-left: 3px solid ${colorVar}; background: linear-gradient(90deg, ${colorLightVar} 0%, transparent 100%);`;
                item.innerHTML = `
                    <div class="me-role-card-top">
                        <div class="me-role-card-icon" style="color: ${colorVar};">
                            ${icon}
                        </div>
                        <div class="me-role-card-title" style="color: ${colorDarkVar};">${this.escHtml(title)}</div>
                    </div>
                    <div class="me-role-card-desc">${desc}</div>
                    <div class="me-role-card-footer">
                        ${tenureLabel ? `<span class="me-role-card-tenure" style="color:${colorDarkVar};">${tenureLabel}</span>` : ''}
                        ${activityLabel ? `<span class="me-role-card-activity">${this.escHtml(activityLabel)}</span>` : ''}
                        <button class="me-role-stepdown-btn" data-role="${this.escHtml(key)}" title="Step down from ${this.escHtml(title)}">STEP DOWN</button>
                    </div>
                `;
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.me-role-stepdown-btn')) return;
                    window.location.href = '/work';
                });
                item.querySelector('.me-role-stepdown-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.stepDownRole(key);
                });
                list.appendChild(item);
            });
        } catch (e) {
            console.error('[MePage] loadRolesPanel error:', e);
            area.innerHTML = '<div class="me-roles-area"><div class="me-messages-empty">Could not load roles.</div></div>';
        }
    },

    /* ── CANON panel ──────────────────────────────────── */
    async loadCanonPanel() {
        const area = document.getElementById('mePanelCanon');
        if (!area) return;
        area.innerHTML = '<div class="me-canon-area"><div class="me-panel-loading">Loading canon…</div></div>';

        try {
            const did = this.session?.did;
            if (!did) {
                area.innerHTML = '<div class="me-canon-area"><div class="me-messages-empty">Log in to view canon.</div></div>';
                return;
            }

            // Load EventStack + dependencies (same as profile.js)
            await this._ensureEventStack();

            // Fetch all canon events (full data with avatars/colors) — same source as profile.js
            const resp = await fetch('/api/canon');
            if (!resp.ok) throw new Error('Failed to load events');

            const raw = await resp.json();
            const allEvents = Array.isArray(raw) ? raw : [];

            // Filter to this user's events + events they reacted to + events where they appear in others[]
            const didLower = did.toLowerCase();
            const dreamerEvents = allEvents.filter(entry => {
                const isOwn      = entry.did?.toLowerCase() === didLower;
                const isReaction = entry.reaction_did?.toLowerCase() === didLower;
                const isInOthers = Array.isArray(entry.others) &&
                    entry.others.some(d => d?.toLowerCase() === didLower);
                return isOwn || isReaction || isInOthers;
            });

            // Deduplicate by id
            const seen = new Set();
            const uniqueEvents = dreamerEvents.filter(e => {
                if (seen.has(e.id)) return false;
                seen.add(e.id);
                return true;
            });

            if (!uniqueEvents.length) {
                area.innerHTML = '<div class="me-canon-area"><div class="me-messages-empty">No events recorded yet.</div></div>';
                return;
            }

            // Build wrapper with section header
            const wrapper = document.createElement('div');
            wrapper.className = 'me-canon-area';
            wrapper.innerHTML = `
                <div class="me-section">
                    <div class="me-section-header">
                        <span class="me-section-title">Your Shared History</span>
                        <span class="me-section-count">${uniqueEvents.length}</span>
                    </div>
                </div>`;

            const listEl = document.createElement('div');
            listEl.style.cssText = 'padding: 0 4px 0 0;';
            wrapper.appendChild(listEl);

            area.innerHTML = '';
            area.appendChild(wrapper);

            // Render with EventStack (same as /database mobile view)
            if (window.EventStack) {
                const eventStack = new EventStack();
                eventStack.render(uniqueEvents, listEl, {
                    columns: { type: false, epoch: false, key: false, uri: false },
                    dateFormat: 'date'
                });
            } else {
                listEl.innerHTML = '<div class="me-messages-empty">Unable to render events.</div>';
            }

        } catch (e) {
            console.error('[MePage] loadCanonPanel error:', e);
            area.innerHTML = '<div class="me-canon-area"><div class="me-messages-empty">Could not load canon.</div></div>';
        }
    },

    /* ── EventStack lazy-loader ───────────────────────── */
    _ensureEventStack() {
        if (window.EventStack) return Promise.resolve();

        const load = src => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(s);
        });

        // Load rowstyle deps + showpost first (EventStack uses them if present), then EventStack
        return Promise.all([
            load('/js/core/rowstyle-registry.js'),
            load('/js/core/rowstyle-engine.js'),
            load('/js/utils/num_nom.js'),
            load('/js/widgets/showpost.js'),
        ]).then(() => load('/js/widgets/eventstack.js'));
    },

    /* ── TOOLS panel ──────────────────────────────────── */
    async loadToolsPanel() {
        const area = document.getElementById('mePanelTools');
        if (!area) return;
        area.innerHTML = '<div class="me-tools-area"><div class="me-panel-loading">Loading…</div></div>';

        try {
            const d = this.dreamer || {};
            const token = this.getToken();
            const did = this.session?.did;

            // Check app password status — correct endpoint
            let isConnected = false;
            let credDate = null;
            if (did) {
                try {
                    const credResp = await fetch(`/api/credentials/status?user_did=${encodeURIComponent(did)}`);
                    if (credResp.ok) {
                        const credData = await credResp.json();
                        isConnected = credData.has_credentials || false;
                        credDate = credData.connected_at || null;
                    }
                } catch (_) {}
            }

            // Build handle options
            const availableHandles = [];
            if (d.name) availableHandles.push(`${d.name}.reverie.house`);
            if (d.alt_names) {
                d.alt_names.split(',').map(a => a.trim()).filter(a => a)
                    .forEach(alt => availableHandles.push(`${alt}.reverie.house`));
            }
            const currentHandle = d.handle || '';

            const handleToolHtml = availableHandles.length > 1 ? `
                <div class="me-tool-row">
                    <span class="me-tool-label">Handle</span>
                    <select class="me-tool-select" id="meToolHandleSelect">
                        ${availableHandles.map(h =>
                            `<option value="${this.escHtml(h)}" ${h === currentHandle ? 'selected' : ''}>@${this.escHtml(h)}</option>`
                        ).join('')}
                    </select>
                    <button class="me-tool-btn" id="meToolHandleSetBtn">SET</button>
                </div>
            ` : '';

            const appPassHtml = isConnected ? `
                <div class="me-tool-row">
                    <span class="me-tool-label">App Pass</span>
                    <span class="me-tool-detail">${credDate ? 'Updated ' + this.formatDate(credDate) : 'Connected'}</span>
                    <button class="me-tool-btn danger" id="meToolDisconnectAppPassBtn">REMOVE</button>
                </div>
            ` : `
                <div class="me-tool-row">
                    <span class="me-tool-label">App Pass</span>
                    <input type="text" class="me-tool-input" id="meToolAppPassInput"
                           placeholder="xxxx-xxxx-xxxx-xxxx" maxlength="19"
                           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                    <button class="me-tool-btn" id="meToolConnectAppPassBtn">CONNECT</button>
                </div>
            `;

            area.innerHTML = `
                <div class="me-tools-area">
                    <div class="me-section">
                        <div class="me-section-header">
                            <span class="me-section-title">Tools</span>
                        </div>
                        <div class="me-tool-list">
                            <hr class="me-tool-divider">
                            <div class="me-tool-row" id="meToolLoreRow">
                                <span class="me-tool-label">Lore</span>
                                <span class="me-tool-detail">loading…</span>
                            </div>
                            ${handleToolHtml || `
                            <div class="me-tool-row">
                                <span class="me-tool-label">Handle</span>
                                <span class="me-tool-detail">${this.escHtml(currentHandle || '—')}</span>
                            </div>`}
                            <div class="me-tool-row">
                                <span class="me-tool-label">Invites</span>
                                <span class="me-tool-detail" id="meToolInviteCount">loading…</span>
                                <button class="me-tool-btn" id="meToolInvitesBtn">CODES</button>
                            </div>
                            <div class="me-tool-row" id="meToolShieldRow">
                                <span class="me-tool-label">Guard</span>
                                <span class="me-tool-detail">loading…</span>
                            </div>
                            <div class="me-tool-row">
                                <span class="me-tool-label">Moderation</span>
                                <span class="me-tool-detail" id="meToolModDetail">loading…</span>
                                <button class="me-tool-btn" id="meModerationBtn">OPEN</button>
                            </div>
                            ${appPassHtml}
                        </div>
                    </div>
                </div>`;

            // Invites
            document.getElementById('meToolInvitesBtn')?.addEventListener('click', () => {
                this.meShowInvitesModal();
            });

            // Moderation
            document.getElementById('meModerationBtn')?.addEventListener('click', () => {
                this.openModerationPanel();
            });

            // Load moderation counts from guardian lists API
            try {
                const did = this.session?.did;
                if (did) {
                    const modResp = await fetch(`/api/guardian/${encodeURIComponent(did)}/lists`);
                    if (modResp.ok) {
                        const modData = await modResp.json();
                        const barredDreamers = (modData.barred_users || []).length;
                        const barredDreams = (modData.barred_content || []).length;
                        const allowedDreamers = (modData.allowed_users || []).length;
                        const allowedDreams = (modData.allowed_content || []).length;
                        const modEl = document.getElementById('meToolModDetail');
                        if (modEl) {
                            modEl.textContent = `${barredDreamers}:${barredDreams} barred · ${allowedDreamers}:${allowedDreams} allowed`;
                            modEl.title = `${barredDreamers} dreamers, ${barredDreams} dreams barred | ${allowedDreamers} dreamers, ${allowedDreams} dreams allowed`;
                        }
                    } else {
                        const modEl = document.getElementById('meToolModDetail');
                        if (modEl) modEl.textContent = '0:0 barred · 0:0 allowed';
                    }
                } else {
                    const modEl = document.getElementById('meToolModDetail');
                    if (modEl) modEl.textContent = '0:0 barred · 0:0 allowed';
                }
            } catch (_) {
                const modEl = document.getElementById('meToolModDetail');
                if (modEl) modEl.textContent = '0:0 barred · 0:0 allowed';
            }

            // Handle change — standalone, reads #meToolHandleSelect
            if (availableHandles.length > 1) {
                document.getElementById('meToolHandleSetBtn')?.addEventListener('click', async () => {
                    const sel = document.getElementById('meToolHandleSelect');
                    if (!sel) return;
                    const name = sel.value.replace(/\.reverie\.house$/, '');
                    const btn = document.getElementById('meToolHandleSetBtn');
                    if (btn) { btn.disabled = true; btn.textContent = '…'; }
                    try {
                        const resp = await fetch('/api/user/set-primary-name', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ name }),
                        });
                        if (!resp.ok) throw new Error(await resp.text());
                        const data = await resp.json();
                        if (this.dreamer) {
                            this.dreamer.handle = data.handle || sel.value;
                            this.dreamer.name   = data.primary_name || name;
                        }
                        if (btn) { btn.disabled = false; btn.textContent = '✓'; }
                        setTimeout(() => { if (btn) btn.textContent = 'SET'; }, 2000);
                    } catch (err) {
                        console.error('[MePage] handle change failed:', err);
                        if (btn) { btn.disabled = false; btn.textContent = 'ERR'; }
                        setTimeout(() => { if (btn) btn.textContent = 'SET'; }, 2000);
                    }
                });
            }

            // App password — standalone, reads #meToolAppPassInput
            if (isConnected) {
                document.getElementById('meToolDisconnectAppPassBtn')?.addEventListener('click', async () => {
                    const btn = document.getElementById('meToolDisconnectAppPassBtn');
                    if (btn) { btn.disabled = true; btn.textContent = '…'; }
                    try {
                        const resp = await fetch(`/api/credentials/disconnect?user_did=${encodeURIComponent(did)}`, {
                            method: 'POST',
                        });
                        if (!resp.ok) throw new Error(await resp.text());
                        this.loadToolsPanel();
                    } catch (err) {
                        console.error('[MePage] disconnect app pass failed:', err);
                        if (btn) { btn.disabled = false; btn.textContent = 'REMOVE'; }
                    }
                });
            } else {
                const appPassInput = document.getElementById('meToolAppPassInput');
                appPassInput?.addEventListener('input', (e) => {
                    let v = e.target.value.replace(/[-\s]/g, '');
                    if (v.length > 16) v = v.slice(0, 16);
                    e.target.value = v.match(/.{1,4}/g)?.join('-') || v;
                });
                document.getElementById('meToolConnectAppPassBtn')?.addEventListener('click', async () => {
                    const input = document.getElementById('meToolAppPassInput');
                    const pass = input?.value.trim();
                    if (!pass) return;
                    const btn = document.getElementById('meToolConnectAppPassBtn');
                    if (btn) { btn.disabled = true; btn.textContent = '…'; }
                    try {
                        const resp = await fetch(`/api/credentials/connect?user_did=${encodeURIComponent(did)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ app_password: pass }),
                        });
                        if (!resp.ok) throw new Error(await resp.text());
                        this.loadToolsPanel();
                    } catch (err) {
                        console.error('[MePage] connect app pass failed:', err);
                        if (btn) { btn.disabled = false; btn.textContent = 'CONNECT'; }
                    }
                });
            }

            // Load invites counter and controls async
            this._loadToolsInviteCount();
            this._loadToolsControls();

        } catch (e) {
            console.error('[MePage] loadToolsPanel error:', e);
            area.innerHTML = '<div class="me-tools-area"><div class="me-messages-empty">Could not load tools.</div></div>';
        }
    },

    async _loadToolsInviteCount() {
        try {
            const token = this.getToken();
            if (!token) return;
            const resp = await fetch('/api/user/invites/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) return;
            const data = await resp.json();
            const el = document.getElementById('meToolInviteCount');
            if (el) el.textContent = data.total !== undefined
                ? `${data.redeemed_count || 0}/${data.total} redeemed`
                : '—';
        } catch (_) {}
    },

    async _loadToolsControls() {
        const loreRow = document.getElementById('meToolLoreRow');
        const shieldRow = document.getElementById('meToolShieldRow');
        if (!loreRow && !shieldRow) return;
        try {
            const token = this.getToken();
            const did = this.session?.did;
            if (!token || !did) return;

            // Check character status
            let isCharacter = false;
            try {
                const r = await fetch('/api/lore/character-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ did })
                });
                if (r.ok) { const d = await r.json(); isCharacter = d.is_character || false; }
            } catch (_) {}

            const shieldEnabled = this.dreamer?.community_shield !== false;

            if (loreRow) {
                loreRow.innerHTML = `
                    <span class="me-tool-label">Lore</span>
                    <span class="me-tool-detail">Approved for Lore</span>
                    <label class="me-toggle">
                        <input type="checkbox" id="meToolCharToggle" ${isCharacter ? 'checked' : ''}>
                        <span class="me-toggle-slider"></span>
                    </label>
                `;
            }
            if (shieldRow) {
                shieldRow.innerHTML = `
                    <span class="me-tool-label">Guard</span>
                    <span class="me-tool-detail">Community Guard</span>
                    <label class="me-toggle">
                        <input type="checkbox" id="meToolShieldToggle" ${shieldEnabled ? 'checked' : ''}>
                        <span class="me-toggle-slider"></span>
                    </label>
                `;
            }

            document.getElementById('meToolCharToggle')?.addEventListener('change', (e) => {
                window.dashboardWidget?.toggleCharacter?.(e.target.checked);
            });
            document.getElementById('meToolShieldToggle')?.addEventListener('change', (e) => {
                window.dashboardWidget?.toggleCommunityShield?.(e.target.checked);
            });

        } catch (e) {
            if (loreRow) loreRow.querySelector('.me-tool-detail').textContent = '—';
            if (shieldRow) shieldRow.querySelector('.me-tool-detail').textContent = '—';
        }
    },

    /* ── Standalone invites modal ─────────────────────── */
    async meShowInvitesModal() {
        const existing = document.querySelector('.invites-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'invites-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'invites-modal';
        modal.innerHTML = `
            <div class="invites-modal-header">
                <h2 class="invites-modal-title">Your Invite Codes</h2>
                <button class="invites-modal-close-btn" aria-label="Close">×</button>
            </div>
            <div class="invites-modal-body">
                <p class="invites-modal-description">
                    Share these codes to invite others to become resident dreamweavers at reverie.house.
                    Each code can only be used once.
                </p>
                <div class="invites-list" id="meInvitesList">
                    <div class="invites-loading">Loading your invite codes…</div>
                </div>
            </div>
            <div class="invites-modal-footer">
                <p class="invites-footer-note">Codes are generated when revealed and remain valid until used.</p>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const close = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        };

        modal.querySelector('.invites-modal-close-btn').addEventListener('click', close);
        modal.addEventListener('click', e => e.stopPropagation());
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        const escHandler = e => {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);

        await this.meLoadInvitesData();
    },

    async meLoadInvitesData() {
        const list = document.getElementById('meInvitesList');
        if (!list) return;
        try {
            const token = this.getToken();
            if (!token) {
                list.innerHTML = '<div class="invites-error">Authentication required.</div>';
                return;
            }
            const resp = await fetch('/api/user/invites/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error(`Server error (${resp.status})`);
            const data = await resp.json();
            this.meRenderInvites(list, data);
            // Keep the panel counter in sync
            const counter = document.getElementById('meToolInviteCount');
            if (counter && data.total !== undefined) {
                counter.textContent = `${data.redeemed_count || 0}/${data.total} redeemed`;
            }
        } catch (err) {
            console.error('[MePage] meLoadInvitesData error:', err);
            list.innerHTML = '<div class="invites-error">Failed to load invite codes. Please try again.</div>';
        }
    },

    meRenderInvites(list, data) {
        let html = '';
        (data.invites || []).forEach(invite => {
            const slotNum = String(invite.slot).padStart(2, '0');
            const isRevealed = invite.revealed;
            const isRedeemed = invite.redeemed;
            html += `
                <div class="invite-row ${isRedeemed ? 'redeemed' : ''}" data-slot="${invite.slot}">
                    <span class="invite-label">Invite ${slotNum}:</span>
                    <div class="invite-code-container">
                        ${isRevealed ? `
                            <span class="invite-code ${isRedeemed ? '' : 'clickable'}"
                                  data-code="${this.escHtml(invite.code || '')}"
                                  title="${isRedeemed ? 'This code has been redeemed' : 'Click to copy'}">
                                ${this.escHtml(invite.code || '')}
                            </span>
                            ${isRedeemed
                                ? '<span class="invite-status redeemed">✓ REDEEMED</span>'
                                : `<button class="invite-copy-btn" data-slot="${invite.slot}">COPY CODE</button>`
                            }
                        ` : `
                            <button class="invite-reveal-btn" data-slot="${invite.slot}">
                                <span class="reveal-blockout">████████████████████</span>
                                <span class="reveal-text">Click to reveal</span>
                            </button>
                        `}
                    </div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="invites-loading">No invite codes found.</div>';

        list.querySelectorAll('.invite-reveal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.meRevealInvite(parseInt(btn.dataset.slot), btn));
        });
        list.querySelectorAll('.invite-code.clickable').forEach(el => {
            el.addEventListener('click', () => this.meCopyInviteCode(el));
        });
        list.querySelectorAll('.invite-copy-btn').forEach(btn => {
            const row = btn.closest('.invite-row');
            const codeEl = row?.querySelector('.invite-code');
            if (codeEl) btn.addEventListener('click', () => this.meCopyInviteCode(codeEl, btn));
        });
    },

    async meRevealInvite(slot, btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="reveal-loading">Generating…</span>';
        try {
            const token = this.getToken();
            const resp = await fetch(`/api/user/invites/reveal/${slot}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!resp.ok) throw new Error(`Server error (${resp.status})`);
            await this.meLoadInvitesData();
        } catch (err) {
            console.error('[MePage] meRevealInvite error:', err);
            btn.disabled = false;
            btn.innerHTML = '<span class="reveal-error">Error — try again</span>';
        }
    },

    meCopyInviteCode(el, btn) {
        const code = el.dataset.code || el.textContent.trim();
        navigator.clipboard.writeText(code).then(() => {
            const orig = el.textContent;
            el.textContent = 'Copied!';
            el.classList.add('copied');
            setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 2000);
            if (btn) {
                const origBtn = btn.textContent;
                btn.textContent = 'COPIED!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = origBtn; btn.classList.remove('copied'); }, 2000);
            }
        }).catch(() => {
            const range = document.createRange();
            range.selectNode(el);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
        });
    },

    /* ── Share Lore ───────────────────────────────────── */
    handleShareLore() {
        const session = window.oauthManager?.getSession?.();
        if (!session) {
            window.loginWidget?.showLoginPopup?.();
            return;
        }

        if (window.shareLoreWidget) {
            window.shareLoreWidget.show();
        } else if (window.ShareLore) {
            window.shareLoreWidget = new window.ShareLore();
            window.shareLoreWidget.show();
        } else {
            const script = document.createElement('script');
            script.src = '/js/widgets/sharelore.js';
            script.onload = () => {
                if (window.ShareLore) {
                    window.shareLoreWidget = new window.ShareLore();
                    window.shareLoreWidget.show();
                }
            };
            document.head.appendChild(script);
        }
    },

    /* ── Moderation Panel ─────────────────────────────── */
    async openModerationPanel() {
        const session = window.oauthManager?.getSession?.();
        if (!session?.did) {
            alert('You must be logged in to access moderation settings.');
            return;
        }

        const displayName = this.dreamer?.display_name || session.profile?.displayName || 'You';

        // Lazy-load guardian panel if needed
        if (!window.guardianPanel) {
            try {
                await new Promise((resolve, reject) => {
                    if (document.querySelector('script[src*="guardianpanel.js"]')) {
                        const check = setInterval(() => {
                            if (window.guardianPanel) { clearInterval(check); resolve(); }
                        }, 100);
                        setTimeout(() => { clearInterval(check); reject(new Error('timeout')); }, 5000);
                        return;
                    }
                    const s = document.createElement('script');
                    s.src = '/js/widgets/guardianpanel.js';
                    s.onload = () => {
                        const check = setInterval(() => {
                            if (window.guardianPanel) { clearInterval(check); resolve(); }
                        }, 50);
                        setTimeout(() => { clearInterval(check); reject(); }, 3000);
                    };
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            } catch (_) {}
        }

        if (window.guardianPanel) {
            await window.guardianPanel.open(session.did, displayName, { selfModeration: true });
        } else {
            alert('Moderation panel is not available. Please refresh the page.');
        }
    },

    /* ── Role Step Down ───────────────────────────────── */
    async stepDownRole(roleKey) {
        // Ensure StepDown widget is loaded
        if (!window.StepDownWidget) {
            try {
                await new Promise((resolve, reject) => {
                    if (document.querySelector('script[src*="stepdown.js"]')) {
                        const check = setInterval(() => {
                            if (window.StepDownWidget) { clearInterval(check); resolve(); }
                        }, 100);
                        setTimeout(() => { clearInterval(check); reject(); }, 3000);
                        return;
                    }
                    const s = document.createElement('script');
                    s.src = '/js/widgets/stepdown.js';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            } catch (_) {}
        }

        if (!window.StepDownWidget) {
            alert('Step down feature is not available. Please refresh the page.');
            return;
        }

        window.StepDownWidget.show(roleKey, async () => {
            try {
                const token = this.getToken();
                const response = await fetch(`/api/work/${roleKey}/step-down`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to step down');

                // Refresh designation
                try {
                    await fetch('/api/user/refresh-designation', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (_) {}

                // Reload roles panel
                this.panelsLoaded['roles'] = false;
                this.loadRolesPanel();
            } catch (error) {
                console.error('[MePage] Failed to step down:', error);
                alert(`Failed to step down from this role.`);
            }
        });
    },

    /* ── Utilities ────────────────────────────────────── */
    escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g, '&#39;');
    },

    stripHtml(str) {
        return (str || '').replace(/<[^>]*>/g, '');
    },

    formatTime(dateStr) {
        if (!dateStr) return '';
        try {
            const d     = new Date(dateStr);
            const diffH = (Date.now() - d) / 3_600_000;
            if (diffH < 1)   return `${Math.floor(diffH * 60)}m`;
            if (diffH < 24)  return `${Math.floor(diffH)}h`;
            if (diffH < 168) return `${Math.floor(diffH / 24)}d`;
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (_) { return ''; }
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
            });
        } catch (_) { return dateStr; }
    },
};

/* ── Boot on DOM ready ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    window.meWidget = MePage;
    window.MePage   = MePage;
    MePage.init();
});
