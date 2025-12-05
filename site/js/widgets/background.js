/**
 * Background Widget
 * 
 * Universal background manager for all pages that need phanera backgrounds.
 * 
 * Modes:
 * - 'user': Shows logged-in user's selected phanera (story.html, etc.)
 * - 'profile': Shows viewed profile's phanera (dreamer.html)
 * - 'static': Shows a specific phanera (homepage, etc.)
 * 
 * Usage:
 *   window.background = new Background('user');
 *   await window.background.init();
 */

class Background {
    constructor(mode = 'user', options = {}) {
        this.mode = mode; // 'user', 'profile', or 'static'
        this.options = options; // { phaneraKey: 'residence/home', did: 'user_did' }
        this.backgroundLayer = null;
        this.currentPhanera = '';
        this.userSession = null;
    }

    async init() {
        // Create the background structure if it doesn't exist
        this.createBackgroundStructure();
        
        // Apply initial fade-in setup
        this.setupBackgroundFadeIn();
        
        // Load based on mode
        switch (this.mode) {
            case 'user':
                await this.loadUserMode();
                break;
            case 'profile':
                await this.loadProfileMode();
                break;
            case 'static':
                this.loadStaticMode();
                break;
            default:
                console.warn(`[background] Unknown mode: ${this.mode}`);
        }
        
        // Listen for phanera updates (when user changes their selection in dashboard)
        this.setupEventListeners();
    }

    createBackgroundStructure() {
        // Check if background already exists
        let fullscreenBg = document.querySelector('.fullscreen-background');
        
        if (!fullscreenBg) {
            console.warn('[background] Background structure not found in DOM');
            return;
        }
        
        this.backgroundLayer = fullscreenBg.querySelector('.background-layer');
        
        if (!this.backgroundLayer) {
            console.warn('[background] Background layer not found');
        }
    }

    setupBackgroundFadeIn() {
        if (!this.backgroundLayer) return;
        
        // If image is already loaded (cached), fade it in immediately
        if (this.backgroundLayer.complete && this.backgroundLayer.naturalHeight !== 0) {
            this.backgroundLayer.classList.add('loaded');
            this.backgroundLayer.style.opacity = '1';
        } else {
            // Otherwise wait for it to load
            this.backgroundLayer.addEventListener('load', () => {
                this.backgroundLayer.classList.add('loaded');
                this.backgroundLayer.style.opacity = '1';
            });
            
            // Also handle error case
            this.backgroundLayer.addEventListener('error', () => {
                // Still fade in even on error to show fallback
                this.backgroundLayer.classList.add('loaded');
                this.backgroundLayer.style.opacity = '1';
            });
        }
    }

    setupEventListeners() {
        // Listen for phanera updates (only relevant for user mode)
        if (this.mode === 'user') {
            window.addEventListener('phaneraUpdated', (e) => {
                if (e.detail && e.detail.phanera !== undefined) {
                    this.updatePhanera(e.detail.phanera);
                }
            });
        }
    }

    /**
     * Load background for user mode (shows logged-in user's phanera)
     */
    async loadUserMode() {
        // Check if user is logged in
        this.userSession = window.oauthManager?.getSession();
        
        if (!this.userSession) {
            // Not logged in - hide phanera, show user color
            this.hidePhaneraBackground();
            return;
        }
        
        try {
            // Fetch user's dreamer data to get phanera selection
            const response = await fetch('/api/dreamers');
            if (!response.ok) {
                console.warn('[background] Failed to fetch dreamers');
                this.hidePhaneraBackground();
                return;
            }
            
            const dreamers = await response.json();
            const userDreamer = dreamers.find(d => d.did === this.userSession.did);
            
            if (!userDreamer) {
                console.warn('[background] User dreamer not found');
                this.hidePhaneraBackground();
                return;
            }
            
            // Get user's selected phanera (empty string means no phanera = user color)
            const userPhanera = userDreamer.phanera || '';
            
            // Apply the background based on phanera selection
            if (userPhanera) {
                // User has a phanera selected - show it
                this.showPhaneraBackground(userPhanera);
            } else {
                // User has no phanera (empty string) - show user color
                this.hidePhaneraBackground();
            }
            
        } catch (error) {
            console.error('[background] Error loading user phanera:', error);
            this.hidePhaneraBackground();
        }
    }

    /**
     * Load background for profile mode (shows viewed profile's phanera)
     */
    async loadProfileMode() {
        const dreamer = this.options.dreamer;
        
        if (!dreamer) {
            console.warn('[background] No dreamer provided for profile mode');
            // Default to residence
            this.showPhaneraBackground('residence/home');
            return;
        }

        // Start with default - always show residence first
        this.showPhaneraBackground('residence/home');
        
        // Wait a bit for default to show, then transition to dreamer's phanera if they have one
        if (dreamer.phanera && dreamer.phanera !== '') {
            setTimeout(() => {
                this.showPhaneraBackground(dreamer.phanera);
            }, 1500); // 1.5 second delay to let default show first
        }
    }

    /**
     * Load background for static mode (shows a specific phanera)
     */
    loadStaticMode() {
        const phaneraKey = this.options.phaneraKey || 'residence/home';
        this.showPhaneraBackground(phaneraKey);
    }

    /**
     * Show phanera background image
     */
    showPhaneraBackground(phaneraKey) {
        if (!this.backgroundLayer) return;
        
        // Normalize the phanera key
        const normalizedKey = phaneraKey || 'residence/home';
        
        // Don't change if it's already the current phanera
        if (this.currentPhanera === normalizedKey) {
            return;
        }
        
        // Store current phanera
        this.currentPhanera = normalizedKey;
        
        // Show the fullscreen background container
        const fullscreenBg = document.querySelector('.fullscreen-background');
        if (fullscreenBg) {
            fullscreenBg.style.display = 'block';
        }
        
        // Construct the phanera image path
        const phaneraPath = `/souvenirs/${normalizedKey}/phanera.png`;
        
        // Preload the image for smooth transition
        const img = new Image();
        img.onload = () => {
            // Fade out current image
            this.backgroundLayer.style.opacity = '0';
            
            // Change source after fade
            setTimeout(() => {
                this.backgroundLayer.src = phaneraPath;
                this.backgroundLayer.alt = `Phanera ${normalizedKey}`;
                
                // Fade in new image
                setTimeout(() => {
                    this.backgroundLayer.style.opacity = '1';
                }, 50);
            }, 800); // Match CSS transition duration
        };
        
        img.onerror = () => {
            console.warn(`[background] Failed to load phanera: ${phaneraPath}, keeping current`);
            // Keep current background on error
        };
        
        img.src = phaneraPath;
        
        // Make body transparent so phanera shows through
        document.body.style.backgroundColor = 'transparent';
    }

    /**
     * Hide phanera background and show user color
     */
    hidePhaneraBackground() {
        if (!this.backgroundLayer) return;
        
        // Clear current phanera
        this.currentPhanera = '';
        
        // Fade out and hide the background layer
        this.backgroundLayer.style.opacity = '0';
        
        setTimeout(() => {
            const fullscreenBg = document.querySelector('.fullscreen-background');
            if (fullscreenBg) {
                fullscreenBg.style.display = 'none';
            }
        }, 800); // Match CSS transition duration
        
        // Make sure body shows the user color
        document.body.style.backgroundColor = 'var(--page-background-color)';
    }

    /**
     * Update the phanera (called from dashboard when user changes their phanera selection)
     * @param {string} newPhanera - The new phanera key (empty string means user color)
     */
    updatePhanera(newPhanera) {
        if (newPhanera) {
            // User selected a phanera - show it
            this.showPhaneraBackground(newPhanera);
        } else {
            // User cleared phanera (set to default) - show user color
            this.hidePhaneraBackground();
        }
    }

    /**
     * Set dreamer for profile mode (used when profile data loads)
     * @param {Object} dreamer - The dreamer object with phanera property
     */
    setDreamer(dreamer) {
        if (this.mode !== 'profile') {
            console.warn('[background] setDreamer only works in profile mode');
            return;
        }
        
        this.options.dreamer = dreamer;
        this.loadProfileMode();
    }
}

console.log('✅ [background.js] Universal background widget loaded');
