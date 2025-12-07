/**
 * HomepageScene - Interactive background experience with unified Shadowbox dialogue system
 * 
 * DIALOGUE SYSTEM:
 * ----------------
 * All dialogues now use the Shadowbox utility (same pattern as header.js) for consistency:
 * 
 * - Create a Shadowbox instance: `const shadowbox = new window.Shadowbox({ showCloseButton: false })`
 * - Show dialogue by key: `await shadowbox.showDialogue('dialogue_key', this)`
 * - Show dialogue from data: `await shadowbox.showDialogueData(dialogueData, this)`
 * 
 * The Shadowbox handles:
 * - Creating the dialogue widget instance
 * - Moving the dialogue container into the modal
 * - Managing lifecycle (init, display, cleanup)
 * - Providing callback context for button actions
 * 
 * This ensures homepage dialogues and header dialogues use exactly the same elements,
 * rendering, and behavior.
 */
class HomepageScene {
    constructor() {
        this.enableBubbles = false;
        this.patience = 100;
        this.isIdle = false;
        this.idleTimer = null;
        this.mouseTimer = null;
        this.delay_start = 1000; // 1 second before dialogue appears (was 4000)
        this.fade_duration = 3000;
        this.mouse_reset_threshold = 50;
        this.last_mouse_position = { x: 0, y: 0 };
        this.mouse_listener_active = true;
        this.bubbles_enabled = false;
        this.logoHasFaded = false;
        this.hasInteracted = false;
        this.experienceStarted = false;
        this.apexAchieved = false;
        this.apexThreshold = 3.0;
        this.apexMouseThreshold = 150;
        this.apexPatienceMultiplier = 2;
        this.sessionApexCount = 0;
        this.fade_tiers = [
            { selector: '.hero-overlay', delay: 0 },
            { selector: '.ui-overlay', delay: 0 } // Bubbles start immediately (was this.patience * 400)
        ];
        this.heroLogo = null;
        this.headerLogo = null;
        this.logoCoPlayActive = false;
        this.floatingContainer = document.querySelector('.floating-elements');
        this.backgroundLayer = document.querySelector('.background-layer');
        this.magicDustContainer = document.querySelector('.magic-dust-container');
        this.windParticlesContainer = document.querySelector('.wind-particles-container');
        this.currentPhanera = 'residence/home'; // Default phanera (matches HTML)
        this.userSession = null; // Track user session
        this.particles = [];
        this.particlePool = [];
        this.maxParticles = 45;
        this.mousePosition = { x: 0, y: 0 };
        this.laggedMousePosition = { x: 0, y: 0 };
        this.currentMousePosition = { x: 0, y: 0 };
        this.mouseHistory = [];
        this.maxHistoryLength = 3;
        this.wildParticles = [];
        this.heldParticles = [];
        this.swirlParticles = [];
        this.orphanedParticles = [];
        this.windParticles = [];
        this.totalActiveParticles = 0;
        this.lastWindParticleTime = 0;
        this.ambientWindSpawnRate = 2000;
        this.targetAmbientParticles = 23;
        this.isMousePressed = false;
        this.mouseDownTime = 0;
        this.swirlIntensity = 0;
        this.lastParticleTime = 0;
        this.lastUpdateTime = null;
        this.frameSkipCounter = 0;
        this.laggedMousePosition = { x: 0, y: 0 };
        this.currentMousePosition = { x: 0, y: 0 };
        this.windPhysics = {
            spawn_interval_min: 2000,
            spawn_interval_max: 5000,
            bubble_population_max: 3,
            avoidance_radius: 800,
            avoidance_force: 160
        };
        this.enableAmplifierPoints = false;
        this.anchorPoints = [];
        this.isHooked = false;
        this.hookedIntensityMultiplier = 1.0;
        this.collectedPoints = 0;
        this.windInterval = null;
        this.originalWindInterval = null;
        this.bubbleSystem = null;
        this.bubblesFeatureEnabled = true;
        this.isPageVisible = !document.hidden; // Track page visibility
        this.rafId = null; // MEMORY LEAK FIX: Track animation frame for cleanup
        this.isActive = true; // MEMORY LEAK FIX: Flag to stop loops
        this.currentShadowbox = null; // Track current shadowbox instance
        
        // Listen for visibility changes to prevent bubble buildup
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            if (this.isPageVisible) {
                // Page is visible again - reset timing to prevent burst
                this.lastWindParticleTime = Date.now();
                if (this.lastUpdateTime) {
                    this.lastUpdateTime = Date.now();
                }
                console.log('🌟 [homepage.js] Page visible - resetting particle timers');
            } else {
                console.log('💤 [homepage.js] Page hidden - aggressive cleanup');
                
                // MEMORY LEAK FIX: Aggressive particle cleanup when page hidden
                const particlesToKeep = 10; // Keep minimal particles
                
                // Remove excess wild particles
                while (this.wildParticles.length > particlesToKeep) {
                    const particle = this.wildParticles.pop();
                    particle.element?.remove();
                }
                
                // Remove all orphaned particles (not needed when hidden)
                this.orphanedParticles.forEach(p => {
                    p.element?.remove();
                    const idx = this.wildParticles.indexOf(p);
                    if (idx > -1) this.wildParticles.splice(idx, 1);
                });
                this.orphanedParticles = [];
                
                // Remove excess wind particles
                while (this.windParticles.length > particlesToKeep) {
                    const particle = this.windParticles.pop();
                    particle.element?.remove();
                }
                
                console.log(`🧹 Cleaned up particles - kept ${particlesToKeep} of each type`);
            }
        });
        
        if (!document.querySelector('#particle-layers-styles')) {
            const style = document.createElement('style');
            style.id = 'particle-layers-styles';
            style.textContent = `
                .wild-particle {
                    pointer-events: none;
                    z-index: 10;
                }
                .collectible-particle {
                    cursor: pointer;
                    transition: all 0.2s ease;
                    z-index: 15;
                }
                .collectible-particle:hover {
                    transform: scale(1.1) !important;
                    filter: brightness(1.5) drop-shadow(0 0 8px rgba(255,255,255,0.8)) !important;
                }
                .swirl-particle {
                    pointer-events: none;
                    z-index: 20;
                }
                .revived-particle {
                    box-shadow: 0 0 10px rgba(0,255,150,0.6);
                    z-index: 25;
                }
                @keyframes wild-to-held {
                    0% { 
                        filter: brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.5));
                    }
                    50% { 
                        filter: brightness(2) saturate(2) drop-shadow(0 0 12px rgba(0,255,150,0.8));
                        transform: scale(1.5);
                    }
                    100% { 
                        filter: none;
                        transform: scale(1.0);
                    }
                }
                @keyframes held-to-wild {
                    0% { 
                        filter: none;
                        transform: scale(1.0);
                    }
                    50% { 
                        filter: brightness(1.5) drop-shadow(0 0 8px rgba(255,100,100,0.6));
                        transform: scale(1.2);
                    }
                    100% { 
                        filter: brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.5));
                        transform: scale(1.0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        this.setupMouseTracking();
        this.initializeWindParticles();
        this.initIdleSystem();
        
        // Set up initial background image fade-in
        this.setupBackgroundFadeIn();
        
        // Load user's phanera preference if logged in
        this.loadUserPhanera();
        
        // Start the new interactive experience
        this.initExperience();
        
        // Listen for clicks to start dialogue early
        this.setupEarlyDialogueClick();
    }
    
    /**
     * Set up fade-in effect for initial background image load
     */
    setupBackgroundFadeIn() {
        if (!this.backgroundLayer) return;
        
        // If image is already loaded (cached), fade it in immediately
        if (this.backgroundLayer.complete && this.backgroundLayer.naturalHeight !== 0) {
            this.backgroundLayer.classList.add('loaded');
        } else {
            // Otherwise wait for it to load
            this.backgroundLayer.addEventListener('load', () => {
                this.backgroundLayer.classList.add('loaded');
            });
            
            // Also handle error case
            this.backgroundLayer.addEventListener('error', () => {
                // Still fade in even on error to show fallback
                this.backgroundLayer.classList.add('loaded');
            });
        }
    }
    
    /**
     * Load and apply user's selected phanera background
     */
    async loadUserPhanera() {
        // Start with default - always show residence first
        // The image in HTML is already set to residence, so it will load naturally
        
        try {
            // Check if user is logged in
            if (window.oauthManager) {
                this.userSession = window.oauthManager.getSession();
            }
            
            if (!this.userSession || !this.userSession.did) {
                // Not logged in, keep default residence phanera (no action needed)
                return;
            }
            
            // User is logged in - fetch their dreamer data to get selected phanera
            const response = await fetch('/api/dreamers');
            if (!response.ok) {
                console.warn('Failed to fetch dreamer data, keeping default');
                return;
            }
            
            const dreamers = await response.json();
            const userDreamer = dreamers.find(d => d.did === this.userSession.did);
            
            if (userDreamer && userDreamer.phanera && userDreamer.phanera !== '') {
                // User has a selected phanera - transition to it after default loads
                // Wait a bit for the default to load and show first
                setTimeout(() => {
                    this.setPhaneraBackground(userDreamer.phanera);
                }, 1500); // 1.5 second delay to let default show first
            }
            // If no phanera selected (empty string or null), keep default
            
        } catch (error) {
            console.error('Error loading user phanera:', error);
            // Keep default on error (no action needed)
        }
    }
    
    /**
     * Update the background phanera image
     * @param {string} phaneraKey - The souvenir key (e.g., "residence/home", "crossroad/beacon")
     */
    setPhaneraBackground(phaneraKey) {
        if (!this.backgroundLayer) {
            console.warn('Background layer not found');
            return;
        }
        
        // Normalize the phanera key
        const normalizedKey = phaneraKey || 'residence/home';
        
        // Don't change if it's already the current phanera
        if (this.currentPhanera === normalizedKey) {
            return;
        }
        
        // Store current phanera
        this.currentPhanera = normalizedKey;
        
        // Construct the phanera image path
        const phaneraPath = `/souvenirs/${normalizedKey}/phanera.png`;
        
        // Preload the image for smooth transition
        const img = new Image();
        img.onload = () => {
            // Remove loaded class for fade out
            this.backgroundLayer.classList.remove('loaded');
            
            // Change source after fade
            setTimeout(() => {
                this.backgroundLayer.src = phaneraPath;
                this.backgroundLayer.alt = `Phanera ${normalizedKey}`;
                
                // Add loaded class back for fade in
                setTimeout(() => {
                    this.backgroundLayer.classList.add('loaded');
                }, 50);
            }, 800); // Match CSS transition duration
        };
        
        img.onerror = () => {
            console.warn(`Failed to load phanera: ${phaneraPath}, keeping current`);
            // Keep current background on error
        };
        
        img.src = phaneraPath;
    }
    
    /**
     * Listen for phanera changes from dashboard
     */
    setupPhaneraListener() {
        // Listen for custom event from dashboard when phanera is updated
        window.addEventListener('phaneraUpdated', (event) => {
            if (event.detail && event.detail.phanera !== undefined) {
                // If phanera is empty string or null, it means "use default"
                const phaneraKey = event.detail.phanera || 'residence/home';
                this.setPhaneraBackground(phaneraKey);
            }
        });
    }
    
    // Idle system disabled
    initIdleSystem() {
        // TODO: Re-enable idle system if needed
        // this.startIdleTimer();
        // this.setupIdleMouseTracking();
        // window.addEventListener('lockToggled', (event) => {
        //     const isLocked = event.detail.locked;
        //     if (isLocked && this.isIdle) {
        //         this.restoreUIFromLock();
        //     } else if (!isLocked && !this.isIdle) {
        //         this.startIdleTimer();
        //     }
        // });
    }
    
    restoreUIFromLock() {
        this.fade_tiers.forEach(tier => {
            if (tier.selector === '.hero-overlay' && this.logoHasFaded) {
                return;
            }
            const elements = document.querySelectorAll(tier.selector);
            elements.forEach(el => {
                el.style.transition = 'opacity 300ms ease-out';
                el.style.opacity = '1';
            });
        });
        if (this.floatingContainer) {
            this.floatingContainer.innerHTML = '';
        }
        this.isIdle = false;
        this.mouse_listener_active = true;
        this.bubbles_enabled = false;
        this.enableBubbles = false;
    }
    startIdleTimer() {
        const isLocked = sessionStorage.getItem('LOCK') === 'true';
        if (isLocked) {
            return;
        }
        if (this.idleTimer) clearTimeout(this.idleTimer);
        const effectiveDelay = this.apexAchieved ? 
            this.delay_start * this.apexPatienceMultiplier : 
            this.delay_start;
        this.idleTimer = setTimeout(() => {
            this.enterIdleMode();
        }, effectiveDelay);
        if (this.apexAchieved) {
        }
    }
    enterIdleMode() {
        const isLocked = sessionStorage.getItem('LOCK') === 'true';
        if (isLocked) {
            return;
        }
        this.isIdle = true;
        this.fade_tiers.forEach(tier => {
            setTimeout(() => {
                const elements = document.querySelectorAll(tier.selector);
                elements.forEach(el => {
                    el.style.transition = `opacity ${this.fade_duration}ms ease-out`;
                    el.style.opacity = '0';
                    if (tier.selector === '.hero-overlay') {
                        this.logoHasFaded = true;
                        // Remove from DOM after fade completes
                        setTimeout(() => {
                            if (el.parentNode) {
                                el.remove();
                            }
                        }, this.fade_duration);
                    }
                });
            }, tier.delay);
        });
        const total_fade_time = Math.max(...this.fade_tiers.map(t => t.delay)) + this.fade_duration;
        setTimeout(() => {
            this.enableBubblesMode();
        }, total_fade_time);
        setTimeout(() => {
            this.mouse_listener_active = false;
        }, total_fade_time + 1000);
    }
    enableBubblesMode() {
        this.bubbles_enabled = true;
        this.enableBubbles = true;
        if (window.dataManager && window.dataManager.data.souvenirs) {
            this.updateFloatingBubbles(
                window.dataManager.data.dreamers,
                window.dataManager.data.canon,
                window.dataManager.data.souvenirs
            );
        }
    }
    setupIdleMouseTracking() {
        document.addEventListener('mousemove', (e) => {
            if (!this.mouse_listener_active) return;
            const movement = Math.abs(e.clientX - this.last_mouse_position.x) + 
                           Math.abs(e.clientY - this.last_mouse_position.y);
            const effectiveThreshold = this.apexAchieved ? 
                this.apexMouseThreshold : 
                this.mouse_reset_threshold;
            if (movement > effectiveThreshold) {
                this.resetToActive();
            }
            this.last_mouse_position = { x: e.clientX, y: e.clientY };
        });
        document.addEventListener('click', () => {
            if (this.isIdle) {
                this.resetToActive();
            }
        });
    }
    resetToActive() {
        if (!this.isIdle) return;
        this.isIdle = false;
        this.mouse_listener_active = true;
        this.bubbles_enabled = false;
        this.enableBubbles = false;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.fade_tiers.forEach(tier => {
            if (tier.selector === '.hero-overlay' && this.logoHasFaded) {
                return;
            }
            const elements = document.querySelectorAll(tier.selector);
            elements.forEach(el => {
                el.style.transition = 'opacity 500ms ease-out';
                el.style.opacity = '1';
            });
        });
        if (this.floatingContainer) {
            this.floatingContainer.innerHTML = '';
        }
        this.startIdleTimer();
    }
    shouldShowBubbles() {
        return this.bubbles_enabled && this.isIdle;
    }
    getSceneRect() {
        const container = document.querySelector('.fullscreen-background') || document.body;
        return container.getBoundingClientRect();
    }
    setupMouseTracking() {
        document.addEventListener('mousemove', (e) => {
            const oldX = this.currentMousePosition.x;
            const oldY = this.currentMousePosition.y;
            const currentTime = Date.now();
            const rect = this.getSceneRect();
            this.currentMousePosition.x = e.clientX - rect.left;
            this.currentMousePosition.y = e.clientY - rect.top;
            this.mousePosition.x = this.currentMousePosition.x;
            this.mousePosition.y = this.currentMousePosition.y;
            this.mouseHistory.push({ x: this.currentMousePosition.x, y: this.currentMousePosition.y, time: currentTime });
            if (this.mouseHistory.length > this.maxHistoryLength) {
                this.mouseHistory.shift();
            }
        });
        window.addEventListener('mousemove', (e) => {
            const rect = this.getSceneRect();
            this.mousePosition.x = e.clientX - rect.left;
            this.mousePosition.y = e.clientY - rect.top;
        });
        document.addEventListener('mouseenter', (e) => {
            const rect = this.getSceneRect();
            this.mousePosition.x = e.clientX - rect.left;
            this.mousePosition.y = e.clientY - rect.top;
        });
        document.addEventListener('mouseleave', () => {
            this.mousePosition.x = -1000;
            this.mousePosition.y = -1000;
            this.endSwirlEffect();
        });
        document.addEventListener('mousedown', (e) => {
            const rect = this.getSceneRect();
            this.startSwirlEffect(e.clientX - rect.left, e.clientY - rect.top);
        });
        document.addEventListener('mouseup', () => {
            this.endSwirlEffect();
        });
        document.addEventListener('contextmenu', () => {
            this.endSwirlEffect();
        });
        this.startPhysicsLoop();
    }
    getParticle(type = 'magic') {
        if (this.particlePool.length > 0) {
            const particle = this.particlePool.pop();
            particle.type = type;
            particle.age = 0;
            particle.maxAge = 2000 + Math.random() * 1000;
            return particle;
        }
        if (this.particles.length < this.maxParticles) {
            const element = document.createElement('div');
            element.className = type === 'wind' ? 'wind-particle' : 'magic-particle';
            element.style.position = 'absolute';
            element.style.pointerEvents = 'none';
            const container = type === 'wind' ? this.windParticlesContainer : this.magicDustContainer;
            if (container) {
                container.appendChild(element);
            }
            const particle = {
                element: element,
                type: type,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                age: 0,
                maxAge: 2000 + Math.random() * 1000,
                radius: Math.random() * 10 + 5,
                angle: Math.random() * Math.PI * 2
            };
            this.particles.push(particle);
            return particle;
        }
        return null;
    }
    returnParticle(particle) {
        if (particle && particle.element) {
            particle.element.style.display = 'none';
            this.particlePool.push(particle);
        }
    }
    updateSwirlParticle(particle, deltaTime) {
        particle.angle += 0.05 + this.swirlIntensity * 0.02;
        particle.radius = Math.min(particle.radius + 0.5, 30 + this.swirlIntensity * 20);
        particle.x = this.laggedMousePosition.x + Math.cos(particle.angle) * particle.radius;
        particle.y = this.laggedMousePosition.y + Math.sin(particle.angle) * particle.radius;
    }
    updateWindParticle(particle, deltaTime) {
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        if (particle.x < -50 || particle.x > window.innerWidth + 50 || 
            particle.y < -50 || particle.y > window.innerHeight + 50) {
            particle.age = particle.maxAge;
        }
    }
    updateMagicParticle(particle, deltaTime) {
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.vy += 20 * deltaTime;
        particle.vx *= 0.99;
        particle.vy *= 0.99;
    }
    createMagicDustTrail(x, y) {
        const currentTime = Date.now();
        if (currentTime - this.lastParticleTime < 100) return;
        const particle = this.getParticle('magic');
        if (!particle) return;
        particle.x = x + (Math.random() - 0.5) * 10;
        particle.y = y + (Math.random() - 0.5) * 10;
        particle.vx = (Math.random() - 0.5) * 50;
        particle.vy = (Math.random() - 0.5) * 50;
        particle.maxAge = 1000 + Math.random() * 500;
        this.lastParticleTime = currentTime;
    }
    initializeAmbientParticles() {
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                this.createWindParticle();
            }, Math.random() * 2000);
        }
    }
    createWindParticle() {
        const particle = this.getParticle('wind');
        if (!particle) return;
        const side = Math.floor(Math.random() * 4);
        switch (side) {
            case 0:
                particle.x = -50;
                particle.y = Math.random() * window.innerHeight;
                particle.vx = 20 + Math.random() * 30;
                particle.vy = (Math.random() - 0.5) * 20;
                break;
            case 1:
                particle.x = window.innerWidth + 50;
                particle.y = Math.random() * window.innerHeight;
                particle.vx = -(20 + Math.random() * 30);
                particle.vy = (Math.random() - 0.5) * 20;
                break;
            case 2:
                particle.x = Math.random() * window.innerWidth;
                particle.y = -50;
                particle.vx = (Math.random() - 0.5) * 20;
                particle.vy = 20 + Math.random() * 30;
                break;
            case 3:
                particle.x = Math.random() * window.innerWidth;
                particle.y = window.innerHeight + 50;
                particle.vx = (Math.random() - 0.5) * 20;
                particle.vy = -(20 + Math.random() * 30);
                break;
        }
        particle.maxAge = 8000 + Math.random() * 4000;
        particle.element.className = 'wind-particle';
        if (Math.random() < 0.3) particle.element.classList.add('small');
    }
    
    toggleAmplifierPoints() {
        this.enableAmplifierPoints = !this.enableAmplifierPoints;
        if (!this.enableAmplifierPoints && this.anchorPoints.length > 0) {
            this.removeAnchorPoint();
        }
        return this.enableAmplifierPoints;
    }
    toggleBubbles() {
        this.enableBubbles = !this.enableBubbles;
        if (!this.enableBubbles) {
            if (this.windInterval) {
                clearInterval(this.windInterval);
                this.windInterval = null;
            }
            if (this.floatingContainer) {
                const bubbles = this.floatingContainer.querySelectorAll('.phanera-bubble');
                bubbles.forEach(bubble => bubble.remove());
            }
        }
        return this.enableBubbles;
    }
    startPhysicsLoop() {
        // OPTIMIZED: Throttle to 30 FPS instead of 60 FPS to reduce CPU load
        const targetFPS = 30;
        const frameInterval = 1000 / targetFPS;
        let lastFrameTime = 0;
        
        const physicsUpdate = (currentTime) => {
            // Throttle frame rate
            const deltaTime = currentTime - lastFrameTime;
            
            // Only update physics when page is visible, active, and at throttled rate
            if (this.isActive && this.isPageVisible && deltaTime >= frameInterval) {
                lastFrameTime = currentTime - (deltaTime % frameInterval);
                
                this.updateLaggedMouse();
                this.updateSwirlEffect();
                this.updateWildParticles();
                this.updateWindParticles();
                this.manageParticlePopulation();
                
                if (this.bubblesFeatureEnabled && this.bubbleSystem && typeof this.bubbleSystem.updateBubblePhysics === 'function') {
                    const deltaTimeSec = deltaTime / 1000;
                    this.bubbleSystem.updateBubblePhysics(currentTime, deltaTimeSec, this.mousePosition.x, this.mousePosition.y);
                }
            }
            
            // MEMORY LEAK FIX: Only continue loop if active
            if (this.isActive) {
                this.rafId = requestAnimationFrame(physicsUpdate);
            }
        };
        
        this.rafId = requestAnimationFrame(physicsUpdate);
    }
    
    /**
     * MEMORY LEAK FIX: Stop physics loop and cleanup
     */
    stopPhysicsLoop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.isActive = false;
    }
    
    /**
     * MEMORY LEAK FIX: Cleanup method to prevent memory leaks
     * Call this when navigating away from homepage
     */
    destroy() {
        console.log('🧹 Cleaning up HomepageScene...');
        
        this.stopPhysicsLoop();
        
        // Clear wind interval
        if (this.windInterval) {
            clearInterval(this.windInterval);
            this.windInterval = null;
        }
        
        // Remove all particles
        this.wildParticles.forEach(p => p.element?.remove());
        this.heldParticles.forEach(p => p.element?.remove());
        this.swirlParticles.forEach(p => p.element?.remove());
        this.orphanedParticles.forEach(p => p.element?.remove());
        this.windParticles.forEach(p => p.element?.remove());
        
        this.wildParticles = [];
        this.heldParticles = [];
        this.swirlParticles = [];
        this.orphanedParticles = [];
        this.windParticles = [];
        
        // Clear bubbles
        if (this.floatingContainer) {
            const bubbles = this.floatingContainer.querySelectorAll('.phanera-bubble');
            bubbles.forEach(bubble => bubble.remove());
        }
        
        // Destroy bubble system
        if (this.bubbleSystem && typeof this.bubbleSystem.destroy === 'function') {
            this.bubbleSystem.destroy();
        }
        
        console.log('✅ HomepageScene cleanup complete');
    }
    
    updateWildParticles() {
        if (!this.wildParticles || this.wildParticles.length === 0) return;
        const deltaTime = 16 / 1000;
        const currentTime = Date.now();
        for (let i = this.wildParticles.length - 1; i >= 0; i--) {
            const particle = this.wildParticles[i];
            if (!particle.element || !particle.element.parentNode) {
                this.wildParticles.splice(i, 1);
                const orphanIndex = this.orphanedParticles.indexOf(particle);
                if (orphanIndex > -1) this.orphanedParticles.splice(orphanIndex, 1);
                continue;
            }
            const timeSinceOrphaned = currentTime - particle.dispersalStartTime;
            const orphanProgress = Math.min(timeSinceOrphaned / particle.dispersalDuration, 1);
            const naturalResistance = 1 - (0.006 / particle.mass);
            particle.physicsVelX *= naturalResistance;
            particle.physicsVelY *= naturalResistance;
            const gravity = 20 * particle.mass;
            const randomDrift = (Math.random() - 0.5) * 3;
            particle.physicsVelY += gravity * deltaTime;
            particle.physicsVelX += randomDrift * deltaTime;
            particle.physicsX += particle.physicsVelX * deltaTime;
            particle.physicsY += particle.physicsVelY * deltaTime;
            particle.element.style.left = particle.physicsX + 'px';
            particle.element.style.top = particle.physicsY + 'px';
            const currentSpeed = Math.sqrt(
                particle.physicsVelX * particle.physicsVelX + 
                particle.physicsVelY * particle.physicsVelY
            );
            const speedFactor = Math.min(1, currentSpeed / particle.initialSpeed);
            const ageFactor = Math.max(0, 1 - Math.pow(orphanProgress, 1.2));
            const baseOpacity = 0.9;
            const fadeMultiplier = Math.max(0.1, ageFactor * 0.8 + speedFactor * 0.2);
            const opacity = baseOpacity * fadeMultiplier;
            const scale = 0.3 + ageFactor * 0.7 + speedFactor * 0.1;
            particle.element.style.opacity = Math.max(0, opacity);
            particle.element.style.transform = `scale(${Math.max(0.1, scale)})`;
            if (particle.isCollectable) {
                const collectibilityFactor = ageFactor * 0.9 + 0.1;
                if (collectibilityFactor < 0.4) {
                    particle.element.style.filter = `brightness(${1 + collectibilityFactor * 0.5}) drop-shadow(0 0 2px rgba(255,255,255,${collectibilityFactor * 0.2}))`;
                }
                particle.collectionRadius = (80 + this.swirlIntensity * 20) * collectibilityFactor;
            }
            const isOffScreen = particle.physicsX < -200 || particle.physicsX > window.innerWidth + 200 || 
                               particle.physicsY < -200 || particle.physicsY > window.innerHeight + 200;
            const isNaturallyDead = orphanProgress >= 1 || opacity <= 0.05 || 
                                   (currentSpeed < 8 && ageFactor < 0.1);
            if (isOffScreen || isNaturallyDead) {
                particle.element.remove();
                this.wildParticles.splice(i, 1);
                const orphanIndex = this.orphanedParticles.indexOf(particle);
                if (orphanIndex > -1) this.orphanedParticles.splice(orphanIndex, 1);
                if (particle.isCollectable && Math.random() < 0.03) {
                }
            }
        }
    }
    manageParticlePopulation() {
        this.totalActiveParticles = this.swirlParticles.length + this.orphanedParticles.length + this.windParticles.length;
        const currentTime = Date.now();
        
        // Don't spawn new particles if page is hidden
        if (this.isPageVisible && 
            this.windParticles.length < this.targetAmbientParticles && 
            currentTime - this.lastWindParticleTime > this.ambientWindSpawnRate) {
            this.createWindParticle();
            this.lastWindParticleTime = currentTime;
            if (this.windParticles.length < this.targetAmbientParticles / 2) {
                this.ambientWindSpawnRate = Math.max(500, this.ambientWindSpawnRate * 0.8);
            } else {
                this.ambientWindSpawnRate = Math.min(3000, this.ambientWindSpawnRate * 1.02);
            }
        }
        
        this.windParticles = this.windParticles.filter(particle => 
            particle && particle.parentNode
        );
        if (Math.random() < 0.001) {

        }
    }
    updateLaggedMouse() {
        const lagFactor = 0.95;
        this.laggedMousePosition.x += (this.currentMousePosition.x - this.laggedMousePosition.x) * lagFactor;
        this.laggedMousePosition.y += (this.currentMousePosition.y - this.laggedMousePosition.y) * lagFactor;
        if (this.laggedMousePosition.x === 0 && this.laggedMousePosition.y === 0) {
            this.laggedMousePosition.x = this.currentMousePosition.x;
            this.laggedMousePosition.y = this.currentMousePosition.y;
        }
    }
    calculateMouseVelocity() {
        if (this.mouseHistory.length < 2) {
            return { vx: 0, vy: 0, speed: 0 };
        }
        const recent = this.mouseHistory.slice(-3);
        let totalVx = 0, totalVy = 0, validSamples = 0;
        for (let i = 1; i < recent.length; i++) {
            const prev = recent[i - 1];
            const curr = recent[i];
            const deltaTime = Math.max(curr.time - prev.time, 16);
            const vx = (curr.x - prev.x) / deltaTime * 1000;
            const vy = (curr.y - prev.y) / deltaTime * 1000;
            totalVx += vx;
            totalVy += vy;
            validSamples++;
        }
        const avgVx = validSamples > 0 ? totalVx / validSamples : 0;
        const avgVy = validSamples > 0 ? totalVy / validSamples : 0;
        const speed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
        return { vx: avgVx, vy: avgVy, speed };
    }
    startSwirlEffect(x, y) {
        if (!this.magicDustContainer) return;
        this.isMousePressed = true;
        this.mouseDownTime = Date.now();
        this.swirlIntensity = 0;
    }
    endSwirlEffect() {
        if (!this.isMousePressed) return;
        this.isMousePressed = false;
        const finalIntensity = this.swirlIntensity;
        const particleCount = this.swirlParticles.length;
        const mouseVelocity = this.calculateMouseVelocity();
        this.swirlParticles.forEach(particle => {
            if (particle.element && particle.element.parentNode) {
                const currentRadius = 20 + Math.sin(particle.age * 0.005) * 10;
                const angularVelocity = (0.05 + this.swirlIntensity * 0.02) * 60;
                const tangentialSpeed = angularVelocity * currentRadius;
                const tangentAngle = particle.angle + Math.PI / 2;
                const baseVelX = Math.cos(tangentAngle) * tangentialSpeed;
                const baseVelY = Math.sin(tangentAngle) * tangentialSpeed;
                const momentumInfluence = Math.min(mouseVelocity.speed / 500, 1.0);
                const mouseInfluenceX = mouseVelocity.vx * momentumInfluence * 0.6;
                const mouseInfluenceY = mouseVelocity.vy * momentumInfluence * 0.6;
                const dispersalAngle = Math.random() * Math.PI * 2;
                const dispersalStrength = 40 + (finalIntensity * 30);
                const dispersalVelX = Math.cos(dispersalAngle) * dispersalStrength;
                const dispersalVelY = Math.sin(dispersalAngle) * dispersalStrength;
                const finalPhysicsVelX = baseVelX + mouseInfluenceX + dispersalVelX;
                const finalPhysicsVelY = baseVelY + mouseInfluenceY + dispersalVelY;
                const wildParticle = {
                    element: particle.element,
                    physicsX: particle.x,
                    physicsY: particle.y,
                    physicsVelX: finalPhysicsVelX,
                    physicsVelY: finalPhysicsVelY,
                    dispersalStartTime: Date.now(),
                    dispersalDuration: 2500 + (Math.random() * 1500),
                    mass: 0.6 + (Math.random() * 0.4),
                    layer: 'wild',
                    type: 'orphaned',
                    isCollectable: true,
                    collectionRadius: 80 + finalIntensity * 20,
                    initialSpeed: Math.sqrt(finalPhysicsVelX * finalPhysicsVelX + finalPhysicsVelY * finalPhysicsVelY),
                    orphaned: true
                };
                this.wildParticles.push(wildParticle);
                this.orphanedParticles.push(wildParticle);
                particle.element.classList.remove('swirl-particle');
                particle.element.classList.add('wild-particle', 'collectible-particle', 'orphaned-particle');
                particle.element.style.filter = 'brightness(1.1) drop-shadow(0 0 3px rgba(255,255,255,0.4))';
            }
        });
        this.swirlParticles = [];
        this.heldParticles = [];
        this.swirlIntensity = 0;
    }
    updateSwirlEffect() {
        const currentTime = Date.now();
        if (this.swirlParticles.length > 0) {
            this.updateSwirlParticles(currentTime);
        }
        if (!this.isMousePressed || !this.magicDustContainer) {
            return;
        }
        const holdDuration = currentTime - this.mouseDownTime;
        this.swirlIntensity = Math.min(holdDuration / 1000, 3.0);
        if (this.swirlIntensity >= this.apexThreshold && !this.apexAchieved) {
            this.achieveApex();
        }
        if (currentTime - this.lastParticleTime > 50) {
            this.collectWindParticle();
            this.lastParticleTime = currentTime;
        }
        const maxParticles = 20 + this.swirlIntensity * 10;
        while (this.swirlParticles.length > maxParticles) {
            const oldest = this.swirlParticles.shift();
            if (oldest && oldest.element && oldest.element.parentNode) {
                oldest.element.remove();
            }
        }
    }
    achieveApex() {
        this.apexAchieved = true;
        this.sessionApexCount++;
        if (this.isIdle) {
            this.temporaryUIRestore();
        }
    }
    temporaryUIRestore() {
        this.fade_tiers.forEach(tier => {
            if (tier.selector === '.hero-overlay' && this.logoHasFaded) {
                return;
            }
            const elements = document.querySelectorAll(tier.selector);
            elements.forEach(el => {
                el.style.transition = 'opacity 200ms ease-out';
                el.style.opacity = '1';
            });
        });
        setTimeout(() => {
            if (this.isIdle && !sessionStorage.getItem('LOCK')) {
                this.fade_tiers.forEach(tier => {
                    if (tier.selector === '.hero-overlay' && this.logoHasFaded) {
                        return;
                    }
                    const elements = document.querySelectorAll(tier.selector);
                    elements.forEach(el => {
                        el.style.transition = 'opacity 1000ms ease-out';
                        el.style.opacity = '0';
                        // Remove from DOM after fade completes
                        if (tier.selector === '.hero-overlay') {
                            setTimeout(() => {
                                if (el.parentNode) {
                                    el.remove();
                                }
                            }, 1000);
                        }
                    });
                });
            }
        }, 2000);
    }
    updateSwirlParticles(currentTime) {
        for (let i = this.swirlParticles.length - 1; i >= 0; i--) {
            const particle = this.swirlParticles[i];
            if (!particle.element || !particle.element.parentNode) {
                this.swirlParticles.splice(i, 1);
                continue;
            }
            if (!particle.orphaned) {
                particle.age += 16;
                particle.angle += 0.05 + this.swirlIntensity * 0.02;
                const radius = 20 + Math.sin(particle.age * 0.005) * 10;
                particle.x = this.mousePosition.x + Math.cos(particle.angle) * radius;
                particle.y = this.mousePosition.y + Math.sin(particle.angle) * radius;
                particle.element.style.left = particle.x + 'px';
                particle.element.style.top = particle.y + 'px';
                const opacity = 0.3 + this.swirlIntensity * 0.4;
                const scale = 0.8 + this.swirlIntensity * 0.3;
                particle.element.style.opacity = opacity;
                particle.element.style.transform = `scale(${scale})`;
            }
        }
    }
    createSwirlParticle() {
        if (!this.magicDustContainer) return;
        const particle = document.createElement('div');
        particle.className = 'magic-particle swirl-particle';
        const rand = Math.random();
        if (rand < 0.3) {
            particle.classList.add('large');
        } else if (rand < 0.7) {
            particle.classList.add('small');
        }
        const offsetX = (Math.random() - 0.5) * 10;
        const offsetY = (Math.random() - 0.5) * 10;
        const centerX = this.mousePosition.x;
        const centerY = this.mousePosition.y;
        const startX = centerX + offsetX;
        const startY = centerY + offsetY;
        particle.style.left = startX + 'px';
        particle.style.top = startY + 'px';
        particle.style.position = 'absolute';
        particle.style.pointerEvents = 'none';
        this.magicDustContainer.appendChild(particle);
        const swirlParticle = {
            element: particle,
            x: startX,
            y: startY,
            angle: Math.random() * Math.PI * 2,
            age: 0,
            released: false,
            velocityX: 0,
            velocityY: 0,
            releaseTime: 0
        };
        this.swirlParticles.push(swirlParticle);
    }
    collectWindParticle() {
        if (!this.windParticlesContainer || !this.magicDustContainer) return;
        const collectionRadius = 120 + (this.swirlIntensity * 50);
        const swirlCenterX = this.mousePosition.x;
        const swirlCenterY = this.mousePosition.y;
        let collectedParticle = null;
        let closestDistance = Infinity;
        for (let i = 0; i < this.wildParticles.length; i++) {
            const particle = this.wildParticles[i];
            if (!particle.isCollectable || !particle.element || !particle.element.parentNode) continue;
            const distance = Math.sqrt(
                Math.pow(swirlCenterX - particle.physicsX, 2) + 
                Math.pow(swirlCenterY - particle.physicsY, 2)
            );
            if (distance < particle.collectionRadius && distance < closestDistance) {
                closestDistance = distance;
                collectedParticle = { type: 'wild', particle: particle, index: i };
            }
        }
        if (!collectedParticle) {
            const windParticles = this.windParticlesContainer.querySelectorAll('.wind-particle');
            windParticles.forEach((particle, index) => {
                const rect = particle.getBoundingClientRect();
                const sceneRect = this.getSceneRect();
                const particleX = (rect.left + rect.width / 2) - sceneRect.left;
                const particleY = (rect.top + rect.height / 2) - sceneRect.top;
                const distance = Math.sqrt(
                    Math.pow(swirlCenterX - particleX, 2) + 
                    Math.pow(swirlCenterY - particleY, 2)
                );
                if (distance < collectionRadius && distance < closestDistance) {
                    closestDistance = distance;
                    collectedParticle = { type: 'wind', particle: particle, index: index };
                }
            });
        }
        if (collectedParticle) {
            if (collectedParticle.type === 'wild') {
                this.transitionWildToHeld(collectedParticle.particle, collectedParticle.index);
            } else {
                this.convertWindToSwirlParticle(collectedParticle.particle);
            }
        } else {
            if (Math.random() < 0.2) {
                this.createSwirlParticle();
            }
        }
    }
    transitionWildToHeld(wildParticle, index) {
        if (!wildParticle || !wildParticle.element || !wildParticle.element.parentNode) return;
        this.wildParticles.splice(index, 1);
        const orphanIndex = this.orphanedParticles.indexOf(wildParticle);
        if (orphanIndex > -1) this.orphanedParticles.splice(orphanIndex, 1);
        const heldParticle = {
            element: wildParticle.element,
            x: wildParticle.physicsX,
            y: wildParticle.physicsY,
            angle: Math.random() * Math.PI * 2,
            age: 0,
            released: false,
            velocityX: 0,
            velocityY: 0,
            releaseTime: 0,
            layer: 'held',
            revived: true
        };
        wildParticle.element.classList.remove('wild-particle', 'collectible-particle', 'orphaned-particle');
        wildParticle.element.classList.add('swirl-particle', 'revived-particle');
        wildParticle.element.style.filter = 'brightness(2) saturate(2) drop-shadow(0 0 12px rgba(0,255,150,0.8))';
        wildParticle.element.style.transition = 'all 0.4s ease-out';
        wildParticle.element.style.transform = 'scale(1.5)';
        setTimeout(() => {
            if (wildParticle.element && wildParticle.element.parentNode) {
                wildParticle.element.style.transition = '';
                wildParticle.element.style.transform = '';
                wildParticle.element.style.filter = '';
                wildParticle.element.classList.remove('revived-particle');
            }
        }, 400);
        this.swirlParticles.push(heldParticle);
        this.heldParticles.push(heldParticle);
    }
    convertWindToSwirlParticle(windParticle) {
        if (!windParticle || !windParticle.parentNode) return;
    const rect = windParticle.getBoundingClientRect();
    const sceneRect = this.getSceneRect();
    const startX = (rect.left + rect.width / 2) - sceneRect.left;
    const startY = (rect.top + rect.height / 2) - sceneRect.top;
        windParticle.remove();
        const windIndex = this.windParticles.indexOf(windParticle);
        if (windIndex > -1) {
            this.windParticles.splice(windIndex, 1);
        }
        const swirlParticle = document.createElement('div');
        swirlParticle.className = 'magic-particle swirl-particle collected-particle';
        const rand = Math.random();
        if (rand < 0.3) {
            swirlParticle.classList.add('large');
        } else if (rand < 0.7) {
            swirlParticle.classList.add('small');
        }
        swirlParticle.style.left = startX + 'px';
        swirlParticle.style.top = startY + 'px';
        swirlParticle.style.position = 'absolute';
        swirlParticle.style.pointerEvents = 'none';
        swirlParticle.style.transition = 'all 0.3s ease-out';
        swirlParticle.style.transform = 'scale(1.5)';
        swirlParticle.style.filter = 'brightness(2) saturate(2) drop-shadow(0 0 8px rgba(255,255,255,0.8))';
        swirlParticle.style.boxShadow = '0 0 10px rgba(0,200,255,0.6)';
        this.magicDustContainer.appendChild(swirlParticle);
        const swirlParticleData = {
            element: swirlParticle,
            x: startX,
            y: startY,
            angle: Math.random() * Math.PI * 2,
            age: 0,
            released: false,
            velocityX: 0,
            velocityY: 0,
            releaseTime: 0,
            collected: true
        };
        this.swirlParticles.push(swirlParticleData);
        setTimeout(() => {
            if (swirlParticle.parentNode) {
                swirlParticle.style.transition = '';
                swirlParticle.style.transform = '';
                swirlParticle.style.filter = '';
                swirlParticle.style.boxShadow = '';
            }
        }, 300);
    }
    createAnchorPoint() {
        if (!this.magicDustContainer) return;
        const anchorPoint = document.createElement('div');
        anchorPoint.className = 'swirl-anchor-point';
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const circleRadius = (window.innerHeight * 0.7) / 2;
        let attempts = 0;
        let anchorPosition;
        do {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * circleRadius;
            anchorPosition = {
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance
            };
            attempts++;
        } while (this.anchorPointTooClose(anchorPosition) && attempts < 20);
        anchorPoint.style.left = anchorPosition.x + 'px';
        anchorPoint.style.top = anchorPosition.y + 'px';
        anchorPoint.style.position = 'absolute';
        anchorPoint.style.pointerEvents = 'none';
        anchorPoint.style.width = '20px';
        anchorPoint.style.height = '20px';
        anchorPoint.style.borderRadius = '50%';
        anchorPoint.style.background = 'radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,165,0,0.4) 50%, transparent 100%)';
        anchorPoint.style.boxShadow = '0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,165,0,0.3)';
        anchorPoint.style.animation = 'anchor-pulse 2s ease-in-out infinite';
        anchorPoint.style.zIndex = '1000';
        if (!document.querySelector('#anchor-styles')) {
            const style = document.createElement('style');
            style.id = 'anchor-styles';
            style.textContent = `
                @keyframes anchor-pulse {
                    0%, 100% { 
                        transform: scale(1) translateX(-50%) translateY(-50%);
                        opacity: 0.6;
                    }
                    50% { 
                        transform: scale(1.3) translateX(-50%) translateY(-50%);
                        opacity: 1.0;
                    }
                }
                .swirl-anchor-point {
                    transform: translateX(-50%) translateY(-50%);
                }
                .swirl-anchor-hooked {
                    background: radial-gradient(circle, rgba(0,255,150,0.9) 0%, rgba(0,200,100,0.5) 50%, transparent 100%) !important;
                    box-shadow: 0 0 30px rgba(0,255,150,0.8), 0 0 60px rgba(0,200,100,0.4) !important;
                    animation: anchor-hooked 1s ease-in-out infinite !important;
                }
                @keyframes anchor-hooked {
                    0%, 100% { 
                        transform: scale(1.2) translateX(-50%) translateY(-50%);
                        opacity: 0.9;
                    }
                    50% { 
                        transform: scale(1.6) translateX(-50%) translateY(-50%);
                        opacity: 1.0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        this.magicDustContainer.appendChild(anchorPoint);
        const anchorData = {
            element: anchorPoint,
            position: anchorPosition,
            id: Math.random().toString(36).substr(2, 9)
        };
        this.anchorPoints.push(anchorData);
    }
    anchorPointTooClose(newPosition) {
        const minDistance = 80;
        return this.anchorPoints.some(anchor => {
            const dx = newPosition.x - anchor.position.x;
            const dy = newPosition.y - anchor.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < minDistance;
        });
    }
    checkAnchorHook() {
        if (this.anchorPoints.length === 0) return;
        for (let i = 0; i < this.anchorPoints.length; i++) {
            const anchor = this.anchorPoints[i];
            const distanceX = this.mousePosition.x - anchor.position.x;
            const distanceY = this.mousePosition.y - anchor.position.y;
            const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
            const hookDistance = 40;
            if (distance < hookDistance) {
                this.activateHook(anchor);
                break;
            }
        }
    }
    activateHook(anchorData) {
        if (!anchorData) return;
        this.collectedPoints++;
        this.isHooked = true;
        this.hookedIntensityMultiplier = 1.2 + (this.collectedPoints * 0.2);
        anchorData.element.classList.add('swirl-anchor-hooked');
        setTimeout(() => {
            this.dissipateSpecificAnchorPoint(anchorData);
        }, 300);
        this.increaseObstacleFrequency();
    }
    dissipateAnchorPoint() {
        if (!this.anchorPoint) return;
        this.anchorPoint.style.transition = 'all 0.3s ease-out';
        this.anchorPoint.style.transform = 'translateX(-50%) translateY(-50%) scale(0.2)';
        this.anchorPoint.style.opacity = '0';
        setTimeout(() => {
            if (this.anchorPoint && this.anchorPoint.parentNode) {
                this.anchorPoint.remove();
            }
            this.anchorPoint = null;
        }, 300);
    }
    dissipateSpecificAnchorPoint(anchorData) {
        if (!anchorData || !anchorData.element) return;
        anchorData.element.style.transition = 'all 0.2s ease-out';
        anchorData.element.style.transform = 'translateX(-50%) translateY(-50%) scale(0.1)';
        anchorData.element.style.opacity = '0';
        setTimeout(() => {
            if (anchorData.element && anchorData.element.parentNode) {
                anchorData.element.remove();
            }
            const index = this.anchorPoints.indexOf(anchorData);
            if (index > -1) {
                this.anchorPoints.splice(index, 1);
            }
        }, 200);
    }
    removeAnchorPoint() {
        this.anchorPoints.forEach(anchor => {
            if (anchor.element && anchor.element.parentNode) {
                anchor.element.remove();
            }
        });
        this.anchorPoints = [];
        this.isHooked = false;
        this.hookedIntensityMultiplier = 1.0;
        this.collectedPoints = 0;
        this.resetObstacleFrequency();
    }
    increaseObstacleFrequency() {
        if (!this.floatingContainer) return;
        if (!this.originalWindInterval && this.windInterval) {
            this.originalWindInterval = this.windInterval;
        }
        if (this.windInterval) {
            clearInterval(this.windInterval);
        }
        this.windInterval = setInterval(() => {
            const currentBubbles = this.floatingContainer?.querySelectorAll('.phanera-bubble').length || 0;
            const maxBubbles = 30 + (this.collectedPoints * 3);
            if (currentBubbles < maxBubbles) {
                this.createBubble(Math.floor(Math.random() * 1000));
            }
        }, 300 + Math.random() * 500);
    }
    resetObstacleFrequency() {
        if (this.windInterval) {
            clearInterval(this.windInterval);
        }
        this.startWindDrift();
    }
    checkParticleConsumption() {
        if (!this.floatingContainer || !this.isHooked || this.swirlParticles.length === 0) return;
        const bubbles = this.floatingContainer.querySelectorAll('.phanera-bubble');
        bubbles.forEach(bubble => {
            if (!bubble.dataset.consumptionRate) {
                bubble.dataset.consumptionRate = Math.random() * 0.3 + 0.1;
                bubble.dataset.lastConsumption = Date.now();
                bubble.dataset.particlesConsumed = 0;
                bubble.dataset.hungerRadius = 60 + Math.random() * 40;
            }
            const rect = bubble.getBoundingClientRect();
            const bubbleX = rect.left + rect.width / 2;
            const bubbleY = rect.top + rect.height / 2;
            const hungerRadius = parseFloat(bubble.dataset.hungerRadius);
            const consumptionRate = parseFloat(bubble.dataset.consumptionRate);
            const currentTime = Date.now();
            const timeSinceLastConsumption = currentTime - parseFloat(bubble.dataset.lastConsumption);
            const consumptionInterval = 1000 / consumptionRate;
            if (timeSinceLastConsumption > consumptionInterval) {
                const nearbyParticles = this.swirlParticles.filter(particle => {
                    if (!particle.element || particle.orphaned) return false;
                    const particleX = particle.x;
                    const particleY = particle.y;
                    const distance = Math.sqrt(
                        Math.pow(bubbleX - particleX, 2) + 
                        Math.pow(bubbleY - particleY, 2)
                    );
                    return distance <= hungerRadius;
                });
                if (nearbyParticles.length > 0) {
                    const closestParticle = nearbyParticles.reduce((closest, particle) => {
                        const distToParticle = Math.sqrt(
                            Math.pow(bubbleX - particle.x, 2) + 
                            Math.pow(bubbleY - particle.y, 2)
                        );
                        const distToClosest = Math.sqrt(
                            Math.pow(bubbleX - closest.x, 2) + 
                            Math.pow(bubbleY - closest.y, 2)
                        );
                        return distToParticle < distToClosest ? particle : closest;
                    });
                    this.bubbleConsumesParticle(bubble, closestParticle);
                }
            }
        });
    }
    destroyParticleOnImpact(particle, bubble, particleSpeed, particleMass) {
        if (particle.element && particle.element.parentNode) {
            particle.element.remove();
        }
        const particleIndex = this.swirlParticles.indexOf(particle);
        if (particleIndex > -1) {
            this.swirlParticles.splice(particleIndex, 1);
        }
        const currentSize = parseFloat(bubble.dataset.size) || 50;
        const newSize = Math.min(currentSize * 1.02, 80);
        bubble.dataset.size = newSize;
        bubble.style.width = newSize + 'px';
        bubble.style.height = newSize + 'px';
    }
    destroyOrphanedParticleOnImpact(particle, bubble, particleSpeed, particleMass) {
        if (particle.element && particle.element.parentNode) {
            particle.element.remove();
        }
        if (this.orphanedParticles) {
            const orphanIndex = this.orphanedParticles.indexOf(particle);
            if (orphanIndex > -1) {
                this.orphanedParticles.splice(orphanIndex, 1);
            }
        }
        const currentSize = parseFloat(bubble.dataset.size) || 50;
        const newSize = Math.min(currentSize * 1.03, 80);
        bubble.dataset.size = newSize;
        bubble.style.width = newSize + 'px';
        bubble.style.height = newSize + 'px';
    }
    feedBubble(bubble, particleSpeed, particleMass, isHighSpeed = false) {
        if (!bubble.dataset.particlesEaten) {
            bubble.dataset.particlesEaten = 0;
            bubble.dataset.totalEnergyConsumed = 0;
        }
        const particlesEaten = parseInt(bubble.dataset.particlesEaten) + 1;
        const currentEnergy = parseFloat(bubble.dataset.totalEnergyConsumed) || 0;
        const particleEnergy = (particleSpeed * particleMass) / 10;
        const energyMultiplier = isHighSpeed ? 1.5 : 1.0;
        const totalEnergy = currentEnergy + (particleEnergy * energyMultiplier);
        bubble.dataset.particlesEaten = particlesEaten;
        bubble.dataset.totalEnergyConsumed = totalEnergy;
        const baseSize = parseFloat(bubble.dataset.originalSize) || 50;
        if (!bubble.dataset.originalSize) {
            bubble.dataset.originalSize = baseSize;
        }
        const growthFactor = 1 + (totalEnergy / 300);
        const maxSize = baseSize * 1.4;
        const newSize = Math.min(maxSize, baseSize * growthFactor);
        bubble.dataset.size = newSize;
        bubble.style.width = newSize + 'px';
        bubble.style.height = newSize + 'px';
        const newMass = 5 + (totalEnergy / 20);
        bubble.dataset.mass = newMass;
        const speedReduction = Math.max(0.3, 1 - (totalEnergy / 200));
        const baseVelX = parseFloat(bubble.dataset.baseVelX) || 0;
        const baseVelY = parseFloat(bubble.dataset.baseVelY) || 0;
        bubble.dataset.currentVelX = baseVelX * speedReduction;
        bubble.dataset.currentVelY = baseVelY * speedReduction;
        bubble.style.filter = `brightness(${1 + Math.min(0.3, totalEnergy / 400)}) saturate(${1 + Math.min(0.2, totalEnergy / 300)})`;
        if (!bubble.dataset.impactCount || parseInt(bubble.dataset.impactCount) === 0) {
            bubble.style.boxShadow = '';
        }
        if (particlesEaten % 5 === 0) {
        }
    }
    processBubbleDeflation(bubble, currentTime, deltaTime) {
        const totalEnergy = parseFloat(bubble.dataset.totalEnergyConsumed) || 0;
        const originalSize = parseFloat(bubble.dataset.originalSize) || 50;
        const currentSize = parseFloat(bubble.dataset.size) || originalSize;
        if (totalEnergy > 0) {
            const excessSize = currentSize - originalSize;
            if (excessSize > 0.1) {
                const deflationRate = excessSize * 0.01 * deltaTime;
                const newSize = Math.max(originalSize, currentSize - deflationRate);
                bubble.dataset.size = newSize;
                bubble.style.width = newSize + 'px';
                bubble.style.height = newSize + 'px';
                const sizeRatio = (newSize - originalSize) / (currentSize - originalSize);
                bubble.dataset.totalEnergyConsumed = totalEnergy * sizeRatio;
                const adjustedEnergy = parseFloat(bubble.dataset.totalEnergyConsumed);
                const newMass = 5 + (adjustedEnergy / 20);
                bubble.dataset.mass = newMass;
                const currentVelX = parseFloat(bubble.dataset.currentVelX) || 0;
                const currentVelY = parseFloat(bubble.dataset.currentVelY) || 0;
                const speedReduction = Math.max(0.4, 1 - (adjustedEnergy / 300));
                bubble.dataset.currentVelX = currentVelX * speedReduction;
                bubble.dataset.currentVelY = currentVelY * speedReduction;
                bubble.style.filter = `brightness(${1 + Math.min(0.3, adjustedEnergy / 400)}) saturate(${1 + Math.min(0.2, adjustedEnergy / 300)})`;
            }
        }
    }
    cleanupDebugEffects(bubble, currentTime) {
        const lastVisualImpact = parseFloat(bubble.dataset.lastVisualImpact) || 0;
        const lastCollision = parseFloat(bubble.dataset.lastCollision) || 0;
        const timeSinceVisualEffect = currentTime - Math.max(lastVisualImpact, lastCollision);
        if (timeSinceVisualEffect > 500) {
            bubble.style.border = '';
        }
    }
    bubbleConsumesParticle(bubble, particle) {
        if (particle.element && particle.element.parentNode) {
            particle.element.remove();
        }
        const particleIndex = this.swirlParticles.indexOf(particle);
        if (particleIndex > -1) {
            this.swirlParticles.splice(particleIndex, 1);
        }
        const particlesConsumed = parseInt(bubble.dataset.particlesConsumed) + 1;
        const currentTime = Date.now();
        bubble.dataset.particlesConsumed = particlesConsumed;
        bubble.dataset.lastConsumption = currentTime;
        if (!bubble.dataset.pumpingWindow) {
            bubble.dataset.pumpingWindow = 2000;
            bubble.dataset.windowStartTime = currentTime;
            bubble.dataset.hitsInWindow = 1;
            bubble.dataset.maxIntensity = 1;
        } else {
            const windowElapsed = currentTime - parseFloat(bubble.dataset.windowStartTime);
            const currentWindow = parseFloat(bubble.dataset.pumpingWindow);
            if (windowElapsed < currentWindow) {
                bubble.dataset.hitsInWindow = parseInt(bubble.dataset.hitsInWindow) + 1;
                bubble.dataset.maxIntensity = Math.min(5, parseFloat(bubble.dataset.maxIntensity) + 0.5);
                bubble.dataset.pumpingWindow = Math.max(500, currentWindow * 0.9);
            } else {
                bubble.dataset.windowStartTime = currentTime;
                bubble.dataset.hitsInWindow = 1;
                bubble.dataset.maxIntensity = Math.max(1, parseFloat(bubble.dataset.maxIntensity) * 0.7);
                bubble.dataset.pumpingWindow = Math.min(2000, parseFloat(bubble.dataset.pumpingWindow) * 1.1);
            }
        }
        const growthPerParticle = 1.04 + (parseFloat(bubble.dataset.maxIntensity) * 0.01);
        const currentSize = parseFloat(bubble.dataset.size) || 50;
        const newSize = currentSize * growthPerParticle;
        bubble.dataset.size = newSize;
        bubble.style.width = newSize + 'px';
        bubble.style.height = newSize + 'px';
        const currentMass = parseFloat(bubble.dataset.mass) || 5;
        const newMass = currentMass * 1.01;
        bubble.dataset.mass = newMass;
        const slowdownFactor = 0.998;
        bubble.dataset.currentVelX = parseFloat(bubble.dataset.currentVelX) * slowdownFactor;
        bubble.dataset.currentVelY = parseFloat(bubble.dataset.currentVelY) * slowdownFactor;
        bubble.dataset.baseVelX = parseFloat(bubble.dataset.baseVelX) * slowdownFactor;
        bubble.dataset.baseVelY = parseFloat(bubble.dataset.baseVelY) * slowdownFactor;
        const intensity = parseFloat(bubble.dataset.maxIntensity);
        const hitsInWindow = parseInt(bubble.dataset.hitsInWindow);
        const glowRadius = 15 + (intensity * 25);
        const glowIntensity = 0.3 + (intensity * 0.2);
        const flashIntensity = Math.min(1, hitsInWindow / 3);
        const innerGlow = `0 0 ${glowRadius * 0.3}px rgba(255,200,50,${glowIntensity * 1.5})`;
        const midGlow = `0 0 ${glowRadius * 0.6}px rgba(255,150,0,${glowIntensity})`;
        const outerGlow = `0 0 ${glowRadius}px rgba(255,100,0,${glowIntensity * 0.6})`;
        const flash = `0 0 ${glowRadius * 1.5}px rgba(255,255,255,${flashIntensity * 0.4})`;
        bubble.style.boxShadow = `${innerGlow}, ${midGlow}, ${outerGlow}, ${flash}`;
        const brightness = 1 + (intensity * 0.3);
        const saturation = 1 + (intensity * 0.4);
        bubble.style.filter = `brightness(${brightness}) saturate(${saturation})`;
        const pumpSpeed = Math.max(0.1, 0.8 - (intensity * 0.1));
        bubble.style.animation = `bubble-pumping ${pumpSpeed}s ease-out`;
        if (!document.querySelector('#bubble-pumping-styles')) {
            const style = document.createElement('style');
            style.id = 'bubble-pumping-styles';
            style.textContent = `
                @keyframes bubble-pumping {
                    0% { 
                        transform: scale(1); 
                    }
                    30% { 
                        transform: scale(1.15); 
                    }
                    60% { 
                        transform: scale(0.95); 
                    }
                    100% { 
                        transform: scale(1); 
                    }
                }
            `;
            document.head.appendChild(style);
        }
        const intensityLoss = 0.02;
        this.hookedIntensityMultiplier = Math.max(0.5, this.hookedIntensityMultiplier - intensityLoss);
        if (this.hookedIntensityMultiplier < 0.7) {
            this.endSwirlEffect();
        }
    }
    cleanupDispersedParticles() {
        this.swirlParticles = this.swirlParticles.filter(particle => {
            if (!particle.element || !particle.element.parentNode) {
                return false;
            }
            if (particle.released) {
                const timeSinceRelease = Date.now() - particle.releaseTime;
                if (timeSinceRelease > 5000) {
                    particle.element.remove();
                    return false;
                }
            }
            return true;
        });
        if (this.magicDustContainer) {
            const allMagicParticles = this.magicDustContainer.querySelectorAll('.magic-particle');
            allMagicParticles.forEach(element => {
                if (!element.dataset.tracked && element.classList.contains('dispersing')) {
                    const opacity = parseFloat(element.style.opacity) || 1;
                    if (opacity < 0.1) {
                        element.remove();
                    }
                }
            });
        }
    }
    createMagicParticle(x, y) {
        if (!this.magicDustContainer) return;
        const particle = document.createElement('div');
        particle.className = 'magic-particle';
        const rand = Math.random();
        if (rand < 0.3) {
            particle.classList.add('large');
        } else if (rand < 0.7) {
            particle.classList.add('small');
        }
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        particle.style.left = (x + offsetX) + 'px';
        particle.style.top = (y + offsetY) + 'px';
        this.magicDustContainer.appendChild(particle);
        setTimeout(() => {
            if (particle.parentNode) {
                particle.remove();
            }
        }, 1500);
    }
    updateMagicDust() {
        const heroArea = document.querySelector('.fullscreen-background');
        if (!heroArea || !this.magicDustContainer) return;
        const heroRect = heroArea.getBoundingClientRect();
        const mouseInHero = this.mousePosition.x >= heroRect.left && 
                           this.mousePosition.x <= heroRect.right &&
                           this.mousePosition.y >= heroRect.top && 
                           this.mousePosition.y <= heroRect.bottom;
        if (mouseInHero) {
            const currentTime = Date.now();
            if (currentTime - this.lastParticleTime > 150) {
                this.createMagicParticle(this.mousePosition.x, this.mousePosition.y);
                this.lastParticleTime = currentTime;
            }
        }
    }
    initializeWindParticles() {
        if (!this.windParticlesContainer) return;
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                this.createWindParticle();
            }, Math.random() * 2000);
        }
    }
    createWindParticle() {
        if (!this.windParticlesContainer) return;
        const particle = document.createElement('div');
        particle.className = 'wind-particle';
        particle.dataset.createdAt = Date.now().toString();
        const rand = Math.random();
        if (rand < 0.1) {
            particle.classList.add('large');
        } else if (rand < 0.4) {
            particle.classList.add('small');
        }
        const windDirection = window.dataManager?.data?.world?.wind?.heading || 85;
        const windStrength = window.dataManager?.data?.world?.wind?.gales || 2.3;
        const startDistance = 200;
        const windRadians = (windDirection - 90) * Math.PI / 180;
        const startX = -Math.cos(windRadians) * startDistance + Math.random() * window.innerWidth;
        const startY = -Math.sin(windRadians) * startDistance + Math.random() * window.innerHeight;
        particle.style.left = startX + 'px';
        particle.style.top = startY + 'px';
        const driftDistance = 500 + (windStrength * 200);
        const driftX = Math.cos(windRadians) * driftDistance;
        const driftY = Math.sin(windRadians) * driftDistance;
        particle.style.setProperty('--wind-drift-transform', `translateX(${driftX}px) translateY(${driftY}px)`);
        const duration = 15000 + Math.random() * 10000;
        const fadeOutDuration = 8000 + Math.random() * 4000;
        particle.style.animationDuration = `${duration}ms, ${fadeOutDuration}ms`;
        this.windParticlesContainer.appendChild(particle);
        this.windParticles.push(particle);
        setTimeout(() => {
            if (particle.parentNode) {
                particle.remove();
                const index = this.windParticles.indexOf(particle);
                if (index > -1) {
                    this.windParticles.splice(index, 1);
                }
            }
        }, Math.max(duration, fadeOutDuration));
        return particle;
    }
    updateWindParticles() {
        if (!this.windParticlesContainer) return;
        this.windParticles = this.windParticles.filter(particle => {
            if (!particle || !particle.parentNode) {
                return false;
            }
            const particleAge = Date.now() - (parseInt(particle.dataset.createdAt) || 0);
            if (particleAge > 25000) {
                particle.remove();
                return false;
            }
            return true;
        });
    }
    updateFloatingBubbles(dreamersData, canonData, souvenirsData) {
        if (!this.bubblesFeatureEnabled) {
            return;
        }
        if (!this.bubbleSystem && typeof window.BubbleSystem === 'function') {
            this.bubbleSystem = new window.BubbleSystem(this);
            const allow = this.shouldShowBubbles();
            this.bubbleSystem.setEnabled(allow);
        }
        if (!this.bubbleSystem) {
            return;
        }
        if (!this.bubbleSystem.floatingContainer) {
            this.bubbleSystem.initializeFloatingBubbles(dreamersData, canonData, souvenirsData);
        } else {
            this.bubbleSystem.updateFloatingBubbles(dreamersData, canonData, souvenirsData);
        }
    }
    showPhaneraInfo(phanera) {
    }
    
    /**
     * Set up click listener to start dialogue early
     */
    setupEarlyDialogueClick() {
        const background = document.querySelector('.fullscreen-background');
        if (!background) return;
        
        const clickHandler = (e) => {
            // Don't intercept clicks on bubbles
            if (e.target.classList.contains('homepage-bubble') || 
                e.target.closest('.homepage-bubble')) {
                return;
            }
            
            // Only respond to click if dialogue hasn't started yet
            if (!this.experienceStarted) {
                // Remove the click listener
                background.removeEventListener('click', clickHandler);
                
                // Start dialogue immediately
                this.startDialogueExperience();
            }
        };
        
        background.addEventListener('click', clickHandler);
    }
    
    /**
     * Initialize the interactive experience
     */
    initExperience() {
        // Wait for Directory to be available
        const waitForDirectory = () => {
            if (window.Directory) {
                this.directoryWidget = new window.Directory();
                console.log('✅ [homepage.js] Directory initialized');
            } else {
                console.log('⏳ [homepage.js] Waiting for Directory...');
                setTimeout(waitForDirectory, 100);
            }
        };
        waitForDirectory();
        
        // Wait for ShareLore to be available
        const waitForShareLore = () => {
            if (window.ShareLore) {
                this.shareLoreWidget = new window.ShareLore();
                console.log('✅ [homepage.js] ShareLore initialized');
            } else {
                console.log('⏳ [homepage.js] Waiting for ShareLore...');
                setTimeout(waitForShareLore, 100);
            }
        };
        waitForShareLore();
        
        // Expose globally for header to use
        window.homepageScene = this;
        console.log('✅ [homepage.js] HomepageScene exposed globally');
        
        // DISABLED: Auto-start dialogue experience
        // Errantson only appears when clicking the header icon
        // 
        // // Check if user is logged in
        // const checkAuth = () => {
        //     if (window.oauthManager && window.oauthManager.session && window.oauthManager.session.did) {
        //         // User is logged in - skip the experience for now
        //         // (will be handled by startDialogueExperience check)
        //         this.experienceStarted = true;
        //         return;
        //     }
        //     
        //     // User not logged in - start the experience after delay
        //     setTimeout(() => {
        //         this.startDialogueExperience();
        //     }, this.delay_start);
        // };
        // 
        // // Try immediately
        // checkAuth();
        // 
        // // Also check after delays in case OAuth manager loads later
        // setTimeout(checkAuth, 500);
        // setTimeout(checkAuth, 1000);
    }
    
    /**
     * Start the dialogue experience
     */
    startDialogueExperience() {
        // Don't start if already started
        if (this.experienceStarted) return;
        
        this.experienceStarted = true;
        
        // Use Shadowbox exactly like the header does
        if (!window.Shadowbox) {
            console.warn('Shadowbox utility not available');
            return;
        }
        
        // Check if user is logged in
        const session = window.oauthManager?.getSession();
        
        if (session) {
            console.log('✅ [homepage.js] User logged in, showing returning user dialogue');
            this.startReturningUserDialogue(session);
        } else {
            console.log('✅ [homepage.js] User not logged in, showing new user dialogue');
            this.startNewUserDialogue();
        }
    }
    
    /**
     * Start dialogue for new/logged-out users
     */
    async startNewUserDialogue() {
        // Use Shadowbox with the same pattern as header.js
        const shadowbox = new window.Shadowbox({
            showCloseButton: false
        });
        
        // Show core:welcome dialogue - shadowbox handles everything
        await shadowbox.showDialogue('core:welcome', this);
    }
    
    /**
     * Explain ATProtocol
     */
    async explainATProtocol() {
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogue('homepage:about:protocol', this);
    }
    
    /**
     * Explain Reverie House
     */
    async explainReverieHouse() {
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogue('homepage:about:house', this);
    }
    
    /**
     * Handle user who has Bluesky
     */
    async handleHasBluesky() {
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogue('homepage:status:account', this);
    }
    
    /**
     * Explain joining process
     */
    async explainJoining() {
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogue('homepage:about:joining', this);
    }
    
    /**
     * Show account creation
     */
    showCreateAccount() {
        // Close any existing shadowbox
        if (this.currentShadowbox) {
            this.currentShadowbox.close();
            this.currentShadowbox = null;
        }
        
        // Wait for login widget to be available
        const showLogin = () => {
            if (!window.loginWidget) {
                setTimeout(showLogin, 100);
                return;
            }
            
            // Show create account modal
            window.loginWidget.showCreateAccount();
        };
        
        showLogin();
    }
    
    /**
     * Offer guided tour
     */
    async offerTour() {
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogue('homepage:action:tour', this);
    }
    
    /**
     * Start guided tour
     */
    startGuidedTour() {
        // Close any existing shadowbox
        if (this.currentShadowbox) {
            this.currentShadowbox.close();
            this.currentShadowbox = null;
        }
        
        // Navigate to getting-started page
        window.location.href = '/getting-started';
    }
    
    /**
     * Let user explore alone
     */
    async exploreAlone() {
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogue('homepage:action:explore', this);
    }
    
    /**
     * Mark user as introduced and end dialogue
     */
    markIntroduced() {
        localStorage.setItem('reverie_introduced', 'true');
        
        // Close any existing shadowbox
        if (this.currentShadowbox) {
            this.currentShadowbox.close();
            this.currentShadowbox = null;
        }
    }
    
    /**
     * Start dialogue for returning/logged-in users
     */
    async startReturningUserDialogue(session) {
        // Use Shadowbox with the same pattern as header.js
        const shadowbox = new window.Shadowbox({
            showCloseButton: false
        });
        
        // Show core:welcome dialogue - shadowbox handles everything
        await shadowbox.showDialogue('core:welcome', this);
    }
    
    /**
     * Handle share story request
     */
    handleShareStory(hasLorePrivs) {
        // Close any existing shadowbox
        if (this.currentShadowbox) {
            this.currentShadowbox.close();
            this.currentShadowbox = null;
        }
        
        // Wait for ShareLore widget
        const showShareLore = () => {
            if (!this.shareLoreWidget && window.ShareLore) {
                this.shareLoreWidget = new window.ShareLore();
            }
            
            if (!this.shareLoreWidget) {
                setTimeout(showShareLore, 100);
                return;
            }
            
            // Show the share lore modal
            this.shareLoreWidget.show();
            
            // Listen for success event
            window.addEventListener('sharelore:success', (event) => {
                this.handleStoryShared(event.detail, hasLorePrivs);
            }, { once: true });
            
            // Listen for cancel event
            window.addEventListener('sharelore:cancel', () => {
                this.handleShareStoryCancelled(hasLorePrivs);
            }, { once: true });
        };
        
        showShareLore();
    }
    
    /**
     * Handle no story to share
     */
    async handleNoStory(hasLorePrivs) {
        // Build dialogue data
        const dialogueData = {
            key: 'no_story',
            messages: hasLorePrivs ? [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "That's alright.\nTake your time.",
                    buttons_json: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "As one of the canon keepers,\nyou know where to find the archives.",
                    buttons_json: JSON.stringify([
                        {
                            text: 'SHOW ME AROUND',
                            callback: 'showDirectory'
                        }
                    ])
                }
            ] : [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "That's alright.\nTake your time.",
                    buttons_json: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Is there anything else you need?",
                    buttons_json: JSON.stringify([
                        {
                            text: 'SHOW ME AROUND',
                            callback: 'showDirectory'
                        }
                    ])
                }
            ]
        };
        
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogueData(dialogueData, this);
    }
    
    /**
     * Handle successful story share
     */
    async handleStoryShared(storyData, hasLorePrivs) {
        const thankYouResponses = [
            "Wonderful. Your voice adds to our tapestry.",
            "Excellent. The collective dream grows richer.",
            "Beautiful. Thank you for sharing.",
            "Marvelous. Your story is now part of the House."
        ];
        
        const randomThankYou = thankYouResponses[Math.floor(Math.random() * thankYouResponses.length)];
        
        // Build dialogue data
        const dialogueData = {
            key: 'story_shared',
            messages: hasLorePrivs ? [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: randomThankYou,
                    buttons_json: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "As a canon keeper,\nwould you like to tag this for the lore.farm?",
                    buttons_json: JSON.stringify([
                        {
                            text: 'YES',
                            callback: 'offerLoreTagging'
                        },
                        {
                            text: 'NOT NOW',
                            callback: 'showDirectory'
                        }
                    ])
                }
            ] : [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: randomThankYou,
                    buttons_json: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Would you like to explore further?",
                    buttons_json: JSON.stringify([
                        {
                            text: 'SHOW ME AROUND',
                            callback: 'showDirectory'
                        }
                    ])
                }
            ]
        };
        
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        // Store story data for potential lore tagging
        this._pendingStoryData = storyData;
        await shadowbox.showDialogueData(dialogueData, this);
    }
    
    /**
     * Handle share story cancellation - user closed the modal
     */
    async handleShareStoryCancelled(hasLorePrivs) {
        await this.showCentralDialogueSpine('share_cancelled');
    }
    
    /**
     * Offer lore.farm tagging
     */
    async offerLoreTagging() {
        // Use stored story data
        const storyData = this._pendingStoryData;
        
        // Build dialogue data
        const dialogueData = {
            key: 'lore_tagging',
            messages: [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "The lore.farm tagging interface\nwill open soon.\n\nFor now, you can tag it manually.",
                    buttons_json: null
                }
            ]
        };
        
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogueData(dialogueData, this);
        
        setTimeout(() => {
            this.showDirectory();
        }, 3000);
    }
    

    
    /**
     * Central dialogue spine - main junction point after various cancellations
     * @param {string} returnLabel - Label indicating where we're returning from
     */
    async showCentralDialogueSpine(returnLabel = 'default') {
        // Contextual opening based on return label
        const openingTexts = {
            'login_cancelled': "Oh? Whatever trouble, nevermind.\nNames aren't important.",
            'introduction_cancelled': "Oh? That's alright.\nNames don't matter much.",
            'name_cancelled': "No worries.\nWe can skip the formalities.",
            'share_cancelled': "No worries.\nWhen inspiration strikes,\nyou know where to find me.",
            'default': "Is there anything else\nyou'd like to do?"
        };
        
        const openingText = openingTexts[returnLabel] || openingTexts['default'];
        
        const dialogueData = {
            key: 'central_spine',
            messages: [
                {
                    sequence: 0,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: openingText,
                    buttons_json: null
                },
                {
                    sequence: 1,
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Were you looking for someone?\nIs there anything you need?",
                    buttons_json: JSON.stringify([
                        {
                            text: 'I NEED...',
                            rotating: true,
                            callback: 'showDirectory'
                        }
                    ])
                }
            ],
            rotating_text: JSON.stringify(['I NEED...', 'SHOW ME...', 'CAN YOU...', 'HELP ME...'])
        };
        
        const shadowbox = new window.Shadowbox({ showCloseButton: false });
        await shadowbox.showDialogueData(dialogueData, this);
    }

    /**
     * Show the directory widget
     */
    showDirectory() {
        // Close any existing shadowbox
        if (this.currentShadowbox) {
            this.currentShadowbox.close();
            this.currentShadowbox = null;
        }
        
        // Wait for directory widget to be available
        const showDir = () => {
            if (!this.directoryWidget && window.Directory) {
                this.directoryWidget = new window.Directory();
            }
            
            if (!this.directoryWidget) {
                console.log('⏳ [homepage.js] Waiting for Directory widget...');
                setTimeout(showDir, 100);
                return;
            }
            
            console.log('✅ [homepage.js] Showing Directory');
            
            // Show directory - let it handle navigation itself
            this.directoryWidget.show();
        };
        
        showDir();
    }
}

window.HomepageScene = HomepageScene;
document.addEventListener('DOMContentLoaded', () => {
    window.homepageScene = new HomepageScene();
    
    // Set up phanera change listener
    window.homepageScene.setupPhaneraListener();
});
