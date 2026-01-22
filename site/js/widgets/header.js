class Header {
    constructor() {
        this.coreColor = '#734ba1';
        this.loginsEnabled = false;
        this.mobileMenuOpen = false;
        
        // Render immediately for fast display
        this.loadStyles();
        this.render();
        this.initialize();
        
        // Load colors asynchronously (won't block rendering)
        this.loadCoreColor();
    }
    async loadCoreColor() {
        try {
            // Use centralized color manager
            if (window.colorManager) {
                await window.colorManager.init();
                this.coreColor = window.colorManager.getColor();
                console.log('🎨 Header: Color loaded from color manager:', this.coreColor);
                
                // Apply color to DOM
                document.documentElement.style.setProperty('--reverie-core-color', this.coreColor);
                document.documentElement.style.setProperty('--user-color', this.coreColor);
            }
            
            // Load world settings (for logins flag and other config)
            if (window.worldConfigCache) {
                const data = await window.worldConfigCache.fetch();
                
                if (data.hasOwnProperty('logins')) {
                    this.loginsEnabled = data.logins;
                }
            }
            
            // Listen for color changes
            window.addEventListener('reverie:color-changed', (event) => {
                this.coreColor = event.detail.color;
                console.log('🎨 Header: Color updated to', this.coreColor);
            });
        } catch (error) {
            console.warn('Header: Could not load config:', error);
        }
    }
    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/header.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/header.css';
            document.head.appendChild(link);
        }
    }
    render() {
        const isEnhancedReader = document.querySelector('#enhanced-reader');
        
        // Check for admin token
        const hasAdminToken = !!localStorage.getItem('admin_token');
        
        // Random dreamer emoji - pick one on page load, store pool for hover rotation
        this.dreamerEmojis = ['🧙‍♂️', '🧙‍♀️', '🧝‍♀️', '🕵️‍♀️', '👩‍🌾', '👨‍🍳', '👩‍🎨', '🧛‍♂️', '🙋‍♂️', '🙋‍♀️', '🧚‍♂️', '🧚‍♀️', '🧟‍♂️', '🙆‍♂️', '🤷‍♀️', '🤹‍♀️'];
        // Randomize the order
        this.dreamerEmojis.sort(() => Math.random() - 0.5);
        this.dreamerEmojiIndex = Math.floor(Math.random() * this.dreamerEmojis.length);
        const randomDreamerIcon = this.dreamerEmojis[this.dreamerEmojiIndex];
        
        const navItems = [
            { href: '/', icon: '🏰', title: 'Our Home' },
            { href: '/story', icon: '📜', title: 'Living Story' },
            { href: '/books', icon: '📚', title: 'Free Library', mobileHref: '/books/seeker/00' },
            { href: '/dreamers', icon: randomDreamerIcon, title: 'The Dreamweavers', isDreamerIcon: true },
            { href: '/work', icon: '🤝', title: 'Open Workshop' },
            { href: '/spectrum', icon: '🌌', title: 'Reverie Spectrum', hideOnMobile: true },
            { href: '/database', icon: '🔮', title: 'Shared History', hideOnMobile: true },
            { href: '/events', icon: '📅', title: 'Live Events', hideOnMobile: true, conveyorAnimation: true },
            { href: '/order', icon: '📦', title: 'Special Orders' }
        ];
        
        // Admin items in separate list
        const adminItems = [];
        if (hasAdminToken) {
            adminItems.push(
                { href: '/admin/quests.html', icon: '🎈', title: 'Quests' },
                { href: '/admin/bugs.html', icon: '🐛', title: 'Bugs' },
                { href: '/admin/dialogues.html', icon: '📣', title: 'Dialogues' },
                { href: '/admin/history.html', icon: '⌛', title: 'Edit History' },
                { href: '/admin/roles.html', icon: '👥', title: 'Roles' },
                { href: '/admin/wretching.html', icon: '🔮', title: 'Wretching' }
            );
        }
        
        // Add login/entrance button if not logged in
        const userSession = window.oauthManager?.getSession();
        if (!userSession) {
            navItems.push(
                { id: 'nav-login-btn', icon: '🚪', title: 'Entrance', isButton: true, action: 'login' }
            );
        }
        
        // Determine current page
        const path = window.location.pathname || '';
        const currentPageIndex = this.getCurrentPageIndex(navItems, path);
        const currentPage = navItems[currentPageIndex] || navItems[0]; // Fallback to first item if not found
        
        // Determine current admin page
        const currentAdminIndex = this.getCurrentPageIndex(adminItems, path);
        const currentAdminPage = adminItems[currentAdminIndex];
        const isOnAdminPage = currentAdminIndex >= 0 && currentAdminPage;
        
        const adminDropdownHTML = adminItems.length > 0 ? `
            <div class="nav-dropdown admin-dropdown">
                <button class="nav-dropdown-trigger" aria-label="Admin menu">
                    <span class="nav-current-icon">${isOnAdminPage && currentAdminPage ? currentAdminPage.icon : '⚙️'}</span>
                    <span class="nav-current-label">${isOnAdminPage && currentAdminPage ? currentAdminPage.title : 'Admin'}</span>
                    <span class="nav-dropdown-arrow">▼</span>
                </button>
                <div class="nav-dropdown-menu">
                    ${adminItems.map(item => {
                        const target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
                        return `<a href="${item.href}" class="nav-dropdown-item" ${target}>
                            <span class="nav-item-icon">${item.icon}</span>
                            <span class="nav-item-label">${item.title}</span>
                        </a>`;
                    }).join('')}
                    <button class="nav-dropdown-item" id="admin-logout-btn" data-action="admin-logout">
                        <span class="nav-item-icon">🔓</span>
                        <span class="nav-item-label">Logout Admin</span>
                    </button>
                </div>
            </div>
        ` : '';
        
        const desktopNavHTML = `
            <nav class="desktop-nav">
                ${adminDropdownHTML}
                <div class="nav-dropdown">
                    <button class="nav-dropdown-trigger" aria-label="Navigation menu">
                        <span class="nav-current-icon">${currentPage.icon}</span>
                        <span class="nav-current-label">${currentPage.title}</span>
                        <span class="nav-dropdown-arrow">▼</span>
                    </button>
                    <div class="nav-dropdown-menu">
                        ${navItems.filter(item => item.href !== '/').map(item => {
                            if (item.isButton) {
                                return `<button id="${item.id}" class="nav-dropdown-item" data-action="${item.action || 'login'}">
                                    <span class="nav-item-icon">${item.icon}</span>
                                    <span class="nav-item-label">${item.title}</span>
                                </button>`;
                            }
                            const target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
                            const conveyorClass = item.conveyorAnimation ? ' conveyor-icon' : '';
                            return `<a href="${item.href}" class="nav-dropdown-item${conveyorClass}" ${target}>
                                <span class="nav-item-icon">${item.icon}</span>
                                <span class="nav-item-label">${item.title}</span>
                            </a>`;
                        }).join('')}
                    </div>
                </div>
            </nav>
        `;
        const mobileNavHTML = `
            <div class="mobile-nav">
                <a href="/" class="mobile-logo-link">
                    <img src="/assets/logo.png" alt="Reverie House" class="mobile-logo">
                </a>
                <div class="mobile-center-group">
                    <button class="errantson-helper mobile-helper" id="errantson-helper-mobile" title="Need something? Click for errantson.">
                        <img src="/souvenirs/dream/strange/icon.png" alt="errantson">
                        <span class="helper-pulse"></span>
                    </button>
                    <div id="header-message-display-mobile" class="header-message-display mobile-message-display"></div>
                </div>
                <button class="hamburger-btn" id="hamburger-btn" aria-label="Menu">
                    <span class="hamburger-icon"></span>
                </button>
            </div>
            <div class="mobile-menu" id="mobile-menu">
                ${navItems.filter(item => !item.hideOnMobile).map(item => {
                    if (item.isButton) {
                        return `<button id="mobile-${item.id}" class="mobile-menu-item" data-action="login">
                            <span class="mobile-menu-icon">${item.icon}</span>
                            <span class="mobile-menu-text">${item.title}</span>
                        </button>`;
                    }
                    const mobileLink = item.mobileHref || item.href;
                    const target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
                    return `<a href="${mobileLink}" class="mobile-menu-item"${target}>
                        <span class="mobile-menu-icon">${item.icon}</span>
                        <span class="mobile-menu-text">${item.title}</span>
                    </a>`;
                }).join('')}
                ${adminItems.length > 0 ? `
                    <div class="mobile-menu-divider"></div>
                    ${adminItems.map(item => {
                        const target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
                        return `<a href="${item.href}" class="mobile-menu-item admin-item"${target}>
                            <span class="mobile-menu-icon">${item.icon}</span>
                            <span class="mobile-menu-text">${item.title}</span>
                        </a>`;
                    }).join('')}
                ` : ''}
            </div>
        `;
        if (isEnhancedReader) {
            const readerContent = document.querySelector('.reader-content');
            if (readerContent) {
                const headerHTML = `
                    <div class="reader-header">
                        <div class="header-unified">
                            <!-- Desktop: Logo -->
                            <a href="/" class="logo-link">
                                <img src="/assets/logo.png" alt="Reverie House" class="header-logo">
                            </a>
                            <!-- Center Group: errantson + Message Display -->
                            <div class="header-center-group">
                                <button class="errantson-helper" id="errantson-helper" title="Need something? Click for errantson.">
                                    <img src="/souvenirs/dream/strange/icon.png" alt="errantson">
                                    <span class="helper-pulse"></span>
                                </button>
                                <div id="header-message-display" class="header-message-display"></div>
                            </div>
                            <!-- Desktop: Beta Notice -->
                            <div class="beta-notice">
                                <small>Reverie House is supported by reading<br>
                                We recognize the value of your patronage<br>
                                Contact <strong>books@reverie.house</strong> for requests</small>
                            </div>
                            <!-- Desktop: Navigation Icons -->
                            ${desktopNavHTML}
                            <!-- Mobile: Navigation -->
                            ${mobileNavHTML}
                        </div>
                    </div>
                `;
                readerContent.insertAdjacentHTML('beforebegin', headerHTML);
            }
        } else {
            const headerHTML = `
                <div class="reader-header">
                    <div class="header-unified">
                        <!-- Desktop: Logo -->
                        <a href="/" class="logo-link">
                            <img src="/assets/logo.png" alt="Reverie House" class="header-logo">
                        </a>
                        <!-- Center Group: errantson + Message Display -->
                        <div class="header-center-group">
                            <button class="errantson-helper" id="errantson-helper" title="Need something? Click for errantson.">
                                <img src="/souvenirs/dream/strange/icon.png" alt="errantson">
                                <span class="helper-pulse"></span>
                            </button>
                            <div id="header-message-display" class="header-message-display"></div>
                        </div>
                        <!-- Desktop: Beta Notice -->
                        <div class="beta-notice">
                            <small>Reverie House is supported by reading<br>
                            We recognize the value of your patronage<br>
                            Contact <strong>books@reverie.house</strong> for requests</small>
                        </div>
                        <!-- Desktop: Navigation Icons -->
                        ${desktopNavHTML}
                        <!-- Mobile: Navigation -->
                        ${mobileNavHTML}
                    </div>
                </div>
            `;
            let headerContainer = document.querySelector("#header-container");
            if (!headerContainer) {
                headerContainer = document.createElement("div");
                headerContainer.id = "header-container";
                document.body.insertBefore(headerContainer, document.body.firstChild);
            }
            headerContainer.innerHTML = headerHTML;
        }
    }
    getCurrentPageIndex(navItems, path) {
        // Find which nav item matches current path
        if (path === '/' || path === '/index.html' || path === '/home') {
            return navItems.findIndex(item => item.href === '/');
        }
        if (path.includes('/books') || path.includes('/library')) {
            return navItems.findIndex(item => item.href === '/books');
        }
        if (path.includes('/dreamer')) {
            return navItems.findIndex(item => item.href === '/dreamers');
        }
        if (path.includes('/canon') || path.includes('/story') || path.includes('/lore')) {
            return navItems.findIndex(item => item.href === '/story');
        }
        if (path.includes('/work')) {
            return navItems.findIndex(item => item.href === '/work');
        }
        if (path.includes('/spectrum')) {
            return navItems.findIndex(item => item.href === '/spectrum');
        }
        if (path.includes('/database')) {
            return navItems.findIndex(item => item.href === '/database');
        }
        if (path.includes('/events')) {
            return navItems.findIndex(item => item.href === '/events');
        }
        if (path.includes('/order')) {
            return navItems.findIndex(item => item.href === '/order');
        }
        if (path.includes('/admin/quests')) {
            return navItems.findIndex(item => item.href === '/admin/quests.html');
        }
        if (path.includes('/admin/bugs')) {
            return navItems.findIndex(item => item.href === '/admin/bugs.html');
        }
        if (path.includes('/admin/dialogues')) {
            return navItems.findIndex(item => item.href === '/admin/dialogues.html');
        }
        return 0; // Default to first item (Home)
    }
    
    initialize() {
        this.setActiveNavigation();
        this.initializeReadingControls();
        this.initializeMobileMenu();
        this.initializeDesktopDropdown();
        this.initializeMessageRotator();
        this.initializeErrantsonHelper();
        this.initializeDreamerIconRotator();
        this.loadMessager();
        this.loadLogin();
        
        // Load SSE notification client
        this.loadSSEClient();
        
        // Initialize message badge
        this.updateMessageBadge();
        
        // Fallback polling every 5 minutes (only if SSE disconnected)
        setInterval(() => {
            if (!this.sseClient || !this.sseClient.isConnected()) {
                this.updateMessageBadge();
            }
        }, 300000); // 5 minutes
        
        document.body.classList.add('has-fixed-header');
    }
    
    loadSSEClient() {
        // Load SSE client script
        if (!document.querySelector('script[src*="sse-notifications.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/utils/sse-notifications.js';
            script.onload = () => {
                console.log('✅ [Header] SSE client loaded');
                this.setupSSENotifications();
            };
            document.head.appendChild(script);
        } else if (window.SSENotificationClient) {
            this.setupSSENotifications();
        }
    }
    
    setupSSENotifications() {
        // Get user DID from OAuth
        const userDid = window.oauthManager?.currentSession?.did;
        if (!userDid) {
            console.log('ℹ️ [Header] No user DID yet, waiting for OAuth...');
            // Listen for OAuth profile loaded event
            window.addEventListener('oauth:profile-loaded', () => {
                console.log('🔐 [Header] OAuth profile loaded, setting up SSE');
                this.setupSSENotifications();
            }, { once: true });
            return;
        }
        
        // Don't setup twice
        if (this.sseClient) {
            console.log('⚠️ [Header] SSE already setup');
            return;
        }
        
        console.log('🔌 [Header] Setting up SSE notifications for', userDid.substring(0, 30) + '...');
        
        // Create SSE client
        this.sseClient = new window.SSENotificationClient(userDid);
        
        // Handle new message events
        this.sseClient.on('new_message', (data) => {
            console.log('📨 [Header] New message via SSE:', data);
            this.updateMessageBadge();
            
            // Update dashboard badge (regardless of which tab is open)
            if (window.dashboardWidget && window.dashboardWidget.updateInitialMessageBadge) {
                window.dashboardWidget.updateInitialMessageBadge();
            }
            
            // Also reload messages list if the messages tab is currently open
            if (window.dashboardWidget && window.dashboardWidget.currentTab === 'messages') {
                window.dashboardWidget.loadMessagesTab();
            }
        });
        
        // Handle message count updates
        this.sseClient.on('message_count', (data) => {
            console.log('📊 [Header] Message count via SSE:', data);
            this.updateMessageBadgeFromData(data);
        });
        
        // Handle connection events
        this.sseClient.on('connected', () => {
            console.log('✅ [Header] SSE connected');
        });
        
        this.sseClient.on('disconnected', () => {
            console.log('🔌 [Header] SSE disconnected');
        });
        
        // Connect
        this.sseClient.connect();
    }
    
    updateMessageBadgeFromData(data) {
        // Toggle flashing animation based on unread message count
        const helperBtn = document.getElementById('errantson-helper');
        const helperBtnMobile = document.getElementById('errantson-helper-mobile');
        
        const hasUnread = data && data.unread > 0;
        
        if (helperBtn) {
            if (hasUnread) {
                helperBtn.classList.add('has-unread');
            } else {
                helperBtn.classList.remove('has-unread');
            }
        }
        
        if (helperBtnMobile) {
            if (hasUnread) {
                helperBtnMobile.classList.add('has-unread');
            } else {
                helperBtnMobile.classList.remove('has-unread');
            }
        }
    }
    
    async initializeMessageRotator() {
        // Load messages from API
        let messages = [
            {
                lines: [
                    'For any requests, contact',
                    'books@reverie.house'
                ]
            },
            {
                lines: [
                    'We are still growing',
                    'Everything is ephemeral'
                ]
            },
            {
                lines: [
                    'Our wild mindscape',
                    'beckons you'
                ]
            },
            {
                lines: [
                    'Everyone has a place',
                    'You can choose yours'
                ]
            },
            {
                lines: [
                    'Welcome, dreamer',
                    'Glad you made it'
                ]
            }
        ];
        
        // Try to load from API
        try {
            const response = await fetch('/api/header-rotator');
            if (response.ok) {
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    messages = data.messages;
                    console.log('🔄 Header: Loaded', messages.length, 'rotator messages from API');
                }
            }
        } catch (error) {
            console.warn('Header: Failed to load rotator messages from API, using defaults:', error);
        }
        
        const messageDisplay = document.getElementById('header-message-display');
        const messageDisplayMobile = document.getElementById('header-message-display-mobile');
        
        if (!messageDisplay && !messageDisplayMobile) return;
        
        let currentIndex = Math.floor(Math.random() * messages.length);
        
        // Function to render current message with fade transition
        const renderMessage = () => {
            const message = messages[currentIndex];
            
            // Update desktop version
            if (messageDisplay) {
                // Add fade-out class
                messageDisplay.classList.add('fade-out');
                
                // After fade-out completes, update content and fade back in
                setTimeout(() => {
                    messageDisplay.innerHTML = `<small>${message.lines.join('<br>')}</small>`;
                    messageDisplay.classList.remove('fade-out');
                    messageDisplay.classList.add('fade-in');
                    
                    // Remove fade-in class after animation
                    setTimeout(() => {
                        messageDisplay.classList.remove('fade-in');
                    }, 800);
                }, 600);
            }
            
            // Update mobile version
            if (messageDisplayMobile) {
                // Add fade-out class
                messageDisplayMobile.classList.add('fade-out');
                
                // After fade-out completes, update content and fade back in
                setTimeout(() => {
                    messageDisplayMobile.innerHTML = `<small>${message.lines.join('<br>')}</small>`;
                    messageDisplayMobile.classList.remove('fade-out');
                    messageDisplayMobile.classList.add('fade-in');
                    
                    // Remove fade-in class after animation
                    setTimeout(() => {
                        messageDisplayMobile.classList.remove('fade-in');
                    }, 800);
                }, 600);
            }
        };
        
        // Render initial message
        renderMessage();
        
        // Auto-rotate every 6 seconds (slower)
        this.messageRotatorInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % messages.length;
            renderMessage();
        }, 6000);
    }
    
    initializeErrantsonHelper() {
        const helperBtn = document.getElementById('errantson-helper');
        const helperBtnMobile = document.getElementById('errantson-helper-mobile');
        
        // Click handler for both desktop and mobile
        const clickHandler = () => {
            this.openErrantsonHelp();
        };
        
        if (helperBtn) {
            helperBtn.addEventListener('click', clickHandler);
        }
        
        if (helperBtnMobile) {
            helperBtnMobile.addEventListener('click', clickHandler);
        }
        
        // Check if user is new (hasn't seen introduction)
        const hasBeenIntroduced = localStorage.getItem('reverie_introduced');
        if (!hasBeenIntroduced) {
            // Add a subtle bounce animation to draw attention
            if (helperBtn) {
                helperBtn.classList.add('needs-attention');
                setTimeout(() => {
                    helperBtn.classList.remove('needs-attention');
                }, 5000);
            }
            if (helperBtnMobile) {
                helperBtnMobile.classList.add('needs-attention');
                setTimeout(() => {
                    helperBtnMobile.classList.remove('needs-attention');
                }, 5000);
            }
        }
    }
    
    initializeDreamerIconRotator() {
        // Find all nav icon elements (both in dropdown and mobile menu)
        const navIcons = document.querySelectorAll('.nav-item-icon, .mobile-menu-icon, .nav-current-icon');
        
        if (!navIcons.length) return;
        
        // Animation configs for each nav item
        const animations = {
            dreamers: {
                filter: (icon, parent) => parent && (parent.href?.includes('/dreamers') || this.getNavTitle(parent) === 'Dreamers'),
                onEnter: (icon) => {
                    let currentIndex = this.dreamerEmojiIndex;
                    
                    icon._interval = setInterval(() => {
                        currentIndex = (currentIndex + 1) % this.dreamerEmojis.length;
                        icon.textContent = this.dreamerEmojis[currentIndex];
                    }, 150);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        // Don't restore original emoji - keep whatever it landed on
                    };
                }
            },
            workshop: {
                filter: (icon, parent) => parent && (parent.href?.includes('/work') || this.getNavTitle(parent) === 'Workshop'),
                onEnter: (icon) => {
                    icon.style.display = 'inline-block';
                    let angle = 0;
                    let direction = 1;
                    
                    icon._interval = setInterval(() => {
                        angle += direction * 8;
                        if (angle >= 12 || angle <= -12) direction *= -1;
                        const scale = 1 + (Math.abs(angle) / 120); // Slight grow at extremes
                        icon.style.transform = `rotate(${angle}deg) scale(${scale})`;
                    }, 80);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        icon.style.transform = '';
                    };
                }
            },
            spectrum: {
                filter: (icon, parent) => parent && (parent.href?.includes('/spectrum') || this.getNavTitle(parent) === 'Spectrum'),
                onEnter: (icon) => {
                    icon.style.display = 'inline-block';
                    let hue = 0;
                    
                    icon._interval = setInterval(() => {
                        hue = (hue + 15) % 360;
                        // Fast smooth hue roll
                        icon.style.filter = `hue-rotate(${hue}deg) brightness(1.2)`;
                    }, 30);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        icon.style.transform = '';
                        icon.style.filter = '';
                    };
                }
            },
            order: {
                filter: (icon, parent) => parent && (parent.href?.includes('/order') || this.getNavTitle(parent) === 'Order'),
                onEnter: (icon) => {
                    icon.style.display = 'inline-block';
                    let phase = 0;
                    let isLifting = true;
                    let liftProgress = 0;
                    let restFrames = 0;
                    
                    icon._interval = setInterval(() => {
                        if (restFrames > 0) {
                            // Resting at the bottom
                            restFrames--;
                            return;
                        }
                        
                        if (isLifting) {
                            liftProgress += 0.08; // Slower up
                            icon.style.transform = `translateY(${-liftProgress * 10}px)`;
                            if (liftProgress >= 1) {
                                isLifting = false;
                            }
                        } else {
                            // Faster down
                            liftProgress -= 0.4;
                            if (liftProgress <= 0) {
                                liftProgress = 0;
                                isLifting = true;
                                // Add a little bounce
                                icon.style.transform = 'translateY(2px)';
                                setTimeout(() => {
                                    if (icon._interval) icon.style.transform = 'translateY(0)';
                                }, 100);
                                // Rest for longer before next lift
                                restFrames = 20; // Rest for 20 frames (1 second at 50ms intervals)
                            } else {
                                icon.style.transform = `translateY(${-liftProgress * 10}px)`;
                            }
                        }
                    }, 50);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        icon.style.transform = '';
                    };
                }
            },
            story: {
                filter: (icon, parent) => parent && (parent.href?.includes('/story') || this.getNavTitle(parent) === 'Story'),
                onEnter: (icon) => {
                    icon.style.display = 'inline-block';
                    let phase = 0;
                    
                    icon._interval = setInterval(() => {
                        phase += 0.25; // Faster, more fluid
                        // Unfurling scroll - smoother wave motion
                        const wave = Math.sin(phase) * 3;
                        const unfurl = Math.cos(phase * 0.6) * 2;
                        const rotate = Math.sin(phase * 0.5) * 6;
                        icon.style.transform = `translate(${wave}px, ${unfurl}px) rotate(${rotate}deg) scaleY(${1 + Math.sin(phase * 0.4) * 0.08})`;
                    }, 30);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        icon.style.transform = '';
                    };
                }
            },
            database: {
                filter: (icon, parent) => parent && (parent.href?.includes('/database') || this.getNavTitle(parent) === 'Database'),
                onEnter: (icon) => {
                    icon.style.display = 'inline-block';
                    let brightness = 1;
                    let direction = 1;
                    
                    icon._interval = setInterval(() => {
                        brightness += direction * 0.05;
                        if (brightness >= 1.5 || brightness <= 0.8) direction *= -1;
                        // Only glow, no scale
                        icon.style.filter = `brightness(${brightness}) drop-shadow(0 0 ${(brightness - 1) * 8}px rgba(138, 43, 226, 0.6))`;
                    }, 60);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        icon.style.transform = '';
                        icon.style.filter = '';
                    };
                }
            },
            entrance: {
                filter: (icon, parent) => {
                    const title = this.getNavTitle(parent);
                    return title === 'Entrance' || parent?.id?.includes('login');
                },
                onEnter: (icon) => {
                    icon.style.display = 'inline-block';
                    let phase = 0;
                    
                    icon._interval = setInterval(() => {
                        phase += 0.1;
                        // Door swings left and right smoothly
                        const rotation = Math.sin(phase) * 35; // Swings ±35 degrees
                        const glow = Math.abs(rotation) / 35 * 8;
                        icon.style.transform = `perspective(100px) rotateY(${rotation}deg)`;
                        icon.style.filter = `brightness(${1 + Math.abs(rotation) / 35 * 0.3}) drop-shadow(0 0 ${glow}px rgba(255, 215, 0, ${Math.abs(rotation) / 35 * 0.6}))`;
                    }, 50);
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        icon.style.transform = '';
                        icon.style.filter = '';
                    };
                }
            },
            library: {
                filter: (icon, parent) => parent && (parent.href?.includes('/books') || parent.href?.includes('/library') || this.getNavTitle(parent) === 'Library'),
                onEnter: (icon) => {
                    // Simple: book opens and pages turn - more books!
                    const books = ['📕', '📗', '📘', '📙', '📔', '📒'];
                    let bookIndex = 0;
                    let pageFlips = 0;
                    const maxFlips = 8; // More page flips
                    
                    icon._interval = setInterval(() => {
                        if (pageFlips < maxFlips) {
                            // Alternate between open book and colored book (simulating page turns)
                            icon.textContent = (pageFlips % 2 === 0) ? '📖' : books[bookIndex % books.length];
                            pageFlips++;
                            if (pageFlips % 2 === 0) {
                                bookIndex++;
                            }
                        } else {
                            // End on stack of books
                            icon.textContent = '📚';
                            clearInterval(icon._interval);
                        }
                    }, 180); // Slightly faster
                    
                    icon._cleanup = () => {
                        if (icon._interval) clearInterval(icon._interval);
                        // Always end on stack, not wherever it stopped
                        icon.textContent = '📚';
                    };
                }
            }
        };
        
        // Apply animations to matching icons
        navIcons.forEach(icon => {
            const parent = icon.closest('a, button, .nav-dropdown-trigger');
            if (!parent) return;
            
            // Find which animation applies
            for (const [name, config] of Object.entries(animations)) {
                if (config.filter(icon, parent)) {
                    parent.addEventListener('mouseenter', () => {
                        config.onEnter(icon);
                    });
                    
                    parent.addEventListener('mouseleave', () => {
                        if (icon._cleanup) {
                            icon._cleanup();
                            icon._cleanup = null;
                        }
                    });
                    break; // Only apply one animation per icon
                }
            }
        });
    }
    
    getNavTitle(element) {
        // Helper to extract nav title from various parent structures
        const label = element.querySelector('.nav-item-label, .mobile-menu-text, .nav-current-label');
        return label?.textContent || '';
    }
    
    async openErrantsonHelp() {
        console.log('🧙 [Header] Errantson button clicked');
        
        // FLOW: Check for unread messages first
        // - If unread messages exist: Open oldest unread message directly
        // - If no unread messages: Show default construction dialogue
        
        try {
            // Get user session for authentication and context
            const session = window.oauthManager?.getSession();
            const userDid = session?.did;
            
            if (!userDid) {
                console.warn('⚠️ [Header] No user session - showing default dialogue');
                throw new Error('Not authenticated');
            }
            
            console.log('📬 [Header] Checking for unread messages...');
            const response = await fetch(`/api/messages/inbox?user_did=${encodeURIComponent(userDid)}`);
            const result = await response.json();
            
            if (result.status === 'success' && result.data && result.data.messages && result.data.messages.length > 0) {
                // Filter for unread messages
                const unreadMessages = result.data.messages.filter(msg => msg.status === 'unread');
                
                if (unreadMessages.length > 0) {
                    // Sort by created_at ascending to get the oldest
                    unreadMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    const oldestMessage = unreadMessages[0];
                    
                    console.log(`📬 [Header] Opening oldest unread message (ID: ${oldestMessage.id})`);
                    
                    // Fetch full message details
                    const msgResponse = await fetch(`/api/messages/${oldestMessage.id}?user_did=${encodeURIComponent(userDid)}`);
                    const msgResult = await msgResponse.json();
                    
                    if (msgResult.status === 'success' && msgResult.data) {
                        const msg = msgResult.data;
                        
                        // Parse the messages JSON
                        let messages;
                        try {
                            messages = JSON.parse(msg.messages_json);
                        } catch (e) {
                            console.error('❌ [Header] Failed to parse messages_json:', e);
                            throw new Error('Invalid message format');
                        }
                        
                        // Build user context for variable replacement
                        const userContext = {
                            name: session.displayName || session.handle || 'dreamer',
                            handle: session.handle || 'reverie.house',
                            did: userDid
                        };
                        console.log('👤 [Header] User context:', userContext);
                        
                        // Show the message in a dialogue
                        if (window.Shadowbox) {
                            const shadowbox = new window.Shadowbox({
                                showCloseButton: true,
                                onClose: async () => {
                                    // Mark the message as read when dialogue closes
                                    try {
                                        const readResponse = await fetch(`/api/messages/${oldestMessage.id}/read?user_did=${encodeURIComponent(userDid)}`, {
                                            method: 'POST'
                                        });
                                        if (readResponse.ok) {
                                            console.log(`✅ [Header] Marked message ${oldestMessage.id} as read`);
                                            // Update badge after marking as read
                                            this.updateMessageBadge();
                                        } else {
                                            console.warn('⚠️ [Header] Failed to mark as read:', await readResponse.text());
                                        }
                                    } catch (e) {
                                        console.warn('⚠️ [Header] Error marking as read:', e);
                                    }
                                }
                            });
                            
                            // Create dialogue data structure with user context
                            const dialogueData = {
                                key: msg.dialogue_key,
                                messages: messages,
                                userContext: userContext
                            };
                            
                            await shadowbox.showDialogueData(dialogueData, this);
                            
                            return;
                        } else {
                            console.error('❌ [Header] Shadowbox not available');
                        }
                    }
                } else {
                    console.log('ℹ️ [Header] No unread messages - showing default dialogue');
                }
            } else {
                console.log('ℹ️ [Header] No messages found - showing default dialogue');
            }
        } catch (error) {
            console.error('❌ [Header] Error checking messages:', error);
        }
        
        // No unread messages (or error) - show default core:welcome dialogue
        console.log('🎭 [Header] Opening default shadowbox dialogue');
        if (window.Shadowbox) {
            const shadowbox = new window.Shadowbox({
                showCloseButton: false
            });
            
            await shadowbox.showDialogue('core:welcome');
        } else {
            console.error('❌ [Header] Shadowbox utility not loaded');
        }
    }
    
    // Dialogue button callbacks
    showDirectory() {
        console.log('📂 Showing directory...');
        // TODO: Implement directory view
        alert('Directory feature coming soon!');
    }
    
    showRealityQuestion() {
        console.log('🤔 Are you real?');
        const shadowbox = new window.Shadowbox({
            showCloseButton: true
        });
        
        const realityDialogue = {
            key: 'reality_question',
            messages: [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Yes. I am a real person.\nThese are my real words.\nI left them here for you.",
                    buttons: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Are you real?",
                    buttons: [
                        {
                            text: 'PRETTY SURE',
                            secondary: true,
                            rotating: true,
                            callback: 'showSharedReality'
                        }
                    ]
                }
            ]
        };
        
        // Add rotating text to the dialogue
        realityDialogue.messages[1].rotatingText = [
            'PRETTY SURE', 'I THINK SO', 'LIKELY', 'YES?', 'PROBABLY', 'I SUPPOSE'
        ];
        
        shadowbox.showDialogueData(realityDialogue, this);
    }
    
    showSharedReality() {
        console.log('🌍 Shared reality...');
        const shadowbox = new window.Shadowbox({
            showCloseButton: true
        });
        
        const sharedRealityDialogue = {
            key: 'shared_reality',
            messages: [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "We make what's real.\nThen, it lives between us.",
                    buttons: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Welcome to Reverie House.\nYou can explore from here.",
                    buttons: [
                        {
                            text: 'EXPLORE',
                            callback: 'end'
                        }
                    ]
                }
            ]
        };
        
        shadowbox.showDialogueData(sharedRealityDialogue, this);
    }
    
    getDialogueKeyForContext(context) {
        // Always show core:welcome message for now
        return 'core:welcome';
    }
    
    // Old context mapping - kept for future reference
    getDialogueKeyForContextOld(context) {
        // Special handling for homepage
        if (context === 'home') {
            const hasBeenIntroduced = localStorage.getItem('reverie_introduced');
            const experienceStarted = window.homepageScene && window.homepageScene.experienceStarted;
            
            if (hasBeenIntroduced || experienceStarted) {
                return 'header:context:home:return';
            } else {
                return 'header:context:home:first-time';
            }
        }
        
        // Map contexts to dialogue keys
        const contextMap = {
            'getting-started': 'header:context:getting-started',
            'story': 'header:context:story',
            'spectrum': 'header:context:spectrum',
            'dreamers': 'header:context:dreamers',
            'books': 'header:context:library',
            'souvenirs': 'header:context:souvenirs',
            'database': 'header:context:database',
            'work': 'header:context:work',
            'general': 'header:context:general'
        };
        
        return contextMap[context] || 'header:context:general';
    }
    
    getPageContext(path) {
        if (path === '/' || path === '/index.html' || path === '/home') return 'home';
        if (path.includes('/getting-started')) return 'getting-started';
        if (path.includes('/story') || path.includes('/canon')) return 'story';
        if (path.includes('/spectrum')) return 'spectrum';
        if (path.includes('/dreamers') || path.includes('/dreamer')) return 'dreamers';
        if (path.includes('/books') || path.includes('/library')) return 'books';
        if (path.includes('/work')) return 'work';
        if (path.includes('/souvenirs')) return 'souvenirs';
        if (path.includes('/database')) return 'database';
        if (path.includes('/order')) return 'order';
        return 'general';
    }
    
    // Callback methods for dialogue buttons (called from database)
    async explainReverieHouse(dialogueWidget) {
        await dialogueWidget.startFromKey('explain:reverie-house', this);
    }
    
    async explainSpectrum(dialogueWidget) {
        await dialogueWidget.startFromKey('explain:spectrum', this);
    }
    
    async explainOctants(dialogueWidget) {
        await dialogueWidget.startFromKey('explain:octants', this);
    }
    
    async explainSouvenirs(dialogueWidget) {
        await dialogueWidget.startFromKey('explain:souvenirs', this);
    }
    
    gotoGettingStarted() {
        window.location.href = '/getting-started';
    }
    
    initializeDesktopDropdown() {
        const dropdowns = document.querySelectorAll('.nav-dropdown');
        
        dropdowns.forEach(dropdown => {
            const dropdownTrigger = dropdown.querySelector('.nav-dropdown-trigger');
            const dropdownMenu = dropdown.querySelector('.nav-dropdown-menu');
            
            if (!dropdownTrigger || !dropdownMenu) return;
            
            let isOpen = false;
            
            const toggleDropdown = (e) => {
                e.stopPropagation();
                
                // Close all other dropdowns
                document.querySelectorAll('.nav-dropdown').forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.querySelector('.nav-dropdown-trigger')?.classList.remove('open');
                        otherDropdown.querySelector('.nav-dropdown-menu')?.classList.remove('open');
                    }
                });
                
                isOpen = !isOpen;
                
                if (isOpen) {
                    dropdownTrigger.classList.add('open');
                    dropdownMenu.classList.add('open');
                } else {
                    dropdownTrigger.classList.remove('open');
                    dropdownMenu.classList.remove('open');
                }
            };
            
            const closeDropdown = () => {
                if (isOpen) {
                    isOpen = false;
                    dropdownTrigger.classList.remove('open');
                    dropdownMenu.classList.remove('open');
                }
            };
            
            dropdownTrigger.addEventListener('click', toggleDropdown);
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (isOpen && !dropdownTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    closeDropdown();
                }
            });
            
            // Close when clicking a menu item
            dropdownMenu.querySelectorAll('.nav-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const action = item.getAttribute('data-action');
                    if (action === 'login') {
                        e.preventDefault();
                        this.handleLogin();
                    } else if (action === 'admin-logout') {
                        e.preventDefault();
                        this.handleAdminLogout();
                    }
                    closeDropdown();
                });
            });
        });
    }
    
    handleAdminLogout() {
        console.log('🔓 Admin logout clicked');
        localStorage.removeItem('admin_token');
        // Redirect to home page
        window.location.href = '/';
    }
    
    handleLogin() {
        console.log('🚪 Login clicked - showing login popup');
        
        // Check if login widget is ready
        const checkAndShow = () => {
            if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                console.log('✅ Calling loginWidget.showLoginPopup()');
                window.loginWidget.showLoginPopup();
                return true;
            }
            return false;
        };
        
        // Try immediately
        if (checkAndShow()) {
            return;
        }
        
        // Wait for it to load
        console.warn('⚠️ Login widget not ready yet, waiting...');
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (checkAndShow()) {
                clearInterval(interval);
            } else if (attempts > 10) {
                clearInterval(interval);
                console.error('❌ Login widget still not available after 5 seconds');
            }
        }, 500);
    }
    
    initializeMobileMenu() {
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (!hamburgerBtn || !mobileMenu) return;
        
        // Update library link to use saved reading progress
        this.updateLibraryLink(mobileMenu);
        
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.mobileMenuOpen = !this.mobileMenuOpen;
            if (this.mobileMenuOpen) {
                hamburgerBtn.classList.add('active');
                mobileMenu.classList.add('open');
            } else {
                hamburgerBtn.classList.remove('active');
                mobileMenu.classList.remove('open');
            }
        });
        mobileMenu.querySelectorAll('.mobile-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.getAttribute('data-action');
                if (action === 'login') {
                    e.preventDefault();
                    this.handleLogin();
                }
                this.closeMobileMenu();
            });
        });
        document.addEventListener('click', (e) => {
            if (this.mobileMenuOpen && 
                !mobileMenu.contains(e.target) && 
                !hamburgerBtn.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
    }
    closeMobileMenu() {
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        this.mobileMenuOpen = false;
        if (hamburgerBtn) hamburgerBtn.classList.remove('active');
        if (mobileMenu) mobileMenu.classList.remove('open');
    }
    
    /**
     * Update library link to use saved reading progress
     */
    updateLibraryLink(mobileMenu) {
        try {
            // Check for saved reading progress (matches ReaderWidget's session key pattern)
            const savedProgress = sessionStorage.getItem('reading_progress_seekers-reverie');
            if (savedProgress) {
                // Find the library link (goes to /books/seeker/00 by default)
                const libraryLink = mobileMenu.querySelector('a[href^="/books/seeker/"]');
                if (libraryLink) {
                    libraryLink.href = `/books/seeker/${savedProgress}`;
                }
            }
        } catch (e) {
            // sessionStorage not available, keep default
        }
    }
    
    initializeReadingControls() {
        if (!document.querySelector('#enhanced-reader')) return;
        const backBtn = document.getElementById('back-to-library-btn');
        const prevBtn = document.getElementById('prev-chapter-btn');
        const nextBtn = document.getElementById('next-chapter-btn');
        const readingControls = document.querySelector('.reading-controls');
        console.log('🎮 Reading controls initialized:', {
            backBtn: !!backBtn,
            prevBtn: !!prevBtn,
            nextBtn: !!nextBtn,
            readingControls: !!readingControls
        });
        if (!readingControls) return;
        readingControls.style.display = 'none';
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('📖 Back to library clicked');
                if (window.returnToLibrary) {
                    window.returnToLibrary();
                    this.hideReadingControls();
                }
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log('⬅️ Previous chapter clicked');
                if (window.loadPreviousChapter) {
                    window.loadPreviousChapter();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log('➡️ Next chapter clicked');
                if (window.loadNextChapter) {
                    window.loadNextChapter();
                }
            });
        }
        console.log('✅ Header reading controls ready (methods will be exposed by constructor)');
    }
    toggleLock() {
        const currentLock = sessionStorage.getItem('LOCK') === 'true';
        const newLock = !currentLock;
        sessionStorage.setItem('LOCK', newLock.toString());
        const lockToggleBtn = document.getElementById('lock-toggle-btn');
        if (lockToggleBtn) {
            this.updateLockButton(lockToggleBtn, newLock);
        }
        console.log('🔒 Lock toggled:', newLock ? 'LOCKED' : 'UNLOCKED');
        window.dispatchEvent(new CustomEvent('lockToggled', { 
            detail: { locked: newLock } 
        }));
    }
    updateLockButton(button, isLocked) {
        if (isLocked) {
            button.textContent = '🔒';
            button.title = 'Unlock (Currently Locked)';
            button.classList.add('locked');
        } else {
            button.textContent = '👁';
            button.title = 'Lock (Currently Unlocked)';
            button.classList.remove('locked');
        }
    }
    setActiveNavigation() {
        const path = window.location.pathname || '';
        const hash = window.location.hash || '';
        const navItems = Array.from(document.querySelectorAll('.nav-icon-btn'));
        navItems.forEach(i => i.classList.remove('active'));
        const pickKey = () => {
            if (path === '/' || path === '/index.html' || path === '/home') return '/home';
            if (path.includes('/books') || path.includes('/library')) return '/books';
            if (path.includes('/dreamer')) return '/dreamers';
            if (path.includes('/canon') || path.includes('/story') || path.includes('/lore')) return '/story';
            if (path.includes('/souvenir')) return '/souvenirs';
            if (path.includes('/work')) return '/work';
            if (path.includes('/spectrum')) return '/spectrum';
            if (path.includes('/database')) return '/database';
            if (path.includes('/order')) return '/order';
            if (hash.includes('#howto')) return '/home';
            return null;
        };
        const key = pickKey();
        if (!key) return;
        let target = navItems.find(i => (i.getAttribute('href') || '') === key);
        if (!target && key === '/home#howto') {
            target = navItems.find(i => (i.getAttribute('href') || '').includes('#howto'))
                   || navItems.find(i => (i.getAttribute('href') || '') === '/home');
        }
        if (target) target.classList.add('active');
    }
    
    loadMessager() {
        // Load messager widget script if not already loaded
        if (!document.querySelector('script[src*="js/widgets/messager.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/messager.js';
            script.defer = true;
            document.head.appendChild(script);
            console.log('✉️ Messager script loaded');
        }
    }
    
    loadLogin() {
        // Load login CSS if not already loaded
        if (!document.querySelector('link[href*="css/widgets/login.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/login.css';
            document.head.appendChild(link);
            console.log('🎨 Login CSS loaded');
        }
        
        // Load login widget script if not already loaded
        if (!document.querySelector('script[src*="js/widgets/login.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/login.js';
            script.defer = true;
            document.head.appendChild(script);
            console.log('🚪 Login script loaded');
        }
    }
    
    /**
     * Update message notification badge on errantson button
     * NOTE: Badge removed from header icon - now uses flashing animation for unread messages
     */
    async updateMessageBadge() {
        try {
            // Get user DID from OAuth session
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                console.log('ℹ️ [Header] No user DID, skipping badge update');
                return;
            }
            
            const response = await fetch(`/api/messages/count?user_did=${encodeURIComponent(userDid)}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('📬 [Header] Badge updated:', result.data);
                this.updateMessageBadgeFromData(result.data);
            }
        } catch (error) {
            console.error('❌ [Header] Error fetching message count:', error);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.headerWidget = new Header();
    if (document.querySelector('#enhanced-reader')) {
        const widget = window.headerWidget;
        widget.showReadingControls = function() {
            console.log('👁 Showing reading controls');
            const readingControls = document.querySelector('.reading-controls');
            if (readingControls) {
                readingControls.style.display = 'flex';
                console.log('✅ Reading controls visible');
            } else {
                console.warn('⚠️ Reading controls element not found');
            }
        };
        widget.hideReadingControls = function() {
            console.log('🙈 Hiding reading controls');
            const readingControls = document.querySelector('.reading-controls');
            if (readingControls) {
                readingControls.style.display = 'none';
            }
        };
        widget.updateReadingButtons = function(canGoPrev, canGoNext) {
            console.log('🔄 Updating reading buttons:', { canGoPrev, canGoNext });
            const prevBtn = document.getElementById('prev-chapter-btn');
            const nextBtn = document.getElementById('next-chapter-btn');
            if (prevBtn) {
                prevBtn.disabled = !canGoPrev;
                prevBtn.style.opacity = canGoPrev ? '1' : '0.3';
            }
            if (nextBtn) {
                nextBtn.disabled = !canGoNext;
                nextBtn.style.opacity = canGoNext ? '1' : '0.3';
            }
        };
        console.log('✅ Header reading control methods exposed on window.headerWidget');
    }
});
window.Header = Header;
