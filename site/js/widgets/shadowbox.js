/**
 * Shadowbox Widget
 * 
 * A standardized fullscreen image viewer with optional bubble effects.
 * Displays images in a centered, darkroom-style overlay.
 * 
 * Usage:
 * 1. Include this script: <script src="/js/widgets/shadowbox.js" defer></script>
 * 2. Call: Shadowbox.show(imageUrl, imageName, options)
 * 
 * Options:
 * - enableBubbles: boolean (default: false) - Enable floating bubble effects
 * - enableGrowth: boolean (default: false) - Enable idle growth animation
 * - bubbleDelay: number (default: 10000) - MS before bubbles start
 * - growthDelay: number (default: 5000) - MS before growth starts after bubbles
 */

class ShadowboxWidget {
    constructor() {
        this.overlay = null;
        this.image = null;
        this.bubbleContainer = null;
        this.souvenirsData = null;
        this.dreamersData = null;
        this.autoBubbleInterval = null;
        this.idleChecker = null;
        this.growthTimeout = null;
        this.lastInteractionTime = Date.now();
        this.growthStarted = false;
        this.growthCancel = false;
        this.growthActive = false;
        this.options = {};
    }

    show(imageUrl, imageName = '', options = {}) {
        // Default options
        this.options = {
            enableBubbles: false,
            enableGrowth: false,
            bubbleDelay: 10000,
            growthDelay: 5000,
            ...options
        };

        this.cleanup(); // Clean up any existing shadowbox
        this.lastInteractionTime = Date.now();
        this.growthStarted = false;
        this.growthCancel = false;
        this.growthActive = false;

        // Create darkroom overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'shadowbox-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.92);
            z-index: 9500;
            opacity: 0;
            transition: opacity 0.3s ease;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        document.body.appendChild(this.overlay);

        // Create bubble container if needed
        if (this.options.enableBubbles) {
            this.bubbleContainer = document.createElement('div');
            this.bubbleContainer.className = 'shadowbox-bubbles';
            this.bubbleContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9501;
            `;
            document.body.appendChild(this.bubbleContainer);
        }

        // Create centered image
        this.image = document.createElement('img');
        this.image.src = imageUrl;
        this.image.alt = imageName;
        this.image.className = 'shadowbox-image';
        this.image.style.cssText = `
            max-width: 85vw;
            max-height: 85vh;
            border: 1px solid rgba(255, 255, 255, 0.3);
            opacity: 0;
            transform: scale(0.95);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            position: relative;
            z-index: 9502;
            object-fit: contain;
        `;
        this.overlay.appendChild(this.image);

        // Fade in animation
        setTimeout(() => {
            this.overlay.style.opacity = '1';
            this.image.style.opacity = '1';
            this.image.style.transform = 'scale(1)';
        }, 10);

        // Set up event listeners
        this.overlay.addEventListener('click', () => this.close());
        this.image.addEventListener('click', (e) => {
            e.stopPropagation();
            // Allow clicking image to close if not in growth mode
            if (!this.growthActive) {
                this.close();
            }
        });

        // Set up interaction tracking for bubbles/growth
        if (this.options.enableBubbles || this.options.enableGrowth) {
            this.setupInteractionTracking();
        }

        // Load souvenirs data for bubbles
        if (this.options.enableBubbles && !this.souvenirsData) {
            this.loadSouvenirsData();
        }
        
        // Load dreamers data for bubble filtering
        if (this.options.enableBubbles && !this.dreamersData) {
            this.loadDreamersData();
        }

        // ESC key to close
        document.addEventListener('keydown', this.handleEscape);
    }

    setupInteractionTracking() {
        const resetInteraction = () => {
            this.lastInteractionTime = Date.now();
        };

        // Track mouse/touch interactions
        const mouseMoveHandler = (e) => {
            resetInteraction();
            if (this.growthStarted && !this.growthCancel) {
                this.growthCancel = true;
                this.resetImageSize();
            }
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('touchstart', mouseMoveHandler);
        document.addEventListener('touchmove', mouseMoveHandler);
        this.overlay.addEventListener('wheel', mouseMoveHandler);

        // Store for cleanup
        this._mouseMoveHandler = mouseMoveHandler;

        // Start idle checker
        this.idleChecker = setInterval(() => this.checkIdleState(), 1000);
    }

    checkIdleState() {
        const idleTime = Date.now() - this.lastInteractionTime;

        if (idleTime >= this.options.bubbleDelay) {
            // Start bubble flow - only if we have both souvenirs and dreamers data
            if (this.options.enableBubbles && !this.autoBubbleInterval && this.souvenirsData && this.dreamersData) {
                this.startBubbles();
            }
        } else {
            // Clear bubbles if user interacts
            this.stopBubbles();
        }
    }

    startBubbles() {
        if (this.autoBubbleInterval) return;

        // Filter to only claimed souvenirs
        const claimedSouvenirs = this.getClaimedSouvenirs();
        if (claimedSouvenirs.length === 0) {
            console.log('No claimed souvenirs for bubbles');
            return;
        }

        this.autoBubbleInterval = setInterval(() => {
            if (!this.souvenirsData || !this.dreamersData) return;

            const claimedSouvenirs = this.getClaimedSouvenirs();
            if (claimedSouvenirs.length === 0) return;

            const randomKey = claimedSouvenirs[Math.floor(Math.random() * claimedSouvenirs.length)];
            const souvenir = this.souvenirsData[randomKey];
            const latestForm = souvenir.forms[souvenir.forms.length - 1];

            this.createBubble(latestForm.icon, randomKey, latestForm.name);
        }, 3000);

        // Start growth after additional delay
        if (this.options.enableGrowth && !this.growthTimeout) {
            this.growthTimeout = setTimeout(() => {
                if (!this.growthCancel) {
                    this.startGrowth();
                }
            }, this.options.growthDelay);
        }
    }

    stopBubbles() {
        if (this.autoBubbleInterval) {
            clearInterval(this.autoBubbleInterval);
            this.autoBubbleInterval = null;
        }
        if (this.growthTimeout) {
            clearTimeout(this.growthTimeout);
            this.growthTimeout = null;
        }
    }

    startGrowth() {
        if (this.growthStarted || !this.image) return;

        this.growthStarted = true;
        this.image.style.transition = 'all 7s cubic-bezier(0.4, 0, 0.2, 1)';
        this.image.style.maxWidth = '96vw';
        this.image.style.maxHeight = '96vh';
        this.image.style.border = 'none';
        this.image.style.transform = 'scale(1.08)';

        setTimeout(() => {
            if (!this.growthCancel) {
                this.growthActive = true;
            }
        }, 7000);
    }

    resetImageSize() {
        if (!this.image) return;

        this.image.style.transition = 'all 0.5s ease';
        this.image.style.maxWidth = '85vw';
        this.image.style.maxHeight = '85vh';
        this.image.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        this.image.style.transform = 'scale(1)';
        this.growthStarted = false;
        this.growthActive = false;
    }

    createBubble(iconUrl, key, name) {
        if (!this.bubbleContainer) return;

        const bubble = document.createElement('div');
        const size = 50 + Math.random() * 30; // 50-80px
        bubble.className = 'shadowbox-bubble';
        bubble.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(200,220,255,0.4));
            border: 2px solid rgba(255,255,255,0.5);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15), 
                        inset -3px -3px 15px rgba(0,0,0,0.08),
                        inset 3px 3px 12px rgba(255,255,255,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        `;

        const icon = document.createElement('img');
        icon.src = iconUrl;
        icon.alt = name;
        icon.style.cssText = `
            width: ${size * 0.80}px;
            height: ${size * 0.80}px;
            opacity: 0.85;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
            pointer-events: none;
        `;

        bubble.appendChild(icon);
        
        // Start bubbles from left side, offscreen
        const x = -100; // Start offscreen left
        const y = Math.random() * window.innerHeight; // Random vertical position

        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';

        // Click to navigate
        bubble.addEventListener('click', () => {
            window.location.href = `/souvenirs?key=${key}`;
        });

        // Hover effect - matching souvenir page
        bubble.addEventListener('mouseenter', () => {
            bubble.style.transform = 'scale(1.15)';
            bubble.style.boxShadow = '0 6px 30px rgba(0,0,0,0.25), inset -4px -4px 20px rgba(0,0,0,0.12), inset 4px 4px 18px rgba(255,255,255,0.6)';
        });
        bubble.addEventListener('mouseleave', () => {
            bubble.style.transform = 'scale(1)';
            bubble.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15), inset -3px -3px 15px rgba(0,0,0,0.08), inset 3px 3px 12px rgba(255,255,255,0.5)';
        });

        this.bubbleContainer.appendChild(bubble);

        // Animate bubble
        this.animateBubble(bubble, x, y);
    }

    animateBubble(bubble, startX, startY) {
        let x = startX;
        let y = startY;
        // Drift right across the screen with gentle vertical wobble
        let vx = 1.2 + Math.random() * 0.8; // Horizontal velocity (rightward)
        let vy = (Math.random() - 0.5) * 0.4; // Slight vertical drift
        let rotation = Math.random() * 360; // Starting rotation
        const wobbleFreq = 0.001 + Math.random() * 0.002;
        const wobbleAmp = 15 + Math.random() * 25;

        const update = () => {
            if (!bubble.parentNode) return;

            // Apply velocities
            x += vx;
            y += vy;

            // Add gentle sine wave vertical wobble
            const wobble = Math.sin(Date.now() * wobbleFreq) * wobbleAmp * 0.02;
            y += wobble;

            // Keep within vertical bounds with soft bounce
            if (y < 50) {
                y = 50;
                vy = Math.abs(vy) * 0.5;
            }
            if (y > window.innerHeight - 100) {
                y = window.innerHeight - 100;
                vy = -Math.abs(vy) * 0.5;
            }

            // Very slight damping to maintain movement
            vx *= 0.9995;
            vy *= 0.998;

            // Physics-based rotation following the wind (horizontal velocity)
            // Rotation speed proportional to horizontal velocity
            const rotationSpeed = vx * 0.3; // Gentle rotation based on wind speed
            rotation += rotationSpeed;

            bubble.style.left = x + 'px';
            bubble.style.top = y + 'px';
            bubble.style.transform = `rotate(${rotation}deg)`;

            // Fade out when exiting right side, but let them fully exit first
            const exitMargin = 200; // Let bubbles go further offscreen before destroying
            
            if (x > window.innerWidth + exitMargin) {
                bubble.remove();
                return;
            } else if (x > window.innerWidth) {
                // Start fading after passing screen edge
                const distanceBeyond = x - window.innerWidth;
                const fadeProgress = Math.min(1, distanceBeyond / exitMargin);
                bubble.style.opacity = 1 - fadeProgress;
            }

            requestAnimationFrame(update);
        };

        requestAnimationFrame(update);
    }

    async loadSouvenirsData() {
        try {
            const response = await fetch('/api/souvenirs');
            const rawData = await response.json();

            // Transform to expected format with forms array
            const transformed = {};
            for (const [key, souvenir] of Object.entries(rawData)) {
                transformed[key] = {
                    forms: [{
                        key: souvenir.key,
                        name: souvenir.name,
                        icon: souvenir.icon
                    }]
                };
            }
            this.souvenirsData = transformed;
            console.log('✅ Shadowbox souvenirs loaded:', Object.keys(transformed).length);
        } catch (err) {
            console.error('Error loading souvenirs for shadowbox:', err);
        }
    }

    async loadDreamersData() {
        try {
            const response = await fetch('/api/dreamers');
            const data = await response.json();
            this.dreamersData = data;
            console.log('✅ Shadowbox dreamers loaded:', data.length);
        } catch (err) {
            console.error('Error loading dreamers for shadowbox:', err);
        }
    }

    getClaimedSouvenirs() {
        if (!this.souvenirsData || !this.dreamersData) return [];

        const allSouvenirKeys = Object.keys(this.souvenirsData);
        const claimedSouvenirKeys = allSouvenirKeys.filter(key => {
            const souvenir = this.souvenirsData[key];
            const formKeys = souvenir.forms.map(form => form.key);
            // Check if any dreamer has claimed any form
            return this.dreamersData.some(d => {
                if (!d.souvenirs) return false;
                return formKeys.some(formKey => formKey in d.souvenirs);
            });
        });

        return claimedSouvenirKeys;
    }

    handleEscape = (e) => {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    close() {
        if (!this.overlay) return;

        // Fade out
        this.overlay.style.opacity = '0';
        if (this.image) {
            this.image.style.opacity = '0';
            this.image.style.transform = 'scale(0.95)';
        }

        setTimeout(() => {
            this.cleanup();
        }, 300);
    }

    cleanup() {
        // Clean up intervals and timeouts
        if (this.autoBubbleInterval) {
            clearInterval(this.autoBubbleInterval);
            this.autoBubbleInterval = null;
        }
        if (this.idleChecker) {
            clearInterval(this.idleChecker);
            this.idleChecker = null;
        }
        if (this.growthTimeout) {
            clearTimeout(this.growthTimeout);
            this.growthTimeout = null;
        }

        // Remove event listeners
        document.removeEventListener('keydown', this.handleEscape);
        if (this._mouseMoveHandler) {
            document.removeEventListener('mousemove', this._mouseMoveHandler);
            document.removeEventListener('touchstart', this._mouseMoveHandler);
            document.removeEventListener('touchmove', this._mouseMoveHandler);
            this._mouseMoveHandler = null;
        }

        // Remove DOM elements
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
        }
        if (this.bubbleContainer && this.bubbleContainer.parentNode) {
            this.bubbleContainer.remove();
        }

        this.overlay = null;
        this.image = null;
        this.bubbleContainer = null;
    }
}

// Export global instance
if (typeof window !== 'undefined') {
    // Export the class, not an instance, so code can create new instances
    window.Shadowbox = ShadowboxWidget;
}

