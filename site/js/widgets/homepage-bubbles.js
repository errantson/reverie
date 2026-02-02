/**
 * Homepage Floating Bubbles
 * 
 * Natural physics simulation for souvenir bubbles drifting on the wind.
 * Features:
 * - Unified wind current affecting all bubbles
 * - Individual trajectory variance per bubble
 * - Bubble-to-bubble collision/bumping
 * - Physics-based rotation from movement and collisions
 * - Buoyancy and gentle turbulence
 */

class HomepageBubbles {
    constructor() {
        this.bubbleContainer = null;
        this.souvenirsData = null;
        this.autoBubbleInterval = null;
        this.initialized = false;
        this.maxBubbles = 10; // Maximum bubbles on screen
        this.activeBubbles = []; // Physics objects
        this.isPageVisible = true;
        this.isActive = true;
        this.rafId = null;
        this.lastTime = 0;
        this.hasSpawnedFirstClickBubble = false; // Track if first-click bubble was spawned
        this.clickCount = 0; // Track total clicks for chance-based spawning
        
        // Spawn timing
        this.spawnRate = 4000;
        this.minSpawnRate = 3000;
        this.maxSpawnRate = 6000;
        
        // Wind system - unified lateral current
        this.wind = {
            baseX: 55,      // Base horizontal wind speed (pixels/sec)
            baseY: 0,       // No vertical bias - let bubbles float naturally
            gustX: 0,       // Current gust modifier
            gustY: 0,
            gustPhase: 0,   // For smooth gust transitions
            gustFreq: 0.25, // How often gusts change
        };
        
        // Physics constants
        this.physics = {
            drag: 0.992,           // Less drag = maintain speed longer
            buoyancy: -5,          // Subtle upward tendency
            turbulenceScale: 2.5,  // Much stronger individual turbulence for vertical variance
            collisionForce: 200,   // Strong bounce force - bumper bubbles!
            restitution: 1.4,      // Bouncy! >1 means they bounce apart harder
            rotationDrag: 0.94,    // Rotation damping
            rotationFromVelocity: 0.2, // How much velocity affects rotation
            collisionSpin: 0.8,    // How much collisions add spin
        };
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        // Create bubble container
        this.bubbleContainer = document.createElement('div');
        this.bubbleContainer.className = 'homepage-bubbles';
        this.bubbleContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
            overflow: hidden;
        `;
        document.body.appendChild(this.bubbleContainer);

        // Set up visibility handling
        this.setupVisibilityHandling();

        // Load souvenirs data first, then start bubbles
        await this.loadSouvenirsData();

        // Start bubbles and physics immediately after data is ready
        this.startBubbles();
        this.startPhysicsLoop();
    }

    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            if (!this.isPageVisible) {
                // Pause spawning when hidden
                if (this.autoBubbleInterval) {
                    clearInterval(this.autoBubbleInterval);
                    this.autoBubbleInterval = null;
                }
                // Keep only a few bubbles
                while (this.activeBubbles.length > 3) {
                    const bubble = this.activeBubbles.pop();
                    bubble.element?.remove();
                }
            } else {
                // Resume when visible
                if (!this.autoBubbleInterval && this.isActive) {
                    this.startBubbles();
                }
                this.lastTime = performance.now();
            }
        });
    }

    async loadSouvenirsData() {
        try {
            const response = await fetch('/api/souvenirs');
            const rawData = await response.json();

            // Build list of all icons we need
            const iconsToLoad = [];
            
            // Souvenir icons
            for (const [key, souvenir] of Object.entries(rawData)) {
                if (souvenir.icon) {
                    iconsToLoad.push({
                        url: souvenir.icon,
                        key: key,
                        name: souvenir.name
                    });
                }
            }
            
            // Special bubble icons for non-logged-in users
            const specialIcons = [
                { url: '/souvenirs/residence/icon.png', key: '_residence', name: 'Residence', action: 'login' },
                { url: '/souvenirs/letter/invite/icon.png', key: '_invite', name: 'Invite', action: 'login' },
                { url: '/souvenirs/bell/icon.png', key: '_bell', name: 'Bell', action: 'dialogue' },
                { url: '/souvenirs/dream/strange/icon.png', key: '_strange', name: 'Strange', action: 'dialogue' },
                { url: '/assets/icon_face.png', key: '_errantson', name: 'Errantson', action: 'dialogue' }
            ];
            iconsToLoad.push(...specialIcons);
            
            // Load all images and store in cache
            this.imageCache = new Map();
            
            await Promise.all(iconsToLoad.map(item => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => {
                        this.imageCache.set(item.url, {
                            img: img,
                            key: item.key,
                            name: item.name,
                            action: item.action || 'souvenir'
                        });
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn('🫧 [Bubbles] Failed to load:', item.url);
                        resolve();
                    };
                    img.src = item.url;
                });
            }));
            
            console.log(`🫧 [Bubbles] Loaded ${this.imageCache.size} images`);
            
            // Build souvenir keys list (excluding special _ prefixed ones)
            this.souvenirKeys = [...this.imageCache.keys()].filter(url => {
                const data = this.imageCache.get(url);
                return data && !data.key.startsWith('_');
            });
            
            // Build special bubble list
            this.specialBubbles = [...this.imageCache.entries()]
                .filter(([url, data]) => data.key.startsWith('_') && data.key !== '_errantson')
                .map(([url, data]) => ({ url, ...data }));
            
            // Mark as ready
            this.souvenirsData = true;
            
        } catch (err) {
            console.error('Error loading souvenirs:', err);
        }
    }

    startBubbles() {
        if (this.autoBubbleInterval || !this.souvenirsData) return;

        const spawnBubble = () => {
            if (!this.souvenirsData || !this.isPageVisible || !this.imageCache) return;
            
            // Clean dead bubbles
            this.activeBubbles = this.activeBubbles.filter(b => b.element?.parentNode);
            
            if (this.activeBubbles.length >= this.maxBubbles) return;

            // Check if user is logged in
            const isLoggedIn = window.oauthManager?.getSession()?.did;
            
            if (!isLoggedIn && this.specialBubbles.length > 0) {
                // For non-logged-in users, spawn special action bubbles
                const special = this.specialBubbles[Math.floor(Math.random() * this.specialBubbles.length)];
                this.createBubbleFromCache(special.url);
            } else if (this.souvenirKeys.length > 0) {
                // For logged-in users, spawn regular souvenir bubbles
                const url = this.souvenirKeys[Math.floor(Math.random() * this.souvenirKeys.length)];
                this.createBubbleFromCache(url);
            }
        };

        spawnBubble();

        this.autoBubbleInterval = setInterval(() => {
            spawnBubble();
            // Vary spawn rate
            this.spawnRate = this.minSpawnRate + Math.random() * (this.maxSpawnRate - this.minSpawnRate);
        }, this.spawnRate);
    }

    /**
     * Create a bubble using a pre-loaded image from cache
     * This is the ONLY way bubbles should be created - guarantees image is ready
     */
    createBubbleFromCache(iconUrl) {
        if (!this.bubbleContainer || !this.imageCache) return;
        
        const cached = this.imageCache.get(iconUrl);
        if (!cached || !cached.img) {
            console.warn('🫧 [Bubbles] Image not in cache:', iconUrl);
            return;
        }
        
        const { img, key, name, action } = cached;
        
        const size = 50 + Math.random() * 30;
        const bubble = document.createElement('div');
        
        bubble.className = 'homepage-bubble';
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
            opacity: 0;
            transition: opacity 0.5s ease, box-shadow 0.2s ease;
            will-change: transform;
        `;

        // Clone the cached image - this is instant, no network request
        const icon = img.cloneNode(true);
        icon.style.cssText = `
            width: ${size * 0.80}px;
            height: ${size * 0.80}px;
            opacity: 0.85;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
        `;

        bubble.appendChild(icon);
        
        // Click handler based on action type
        bubble.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            if (action === 'login') {
                if (window.loginWidget) {
                    window.loginWidget.showLoginPopup();
                }
            } else if (action === 'dialogue') {
                if (window.Shadowbox) {
                    const shadowbox = new window.Shadowbox({ showCloseButton: false });
                    await shadowbox.showDialogue('core:welcome');
                }
            } else if (action === 'souvenir' && key && !key.startsWith('_')) {
                const isLoggedIn = window.oauthManager?.getSession()?.did;
                if (isLoggedIn) {
                    window.location.href = `/souvenirs?key=${key}`;
                }
            }
        });

        // Hover effect
        bubble.addEventListener('mouseenter', () => {
            bubble.style.boxShadow = '0 6px 30px rgba(0,0,0,0.25), inset -4px -4px 20px rgba(0,0,0,0.12), inset 4px 4px 18px rgba(255,255,255,0.6)';
        });
        bubble.addEventListener('mouseleave', () => {
            bubble.style.boxShadow = '';
        });

        this.bubbleContainer.appendChild(bubble);

        // Spawn from left edge at random height
        const startX = -size - 20;
        const startY = 80 + Math.random() * (window.innerHeight - 200);

        // Physics state
        const bubbleData = {
            element: bubble,
            size: size,
            radius: size / 2,
            mass: size / 60,
            x: startX,
            y: startY,
            vx: 10 + Math.random() * 60,
            vy: (Math.random() - 0.5) * 80,
            rotation: Math.random() * 360,
            angularVel: (Math.random() - 0.5) * 50,
            windSensitivity: 0.5 + Math.random() * 1.0,
            turbulencePhase: Math.random() * Math.PI * 2,
            turbulenceFreq: 0.3 + Math.random() * 0.8,
            verticalDrift: (Math.random() - 0.5) * 25,
            buoyancyFactor: 0.5 + Math.random() * 1.0,
            age: 0,
            opacity: 0,
        };

        this.activeBubbles.push(bubbleData);

        // Fade in
        requestAnimationFrame(() => {
            bubble.style.opacity = '0.9';
            bubbleData.opacity = 0.9;
        });
    }

    /**
     * Create a souvenir bubble at a specific position (for first-click interaction)
     * Uses the largest bubble size and spawns with physics already active
     * First bubble uses errantson face icon and opens dialogue
     * @param {number} x - X position to spawn at
     * @param {number} y - Y position to spawn at
     * @returns {boolean} - True if bubble was created successfully
     */
    createBubbleAt(x, y) {
        if (!this.bubbleContainer || !this.imageCache) return false;
        
        // First bubble is always errantson face - get from cache
        const iconUrl = '/assets/icon_face.png';
        const cached = this.imageCache.get(iconUrl);
        if (!cached || !cached.img) {
            console.warn('🫧 [Bubbles] Errantson image not in cache');
            return false;
        }
        
        // Use the largest size (80px - the max of normal spawn range)
        const size = 80;
        const bubble = document.createElement('div');
        
        bubble.className = 'homepage-bubble first-click-bubble';
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
            opacity: 0;
            transition: opacity 0.6s ease, box-shadow 0.2s ease;
            will-change: transform;
        `;

        // Clone the cached image - instant, no network request
        const icon = cached.img.cloneNode(true);
        icon.style.cssText = `
            width: ${size * 0.80}px;
            height: ${size * 0.80}px;
            opacity: 0.85;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
        `;

        bubble.appendChild(icon);
        
        // Click to open errantson dialogue (same as header button)
        bubble.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (window.Shadowbox) {
                const shadowbox = new window.Shadowbox({ showCloseButton: false });
                await shadowbox.showDialogue('core:welcome');
            }
        });

        // Hover effect
        bubble.addEventListener('mouseenter', () => {
            bubble.style.boxShadow = '0 6px 30px rgba(0,0,0,0.25), inset -4px -4px 20px rgba(0,0,0,0.12), inset 4px 4px 18px rgba(255,255,255,0.6)';
        });
        bubble.addEventListener('mouseleave', () => {
            bubble.style.boxShadow = '';
        });

        this.bubbleContainer.appendChild(bubble);

        // Position centered on click point
        const startX = x - size / 2;
        const startY = y - size / 2;

        // Physics state - spawn with gentle initial velocity influenced by wind direction
        const bubbleData = {
            element: bubble,
            size: size,
            radius: size / 2,
            mass: size / 60,
            x: startX,
            y: startY,
            vx: 15 + Math.random() * 25,
            vy: (Math.random() - 0.5) * 30,
            rotation: Math.random() * 360,
            angularVel: (Math.random() - 0.5) * 30,
            windSensitivity: 0.6 + Math.random() * 0.8,
            turbulencePhase: Math.random() * Math.PI * 2,
            turbulenceFreq: 0.3 + Math.random() * 0.8,
            verticalDrift: (Math.random() - 0.5) * 20,
            buoyancyFactor: 0.6 + Math.random() * 0.8,
            
            // State
            age: 0,
            opacity: 0,
        };

        this.activeBubbles.push(bubbleData);

        // Fade in with a gentle appearance
        requestAnimationFrame(() => {
            bubble.style.opacity = '0.9';
            bubbleData.opacity = 0.9;
        });
        
        console.log(`🫧 First-click bubble spawned: ${iconName} at (${x}, ${y})`);
        return true;
    }

    /**
     * Handle click to potentially spawn a bubble
     * - First click: Always spawns errantson face bubble that opens dialogue
     * - Clicks 2-5: No bubble spawning
     * - Clicks 6+: 1 in 8 chance to spawn a small souvenir bubble
     * @param {number} x - Click X position
     * @param {number} y - Click Y position
     * @returns {boolean} - True if a bubble was spawned
     */
    handleFirstClick(x, y) {
        this.clickCount++;
        
        // Wait for images to be loaded
        if (!this.imageCache || this.imageCache.size === 0) {
            return false;
        }
        
        // First click: always spawn large bubble
        if (!this.hasSpawnedFirstClickBubble) {
            this.hasSpawnedFirstClickBubble = true;
            return this.createBubbleAt(x, y);
        }
        
        // After 5th click: 1 in 8 chance to spawn a small bubble
        if (this.clickCount > 5 && Math.random() < 0.125) {
            return this.createSmallBubbleAt(x, y);
        }
        
        return false;
    }

    /**
     * Create a small souvenir bubble at a specific position (for chance-based spawning)
     * @param {number} x - X position to spawn at
     * @param {number} y - Y position to spawn at
     * @returns {boolean} - True if bubble was created successfully
     */
    createSmallBubbleAt(x, y) {
        if (!this.bubbleContainer || !this.imageCache || this.souvenirKeys.length === 0) return false;
        
        // Pick a random souvenir from cache
        const url = this.souvenirKeys[Math.floor(Math.random() * this.souvenirKeys.length)];
        const cached = this.imageCache.get(url);
        if (!cached || !cached.img) return false;
        
        const { img, key, name } = cached;
        
        // Use the smallest size (50px)
        const size = 50;
        const bubble = document.createElement('div');
        
        bubble.className = 'homepage-bubble click-spawned-bubble';
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
            opacity: 0;
            transition: opacity 0.5s ease, box-shadow 0.2s ease;
            will-change: transform;
        `;

        // Clone cached image
        const icon = img.cloneNode(true);
        icon.style.cssText = `
            width: ${size * 0.80}px;
            height: ${size * 0.80}px;
            opacity: 0.85;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
        `;

        bubble.appendChild(icon);
        
        // Click to navigate
        bubble.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/souvenirs?key=${key}`;
        });

        // Hover effect
        bubble.addEventListener('mouseenter', () => {
            bubble.style.boxShadow = '0 6px 30px rgba(0,0,0,0.25), inset -4px -4px 20px rgba(0,0,0,0.12), inset 4px 4px 18px rgba(255,255,255,0.6)';
        });
        bubble.addEventListener('mouseleave', () => {
            bubble.style.boxShadow = '';
        });

        this.bubbleContainer.appendChild(bubble);

        // Position centered on click point
        const startX = x - size / 2;
        const startY = y - size / 2;

        // Physics state
        const bubbleData = {
            element: bubble,
            size: size,
            radius: size / 2,
            mass: size / 60,
            x: startX,
            y: startY,
            vx: 10 + Math.random() * 20,
            vy: (Math.random() - 0.5) * 25,
            rotation: Math.random() * 360,
            angularVel: (Math.random() - 0.5) * 40,
            windSensitivity: 0.7 + Math.random() * 0.6,
            turbulencePhase: Math.random() * Math.PI * 2,
            turbulenceFreq: 0.4 + Math.random() * 0.6,
            verticalDrift: (Math.random() - 0.5) * 15,
            buoyancyFactor: 0.7 + Math.random() * 0.6,
            age: 0,
            opacity: 0,
        };

        this.activeBubbles.push(bubbleData);

        // Fade in
        requestAnimationFrame(() => {
            bubble.style.opacity = '0.9';
            bubbleData.opacity = 0.9;
        });
        
        console.log(`🫧 Bonus bubble spawned: ${name} at (${x}, ${y})`);
        return true;
    }

    startPhysicsLoop() {
        this.lastTime = performance.now();
        
        const update = (currentTime) => {
            if (!this.isActive) return;
            
            // Calculate delta time (cap at 100ms to prevent huge jumps)
            const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
            this.lastTime = currentTime;
            
            // Only update when visible
            if (this.isPageVisible && dt > 0) {
                this.updateWind(dt);
                this.updateBubbles(dt);
                this.handleCollisions();
                this.renderBubbles();
            }
            
            this.rafId = requestAnimationFrame(update);
        };
        
        this.rafId = requestAnimationFrame(update);
    }

    updateWind(dt) {
        // Smooth gusting wind
        this.wind.gustPhase += dt * this.wind.gustFreq;
        
        // Perlin-like smooth transitions using multiple sine waves
        this.wind.gustX = Math.sin(this.wind.gustPhase) * 15 
                        + Math.sin(this.wind.gustPhase * 2.3) * 8
                        + Math.sin(this.wind.gustPhase * 0.7) * 5;
        
        this.wind.gustY = Math.sin(this.wind.gustPhase * 1.1 + 1) * 10
                        + Math.sin(this.wind.gustPhase * 0.5 + 2) * 6;
    }

    updateBubbles(dt) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        for (let i = this.activeBubbles.length - 1; i >= 0; i--) {
            const b = this.activeBubbles[i];
            
            if (!b.element?.parentNode) {
                this.activeBubbles.splice(i, 1);
                continue;
            }
            
            b.age += dt;
            
            // === FORCES ===
            
            // 1. Wind force (unified + individual sensitivity)
            const windX = (this.wind.baseX + this.wind.gustX) * b.windSensitivity;
            const windY = (this.wind.baseY + this.wind.gustY) * b.windSensitivity + b.verticalDrift;
            
            // 2. Buoyancy (subtle, varies per bubble)
            const buoyancy = this.physics.buoyancy * b.buoyancyFactor;
            
            // 3. Individual turbulence - strong vertical variance
            const turbTime = b.age * b.turbulenceFreq + b.turbulencePhase;
            const turbX = Math.sin(turbTime * 2.1) * this.physics.turbulenceScale * 5
                        + Math.sin(turbTime * 4.7) * this.physics.turbulenceScale * 3;
            const turbY = Math.sin(turbTime * 1.3 + 1.5) * this.physics.turbulenceScale * 18
                        + Math.cos(turbTime * 2.8) * this.physics.turbulenceScale * 12
                        + Math.sin(turbTime * 0.7) * this.physics.turbulenceScale * 8;
            
            // Apply forces (F = ma, so a = F/m)
            const ax = (windX + turbX) / b.mass;
            const ay = (windY + buoyancy + turbY) / b.mass;
            
            // Update velocity
            b.vx += ax * dt;
            b.vy += ay * dt;
            
            // Apply drag
            b.vx *= this.physics.drag;
            b.vy *= this.physics.drag;
            
            // Update position
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            
            // === ROTATION ===
            // Rotation influenced by horizontal velocity and turbulence
            const velocityRotation = b.vx * this.physics.rotationFromVelocity;
            b.angularVel += (velocityRotation - b.angularVel * 0.1) * dt;
            b.angularVel *= this.physics.rotationDrag;
            b.rotation += b.angularVel * dt;
            
            // === BOUNDARIES ===
            // Let bubbles flow freely past header/drawer - no top/bottom collision
            // Only remove bubbles that go too far off-screen vertically
            if (b.y < -b.size - 100 || b.y > screenHeight + b.size + 100) {
                b.element.remove();
                this.activeBubbles.splice(i, 1);
                continue;
            }
            
            // Remove if off right edge
            if (b.x > screenWidth + 100) {
                b.element.remove();
                this.activeBubbles.splice(i, 1);
                continue;
            }
            
            // Fade out near right edge
            if (b.x > screenWidth - 150) {
                b.opacity = Math.max(0, 0.9 * (1 - (b.x - (screenWidth - 150)) / 150));
            }
        }
    }

    handleCollisions() {
        // Check each pair of bubbles for collision - bumper bubble physics!
        for (let i = 0; i < this.activeBubbles.length; i++) {
            for (let j = i + 1; j < this.activeBubbles.length; j++) {
                const a = this.activeBubbles[i];
                const b = this.activeBubbles[j];
                
                // Distance between centers
                const dx = b.x + b.radius - (a.x + a.radius);
                const dy = b.y + b.radius - (a.y + a.radius);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = a.radius + b.radius;
                
                // Check for collision
                if (dist < minDist && dist > 0) {
                    // Normalize collision vector
                    const nx = dx / dist;
                    const ny = dy / dist;
                    
                    // Relative velocity
                    const dvx = a.vx - b.vx;
                    const dvy = a.vy - b.vy;
                    
                    // Relative velocity along collision normal
                    const dvn = dvx * nx + dvy * ny;
                    
                    // Always resolve - bumper bubbles bounce hard!
                    // Impulse based on mass with restitution > 1 for extra bounce
                    const totalMass = a.mass + b.mass;
                    const restitution = this.physics.restitution;
                    const impulseA = (1 + restitution) * (b.mass / totalMass) * Math.abs(dvn);
                    const impulseB = (1 + restitution) * (a.mass / totalMass) * Math.abs(dvn);
                    
                    // Apply impulse - bounce apart
                    a.vx -= impulseA * nx;
                    a.vy -= impulseA * ny;
                    b.vx += impulseB * nx;
                    b.vy += impulseB * ny;
                    
                    // Add extra separation velocity for that bumper feel
                    const bumpBoost = 30;
                    a.vx -= bumpBoost * nx;
                    a.vy -= bumpBoost * ny;
                    b.vx += bumpBoost * nx;
                    b.vy += bumpBoost * ny;
                    
                    // Strong spin from collision
                    const tangent = dvx * (-ny) + dvy * nx;
                    a.angularVel += tangent * this.physics.collisionSpin;
                    b.angularVel -= tangent * this.physics.collisionSpin;
                    
                    // Separate overlapping bubbles
                    const overlap = minDist - dist;
                    const separateX = (overlap / 2 + 1) * nx;
                    const separateY = (overlap / 2 + 1) * ny;
                    a.x -= separateX;
                    a.y -= separateY;
                    b.x += separateX;
                    b.y += separateY;
                }
            }
        }
    }

    renderBubbles() {
        for (const b of this.activeBubbles) {
            if (!b.element) continue;
            
            b.element.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.rotation}deg)`;
            b.element.style.opacity = b.opacity;
        }
    }

    cleanup() {
        console.log('🧹 Cleaning up HomepageBubbles...');
        
        this.isActive = false;
        
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        if (this.autoBubbleInterval) {
            clearInterval(this.autoBubbleInterval);
            this.autoBubbleInterval = null;
        }
        
        this.activeBubbles.forEach(b => b.element?.remove());
        this.activeBubbles = [];
        
        if (this.bubbleContainer?.parentNode) {
            this.bubbleContainer.remove();
            this.bubbleContainer = null;
        }
        
        console.log('✅ HomepageBubbles cleanup complete');
    }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    window.homepageBubbles = new HomepageBubbles();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.homepageBubbles.init();
        });
    } else {
        window.homepageBubbles.init();
    }
}

console.log('✅ [homepage-bubbles.js] Homepage bubbles widget loaded');
