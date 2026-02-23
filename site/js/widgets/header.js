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
        // Active state detection for mobile tab nav
        const mobileActiveStory = path.includes('/story') || path.includes('/canon') || path.includes('/lore');
        const mobileActiveLibrary = path.includes('/library') || path.includes('/order');
        const mobileActiveWork = path.includes('/work');
        const mobileActiveHistory = path.includes('/database');
        const mobileActiveOthers = path.includes('/dreamer');
        const mobileActiveMe = path.includes('/me');

        const mobileNavHTML = `
            <div class="mobile-nav">
                <nav class="mobile-tab-nav" aria-label="Main navigation">
                    <a href="/story" class="mobile-tab-item${mobileActiveStory ? ' active' : ''}" aria-label="Story">
                        <svg viewBox="0 0 32 32" fill="currentColor"><path d="M29.98,8.875c-0.079-0.388-0.181-0.774-0.299-1.152c-0.112-0.367-0.266-0.718-0.411-1.073c-0.172-0.424-0.351-0.824-0.606-1.206c-0.253-0.378-0.531-0.743-0.793-1.117c-0.1-0.144-0.223-0.247-0.375-0.317c-0.02-0.015-0.033-0.037-0.055-0.05c-0.031-0.018-0.065-0.027-0.098-0.041c-0.012-0.334-0.226-0.656-0.565-0.739c-0.405-0.098-0.83-0.116-1.245-0.141c-0.363-0.023-0.726-0.039-1.088-0.044c-0.785-0.015-1.571-0.008-2.356-0.014c-0.645-0.003-1.292-0.016-1.939-0.016c-0.14,0-0.281,0.001-0.421,0.002c-0.826,0.008-1.65,0.01-2.474,0.016c-0.986,0.004-1.97,0.017-2.954,0.021c-0.507,0.002-1.013-0.002-1.519-0.008c-0.538-0.004-1.079-0.01-1.617-0.008c-0.26,0.001-0.484,0.139-0.63,0.338c-0.018,0.015-0.041,0.021-0.057,0.039c-0.301,0.318-0.596,0.673-0.807,1.061c-0.21,0.39-0.369,0.805-0.502,1.225C8.932,6.399,8.726,7.167,8.585,7.937C8.29,9.559,8.132,11.203,7.941,12.84c-0.108,0.929-0.219,1.858-0.338,2.788c-0.154,1.12-0.348,2.235-0.608,3.335c-0.133,0.558-0.278,1.113-0.457,1.659c-0.17,0.525-0.376,1.04-0.59,1.549c-0.16,0.365-0.324,0.739-0.545,1.073c-0.019,0.021-0.027,0.048-0.044,0.071c-0.006,0-0.013,0-0.019,0c-0.805,0-1.61,0.004-2.414,0.017c-0.211,0.004-0.404,0.091-0.548,0.229c-0.288,0.188-0.442,0.542-0.35,0.889c0.096,0.367,0.172,0.745,0.303,1.102c0.149,0.409,0.328,0.801,0.527,1.187c0.191,0.372,0.405,0.716,0.668,1.044c0.22,0.274,0.479,0.505,0.749,0.729c0.164,0.134,0.33,0.219,0.54,0.233c0.109,0.052,0.228,0.087,0.356,0.09c1.731,0.041,3.462-0.019,5.193-0.031c1.686-0.012,3.373-0.004,5.061-0.014c0.87-0.006,1.742,0.01,2.613,0.023c0.262,0.006,0.527,0.006,0.791,0.004c0.536-0.002,1.077-0.002,1.611,0.044c0.011,0.001,0.021-0.006,0.032-0.005c0.307,0.239,0.802,0.258,1.072-0.051c0.291-0.336,0.563-0.695,0.801-1.071c0.247-0.39,0.413-0.818,0.579-1.247c0.284-0.729,0.527-1.491,0.683-2.258c0.342-1.663,0.567-3.352,0.753-5.04c0.061-0.56,0.123-1.12,0.195-1.679c0.136-0.949,0.285-1.896,0.414-2.846c0.18-1.298,0.4-2.589,0.68-3.871c0.068-0.311,0.139-0.622,0.214-0.932c0.003,0.003,0.004,0.007,0.006,0.009c0.141,0.141,0.372,0.259,0.579,0.239c0.834-0.081,1.665-0.131,2.503-0.179c0.112-0.006,0.218-0.035,0.316-0.079c0.057-0.002,0.115,0.005,0.171-0.011C29.864,9.72,30.067,9.294,29.98,8.875z M15.566,27.231c-1.683-0.01-3.365-0.004-5.048-0.01c-0.878-0.004-1.754,0-2.632-0.006c-0.886-0.006-1.774-0.04-2.66-0.07c-0.192-0.164-0.376-0.332-0.545-0.523c-0.294-0.409-0.528-0.86-0.732-1.32c-0.049-0.136-0.087-0.273-0.128-0.41c0.557-0.016,1.114-0.033,1.67-0.049c0.81-0.023,1.625-0.021,2.435-0.021c1.58,0.002,3.164,0.019,4.743,0.098c1.708,0.082,3.421,0.131,5.129,0.244c0.046,0.159,0.089,0.319,0.139,0.476c0.112,0.345,0.262,0.677,0.421,1.005c0.102,0.213,0.22,0.409,0.347,0.601c-0.212-0.002-0.424-0.003-0.636-0.005C17.233,27.237,16.4,27.237,15.566,27.231z M24.486,9.036c-0.415,1.617-0.745,3.251-0.998,4.901c-0.089,0.583-0.168,1.167-0.257,1.748c-0.083,0.536-0.174,1.073-0.249,1.609c-0.166,1.186-0.268,2.375-0.416,3.56c-0.13,0.936-0.281,1.87-0.469,2.798c-0.191,0.941-0.498,1.864-0.856,2.756c-0.14,0.294-0.316,0.561-0.501,0.826c-0.056-0.072-0.111-0.145-0.189-0.195c-0.159-0.141-0.298-0.297-0.432-0.461c-0.213-0.301-0.371-0.623-0.519-0.956c-0.172-0.457-0.286-0.934-0.412-1.404c-0.003-0.01-0.009-0.017-0.012-0.026c-0.021-0.07-0.051-0.132-0.089-0.191c-0.01-0.015-0.019-0.028-0.03-0.042c-0.043-0.056-0.089-0.106-0.146-0.149c-0.019-0.015-0.04-0.026-0.061-0.04c-0.053-0.033-0.106-0.065-0.166-0.087c-0.029-0.011-0.06-0.014-0.09-0.021c-0.054-0.013-0.104-0.034-0.161-0.038c-0.378-0.023-0.756-0.025-1.135-0.041c-0.405-0.019-0.81-0.039-1.218-0.052c-0.791-0.025-1.582-0.039-2.373-0.077c-0.778-0.037-1.555-0.089-2.335-0.106c-0.78-0.017-1.559-0.027-2.341-0.027c-0.651,0-1.303-0.002-1.954-0.005c0.024-0.054,0.052-0.11,0.076-0.163c0.181-0.394,0.336-0.799,0.492-1.202c0.286-0.747,0.523-1.499,0.726-2.271c0.407-1.557,0.668-3.143,0.863-4.739c0.193-1.582,0.348-3.167,0.545-4.748c0.108-0.788,0.226-1.574,0.385-2.355c0.079-0.388,0.195-0.772,0.301-1.154c0.106-0.375,0.223-0.744,0.359-1.108c0.111-0.237,0.241-0.456,0.394-0.671c0.096-0.115,0.198-0.226,0.301-0.336c1.588-0.029,3.174-0.083,4.76-0.108c0.834-0.014,1.667-0.017,2.501-0.016c0.822,0.002,1.642,0.027,2.464,0.048c0.843,0.021,1.686,0.035,2.528,0.039c0.76,0.002,1.519,0.02,2.274,0.105c0.029,0.005,0.058,0.011,0.087,0.016c-0.354,0.632-0.67,1.284-0.916,1.967C24.932,7.415,24.696,8.22,24.486,9.036z M26.214,8.523c0.176-0.605,0.371-1.205,0.602-1.792c0.102-0.224,0.215-0.441,0.329-0.657c0.02,0.026,0.039,0.053,0.058,0.079c0.209,0.284,0.375,0.58,0.519,0.9c0.138,0.328,0.274,0.656,0.392,0.99c0.039,0.111,0.062,0.227,0.097,0.34c-0.59,0.015-1.179,0.042-1.766,0.093C26.362,8.482,26.288,8.502,26.214,8.523z M20.026,10.52c0.102,0.174,0.129,0.386,0.077,0.579c-0.052,0.187-0.177,0.351-0.345,0.45c-0.178,0.104-0.359,0.113-0.554,0.08c-0.218-0.017-0.438-0.016-0.656-0.016c-0.118,0-0.233,0.002-0.349-0.002c-0.415-0.008-0.832-0.017-1.247-0.012c-0.974,0.016-1.947,0.081-2.919,0.104c-0.399,0.01-0.731-0.34-0.731-0.731c0-0.401,0.332-0.727,0.731-0.731c0.349-0.002,0.7,0.002,1.052,0.008c0.656,0.008,1.312,0.017,1.97-0.023c0.424-0.025,0.849-0.037,1.274-0.042c0.206-0.004,0.411-0.01,0.616-0.019c0.113-0.006,0.229-0.016,0.345-0.016c0.031,0,0.061,0.001,0.092,0.002C19.648,10.165,19.887,10.283,20.026,10.52z M18.925,13.447c0.135,0.135,0.212,0.32,0.212,0.509c0,0.378-0.328,0.741-0.722,0.722c-0.814-0.041-1.638-0.031-2.453-0.004c-0.45,0.016-0.899,0.012-1.349,0.025c-0.484,0.014-0.969,0.041-1.455,0.066c-0.403,0.021-0.741-0.353-0.741-0.741c0-0.411,0.338-0.729,0.741-0.741c0.411-0.01,0.822,0,1.233,0.008c0.523,0.012,1.046,0.023,1.571-0.006c0.436-0.025,0.874-0.027,1.312-0.025c0.38,0,0.764,0.014,1.14-0.023c0.013-0.001,0.027-0.002,0.04-0.002C18.627,13.235,18.811,13.332,18.925,13.447z M18.864,16.706c0.102,0.176,0.129,0.388,0.075,0.581c-0.05,0.189-0.178,0.353-0.345,0.452c-0.193,0.112-0.369,0.104-0.581,0.075c-0.013-0.002-0.025-0.004-0.039-0.004c0.068,0.008,0.133,0.017,0.201,0.027c-0.855-0.11-1.725-0.106-2.584-0.087c-0.496,0.012-0.994,0.012-1.49,0.017c-0.517,0.004-1.032,0.048-1.548,0.064c-0.417,0.016-0.762-0.355-0.762-0.76c0-0.417,0.345-0.762,0.762-0.762c0.536,0,1.071,0.037,1.607,0.041c0.484,0.004,0.969-0.008,1.453-0.01c0.48-0.002,0.959-0.008,1.438-0.029c0.139-0.006,0.278-0.009,0.419-0.009c0.248,0,0.498,0.01,0.743,0.032C18.483,16.356,18.721,16.461,18.864,16.706z"/></svg>
                        <span>Story</span>
                    </a>
                    <a href="/library" class="mobile-tab-item${mobileActiveLibrary ? ' active' : ''}" aria-label="Library">
                        <svg viewBox="0 0 335 335" fill="currentColor"><path d="M311.175,115.775c-1.355-10.186-1.546-27.73,7.915-33.621c0.169-0.108,0.295-0.264,0.443-0.398c7.735-2.474,13.088-5.946,8.886-10.618l-114.102-34.38L29.56,62.445c0,0-21.157,3.024-19.267,35.894c1.026,17.89,6.637,26.676,11.544,31l-15.161,4.569c-4.208,4.672,1.144,8.145,8.88,10.615c0.147,0.138,0.271,0.293,0.443,0.401c9.455,5.896,9.273,23.438,7.913,33.626c-33.967,9.645-21.774,12.788-21.774,12.788l7.451,1.803c-5.241,4.736-10.446,13.717-9.471,30.75c1.891,32.864,19.269,35.132,19.269,35.132l120.904,39.298l182.49-44.202c0,0,12.197-3.148-21.779-12.794c-1.366-10.172-1.556-27.712,7.921-33.623c0.174-0.105,0.301-0.264,0.442-0.396c7.736-2.474,13.084-5.943,8.881-10.615l-7.932-2.395c5.29-3.19,13.236-11.527,14.481-33.183c0.859-14.896-3.027-23.62-7.525-28.756l15.678-3.794C332.949,128.569,345.146,125.421,311.175,115.775z M158.533,115.354l30.688-6.307l103.708-21.312l15.451-3.178c-4.937,9.036-4.73,21.402-3.913,29.35c0.179,1.798,0.385,3.44,0.585,4.688L288.14,122.8l-130.897,32.563L158.533,115.354z M26.71,147.337l15.449,3.178l99.597,20.474l8.701,1.782l26.093,5.363l1.287,40.01L43.303,184.673l-13.263-3.296c0.195-1.25,0.401-2.89,0.588-4.693C31.44,168.742,31.651,156.373,26.71,147.337z M20.708,96.757c-0.187-8.743,1.371-15.066,4.52-18.28c2.004-2.052,4.369-2.479,5.991-2.479c0.857,0,1.474,0.119,1.516,0.119l79.607,25.953l39.717,12.949l-1.303,40.289L39.334,124.07l-5.88-1.647c-0.216-0.061-0.509-0.103-0.735-0.113C32.26,122.277,21.244,121.263,20.708,96.757z M140.579,280.866L23.28,247.98c-0.217-0.063-0.507-0.105-0.733-0.116c-0.467-0.031-11.488-1.044-12.021-25.544c-0.19-8.754,1.376-15.071,4.519-18.288c2.009-2.052,4.375-2.479,5.994-2.479c0.859,0,1.474,0.115,1.519,0.115l119.316,38.908L140.579,280.866z M294.284,239.459c0.185,1.804,0.391,3.443,0.591,4.693l-147.812,36.771l1.292-40.01l31.601-6.497l4.667,1.129l17.492-5.685l80.631-16.569l15.457-3.18C293.261,219.146,293.466,231.517,294.284,239.459z M302.426,185.084c-0.269,0.006-0.538,0.042-0.791,0.122l-11.148,3.121l-106.148,29.764l-1.298-40.289l34.826-11.359l84.327-27.501c0.011-0.005,4.436-0.988,7.684,2.315c3.144,3.214,4.704,9.537,4.52,18.28C313.848,184.035,302.827,185.053,302.426,185.084z"/></svg>
                        <span>Library</span>
                    </a>
                    <a href="/work" class="mobile-tab-item${mobileActiveWork ? ' active' : ''}" aria-label="Work">
                        <svg viewBox="0 0 512 512" fill="currentColor"><path d="M326.527,171.735c-15.637-2.602-55.941-2.43-82.686,7.296c-26.752,9.725-75.397,40.124-89.988,44.997c-14.591,4.859-15.81,24.322,17.02,27.964c32.836,3.654,62.018-17.028,69.313-20.669c7.296-3.654,77.826,7.296,77.826,7.296l22.19,5.468l51.161,69.154c8.977-7.798,26.732-24.349,31.228-36.927c1.641-4.581,4.078-8.792,6.752-12.532l-72.49-99.977C347.605,169.047,336.444,173.39,326.527,171.735z"/><path d="M326.527,254.123l-10.752-1.085c-14.107-2.185-54-7.865-68.975-7.865c-0.662,0-1.185,0.007-1.576,0.026c-0.602,0.344-1.298,0.742-1.98,1.139c-10.625,6.19-35.524,20.681-64.52,20.681c-3.178,0-6.362-0.179-9.46-0.523c-4.7-0.523-8.832-1.331-12.486-2.35c3.462,1.516,6.653,3.688,9.381,6.475c4.29,4.383,6.944,9.758,7.997,15.379c2.496-0.669,5.084-1.04,7.732-1.04c8.116,0,15.71,3.191,21.376,8.99c5.588,5.707,8.613,13.254,8.527,21.238c0,0.079-0.013,0.159-0.013,0.238c8.083,0.026,15.644,3.218,21.297,8.99c5.587,5.707,8.613,13.253,8.527,21.238c-0.027,2.754-0.45,5.441-1.198,8.024c5.733,1.198,10.983,4.051,15.18,8.341c11.532,11.791,11.327,30.757-0.457,42.29l-5.898,5.773c0.026,0,0.053,0,0.079,0c9.917-0.715,18.265-6.832,20.602-16.048c4.038,3.184,9.122,5.097,14.664,5.097c13.095,0,23.713-10.612,23.713-23.713c0-1.377-0.139-2.714-0.371-4.026c4.171,3.635,9.606,5.852,15.571,5.852c13.095,0,23.714-10.619,23.714-23.713c2.807,1.172,5.885,1.827,9.116,1.827c13.101,0,23.713-10.619,23.713-23.713c0-9.944-4.859-16.418-16.418-29.791L326.527,254.123z"/><path d="M155.734,280.829c-5.918-6.044-15.61-6.15-21.654-0.238l-21.88,21.416c-6.044,5.912-6.15,15.604-0.238,21.648c5.918,6.044,15.61,6.15,21.654,0.231l21.886-21.41C161.539,296.565,161.645,286.873,155.734,280.829z"/><path d="M192.833,304.158c-5.912-6.051-15.604-6.157-21.648-0.239l-29.175,28.546c-6.051,5.918-6.15,15.61-0.239,21.648c5.912,6.051,15.611,6.157,21.655,0.239l29.175-28.547C198.645,319.894,198.751,310.202,192.833,304.158z"/><path d="M222.643,334.624c-5.912-6.044-15.604-6.157-21.648-0.238l-29.175,28.553c-6.044,5.911-6.15,15.603-0.238,21.654c5.912,6.038,15.604,6.144,21.655,0.225l29.175-28.546C228.456,350.353,228.562,340.661,222.643,334.624z"/><path d="M245.158,372.226c-5.912-6.044-15.604-6.156-21.648-0.238l-17.02,16.657c-6.044,5.911-6.15,15.603-0.238,21.648c5.918,6.044,15.61,6.144,21.654,0.238l17.02-16.656C250.971,387.963,251.07,378.271,245.158,372.226z"/><path d="M510.606,234.991l-97.792-134.866c-2.364-3.27-6.925-3.991-10.189-1.628l-43.315,31.412c-3.264,2.363-3.992,6.925-1.622,10.188L455.48,274.97c2.363,3.264,6.925,3.992,10.188,1.622l43.323-31.406C512.248,242.815,512.977,238.254,510.606,234.991z M477.334,247.106c-5.435,3.945-13.042,2.727-16.987-2.708c-3.939-5.435-2.728-13.035,2.714-16.98c5.435-3.946,13.035-2.728,16.981,2.701C483.98,235.56,482.769,243.167,477.334,247.106z"/><path d="M144.784,261.63c2.304,0,4.555,0.292,6.739,0.788c-18.384-7.05-21.429-19.946-21.906-24.494c-1.298-12.248,6.587-23.402,19.622-27.745c5.243-1.748,18.986-9.242,32.28-16.484c14.26-7.779,29.91-16.312,43.521-22.589c-17.252-1.396-33.419-0.807-42.051,0.629c-9.295,1.549-19.675-2.164-28.553-6.944l-73.06,100.752c2.191,3.29,4.157,6.892,5.54,10.771c2.046,5.72,6.839,12.26,12.3,18.43c0.854-1.099,1.761-2.172,2.781-3.171l21.879-21.416C129.498,264.662,136.926,261.63,144.784,261.63z"/><path d="M152.695,129.902l-43.323-31.406c-3.257-2.363-7.818-1.642-10.188,1.628L1.391,234.991c-2.37,3.263-1.635,7.824,1.622,10.195l43.316,31.406c3.264,2.37,7.825,1.642,10.189-1.629l97.793-134.866C156.68,136.834,155.952,132.272,152.695,129.902z M123.745,144.97c-3.939,5.428-11.546,6.646-16.981,2.701c-5.442-3.94-6.654-11.546-2.708-16.981c3.939-5.435,11.546-6.653,16.981-2.708C126.479,131.928,127.684,139.528,123.745,144.97z"/></svg>
                        <span>Work</span>
                    </a>
                    <a href="/database" class="mobile-tab-item${mobileActiveHistory ? ' active' : ''}" aria-label="History">
                        <svg viewBox="0 0 512 512" fill="currentColor"><path d="M315.883,231.15l82.752-115.13c7.152-9.942,11.039-21.784,11.039-33.93V46.13h23.911V0H78.415v46.13h23.912v35.96c0,12.145,3.886,23.988,11.039,33.93l82.752,115.13c2.963,4.136,4.472,8.857,4.483,13.665v22.36c-0.011,4.808-1.52,9.53-4.483,13.665l-82.752,115.141c-7.154,9.942-11.039,21.783-11.039,33.918v35.971H78.415V512h355.169v-46.129h-23.911V429.9c0-12.135-3.887-23.976-11.039-33.918L315.883,280.84c-2.963-4.136-4.482-8.857-4.482-13.665v-22.36C311.401,240.007,312.92,235.286,315.883,231.15z M386.609,461.257H125.393V429.9c0-7.229,2.291-14.317,6.696-20.46l82.753-115.141c5.708-7.934,8.824-17.41,8.824-27.124v-22.36c0-9.714-3.115-19.202-8.824-27.124L132.1,102.561c-4.417-6.155-6.708-13.232-6.708-20.471V50.743h261.216V82.09c-0.011,7.239-2.291,14.316-6.709,20.471l-82.752,115.13c-5.698,7.922-8.813,17.41-8.813,27.124v22.36c0,9.714,3.114,19.19,8.813,27.124l82.763,115.141c4.407,6.143,6.686,13.231,6.698,20.46V461.257z"/><path d="M236.268,232.929h39.466c1.672-8.314,5.091-16.237,10.181-23.314l59.491-82.774H166.595l59.492,82.774C231.177,216.692,234.585,224.616,236.268,232.929z"/><path d="M246.753,381.588l-65.82,65.831h150.134l-65.82-65.831C260.137,376.487,251.865,376.487,246.753,381.588z"/><circle cx="255.632" cy="258.307" r="10.311"/><circle cx="255.632" cy="299.813" r="10.311"/><circle cx="255.632" cy="342.556" r="10.311"/></svg>
                        <span>History</span>
                    </a>
                    <a href="/dreamers" class="mobile-tab-item${mobileActiveOthers ? ' active' : ''}" aria-label="Dreamers">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>Dreamers</span>
                    </a>
                    <a href="/me" class="mobile-tab-item${mobileActiveMe ? ' active' : ''}" aria-label="Me">
                        <svg viewBox="0 0 128 128"><path d="M120.44 51.23a29.87 29.87 0 0 0 2.96-13.02c0-16.6-13.45-30.05-30.05-30.05c-3.89 0-7.61.75-11.03 2.1C77.95 6.45 72.22 4.1 66 4.1c-7.6 0-14.4 3.4-18.9 8.7c-3.5-1.9-7.5-3-11.7-3c-13.4.1-24.3 10.9-24.3 24.3c0 5 1.5 9.7 4.2 13.6c-5 4-8.5 9.9-9.2 16.8C4.8 77.9 14.7 90 28.3 91.3c3.2.3 6.2 0 9.1-.8c1.1 10.7 10.1 19 21.1 19c7 0 13.2-3.4 17-8.6c3.6 2.8 8.1 4.6 13.1 4.6c11 0 20.1-8.5 20.9-19.2C118 82.4 124 73.8 124 63.8c0-4.59-1.33-8.92-3.56-12.57z" fill="currentColor" stroke="rgba(0,0,0,0.3)" stroke-width="6" stroke-miterlimit="10"/><path d="M24.3 97.3c-4.5-.5-8.5 2.8-9 7.3s2.8 8.5 7.3 8.9c4.5.5 8.5-2.8 9-7.3s-2.8-8.5-7.3-8.9z" fill="currentColor" stroke="rgba(0,0,0,0.3)" stroke-width="4.5" stroke-miterlimit="10"/><path d="M9 114.3c-3-.3-5.7 1.9-6 4.9s1.9 5.6 4.9 5.9s5.7-1.9 6-4.9c.3-2.9-1.9-5.6-4.9-5.9z" fill="currentColor" stroke="rgba(0,0,0,0.3)" stroke-width="4.5" stroke-miterlimit="10"/></svg>
                        <span>Me</span>
                    </a>
                </nav>
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
        this.injectErrantsonFab();
        this.initializeDreamerIconRotator();
        this.loadMessager();
        this.loadLogin();
        this.setupMeTabIntercept();
        
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
    
    setupMeTabIntercept() {
        // The Me tab links to /me. If the user isn't logged in, intercept the
        // tap and show the login popup instead of navigating.
        const nav = document.querySelector('.mobile-tab-nav');
        if (!nav) return;

        // Shared helper — returns true if there is NO active session.
        const isLoggedOut = () => {
            const s = window.oauthManager?.getSession?.()
                   || window.oauthManager?.currentSession
                   || null;
            return !s;
        };

        // Reliably trigger the login popup, retrying briefly if loginWidget
        // hasn't initialised yet (module script timing on mobile).
        const triggerLogin = (retries = 6) => {
            if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                window.loginWidget.showLoginPopup();
                return;
            }
            if (retries > 0) {
                setTimeout(() => triggerLogin(retries - 1), 80);
            }
        };

        // On mobile, the browser can start navigating on touchend *before*
        // the click event fires. We intercept touchend to call
        // preventDefault() early, which suppresses both the navigation and
        // the synthesised click. A flag tells the click handler to bail.
        let handledByTouch = false;

        nav.addEventListener('touchend', (e) => {
            const meTab = e.target.closest('a[href="/me"]');
            if (!meTab) return;
            if (isLoggedOut()) {
                e.preventDefault();
                handledByTouch = true;
                triggerLogin();
            }
        }, { capture: true, passive: false });

        // Click handler as fallback (desktop / non-touch devices, or if
        // touchend didn't fire for some reason).
        nav.addEventListener('click', (e) => {
            if (handledByTouch) { handledByTouch = false; return; }
            const meTab = e.target.closest('a[href="/me"]');
            if (!meTab) return;
            if (isLoggedOut()) {
                e.preventDefault();
                triggerLogin();
            }
            // If logged in — let the <a href> navigate normally to /me
        }, true);

        // Set initial label and update on auth changes
        this.updateMeTabLabel();
        window.addEventListener('oauth:login',          () => this.updateMeTabLabel());
        window.addEventListener('oauth:profile-loaded', () => this.updateMeTabLabel());
        window.addEventListener('oauth:logout',         () => this.updateMeTabLabel());
    }

    updateMeTabLabel() {
        const meTab = document.querySelector('a.mobile-tab-item[href="/me"]');
        if (!meTab) return;
        const session = window.oauthManager?.getSession?.()
            || window.oauthManager?.currentSession
            || null;
        const doorSvg = `<svg fill="currentColor" viewBox="-13.22 0 122.88 122.88" xmlns="http://www.w3.org/2000/svg"><path d="M0,115.27h4.39V1.99V0h1.99h82.93h1.99v1.99v113.28h5.14v7.61H0V115.27L0,115.27z M13.88,8.32H81.8h0.83v0.83v104.89h4.69V3.97H8.36v111.3h4.69V9.15V8.32H13.88L13.88,8.32z M15.94,114.04H75.1l-0.38-0.15l-27.76-3.79V33.9l32.79-20.66v-2.04H15.94V114.04L15.94,114.04z M51.7,59.66l4.23-1.21v15.81l-4.23-1.53V59.66L51.7,59.66z"/></svg>`;
        const cloudSvg = `<svg viewBox="0 0 128 128"><path d="M120.44 51.23a29.87 29.87 0 0 0 2.96-13.02c0-16.6-13.45-30.05-30.05-30.05c-3.89 0-7.61.75-11.03 2.1C77.95 6.45 72.22 4.1 66 4.1c-7.6 0-14.4 3.4-18.9 8.7c-3.5-1.9-7.5-3-11.7-3c-13.4.1-24.3 10.9-24.3 24.3c0 5 1.5 9.7 4.2 13.6c-5 4-8.5 9.9-9.2 16.8C4.8 77.9 14.7 90 28.3 91.3c3.2.3 6.2 0 9.1-.8c1.1 10.7 10.1 19 21.1 19c7 0 13.2-3.4 17-8.6c3.6 2.8 8.1 4.6 13.1 4.6c11 0 20.1-8.5 20.9-19.2C118 82.4 124 73.8 124 63.8c0-4.59-1.33-8.92-3.56-12.57z" fill="currentColor" stroke="rgba(0,0,0,0.3)" stroke-width="6" stroke-miterlimit="10"/><path d="M24.3 97.3c-4.5-.5-8.5 2.8-9 7.3s2.8 8.5 7.3 8.9c4.5.5 8.5-2.8 9-7.3s-2.8-8.5-7.3-8.9z" fill="currentColor" stroke="rgba(0,0,0,0.3)" stroke-width="4.5" stroke-miterlimit="10"/><path d="M9 114.3c-3-.3-5.7 1.9-6 4.9s1.9 5.6 4.9 5.9s5.7-1.9 6-4.9c.3-2.9-1.9-5.6-4.9-5.9z" fill="currentColor" stroke="rgba(0,0,0,0.3)" stroke-width="4.5" stroke-miterlimit="10"/></svg>`;

        if (!session) {
            meTab.innerHTML = `${doorSvg}<span>Enter</span>`;
            return;
        }

        // Try to show avatar + name from already-loaded dreamer data
        const avatar = window.MePage?.dreamer?.avatar
            || window.oauthManager?.currentSession?.avatar
            || window.AvatarCache?.get(session.did || session.sub)
            || null;
        // Only use the confirmed display name from dreamer data — never show raw handle
        const name = window.MePage?.dreamer?.name || 'Me';

        if (avatar && name !== 'Me') {
            meTab.innerHTML = `<img src="${avatar}" class="me-tab-avatar" alt="" onerror="this.style.display='none';this.nextSibling.style.display='';"><span class="me-tab-name">${name}</span>`;
        } else {
            meTab.innerHTML = `${cloudSvg}<span>${name}</span>`;
            // Always fetch dreamer data to get real name + avatar
            const did = session.did || session.sub;
            if (did) {
                fetch(`/api/dreamers/${encodeURIComponent(did)}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(d => {
                        if (!d) return;
                        const img   = d.avatar || null;
                        const label = d.name || 'Me';
                        window.AvatarCache?.set(d.did, img);
                        if (img) {
                            meTab.innerHTML = `<img src="${img}" class="me-tab-avatar" alt="" onerror="this.style.display='none';this.nextSibling.style.display='';"><span class="me-tab-name">${label}</span>`;
                        } else {
                            meTab.querySelector('span') && (meTab.querySelector('span').textContent = label);
                        }
                    })
                    .catch(() => {});
            }
        }
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
        const errantsonFab = document.getElementById('errantson-fab');

        const hasUnread = data && data.unread > 0;

        if (helperBtn) {
            if (hasUnread) {
                helperBtn.classList.add('has-unread');
            } else {
                helperBtn.classList.remove('has-unread');
            }
        }

        if (errantsonFab) {
            if (hasUnread) {
                errantsonFab.classList.add('has-unread');
            } else {
                errantsonFab.classList.remove('has-unread');
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

        // Click handler for desktop only (mobile uses FAB)
        if (helperBtn) {
            helperBtn.addEventListener('click', () => this.openErrantsonHelp());
        }

        // Attention animation for new users (desktop)
        const hasBeenIntroduced = localStorage.getItem('reverie_introduced');
        if (!hasBeenIntroduced && helperBtn) {
            helperBtn.classList.add('needs-attention');
            setTimeout(() => helperBtn.classList.remove('needs-attention'), 5000);
        }
    }

    injectErrantsonFab() {
        // Only inject on mobile viewports
        if (window.innerWidth > 768) return;
        // Prevent double injection
        if (document.getElementById('errantson-fab')) return;

        const fab = document.createElement('button');
        fab.className = 'errantson-fab';
        fab.id = 'errantson-fab';
        fab.setAttribute('aria-label', 'Need something? Click for errantson.');
        fab.innerHTML = `
            <img src="/souvenirs/dream/strange/icon.png" alt="errantson">
            <span class="helper-pulse"></span>
        `;
        fab.addEventListener('click', () => this.openErrantsonHelp());
        document.body.appendChild(fab);

        // Attention animation for new users
        const hasBeenIntroduced = localStorage.getItem('reverie_introduced');
        if (!hasBeenIntroduced) {
            fab.classList.add('needs-attention');
            setTimeout(() => fab.classList.remove('needs-attention'), 5000);
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
