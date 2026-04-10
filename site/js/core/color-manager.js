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

            // Wait for OAuth manager to be ready
            await this.waitForOAuthManager();

            // Load color based on session state
            await this.loadColor();

            this.isInitialized = true;
        })();

        return this.initPromise;
    }

    async waitForOAuthManager() {
        // Quick check - if oauth-manager.js isn't even loaded, don't wait
        const hasOAuthScript = document.querySelector('script[src*="oauth-manager"]');
        if (!hasOAuthScript && !window.oauthManager) {
            return;
        }
        
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20; // 1 second max wait (20 * 50ms)
            
            const checkOAuth = () => {
                if (window.oauthManager) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    resolve(); // Continue anyway
                } else {
                    attempts++;
                    setTimeout(checkOAuth, 50);
                }
            };
            checkOAuth();
        });
    }

    async loadColor() {
        const session = window.oauthManager?.getSession();

        if (session && session.did) {
            await this.loadUserColor(session.did);
        } else {
            await this.loadWorldColor();
        }
    }

    async loadUserColor(did) {
        // Try cache first
        const cacheKey = `reverie_color_${did}`;
        const cachedColor = localStorage.getItem(cacheKey);
        
        if (cachedColor) {
            this.setColor(cachedColor, 'user');
        }

        // Fetch fresh from API
        try {
            const response = await fetch('/api/dreamers');
            if (!response.ok) throw new Error('Failed to fetch dreamers');
            
            const dreamers = await response.json();
            const user = dreamers.find(d => d.did === did);

            if (user && user.color_hex) {
                this.setColor(user.color_hex, 'user');
                localStorage.setItem(cacheKey, user.color_hex);
            } else if (!cachedColor) {
                // No user color found, fall back to world color
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
            if (window.worldConfigCache) {
                const config = await window.worldConfigCache.fetch();
                const worldColor = config.color || this.currentColor;
                this.setColor(worldColor, 'world');
            } else {
                this.setColor(this.currentColor, 'default');
            }
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
        document.documentElement.style.setProperty('--user-color', this.currentColor);
    }

    setupOAuthListeners() {
        // Handle login
        window.addEventListener('oauth:login', async () => {
            const session = window.oauthManager?.getSession();
            if (session && session.did) {
                await this.loadUserColor(session.did);
            }
        });

        // Handle profile loaded (has DID)
        window.addEventListener('oauth:profile-loaded', async () => {
            const session = window.oauthManager?.getSession();
            if (session && session.did) {
                await this.loadUserColor(session.did);
            }
        });

        // Handle logout
        window.addEventListener('oauth:logout', async (event) => {
            
            // Clear cached user color using DID from event
            const did = event.detail?.sub;
            if (did) {
                const cacheKey = `reverie_color_${did}`;
                localStorage.removeItem(cacheKey);
            }
            
            // Force fresh fetch of world color by invalidating cache
            window.worldConfigCache.invalidate();
            
            await this.loadWorldColor();
        });
    }

    // For widgets that need to manually trigger color reload
    async refresh() {
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

