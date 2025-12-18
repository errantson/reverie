class Drawer {
    constructor() {
        this.isOpen = false;
        this.animationDuration = 300;
        this.coreColor = '#87408d';
        this.loginsEnabled = false;
        this.loginsAlwaysShowPopup = true;
        this.loadCoreColor();
        this.loadStyles();
        this.render();
        this.initialize();
    }

    async loadCoreColor() {
        try {
            // Use centralized color manager
            if (window.colorManager) {
                await window.colorManager.init();
                this.coreColor = window.colorManager.getColor();
                
                // Apply color immediately to DOM before rendering
                document.documentElement.style.setProperty('--reverie-core-color', this.coreColor);
                document.documentElement.style.setProperty('--user-color', this.coreColor);
                console.log('🎨 Drawer: Initial color loaded:', this.coreColor);
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
                console.log('🎨 Drawer: Color changed to', this.coreColor, 'from source:', event.detail.source);
                // Force a repaint by updating a CSS variable
                document.documentElement.style.setProperty('--reverie-core-color', this.coreColor);
            });
        } catch (error) {
            console.warn('Drawer: Could not load config:', error);
        }
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/drawer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/drawer.css?v=19';
            document.head.appendChild(link);
        }

        // Load orientation handler utility
        if (!window.orientationHandler && !document.querySelector('script[src*="orientation-handler.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/utils/orientation-handler.js';
            document.head.appendChild(script);
        }
    }

    render() {
        const drawerHTML = `
            <!-- Drawer Backdrop Overlay for Mobile -->
            <div class="drawer-backdrop" id="drawerBackdrop"></div>
            <div id="spectrum-drawer" class="drawer-container closed">
                <!-- Drawer Header (visible as footer bar when closed) -->
                <div class="drawer-header">
                    <!-- Avatar Login Button (always present) -->
                    <button class="drawer-avatar-btn" id="drawerAvatarBtn" title="Login">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </button>
                    <!-- Firehose Status Indicator (hidden when logged in) -->
                    <div class="firehose-indicator" id="firehoseIndicator" title="Dream Monitor: Observing...">
                        <div class="firehose-light"></div>
                    </div>
                    <!-- User Info Section - name only (shown when logged in) -->
                    <div class="drawer-user-section" id="drawerUserSection" style="display: none;">
                        <span class="drawer-handle" id="drawerHandle"></span>
                    </div>
                    <!-- Inbox Counter Badge (shown when logged in, positioned right) -->
                    <div class="drawer-inbox-badge" id="drawerInboxCount" style="display: none;"></div>
                    <!-- Mobile: Login Button (shown when not logged in) -->
                    <button class="drawer-login-btn mobile-only" id="drawerLoginBtn" title="Login">
                        LOGIN
                    </button>
                    <!-- Desktop: Grip Indicator (centered) -->
                    <div class="drawer-grip desktop-only">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
                <!-- Drawer Content -->
                <div class="drawer-content">
                    <div class="drawer-body">
                        <!-- Content will go here -->
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', drawerHTML);
        const drawerElement = document.getElementById('spectrum-drawer');
    }

    initialize() {
        this.drawer = document.getElementById('spectrum-drawer');
        this.header = this.drawer.querySelector('.drawer-header');
        this.grip = this.drawer.querySelector('.drawer-grip');
        this.content = this.drawer.querySelector('.drawer-content');
        this.backdrop = document.getElementById('drawerBackdrop');

        this.checkDrawerAvailability();

        const savedState = sessionStorage.getItem('drawerState');
        const shouldBeOpen = savedState === 'open';

        this.drawer.classList.add('closed');
        this.drawer.classList.remove('open');
        this.isOpen = false;

        if (this.drawerAvailable) {
            this.header.addEventListener('click', (e) => {
                if (e.target.closest('.drawer-avatar-btn')) {
                    return;
                }
                e.stopPropagation();

                // Check if dialogue is active - don't allow interaction during dialogue
                if (window.DialogueManager && window.DialogueManager.isBlocked) {
                    console.log('🚫 [Drawer] Click blocked - dialogue is active');
                    return;
                }

                // Check if user is logged in
                const session = window.oauthManager?.getSession();
                
                if (!session) {
                    // Not logged in - show login popup
                    if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                        window.loginWidget.showLoginPopup();
                    }
                    return;
                }

                // Logged in - toggle drawer on desktop
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const isMobile = viewportWidth <= 768 && viewportHeight > viewportWidth;

                if (!isMobile) {
                    this.toggle();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    // Check if dialogue is active - Escape should close dialogue, not drawer
                    if (window.DialogueManager && window.DialogueManager.isBlocked) {
                        console.log('🚫 [Drawer] Escape blocked - dialogue is active');
                        return;
                    }
                    this.close();
                }
            });

            document.addEventListener('click', (e) => {
                if (!this.isOpen) return;

                // Check if dialogue is active - don't close drawer during dialogue
                if (window.DialogueManager && window.DialogueManager.isBlocked) {
                    return;
                }

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const isDesktop = (viewportWidth > viewportHeight) || (viewportWidth >= 768);

                // Don't close drawer if clicking on shadowbox overlay or image
                if (e.target.closest('.shadowbox-overlay, .shadowbox-image')) {
                    return;
                }

                // Don't close drawer if clicking on explainer popups/overlays
                if (e.target.closest('.axis-explainer-overlay, .axis-explainer-popup, .octant-explainer-overlay, .octant-explainer-popup')) {
                    return;
                }

                // Don't close drawer if clicking on dashboard modals
                if (e.target.closest('.edit-name-modal, .edit-avatar-modal, .dreamer-modal-overlay')) {
                    return;
                }

                // Don't close drawer if clicking on spectrum calculator modal
                if (e.target.closest('.spectrum-calculator-overlay, .spectrum-calculator-modal')) {
                    return;
                }

                if (isDesktop && !this.drawer.contains(e.target)) {
                    this.close();
                }
            });

            this.backdrop.addEventListener('click', () => {
                // Check if dialogue is active before allowing backdrop close
                if (window.DialogueManager && window.DialogueManager.isBlocked) {
                    console.log('🚫 [Drawer] Backdrop click blocked - dialogue is active');
                    return;
                }
                
                if (this.isOpen) {
                    this.close();
                }
            });

            this.drawer.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            this.setupLinkInterception();
            this.setupSwipeGestures();

            if (shouldBeOpen) {
                setTimeout(() => this.open(), 100);
            }
        }

        this.setupAvatarButton();
        this.setupFirehoseIndicator();
        this.setupDashboard();

        document.body.classList.add('has-spectrum-drawer');

        window.addEventListener('resize', () => {
            this.checkDrawerAvailability();
            if (this.isOpen) {
                this.recalculateDimensions();
            }
        });

        // Subscribe to orientation handler for robust orientation change detection
        if (window.orientationHandler) {
            this.orientationUnsubscribe = window.orientationHandler.subscribe((data) => {
                this.checkDrawerAvailability();
                if (this.isOpen) {
                    this.recalculateDimensions();
                }
            });
        } else {
            // Fallback: Handle orientation changes directly
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.checkDrawerAvailability();
                    if (this.isOpen) {
                        this.recalculateDimensions();
                    }
                }, 200);
            });

            // Also listen to screen orientation API if available
            if (screen.orientation) {
                screen.orientation.addEventListener('change', () => {
                    setTimeout(() => {
                        this.checkDrawerAvailability();
                        if (this.isOpen) {
                            this.recalculateDimensions();
                        }
                    }, 200);
                });
            }
        }

    }

    setupLinkInterception() {
        this.drawer.addEventListener('click', async (e) => {
            const link = e.target.closest('a');
            if (link && link.href && !link.target) {
                const url = link.href;
                if (url.includes('#') && url.split('#')[0] === window.location.href.split('#')[0]) {
                    return;
                }
                e.preventDefault();
                await this.close();
                window.location.href = url;
            }
        }, true);
    }

    setupSwipeGestures() {
        let touchStartY = 0;
        let touchStartX = 0;
        let touchStartTime = 0;
        let isDragging = false;
        this.wasSwiping = false;

        this.header.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            touchStartTime = Date.now();
            isDragging = true;
            this.wasSwiping = false;
        }, { passive: true });

        this.header.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const touchCurrentY = e.touches[0].clientY;
            const touchCurrentX = e.touches[0].clientX;
            const deltaY = Math.abs(touchCurrentY - touchStartY);
            const deltaX = Math.abs(touchCurrentX - touchStartX);

            if (deltaY > 10 || deltaX > 10) {
                this.wasSwiping = true;
            }
        }, { passive: true });

        this.header.addEventListener('touchend', (e) => {
            if (!isDragging) return;

            if (e.target.closest('.drawer-avatar-btn')) {
                isDragging = false;
                this.wasSwiping = false;
                return;
            }

            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const touchDuration = Date.now() - touchStartTime;
            const deltaY = touchEndY - touchStartY;
            const deltaX = touchEndX - touchStartX;
            const velocity = Math.abs(deltaY) / touchDuration;

            if (!this.wasSwiping) {
                // Check if dialogue is active before toggling
                if (window.DialogueManager && window.DialogueManager.isBlocked) {
                    console.log('🚫 [Drawer] Touch toggle blocked - dialogue is active');
                    isDragging = false;
                    return;
                }
                
                // Check if user is logged in - if not, show login popup instead of toggling
                const session = window.oauthManager?.getSession();
                if (!session) {
                    if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                        window.loginWidget.showLoginPopup();
                    }
                    isDragging = false;
                    return;
                }
                
                this.toggle();
                isDragging = false;
                return;
            }

            const minSwipeDistance = 30;
            const maxSwipeTime = 300;
            const minVelocity = 0.3;

            const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);

            if (isVerticalSwipe) {
                // Check if dialogue is active before allowing swipe gestures
                if (window.DialogueManager && window.DialogueManager.isBlocked) {
                    console.log('🚫 [Drawer] Swipe gesture blocked - dialogue is active');
                    isDragging = false;
                    return;
                }
                
                const isSwipeDown = deltaY > minSwipeDistance && velocity > minVelocity && touchDuration < maxSwipeTime;
                const isSwipeUp = deltaY < -minSwipeDistance && velocity > minVelocity && touchDuration < maxSwipeTime;

                if (isSwipeDown && this.isOpen) {
                    this.close();
                } else if (isSwipeUp && !this.isOpen) {
                    this.open();
                }
            } else {
                // Check if dialogue is active before allowing horizontal swipe
                if (window.DialogueManager && window.DialogueManager.isBlocked) {
                    console.log('🚫 [Drawer] Swipe gesture blocked - dialogue is active');
                    isDragging = false;
                    return;
                }
                
                const isSwipeRight = deltaX > minSwipeDistance && Math.abs(deltaX) / touchDuration > minVelocity;
                if (isSwipeRight && this.isOpen) {
                    this.close();
                }
            }

            isDragging = false;
            setTimeout(() => {
                this.wasSwiping = false;
            }, 100);
        }, { passive: true });
    }

    checkDrawerAvailability() {
        const minRequiredHeight = 700;
        const viewportHeight = window.innerHeight;
        this.drawerAvailable = viewportHeight >= minRequiredHeight;

        if (this.grip) {
            this.grip.style.display = this.drawerAvailable ? 'flex' : 'none';
        }

        if (this.header) {
            this.header.style.cursor = this.drawerAvailable ? 'pointer' : 'default';
        }

        if (!this.drawerAvailable && this.isOpen) {
            this.close();
        }
    }

    toggle() {
        if (!this.drawerAvailable) return;

        // Check if dialogue is active - don't allow drawer to open/close during dialogue
        if (window.DialogueManager && window.DialogueManager.isBlocked) {
            console.log('🚫 [Drawer] Toggle blocked - dialogue is active');
            return;
        }

        if (this.isOpen) {
            this.close_drawer();
        } else {
            this.open_drawer();
        }
    }

    async open_drawer() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth <= 768;

        if (isMobile) {
            return;
        }
        
        if (this.isOpen || !this.drawerAvailable) return;

        this.isOpen = true;

        const isMobilePortrait = viewportWidth <= 768 && viewportHeight > viewportWidth;
        if (isMobilePortrait && this.backdrop) {
            this.backdrop.classList.add('visible');
        }

        this.drawer.classList.remove('closed');
        this.drawer.classList.add('open');
        sessionStorage.setItem('drawerState', 'open');

        this.recalculateDimensions();

    }

    recalculateDimensions() {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const isDesktop = (viewportWidth > viewportHeight) || (viewportWidth >= 768);

        if (isDesktop) {
            const pageHeaderHeight = window.location.pathname.startsWith('/books') ? 56 : (document.body.classList.contains('has-fixed-header') ? (viewportWidth <= 768 ? 70 : 80) : 0);
            const availableHeight = viewportHeight - pageHeaderHeight - 20; // Reduced bottom margin from 40 to 20
            const drawerHeaderHeight = 64;
            const contentHeight = 600; // Increased from 400 to 600
            const padding = 120; // Increased from 96 to 120
            const neededHeight = drawerHeaderHeight + contentHeight + padding + 20;
            const totalDrawerHeight = Math.min(neededHeight, availableHeight);

            this.drawer.style.setProperty('height', `${totalDrawerHeight}px`, 'important');
            this.drawer.style.setProperty('max-height', `${totalDrawerHeight}px`, 'important');
        } else {
            this.drawer.style.setProperty('height', '100vh', 'important');
            this.drawer.style.setProperty('max-height', '100vh', 'important');
        }

        if (this.content) {
            this.content.style.setProperty('flex', '1', 'important');
            this.content.style.setProperty('min-height', '0', 'important');
        }
    }

    close_drawer() {
        if (!this.isOpen) return Promise.resolve();

        return new Promise((resolve) => {
            this.isOpen = false;

            if (this.backdrop) {
                this.backdrop.classList.remove('visible');
            }

            this.drawer.classList.add('closing');
            this.drawer.classList.remove('open');
            this.drawer.style.maxHeight = '';
            sessionStorage.setItem('drawerState', 'closed');

            setTimeout(() => {
                this.drawer.classList.add('closed');
                this.drawer.classList.remove('closing');
                resolve();
            }, 750);
        });
    }

    open() { return this.open_drawer(); }
    close() { return this.close_drawer(); }

    cleanup() {
        if (this.firehoseStatusInterval) {
            clearInterval(this.firehoseStatusInterval);
            this.firehoseStatusInterval = null;
        }
        if (this.dashboard) {
            this.dashboard = null;
        }
        if (this.orientationUnsubscribe) {
            this.orientationUnsubscribe();
            this.orientationUnsubscribe = null;
        }
    }

    setupDashboard() {
        // Load user-status utility first
        if (!window.UserStatus) {
            const userStatusScript = document.createElement('script');
            userStatusScript.src = '/js/utils/user-status.js';
            document.head.appendChild(userStatusScript);
        }
        
        // Load dialogue widget if not already loaded (needed for errantson help)
        if (!window.dialogue) {
            const dialogueScript = document.createElement('script');
            dialogueScript.src = '/js/widgets/dialogue.js';
            document.head.appendChild(dialogueScript);
        }
        
        // Load AppPasswordRequest widget before Dashboard
        if (!window.AppPasswordRequest) {
            const appPassScript = document.createElement('script');
            appPassScript.src = '/js/widgets/apppassreq.js';
            appPassScript.onload = () => {
                console.log('✅ [Drawer] AppPasswordRequest loaded');
                this.loadDashboard();
            };
            document.head.appendChild(appPassScript);
        } else {
            this.loadDashboard();
        }
    }
    
    loadDashboard() {
        if (!window.Dashboard) {
            const script = document.createElement('script');
            script.src = '/js/widgets/dashboard.js?v=27';
            script.onload = () => {
                // Load composer widget for standalone post composition
                if (!window.ComposerWidget) {
                    const composerScript = document.createElement('script');
                    composerScript.src = '/js/widgets/composer.js';
                    document.head.appendChild(composerScript);
                    
                    const composerCSS = document.createElement('link');
                    composerCSS.rel = 'stylesheet';
                    composerCSS.href = '/css/widgets/composer.css';
                    document.head.appendChild(composerCSS);
                }
                
                // Load shadowbox widget for phanera image clicks
                if (!window.Shadowbox) {
                    const shadowboxScript = document.createElement('script');
                    shadowboxScript.src = '/js/widgets/shadowbox.js';
                    shadowboxScript.onload = () => this.initDashboard();
                    document.head.appendChild(shadowboxScript);
                } else {
                    this.initDashboard();
                }
            };
            document.head.appendChild(script);
        } else {
            // Load composer widget if not already loaded
            if (!window.ComposerWidget) {
                const composerScript = document.createElement('script');
                composerScript.src = '/js/widgets/composer.js';
                document.head.appendChild(composerScript);
                
                const composerCSS = document.createElement('link');
                composerCSS.rel = 'stylesheet';
                composerCSS.href = '/css/widgets/composer.css';
                document.head.appendChild(composerCSS);
            }
            
            if (!window.Shadowbox) {
                const shadowboxScript = document.createElement('script');
                shadowboxScript.src = '/js/widgets/shadowbox.js';
                shadowboxScript.onload = () => this.initDashboard();
                document.head.appendChild(shadowboxScript);
            } else {
                this.initDashboard();
            }
        }

        window.addEventListener('oauth:login', () => {
            // Don't update avatar immediately - wait for profile-loaded event
            // which fires after profile data is fully loaded
            setTimeout(() => this.initDashboard(), 500);
        });

        window.addEventListener('oauth:logout', () => {
            const drawerBody = this.drawer.querySelector('.drawer-body');
            if (drawerBody && this.dashboard) {
                this.dashboard = null;
                drawerBody.innerHTML = '';
            }
            
            // Force repaint by temporarily hiding and showing the drawer
            // This ensures CSS variable changes are applied
            if (this.drawer) {
                const originalDisplay = this.drawer.style.display;
                this.drawer.style.display = 'none';
                // Force reflow
                void this.drawer.offsetHeight;
                this.drawer.style.display = originalDisplay || '';
            }
        });

        window.addEventListener('oauth:profile-loaded', () => {
            // Profile is fully loaded, now update avatar with fresh data
            this.updateAvatarButton();
            setTimeout(() => this.initDashboard(), 500);
        });
    }

    initDashboard() {
        if (!window.Dashboard) {
            return;
        }

        const drawerBody = this.drawer.querySelector('.drawer-body');
        if (!drawerBody) {
            return;
        }

        if (!this.dashboard) {
            this.dashboard = new Dashboard(drawerBody);
            window.dashboardWidget = this.dashboard;
        } else {
            this.dashboard.init();
        }
    }

    setupFirehoseIndicator() {
        this.checkFirehoseStatus();
        this.firehoseStatusInterval = setInterval(() => this.checkFirehoseStatus(), 30000);
    }

    async checkFirehoseStatus() {
        const indicator = document.getElementById('firehoseIndicator');
        if (!indicator) return;

        try {
            const response = await fetch('/api/operations-status');
            const data = await response.json();

            const light = indicator.querySelector('.firehose-light');
            if (data.firehose && data.firehose.active) {
                light.classList.add('active');
                light.classList.remove('inactive', 'error');
                indicator.title = 'Dreaming Monitor - Active';
            } else if (data.firehose) {
                light.classList.add('inactive');
                light.classList.remove('active', 'error');
                indicator.title = 'Dreaming Monitor - Inactive';
            } else {
                light.classList.add('error');
                light.classList.remove('active', 'inactive');
                indicator.title = 'Dreaming Monitor - Error';
            }
        } catch (error) {
            const light = indicator.querySelector('.firehose-light');
            light.classList.add('error');
            light.classList.remove('active', 'inactive');
            indicator.title = 'Dream Monitor: Error';
        }
    }

    setupAvatarButton() {
        const avatarBtn = document.getElementById('drawerAvatarBtn');
        const loginBtn = document.getElementById('drawerLoginBtn');

        if (!avatarBtn) {
            return;
        }

        this.updateAvatarButton();

        const handleLoginClick = (e) => {
            e.stopPropagation();
            
            // Close any active dialogue (like errantson message)
            if (window.DialogueManager && typeof window.DialogueManager.hideActive === 'function') {
                window.DialogueManager.hideActive();
            }
            
            // Close shadowbox if it's showing
            if (window.Shadowbox && typeof window.Shadowbox.cleanup === 'function') {
                window.Shadowbox.cleanup();
            }

            const tryShowLogin = (attempts = 0) => {
                if (window.loginWidget) {
                }

                if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                    window.loginWidget.showLoginPopup();
                } else if (attempts < 10) {
                    setTimeout(() => tryShowLogin(attempts + 1), 100);
                } else {
                }
            };

            tryShowLogin();
        };

        avatarBtn.addEventListener('click', handleLoginClick);
        if (loginBtn) {
            loginBtn.addEventListener('click', handleLoginClick);
        }

        // Update avatar on logout
        window.addEventListener('oauth:logout', () => this.updateAvatarButton());
        
        // Update avatar when profile is fully loaded (not on initial login event)
        window.addEventListener('oauth:profile-loaded', () => {
            console.log('🎨 Drawer: Profile loaded, updating avatar button');
            this.updateAvatarButton();
        });
    }

    async updateAvatarButton() {
        const avatarBtn = document.getElementById('drawerAvatarBtn');
        const userSection = document.getElementById('drawerUserSection');
        const handle = document.getElementById('drawerHandle');
        const inboxCount = document.getElementById('drawerInboxCount');
        const firehoseIndicator = document.getElementById('firehoseIndicator');
        const loginBtn = document.getElementById('drawerLoginBtn');

        if (!avatarBtn) return;

        const session = window.oauthManager?.getSession();

        if (session) {
            // Fetch avatar from database (same as dashboard)
            let avatar = '/assets/icon_face.png';
            let displayName = session.displayName || session.handle;
            
            try {
                const response = await fetch('/api/dreamers');
                if (response.ok) {
                    const dreamers = await response.json();
                    const dreamer = dreamers.find(d => d.did === session.did);
                    if (dreamer) {
                        avatar = dreamer.avatar || avatar;
                        displayName = dreamer.display_name || dreamer.name || displayName;
                    }
                }
            } catch (error) {
                console.warn('Failed to fetch dreamer avatar from database:', error);
            }

            avatarBtn.innerHTML = `
                <img src="${avatar}" alt="${displayName}" 
                     class="drawer-avatar-image" onerror="this.src='/assets/icon_face.png'">
            `;
            avatarBtn.title = `Logged in as @${session.handle}`;

            if (userSection) {
                userSection.style.display = 'flex';
            }
            if (loginBtn) {
                loginBtn.style.display = 'none';
            }
            if (handle) {
                handle.textContent = displayName;
            }

            // Fetch and display inbox count
            if (inboxCount) {
                try {
                    // Get user DID from OAuth manager
                    const userDid = window.oauthManager?.currentSession?.did;
                    
                    if (userDid) {
                        const inboxResponse = await fetch(`/api/messages/inbox?user_did=${encodeURIComponent(userDid)}`);
                        if (inboxResponse.ok) {
                            const inboxData = await inboxResponse.json();
                            if (inboxData.status === 'success') {
                                const unreadCount = inboxData.data.unread || 0;
                                
                                if (unreadCount > 0) {
                                    inboxCount.textContent = unreadCount;
                                    inboxCount.style.display = 'flex';
                                } else {
                                    inboxCount.style.display = 'none';
                                }
                            } else {
                                inboxCount.style.display = 'none';
                            }
                        }
                    } else {
                        inboxCount.style.display = 'none';
                    }
                } catch (error) {
                    console.warn('Failed to fetch inbox count:', error);
                    inboxCount.style.display = 'none';
                }
            }

            if (firehoseIndicator) {
                firehoseIndicator.style.display = 'none';
            }
        } else {
            avatarBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            `;
            avatarBtn.title = 'Login';

            if (loginBtn) {
                loginBtn.style.display = 'block';
            }
            if (userSection) {
                userSection.style.display = 'none';
            }

            if (firehoseIndicator) {
                firehoseIndicator.style.display = 'flex';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        window.spectrumDrawer = new Drawer();
    } catch (error) {
    }

    if (sessionStorage.getItem('openDrawer') === 'true') {
        sessionStorage.removeItem('openDrawer');
        setTimeout(() => {
            if (window.spectrumDrawer && window.spectrumDrawer.drawerAvailable) {
                window.spectrumDrawer.open();
            }
        }, 500);
    }

    window.addEventListener('beforeunload', () => {
        if (window.spectrumDrawer) {
            window.spectrumDrawer.cleanup();
        }
    });

    let attempts = 0;
    const checkOAuthReady = () => {
        if (window.oauthManager && window.oauthManager.getSession) {
            if (window.spectrumDrawer) {
                window.spectrumDrawer.updateAvatarButton();
            }
        } else if (attempts < 20) {
            attempts++;
            setTimeout(checkOAuthReady, 100);
        }
    };

    setTimeout(checkOAuthReady, 100);
});

window.Drawer = Drawer;
