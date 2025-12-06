/**
 * Homepage Floating Bubbles
 * 
 * Displays random floating souvenir bubbles across the homepage after a delay.
 * Uses same physics and styling as shadowbox bubbles.
 */

class HomepageBubbles {
    constructor() {
        this.bubbleContainer = null;
        this.souvenirsData = null;
        this.autoBubbleInterval = null;
        this.bubbleDelay = 10000; // 10 seconds like shadowbox
        this.initialized = false;
        this.maxBubbles = 12; // Maximum number of bubbles on screen at once
        this.activeBubbles = []; // Track active bubbles
        this.isPageVisible = true; // Track page visibility
        this.lastUpdateTime = null; // For deltaTime calculation
        this.spawnRate = 3000; // Base spawn rate in ms
        this.minSpawnRate = 2000; // Minimum time between spawns
        this.maxSpawnRate = 5000; // Maximum time between spawns
        this.isActive = true; // MEMORY LEAK FIX: Flag to control lifecycle
    }

    init() {
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
        `;
        document.body.appendChild(this.bubbleContainer);

        // Set up Page Visibility API to pause/resume animations
        this.setupVisibilityHandling();

        // Load souvenirs data
        this.loadSouvenirsData();

        // Start bubbles after delay
        setTimeout(() => {
            this.startBubbles();
        }, this.bubbleDelay);
    }

    setupVisibilityHandling() {
        // OPTIMIZED: Pause animations when tab is hidden to save CPU/GPU
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            if (!this.isPageVisible) {
                console.log('💤 [homepage-bubbles] Page hidden - aggressive cleanup');
                
                // Clear the spawn interval when hidden
                if (this.autoBubbleInterval) {
                    clearInterval(this.autoBubbleInterval);
                    this.autoBubbleInterval = null;
                }
                
                // MEMORY LEAK FIX: Remove excess bubbles when page hidden
                const bubblestoKeep = 3; // Keep minimal bubbles
                while (this.activeBubbles.length > bubblestoKeep) {
                    const bubbleData = this.activeBubbles.pop();
                    bubbleData.element?.remove();
                }
                console.log(`🧹 Kept ${this.activeBubbles.length} bubbles while hidden`);
                
            } else {
                console.log('👁️ [homepage-bubbles] Page visible - resuming bubbles');
                // Resume spawning when visible again
                if (!this.autoBubbleInterval && this.isActive) {
                    this.startBubbles();
                }
                // Reset lastUpdateTime to prevent time jumps
                this.lastUpdateTime = performance.now();
            }
        });
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
        } catch (err) {
            console.error('Error loading souvenirs for homepage bubbles:', err);
        }
    }

    startBubbles() {
        if (this.autoBubbleInterval || !this.souvenirsData) return;

        // Create bubbles at regular intervals
        const spawnBubble = () => {
            if (!this.souvenirsData || !this.isPageVisible) return;

            // Clean up destroyed bubbles from tracking array
            this.activeBubbles = this.activeBubbles.filter(b => b.element && b.element.parentNode);

            // Don't create new bubble if we're at max capacity
            if (this.activeBubbles.length >= this.maxBubbles) {
                return;
            }

            const souvenirKeys = Object.keys(this.souvenirsData);
            const randomKey = souvenirKeys[Math.floor(Math.random() * souvenirKeys.length)];
            const souvenir = this.souvenirsData[randomKey];
            const latestForm = souvenir.forms[souvenir.forms.length - 1];

            this.createBubble(latestForm.icon, randomKey, latestForm.name);
        };

        // Create first bubble immediately
        spawnBubble();

        // Then spawn at intervals with some randomness
        this.autoBubbleInterval = setInterval(() => {
            spawnBubble();
            
            // Vary spawn rate slightly for more organic feel
            const variance = (Math.random() - 0.5) * 1000;
            this.spawnRate = Math.max(
                this.minSpawnRate,
                Math.min(this.maxSpawnRate, this.spawnRate + variance)
            );
        }, this.spawnRate);
    }

    createBubble(iconUrl, key, name) {
        if (!this.bubbleContainer) return;

        const bubble = document.createElement('div');
        const size = 50 + Math.random() * 30; // 50-80px
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
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            will-change: transform, left, top;
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

        // Create bubble data object for tracking
        const bubbleData = {
            element: bubble,
            x: x,
            y: y,
            vx: 1.2 + Math.random() * 0.8, // Horizontal velocity (rightward)
            vy: (Math.random() - 0.5) * 0.4, // Slight vertical drift
            rotation: Math.random() * 360,
            wobbleFreq: 0.001 + Math.random() * 0.002,
            wobbleAmp: 15 + Math.random() * 25,
            startTime: performance.now(),
            isHovered: false
        };

        // Track this bubble
        this.activeBubbles.push(bubbleData);

        // Animate bubble with same physics as shadowbox
        this.animateBubble(bubbleData);
    }

    animateBubble(bubbleData) {
        let lastTime = performance.now();
        
        // OPTIMIZED: Throttle to 30 FPS to reduce CPU load
        const targetFPS = 30;
        const frameInterval = 1000 / targetFPS;

        const update = (currentTime) => {
            // Check if bubble still exists
            if (!bubbleData.element || !bubbleData.element.parentNode) {
                // Remove from tracking
                const index = this.activeBubbles.indexOf(bubbleData);
                if (index > -1) {
                    this.activeBubbles.splice(index, 1);
                }
                return;
            }

            // OPTIMIZED: Only animate when page is visible and at throttled rate
            const deltaTime = currentTime - lastTime;
            
            if (!this.isPageVisible || deltaTime < frameInterval) {
                requestAnimationFrame(update);
                return;
            }
            
            lastTime = currentTime - (deltaTime % frameInterval);
            const deltaTimeSec = Math.min(deltaTime / 1000, 0.1);

            // Apply velocities with deltaTime for frame-rate independence
            bubbleData.x += bubbleData.vx * 60 * deltaTimeSec; // Normalized to 60fps
            bubbleData.y += bubbleData.vy * 60 * deltaTimeSec;

            // Add gentle sine wave vertical wobble based on elapsed time
            const elapsedTime = currentTime - bubbleData.startTime;
            const wobble = Math.sin(elapsedTime * bubbleData.wobbleFreq) * bubbleData.wobbleAmp * 0.02;
            bubbleData.y += wobble * deltaTimeSec * 60;

            // Keep within vertical bounds with soft bounce
            if (bubbleData.y < 50) {
                bubbleData.y = 50;
                bubbleData.vy = Math.abs(bubbleData.vy) * 0.5;
            }
            if (bubbleData.y > window.innerHeight - 100) {
                bubbleData.y = window.innerHeight - 100;
                bubbleData.vy = -Math.abs(bubbleData.vy) * 0.5;
            }

            // Very slight damping to maintain movement
            const dampingFactor = Math.pow(0.9995, deltaTimeSec * 60);
            bubbleData.vx *= dampingFactor;
            bubbleData.vy *= Math.pow(0.998, deltaTimeSec * 60);

            // Physics-based rotation following the wind (horizontal velocity)
            const rotationSpeed = bubbleData.vx * 0.3 * deltaTimeSec * 60;
            bubbleData.rotation += rotationSpeed;

            // Update DOM position
            bubbleData.element.style.left = bubbleData.x + 'px';
            bubbleData.element.style.top = bubbleData.y + 'px';
            bubbleData.element.style.transform = `rotate(${bubbleData.rotation}deg)`;

            // Fade out when exiting right side
            const exitMargin = 200;
            
            if (bubbleData.x > window.innerWidth + exitMargin) {
                // Remove bubble
                bubbleData.element.remove();
                const index = this.activeBubbles.indexOf(bubbleData);
                if (index > -1) {
                    this.activeBubbles.splice(index, 1);
                }
                return;
            } else if (bubbleData.x > window.innerWidth) {
                // Start fading after passing screen edge
                const distanceBeyond = bubbleData.x - window.innerWidth;
                const fadeProgress = Math.min(1, distanceBeyond / exitMargin);
                bubbleData.element.style.opacity = 1 - fadeProgress;
            }

            // Continue animation loop
            requestAnimationFrame(update);
        };

        requestAnimationFrame(update);
    }

    /**
     * MEMORY LEAK FIX: Cleanup method to prevent memory leaks
     * Call this when navigating away from homepage
     */
    cleanup() {
        console.log('🧹 Cleaning up HomepageBubbles...');
        
        this.isActive = false;
        
        if (this.autoBubbleInterval) {
            clearInterval(this.autoBubbleInterval);
            this.autoBubbleInterval = null;
        }
        
        // Remove all bubbles
        this.activeBubbles.forEach(bubbleData => {
            bubbleData.element?.remove();
        });
        this.activeBubbles = [];
        
        if (this.bubbleContainer && this.bubbleContainer.parentNode) {
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
