/**
 * Color Manager
 * Centralizes color loading and application across all widgets
 */
class ColorManager {
    constructor() {
        this.currentColor = '#734ba1'; // Default fallback
        this.colorSource = 'default'; // 'default' | 'world' | 'user'
        this.isInitialized = false;
        this.initPromise = null;
        this.setupOAuthListeners();
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            console.log('🎨 Color Manager: Initializing...');

            // Wait for OAuth manager to be ready
            await this.waitForOAuthManager();

            // Load color based on session state
            await this.loadColor();

            this.isInitialized = true;
            console.log('✅ Color Manager: Initialized with color', this.currentColor);
        })();

        return this.initPromise;
    }

    async waitForOAuthManager() {
        return new Promise((resolve) => {
            const checkOAuth = () => {
                if (window.oauthManager) {
                    console.log('🎨 Color Manager: OAuth manager found');
                    resolve();
                } else {
                    setTimeout(checkOAuth, 50);
                }
            };
            checkOAuth();
        });
    }

    async loadColor() {
        const session = window.oauthManager?.getSession();

        if (session && session.did) {
            console.log('🎨 Color Manager: User logged in, loading user color...');
            await this.loadUserColor(session.did);
        } else {
            console.log('🎨 Color Manager: No session, loading world color...');
            await this.loadWorldColor();
        }
    }

    async loadUserColor(did) {
        // Try cache first
        const cacheKey = `reverie_color_${did}`;
        const cachedColor = localStorage.getItem(cacheKey);
        
        if (cachedColor) {
            console.log('🎨 Color Manager: Using cached user color', cachedColor);
            this.setColor(cachedColor, 'user');
        }

        // Fetch fresh from API
        try {
            const response = await fetch('/api/dreamers');
            if (!response.ok) throw new Error('Failed to fetch dreamers');
            
            const dreamers = await response.json();
            const user = dreamers.find(d => d.did === did);

            if (user && user.color_hex) {
                console.log('🎨 Color Manager: Loaded user color from API', user.color_hex);
                this.setColor(user.color_hex, 'user');
                localStorage.setItem(cacheKey, user.color_hex);
            } else if (!cachedColor) {
                // No user color found, fall back to world color
                console.log('🎨 Color Manager: User has no color, falling back to world color');
                await this.loadWorldColor();
            }
        } catch (error) {
            console.error('❌ Color Manager: Failed to load user color', error);
            // Keep cached color or fall back to world color
            if (!cachedColor) {
                await this.loadWorldColor();
            }
        }
    }

    async loadWorldColor() {
        try {
            const config = await window.worldConfigCache.fetch();
            const worldColor = config.color || this.currentColor;
            console.log('🎨 Color Manager: Loaded world color', worldColor);
            this.setColor(worldColor, 'world');
        } catch (error) {
            console.error('❌ Color Manager: Failed to load world color', error);
            this.setColor(this.currentColor, 'default');
        }
    }

    setColor(color, source = 'unknown') {
        if (this.currentColor === color && this.colorSource === source) {
            return; // No change
        }

        const oldColor = this.currentColor;
        this.currentColor = color;
        this.colorSource = source;

        // Apply to DOM - set both variables
        document.documentElement.style.setProperty('--reverie-core-color', color);
        document.documentElement.style.setProperty('--user-color', color);

        // Dispatch event for widgets that need to react
        window.dispatchEvent(new CustomEvent('reverie:color-changed', {
            detail: {
                color: color,
                oldColor: oldColor,
                source: source
            }
        }));

        console.log(`🎨 Color Manager: Color set to ${color} (source: ${source})`);
    }

    getColor() {
        return this.currentColor;
    }

    getColorSource() {
        return this.colorSource;
    }

    // Set a temporary profile color (for viewing other dreamers)
    // This overrides the user color but can be restored
    setProfileColor(color, profileName = 'profile') {
        console.log(`🎨 Color Manager: Setting profile color to ${color} for ${profileName}`);
        document.documentElement.style.setProperty('--user-color', color);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('reverie:profile-color-changed', {
            detail: {
                color: color,
                profileName: profileName
            }
        }));
    }

    // Restore the user's own color (after viewing another profile)
    restoreUserColor() {
        console.log(`🎨 Color Manager: Restoring user color to ${this.currentColor}`);
        document.documentElement.style.setProperty('--user-color', this.currentColor);
    }

    setupOAuthListeners() {
        // Handle login
        window.addEventListener('oauth:login', async () => {
            console.log('🎨 Color Manager: OAuth login detected');
            const session = window.oauthManager?.getSession();
            if (session && session.did) {
                await this.loadUserColor(session.did);
            }
        });

        // Handle profile loaded (has DID)
        window.addEventListener('oauth:profile-loaded', async () => {
            console.log('🎨 Color Manager: OAuth profile loaded');
            const session = window.oauthManager?.getSession();
            if (session && session.did) {
                await this.loadUserColor(session.did);
            }
        });

        // Handle logout
        window.addEventListener('oauth:logout', async (event) => {
            console.log('🎨 Color Manager: OAuth logout detected, reloading world color...');
            
            // Clear cached user color using DID from event
            const did = event.detail?.sub;
            if (did) {
                const cacheKey = `reverie_color_${did}`;
                localStorage.removeItem(cacheKey);
                console.log(`🎨 Color Manager: Cleared cached user color for ${did}`);
            }
            
            // Force fresh fetch of world color by invalidating cache
            window.worldConfigCache.invalidate();
            
            await this.loadWorldColor();
            console.log('🎨 Color Manager: World color reloaded after logout');
        });
    }

    // For widgets that need to manually trigger color reload
    async refresh() {
        console.log('🎨 Color Manager: Manual refresh requested');
        await this.loadColor();
    }
}

// Create singleton instance
window.colorManager = new ColorManager();

// Auto-initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.colorManager.init();
    });
} else {
    window.colorManager.init();
}

console.log('🎨 Color Manager initialized');
