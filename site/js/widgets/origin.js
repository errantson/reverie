/**
 * Origin Page - Centered octant display
 * Displays a user's spectrum origin in the center of the screen
 */

class OriginScene {
    constructor() {
        console.log('🔵 [Origin] ===== CONSTRUCTOR START =====');
        console.log('🔵 [Origin] Document ready state:', document.readyState);
        console.log('🔵 [Origin] Body classes:', document.body.className);
        
        this.canvas = document.getElementById('origin-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        console.log('🔵 [Origin] Canvas element found:', !!this.canvas);
        console.log('🔵 [Origin] Canvas context:', !!this.ctx);
        
        if (this.canvas) {
            console.log('🔵 [Origin] Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
            console.log('🔵 [Origin] Canvas parent:', this.canvas.parentElement);
        }
        
        this.bubbleSystem = null;
        this.handle = null;
        this.spectrum = null;
        this.displayName = null;
        this.avatarUrl = null;
        this.currentCard = 0; // Track carousel position
        this.carouselCards = [];
        this.cachedAvatarImage = null; // Cache avatar image
        this.isActive = true; // For particle cleanup
        
        // Animation state
        this.animating = false;
        this.animationStartTime = null;
        this.animationDuration = 4500; // Longer duration to let pendulum settle naturally
        this.animatedValues = {
            authority: 0,
            entropy: 0,
            liberty: 0,
            oblivion: 0,
            receptive: 0,
            skeptic: 0
        };
        
        // Color transition state for smooth octant color changes
        this.currentOctantColor = null;
        this.targetOctantColor = null;
        this.colorTransitionProgress = 1; // 1 = fully transitioned
        
        // Parse URL to get handle
        this.parseUrl();
        
        // Initialize
        this.init();
        console.log('🔵 [Origin] ===== CONSTRUCTOR END =====');
    }
    
    parseUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlHandle = urlParams.get('handle');
        
        if (urlHandle) {
            // Explicit handle in URL - use it
            this.handle = urlHandle;
            console.log('🟢 [Origin] Using handle from URL:', this.handle);
        } else {
            // No handle in URL - will try to detect from session in init()
            this.handle = null;
            console.log('🟢 [Origin] No handle in URL, will check for active session');
        }
    }
    
    /**
     * Detect if user has an active Bluesky session and use their handle
     * This allows visiting /origin or /origin.html without a handle param
     * to automatically show the logged-in user's spectrum origin
     */
    async detectSessionHandle() {
        console.log('🔍 [Origin] Checking for active Bluesky session...');
        
        // Wait briefly for OAuth manager to initialize if needed
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!window.oauthManager && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.oauthManager) {
            console.log('🔍 [Origin] OAuth manager not available');
            return;
        }
        
        try {
            // Try to get the current session
            const session = window.oauthManager.getSession();
            
            if (session && session.handle) {
                this.handle = session.handle;
                console.log('✅ [Origin] Found active session, using handle:', this.handle);
                
                // Update URL to include handle (without triggering reload)
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('handle', this.handle);
                window.history.replaceState({}, '', newUrl.toString());
                console.log('📝 [Origin] Updated URL with handle');
            } else {
                console.log('🔍 [Origin] No active session found');
            }
        } catch (error) {
            console.error('❌ [Origin] Error checking session:', error);
        }
    }
    
    async init() {
        console.log('🟡 [Origin] ===== INIT START =====');
        
        // If no handle from URL, try to get from active Bluesky session
        if (!this.handle) {
            await this.detectSessionHandle();
        }
        
        // Fallback to demo if still no handle
        if (!this.handle) {
            this.handle = 'demo';
            console.log('🟡 [Origin] No session found, using demo mode');
        }
        
        console.log('🟡 [Origin] Initializing for handle:', this.handle);
        
        // Ensure canvas is hidden initially
        this.canvas.style.display = 'none';
        
        // Set canvas size - 10% smaller than spectrum preview (880x630 -> 792x567)
        this.canvas.width = 792;
        this.canvas.height = 567;
        console.log('🟡 [Origin] Canvas size set to:', this.canvas.width, 'x', this.canvas.height);
        console.log('🟡 [Origin] Canvas display:', this.canvas.style.display);
        
        // Initialize bubbles for ambiance
        this.initBubbles();
        console.log('🟡 [Origin] Bubbles initialized');
        
        // Add window resize listener for responsive canvas
        window.addEventListener('resize', () => {
            if (this.canvas && this.canvas.style.display !== 'none') {
                console.log('📐 [Origin] Window resized, re-rendering canvas');
                this.render();
            }
        });
        
        // Listen for OAuth events to update buttons or reload with user's handle
        window.addEventListener('oauth:login', (event) => {
            console.log('🔐 [Origin] User logged in');
            
            // If we're on the landing page (demo mode), reload with user's handle
            if (this.handle === 'demo' || !this.handle.includes('.')) {
                const session = event.detail?.session;
                if (session && session.handle) {
                    console.log('🔐 [Origin] Redirecting to user origin page:', session.handle);
                    window.location.href = `/origin.html?handle=${encodeURIComponent(session.handle)}`;
                    return;
                }
            }
            
            this.addActionButtons();
        });
        
        window.addEventListener('oauth:logout', () => {
            console.log('🔓 [Origin] User logged out, updating buttons...');
            this.addActionButtons();
        });
        
        window.addEventListener('oauth:profile-loaded', (event) => {
            console.log('👤 [Origin] Profile loaded');
            
            // If we're on the landing page (demo mode), reload with user's handle
            if (this.handle === 'demo' || !this.handle.includes('.')) {
                const session = event.detail?.session;
                if (session && session.handle) {
                    console.log('👤 [Origin] Redirecting to user origin page:', session.handle);
                    window.location.href = `/origin.html?handle=${encodeURIComponent(session.handle)}`;
                    return;
                }
            }
            
            this.addActionButtons();
        });
        
        // Start with carousel
        await this.showCarousel();
        
        console.log('🟡 [Origin] ===== INIT END =====');
        console.log('🟡 [Origin] Final canvas display:', this.canvas.style.display);
    }
    
    async showCarousel() {
        console.log('🎠 [Origin] Starting carousel...');
        
        // Check if we're in demo/landing mode (no valid handle)
        if (this.handle === 'demo' || !this.handle.includes('.')) {
            console.log('🎠 [Origin] No valid handle, showing landing page');
            this.showLandingPage();
            return;
        }
        
        // Load spectrum data first (needed for card 2)
        try {
            await this.loadSpectrumData();
        } catch (error) {
            console.error('Failed to load spectrum data:', error);
            // Show error and skip carousel
            this.showError(error.message || 'Failed to load spectrum data');
            return;
        }
        
        // Create and show welcome card (card 1)
        this.showWelcomeCard();
    }
    
    /**
     * Show landing page when no handle is provided
     * Primary action: enter handle to see spectrum (no auth needed)
     */
    showLandingPage() {
        const carousel = document.getElementById('origin-carousel');
        if (!carousel) return;
        
        carousel.innerHTML = `
            <div class="carousel-card landing-card active">
                <img src="/assets/logo.png" alt="Reverie House" class="landing-logo">
                
                <p class="landing-description">
                    Dreamweavers wield forces like oblivion and entropy<br>
                    to conjure powerful reveries and nightmares.<br><br>
                    Enter your Bluesky handle to discover your<br>
                    coordinates in our wild mindscape.
                </p>
                
                <input 
                    type="text" 
                    id="landing-handle" 
                    placeholder="@handle.bsky.social" 
                    class="landing-input"
                >
                
                <button id="landing-lookup-btn" class="landing-btn">
                    View Origin
                </button>
                
                <p class="landing-hint">
                    No login required. Your origins are already known.
                </p>
            </div>
        `;
        
        // Start rotating placeholder handles
        this.startPlaceholderRotation();
        
        // Attach event handlers
        document.getElementById('landing-lookup-btn')?.addEventListener('click', () => {
            this.handleLandingSubmit();
        });
        
        // Allow Enter key to submit
        document.getElementById('landing-handle')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLandingSubmit();
            }
        });
    }
    
    /**
     * Start rotating placeholder text between example handles
     */
    startPlaceholderRotation() {
        const input = document.getElementById('landing-handle');
        if (!input) return;
        
        const placeholders = ['@handle.bsky.social', '@name.reverie.house'];
        let currentIndex = 0;
        let isRotating = true;
        
        // Stop rotation when input is focused
        input.addEventListener('focus', () => {
            isRotating = false;
            input.classList.remove('placeholder-fade');
        });
        
        // Resume rotation when input loses focus (if empty)
        input.addEventListener('blur', () => {
            if (!input.value.trim()) {
                isRotating = true;
            }
        });
        
        // Rotate every 3 seconds with smooth crossfade
        this.placeholderInterval = setInterval(() => {
            // Don't rotate if user has typed something or input is focused
            if (input.value.trim() || !isRotating) {
                return;
            }
            
            // Fade out smoothly
            input.classList.add('placeholder-fade');
            
            setTimeout(() => {
                // Change placeholder
                currentIndex = (currentIndex + 1) % placeholders.length;
                input.placeholder = placeholders[currentIndex];
                
                // Fade in smoothly
                input.classList.remove('placeholder-fade');
            }, 400);
        }, 3500);
    }
    
    /**
     * Handle the landing page form submission
     * Takes the entered handle and loads their spectrum directly
     */
    async handleLandingSubmit() {
        const handleInput = document.getElementById('landing-handle');
        let handle = handleInput?.value?.trim()?.replace('@', '');
        
        if (!handle) {
            // Shake the input to indicate error
            handleInput?.classList.add('shake');
            setTimeout(() => handleInput?.classList.remove('shake'), 500);
            return;
        }
        
        // If no domain provided, assume bsky.social
        if (!handle.includes('.')) {
            handle = `${handle}.bsky.social`;
        }
        
        // Set the handle and update URL
        this.handle = handle;
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('handle', handle);
        window.history.replaceState({}, '', newUrl.toString());
        
        // Load spectrum data and go straight to canvas
        try {
            await this.loadSpectrumData();
            await this.showSpectrumCard();
        } catch (error) {
            console.error('Failed to load spectrum:', error);
            this.showError(error.message || 'Failed to load spectrum data');
        }
    }
    
    showWelcomeCard() {
        const carousel = document.getElementById('origin-carousel');
        if (!carousel) return;
        
        // Calculate octant for user box color
        const octantName = this.calculateOctant();
        const octantColors = {
            'adaptive': 'rgb(100, 255, 200)',
            'chaotic': 'rgb(100, 200, 255)',
            'intended': 'rgb(255, 100, 150)',
            'prepared': 'rgb(255, 180, 100)',
            'contented': 'rgb(255, 150, 255)',
            'assertive': 'rgb(150, 150, 255)',
            'ordered': 'rgb(255, 255, 100)',
            'guarded': 'rgb(169, 85, 214)',
            'equilibrium': 'rgb(200, 200, 200)'
        };
        const octantColor = octantColors[octantName] || octantColors['equilibrium'];
        const borderColor = octantColor.replace(')', ', 0.5)').replace('rgb', 'rgba');
        
        carousel.innerHTML = `
            <div class="carousel-card welcome-card active">
                <div class="welcome-top">
                    <div class="welcome-text" style="font-size: 0.8em;">welcome to</div>
                </div>
                <div class="welcome-middle">
                    <img src="/assets/logo.png" alt="Reverie House" class="welcome-logo">
                    <div class="welcome-tagline">
                        home for all dreamers in<br>
                        our wild mindscape
                    </div>
                </div>
                
                <div class="spectrum-origins-box">
                    <div class="spectrum-origins-title">Spectrum Origins</div>
                    <div class="spectrum-description">
                        Dreamweavers wield forces like oblivion and<br>
                        entropy to conjure powerful reveries and nightmares.<br>
                        <br>
                        These natural elements are in constant flux and<br>
                        contradiction with one another, but provide each of<br>
                        us an origin for where our dreaming may begin.
                    </div>
                </div>
                
                <div class="welcome-bottom-right">
                    <div class="user-info-box" style="border-color: ${borderColor};" onclick="window.originScene.showSpectrumCard()">
                        <img src="${this.avatarUrl || '/assets/icon_face.png'}" alt="${this.displayName}" class="user-avatar" style="border-color: ${borderColor};">
                        <div class="user-display-name">${this.truncateDisplayName(this.displayName || this.handle, 20)}</div>
                        <div class="user-handle">@${this.truncateDisplayName(this.handle, 20)}</div>
                    </div>
                    <button class="view-origin-btn" onclick="window.originScene.showSpectrumCard()">
                        View Origin →
                    </button>
                </div>
            </div>
        `;
    }
    
    async showSpectrumCard() {
        console.log('🎬 [Origin] showSpectrumCard() called');
        // Skip carousel card 2, go directly to final canvas display
        const carousel = document.getElementById('origin-carousel');
        if (!carousel) {
            console.error('❌ [Origin] Carousel not found!');
            return;
        }
        
        console.log('🎬 [Origin] Carousel found, fading out welcome card...');
        // Fade out welcome card
        const currentCard = carousel.querySelector('.carousel-card');
        if (currentCard) {
            currentCard.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        console.log('🎬 [Origin] Hiding carousel, showing canvas...');
        // Hide carousel, show canvas
        carousel.style.display = 'none';
        
        // Get fresh canvas reference and show it
        this.canvas = document.getElementById('origin-canvas');
        if (this.canvas) {
            console.log('🎬 [Origin] Canvas element found, setting display:block');
            this.canvas.style.display = 'block';
        } else {
            console.error('❌ [Origin] Canvas element not found!');
        }
        
        // Pre-load avatar image before starting animation
        if (!this.cachedAvatarImage) {
            this.cachedAvatarImage = await this.loadImage(this.avatarUrl || '/assets/logo.png');
        }
        
        // Start animation
        this.animating = true;
        this.animationStartTime = Date.now();
        
        console.log('🎬 [Origin] Starting animation loop...');
        // Start animation loop
        this.animateSpectrum();
        
        console.log('🎬 [Origin] Adding action buttons...');
        // Add action buttons
        this.addActionButtons();
        console.log('🎬 [Origin] showSpectrumCard() complete');
    }
    
    // Easing function for smooth animation
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    // Pendulum physics - natural dampened harmonic motion
    pendulumEase(t, phase = 0, settleSpeed = 1.0) {
        // Adjust time based on settle speed
        const adjustedT = Math.min(t * settleSpeed, 1);
        
        // Pendulum parameters
        const frequency = 3.5; // Number of swings
        const dampingRatio = 0.35; // Slightly higher damping for smoother end
        
        // Exponential decay (energy loss over time)
        const decay = Math.exp(-dampingRatio * adjustedT * 8);
        
        // Harmonic oscillation (sine wave)
        const oscillation = Math.sin((adjustedT * Math.PI * frequency + phase) * 2);
        
        // Combine: amplitude decreases exponentially like a real pendulum
        const pendulumMotion = oscillation * decay;
        
        // Progressive ease into final position - stronger damping as we approach the end
        let settleEase = 1;
        if (adjustedT > 0.85) {
            // More aggressive damping in the final 15%
            const finalPhase = (adjustedT - 0.85) / 0.15; // 0 to 1 in last 15%
            // Exponential damping curve for very smooth final approach
            settleEase = 1 - Math.pow(finalPhase, 2.5) * 0.85; // Reduce oscillation by up to 85%
        }
        
        // Return position: starts at 0, oscillates with decreasing amplitude, settles at 1
        return adjustedT + (pendulumMotion * settleEase) * (1 - adjustedT) * 0.7;
    }
    
    animateSpectrum() {
        if (!this.animating) return;
        
        const elapsed = Date.now() - this.animationStartTime;
        const progress = Math.min(elapsed / this.animationDuration, 1);
        
        // Define axis pairs - each with different settling speed and phase
        const axisPairs = [
            { left: 'oblivion', right: 'entropy', phase: 0, settleSpeed: 1.0 },
            { left: 'authority', right: 'liberty', phase: Math.PI / 3, settleSpeed: 1.0 },
            { left: 'skeptic', right: 'receptive', phase: Math.PI / 1.5, settleSpeed: 1.0 }
        ];
        
        // Debug logging for final phase
        if (progress > 0.85) {
            console.log(`🎬 [Pendulum] Progress: ${(progress * 100).toFixed(2)}%`);
        }
        
        let allSettled = true;
        const offsetThreshold = 0.01; // Consider settled when offset is below this
        
        // Animate each axis pair with coordinated push-pull
        axisPairs.forEach(pair => {
            const leftTarget = this.spectrum[pair.left];
            const rightTarget = this.spectrum[pair.right];
            const total = leftTarget + rightTarget;
            
            // Get pendulum motion for this axis
            const pendulumPosition = this.pendulumEase(progress, pair.phase, pair.settleSpeed);
            
            // Calculate the push-pull offset based on pendulum motion
            const pushPullOffset = (pendulumPosition - progress) * total * 0.6;
            
            // Check if this axis has settled
            if (Math.abs(pushPullOffset) < offsetThreshold) {
                this.animatedValues[pair.left] = leftTarget;
                this.animatedValues[pair.right] = rightTarget;
                
                if (progress > 0.85) {
                    console.log(`  ${pair.left}/${pair.right}: SETTLED (offset=${pushPullOffset.toFixed(3)})`);
                }
            } else {
                allSettled = false;
                
                // Apply push-pull: if offset is positive, left gets more, right gets less
                const leftValue = Math.max(0, leftTarget + pushPullOffset);
                const rightValue = Math.max(0, rightTarget - pushPullOffset);
                
                this.animatedValues[pair.left] = leftValue;
                this.animatedValues[pair.right] = rightValue;
                
                // Debug logging for final phase
                if (progress > 0.85) {
                    console.log(`  ${pair.left}/${pair.right}: offset=${pushPullOffset.toFixed(3)}, left=${leftValue.toFixed(2)} (target=${leftTarget}), right=${rightValue.toFixed(2)} (target=${rightTarget})`);
                }
            }
        });
        
        // Re-render with animated values
        this.render();
        
        // Continue animation until all axes are settled
        if (!allSettled) {
            requestAnimationFrame(() => this.animateSpectrum());
        } else {
            console.log('🎬 [Pendulum] All axes settled - animation complete!');
            this.animating = false;
            
            // Log final spectrum values
            console.log('🏁 [Origin] ===== ANIMATION COMPLETE =====');
            console.log('🏁 [Origin] Final spectrum values:', this.spectrum);
            const finalOctant = this.calculateOctant(this.spectrum);
            console.log(`🏁 [Origin] Final octant will be: ${finalOctant.toUpperCase()}`);
            console.log('🏁 [Origin] ===================================');
            
            // Final render with exact values
            this.render();
        }
    }
    
    async showFinalOrigin() {
        const carousel = document.getElementById('origin-carousel');
        if (!carousel) return;
        
        // Fade out spectrum card
        const currentCard = carousel.querySelector('.carousel-card');
        if (currentCard) {
            currentCard.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        // Hide carousel, show canvas
        carousel.style.display = 'none';
        this.canvas.style.display = 'block';
        
        // Render the octant display
        await this.render();
        
        // Add action buttons
        this.addActionButtons();
    }
    
    async loadSpectrumData() {
        try {
            console.log(`🔍 [Origin] Fetching/calculating spectrum for handle: ${this.handle}`);
            
            // Normalize handle (remove @ if present only)
            // Do NOT strip domain - require full handle
            let cleanHandle = this.handle.replace('@', '');
            
            // Validate that we have a full handle with domain
            if (!cleanHandle.includes('.')) {
                throw new Error('Invalid handle format. Please provide full handle with domain (e.g., user.bsky.social or custom.domain)');
            }
            
            // Use the same API endpoint as spectrum calculator - it auto-calculates if needed
            const response = await fetch(`/api/spectrum/calculate?handle=${encodeURIComponent(cleanHandle)}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📊 [Origin] API response:', data);
            
            // Check if we have valid spectrum data (don't check success field, check actual data)
            if (!data.spectrum || !data.spectrum.octant) {
                throw new Error(data.error || 'Invalid spectrum data received');
            }
            
            this.spectrum = data.spectrum;
            this.displayName = data.display_name || cleanHandle;
            this.avatarUrl = data.avatar;
            this.did = data.did;
            this.handle = data.handle || cleanHandle; // Use the full handle from response
            
            console.log('✅ [Origin] Loaded spectrum data:', this.spectrum);
            
            // Check if spectrum image exists, generate if not
            await this.ensureSpectrumImage();
        } catch (error) {
            console.error('❌ [Origin] Failed to load spectrum data:', error);
            throw error; // Re-throw for init() to handle
        }
    }
    
    async ensureSpectrumImage() {
        /**
         * Ensure the spectrum image exists for OG previews
         * If it doesn't exist, generate and upload it
         */
        try {
            const safe_handle = this.handle.replace('/', '').replace('\\', '').replace('..', '');
            const imageUrl = `https://reverie.house/spectrum/${safe_handle}.png`;
            
            // Check if image already exists by trying to fetch it
            const checkResponse = await fetch(imageUrl, { method: 'HEAD' });
            
            if (checkResponse.ok) {
                console.log('✅ [Origin] Spectrum image already exists:', imageUrl);
                return;
            }
            
            console.log('🎨 [Origin] Image does not exist, generating...');
            
            // Dynamically import spectrum utilities
            const utilsModule = await import('/js/utils/spectrum-utils.js');
            const { configurePixelPerfectCanvas, loadImage: loadImageUtil } = utilsModule;
            
            // Generate the image canvas
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            configurePixelPerfectCanvas(ctx);
            
            // Load background
            try {
                const bgImage = await loadImageUtil('/assets/originBG.png');
                ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
            } catch (e) {
                // Fallback gradient
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#0a0806');
                gradient.addColorStop(1, '#1a1410');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            // Add particles (simplified version)
            const particleCount = 100;
            for (let i = 0; i < particleCount; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 3 + 1;
                const opacity = Math.random() * 0.6 + 0.2;
                
                ctx.fillStyle = `rgba(212, 175, 55, ${opacity})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Convert to blob and upload
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            
            const formData = new FormData();
            formData.append('image', blob, `${this.handle}.png`);
            formData.append('handle', this.handle);
            
            console.log('📤 [Origin] Uploading generated image...');
            const uploadResponse = await fetch('/api/spectrum/save-image', {
                method: 'POST',
                body: formData
            });
            
            if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                console.log('✅ [Origin] Image uploaded successfully:', result.url);
            } else {
                console.warn('⚠️  [Origin] Image upload failed');
            }
            
        } catch (error) {
            console.warn('⚠️  [Origin] Could not generate/upload image:', error);
            // Don't throw - this is not critical to page display
        }
    }
    
    showCalculatingMessage() {
        // Clear canvas and show calculating message
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Create a calculating message overlay
        const container = document.getElementById('origin-display-container');
        container.innerHTML = `
            <div style="
                background: rgba(26, 20, 16, 0.95);
                border: 2px solid #734ba1;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            ">
                <h2 style="color: #d4af37; margin-bottom: 1rem; font-size: 1.5rem;">
                    Calculating Spectrum...
                </h2>
                <p style="color: #e8d5c4; margin-bottom: 1.5rem; line-height: 1.6;">
                    Analyzing posts for <strong>@${this.handle}</strong>
                </p>
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #734ba1;
                    border-top-color: #d4af37;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                "></div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }
    
    showError(message) {
        const container = document.getElementById('origin-display-container');
        container.innerHTML = `
            <div style="
                background: rgba(26, 20, 16, 0.95);
                border: 2px solid #a13434;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            ">
                <h2 style="color: #ff6b6b; margin-bottom: 1rem; font-size: 1.5rem;">
                    Unable to Load Spectrum
                </h2>
                <p style="color: #e8d5c4; margin-bottom: 1.5rem; line-height: 1.6;">
                    ${message}
                </p>
                <p style="color: #c9b8a8; font-size: 0.9rem;">
                    Handle: <strong>@${this.handle}</strong>
                </p>
            </div>
        `;
    }
    
    render() {
        // Get existing elements
        const container = document.getElementById('origin-display-container');
        
        // Don't reset container - just get the canvas
        this.canvas = document.getElementById('origin-canvas');
        if (!this.canvas) {
            console.error('🟣 [Origin] Canvas not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Calculate responsive scale factor
        const viewportWidth = window.innerWidth;
        let scaleFactor = 1.0;
        
        // Base dimensions at full scale
        const baseWidth = 634;
        const baseHeight = 454;
        
        if (viewportWidth <= 674) {
            // Calculate how much width we have available (minus margins)
            const availableWidth = viewportWidth - 40; // 20px margin on each side
            // Scale to fit available width
            scaleFactor = availableWidth / baseWidth;
            // Clamp to reasonable bounds
            scaleFactor = Math.max(0.5, Math.min(1.0, scaleFactor));
            console.log(`📏 [Origin] Viewport: ${viewportWidth}px, Available: ${availableWidth}px, Scale: ${scaleFactor.toFixed(3)}`);
        }
        
        // Set canvas to scaled dimensions
        this.canvas.width = baseWidth;
        this.canvas.height = baseHeight;
        
        console.log(`📏 [Origin] Canvas base size: ${this.canvas.width}x${this.canvas.height}`);
        console.log(`📏 [Origin] Scale transform: ${scaleFactor.toFixed(3)}`);
        
        // Apply CSS transform to scale the canvas itself
        this.canvas.style.width = `${Math.floor(baseWidth * scaleFactor)}px`;
        this.canvas.style.height = `${Math.floor(baseHeight * scaleFactor)}px`;
        
        // Enable smooth image rendering for better avatar quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Use animated values during animation, otherwise use final spectrum
        const currentValues = this.animating ? this.animatedValues : this.spectrum;
        
        // Calculate octant based on current values (will fluctuate during animation)
        const octantName = this.calculateOctant(currentValues);
        
        // Get octant colors
        const octantColors = {
            'adaptive': { base: 'rgb(100, 255, 200)', dark: 'rgb(45, 140, 100)' },
            'chaotic': { base: 'rgb(100, 200, 255)', dark: 'rgb(45, 110, 150)' },
            'intended': { base: 'rgb(255, 100, 150)', dark: 'rgb(160, 50, 90)' },
            'prepared': { base: 'rgb(255, 180, 100)', dark: 'rgb(150, 100, 50)' },
            'contented': { base: 'rgb(255, 150, 255)', dark: 'rgb(141, 87, 141)' },
            'assertive': { base: 'rgb(150, 150, 255)', dark: 'rgb(80, 80, 150)' },
            'ordered': { base: 'rgb(255, 255, 100)', dark: 'rgb(140, 140, 50)' },
            'guarded': { base: 'rgb(169, 85, 214)', dark: 'rgb(100, 50, 130)' },
            'equilibrium': { base: 'rgb(200, 200, 200)', dark: 'rgb(100, 100, 100)' },
            'confused': { base: 'rgb(180, 180, 200)', dark: 'rgb(90, 90, 110)' },
            'singling': { base: 'rgb(200, 180, 180)', dark: 'rgb(110, 90, 90)' }
        };
        
        const targetColor = octantColors[octantName] || octantColors['equilibrium'];
        
        // Smooth color transition
        if (!this.currentOctantColor) {
            this.currentOctantColor = targetColor;
        }
        
        // Check if we need to transition to a new color
        if (this.targetOctantColor && this.targetOctantColor.base !== targetColor.base) {
            // Reset transition for new target
            this.targetOctantColor = targetColor;
            this.colorTransitionProgress = 0;
        } else if (!this.targetOctantColor || this.targetOctantColor.base !== targetColor.base) {
            this.targetOctantColor = targetColor;
            this.colorTransitionProgress = 0;
        }
        
        // Declare octantColor here so it's accessible throughout the function
        let octantColor;
        
        // Animate color transition
        if (this.colorTransitionProgress < 1) {
            this.colorTransitionProgress = Math.min(this.colorTransitionProgress + 0.08, 1);
            
            // Interpolate between current and target colors
            octantColor = this.interpolateColors(this.currentOctantColor, this.targetOctantColor, this.colorTransitionProgress);
            
            if (this.colorTransitionProgress >= 1) {
                this.currentOctantColor = this.targetOctantColor;
            }
            
            // Continue rendering if we're still transitioning
            if (this.colorTransitionProgress < 1 && !this.animating) {
                requestAnimationFrame(() => this.render());
            }
        } else {
            // Use target color directly
            octantColor = this.currentOctantColor;
        }
        
        // Box dimensions (full canvas)
        const boxWidth = canvas.width;
        const boxHeight = canvas.height;
        const boxX = 0;
        const boxY = 0;
        
        // Background box - no drop shadow
        ctx.fillStyle = 'rgba(26, 20, 16, 0.85)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        // Border with octant color
        ctx.strokeStyle = octantColor.base.replace(')', ', 0.6)').replace('rgb', 'rgba');
        ctx.lineWidth = 3;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        // Use cached avatar image
        const avatarImage = this.cachedAvatarImage;
        
        // Profile section (scaled 20% smaller than original: 0.9 * 0.8 = 0.72, then 5% smaller)
        let profileY = boxY + 16;  // 20 * 0.8
        const avatarSize = 83;     // 87 * 0.95
        const avatarX = boxX + 20; // 25 * 0.8
        const avatarY = profileY - 3;
        
        if (avatarImage) {
            ctx.save();
            
            // Create a temporary off-screen canvas for better quality rendering
            const tempCanvas = document.createElement('canvas');
            const tempSize = avatarSize * 2; // Render at 2x resolution
            tempCanvas.width = tempSize;
            tempCanvas.height = tempSize;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Enable high-quality smoothing on temp canvas
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            
            // Draw to temp canvas at higher resolution
            tempCtx.beginPath();
            tempCtx.arc(tempSize / 2, tempSize / 2, tempSize / 2, 0, Math.PI * 2);
            tempCtx.closePath();
            tempCtx.clip();
            tempCtx.drawImage(avatarImage, 0, 0, tempSize, tempSize);
            
            // Now draw the temp canvas to main canvas (downscaling for smoothness)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(tempCanvas, avatarX, avatarY, avatarSize, avatarSize);
            
            ctx.restore();
            
            // Avatar border - no drop shadow
            ctx.strokeStyle = octantColor.base.replace(')', ', 0.8)').replace('rgb', 'rgba');
            ctx.lineWidth = 3;  // 4 * 0.8 = 3.2 rounded to 3
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Text next to avatar (scaled 20% smaller)
        const profileTextX = avatarX + avatarSize + 20;  // 25 * 0.8
        let textY = avatarY;
        
        // Calculate available width for text (avoid description box)
        const descBoxLeft = boxX + boxWidth - 250 - 15; // Description box position
        const maxNameplateWidth = 450; // Max width for nameplate area
        const availableWidth = Math.min(maxNameplateWidth, descBoxLeft - profileTextX - 10); // Reduced margin from 20 to 10
        
        // Display name with ellipsis if too long
        ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';  // 35 * 0.8
        ctx.textAlign = 'left';
        const displayNameText = this.truncateText(ctx, this.displayName, availableWidth);
        ctx.fillText(displayNameText, profileTextX, textY + 23);  // 29 * 0.8
        
        // Handle with ellipsis if too long
        textY += 38;  // 48 * 0.8
        ctx.fillStyle = 'rgba(201, 184, 168, 0.75)';
        ctx.font = '22px system-ui, -apple-system, sans-serif';  // 28 * 0.8
        const handleText = this.truncateText(ctx, `@${this.handle}`, availableWidth);
        ctx.fillText(handleText, profileTextX, textY + 14);  // 17 * 0.8
        
        // Coordinate string - simple single line format
        textY += 28;  // 35 * 0.8
        const coordinateText = this.getCoordinateString();
        ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
        ctx.font = 'bold 16px "Courier New", monospace';  // 20 * 0.8
        ctx.fillText(coordinateText, profileTextX, textY + 11);  // 14 * 0.8
        
        // Octant name below avatar (dropped 5px)
        profileY = avatarY + avatarSize + 37;  // 40 * 0.8 + 5
        ctx.fillStyle = octantColor.base;
        ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';  // 40 * 0.8
        ctx.textAlign = 'left';
        
        console.log(`🎨 [Origin] Drawing octant name: ${octantName.toUpperCase()}`);
        console.log(`🎨 [Origin] Octant color: ${octantColor.base}`);
        
        ctx.fillText(octantName.toUpperCase(), boxX + 34, profileY);  // 43 * 0.8
        
        // Octant description - use proper description from spectrum-utils (dropped 2px)
        profileY += 32;  // 37 * 0.8 + 2
        const octantInfo = this.getOctantInfo(octantName);
        
        console.log(`🎨 [Origin] Octant description: "${octantInfo.desc}"`);
        console.log(`🎨 [Origin] Octant full text: "${octantInfo.full}"`);
        
        ctx.fillStyle = octantColor.base;
        ctx.font = 'italic 18px Georgia, serif';  // 23 * 0.8
        ctx.fillText(octantInfo.desc, boxX + 34, profileY);  // 43 * 0.8
        
        // Divider
        profileY += 20;  // 25 * 0.8
        ctx.strokeStyle = octantColor.base;
        ctx.beginPath();
        ctx.moveTo(boxX + 40, profileY);  // 50 * 0.8
        ctx.lineTo(boxX + boxWidth - 40, profileY);
        ctx.stroke();
        
        // Description box in upper right corner (20% larger)
        const descBoxWidth = 250;
        const descBoxHeight = 132; // 110 * 1.2
        const descBoxX = boxX + boxWidth - descBoxWidth - 15;
        const descBoxY = boxY + 15;
        
        // Semi-transparent background (darker for better readability)
        ctx.fillStyle = 'rgba(16, 12, 10, 0.85)';
        ctx.fillRect(descBoxX, descBoxY, descBoxWidth, descBoxHeight);
        
        // Border with octant color
        ctx.strokeStyle = octantColor.base.replace(')', ', 0.5)').replace('rgb', 'rgba');
        ctx.lineWidth = 1.5;
        ctx.strokeRect(descBoxX, descBoxY, descBoxWidth, descBoxHeight);
        
        // Full description text (sans-serif, centered, better readability)
        const fullOctantInfo = this.getOctantInfo(octantName);
        
        // List of axis words to bold
        const axisWords = ['Entropy', 'Oblivion', 'Authority', 'Liberty', 'Skeptic', 'Receptive', 'Equilibrium', 'Confused', 'Singling'];
        
        // Regular and bold fonts
        const regularFont = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        const boldFont = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = regularFont;
        ctx.textAlign = 'center';
        
        // Wrap text manually (centered) with bold axis names
        const maxWidth = descBoxWidth - 24;
        const lineHeight = 17;
        const words = fullOctantInfo.full.split(' ');
        let line = '';
        let lineSegments = []; // Array of {text, bold} objects
        let currentLine = [];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const isBold = axisWords.includes(word.replace(/[.,!?;:]/, ''));
            const testLine = line + word + ' ';
            
            // Temporarily set font to measure
            ctx.font = isBold ? boldFont : regularFont;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                // Push current line and start new one
                lineSegments.push(currentLine);
                currentLine = [{text: word + ' ', bold: isBold}];
                line = word + ' ';
            } else {
                currentLine.push({text: word + ' ', bold: isBold});
                line = testLine;
            }
        }
        if (currentLine.length > 0) {
            lineSegments.push(currentLine);
        }
        
        // Draw centered lines with bold axis names
        const startY = descBoxY + 24;
        lineSegments.forEach((segments, lineIndex) => {
            const y = startY + (lineIndex * lineHeight);
            
            // Calculate total line width for centering
            let totalWidth = 0;
            segments.forEach(seg => {
                ctx.font = seg.bold ? boldFont : regularFont;
                totalWidth += ctx.measureText(seg.text).width;
            });
            
            // Start x position (centered)
            let x = descBoxX + (descBoxWidth - totalWidth) / 2;
            
            // Draw each segment
            segments.forEach(seg => {
                ctx.font = seg.bold ? boldFont : regularFont;
                ctx.textAlign = 'left';
                ctx.fillText(seg.text, x, y);
                x += ctx.measureText(seg.text).width;
            });
        });
        
        // Reset font
        ctx.font = regularFont;
        
        // Draw spectrum bars
        this.drawSpectrumBars(profileY + 52, boxX, boxWidth, octantColor);
    }
    
    drawSpectrumBars(startY, boxX, boxWidth, octantColor) {
        const ctx = this.ctx;
        const barWidth = boxWidth - 79;  // 99 * 0.8
        const barHeight = 58;  // 73 * 0.8
        const barSpacing = 26;  // 32 * 0.8
        
        const axisColors = {
            oblivion: 'rgb(150, 120, 180)',
            entropy: 'rgb(255, 120, 80)',
            authority: 'rgb(200, 60, 60)',
            liberty: 'rgb(80, 180, 255)',
            skeptic: 'rgb(255, 200, 80)',
            receptive: 'rgb(120, 220, 160)'
        };
        
        // Use animated values if animating, otherwise use actual spectrum values
        const values = this.animating ? this.animatedValues : this.spectrum;
        
        const axisPairs = [
            {
                left: { name: 'Oblivion', value: Math.round(values.oblivion), color: axisColors.oblivion },
                right: { name: 'Entropy', value: Math.round(values.entropy), color: axisColors.entropy }
            },
            {
                left: { name: 'Authority', value: Math.round(values.authority), color: axisColors.authority },
                right: { name: 'Liberty', value: Math.round(values.liberty), color: axisColors.liberty }
            },
            {
                left: { name: 'Skeptic', value: Math.round(values.skeptic), color: axisColors.skeptic },
                right: { name: 'Receptive', value: Math.round(values.receptive), color: axisColors.receptive }
            }
        ];
        
        axisPairs.forEach((pair, i) => {
            const y = startY + i * (barHeight + barSpacing);
            const barStartX = boxX + 40;  // 50 * 0.8
            
            const total = pair.left.value + pair.right.value;
            // Prevent division by zero - default to 0.5 if total is 0
            const leftRatio = total > 0 ? Math.max(0, Math.min(1, pair.left.value / total)) : 0.5;
            const midlineX = barStartX + (barWidth * leftRatio);
            
            // Background track
            ctx.fillStyle = 'rgba(50, 40, 45, 0.6)';
            ctx.fillRect(barStartX, y, barWidth, 30);  // 37 * 0.8
            
            // Gradient bar
            const barGradient = ctx.createLinearGradient(barStartX, 0, barStartX + barWidth, 0);
            barGradient.addColorStop(0, pair.left.color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
            barGradient.addColorStop(leftRatio, pair.left.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
            barGradient.addColorStop(leftRatio, pair.right.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
            barGradient.addColorStop(1, pair.right.color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
            ctx.fillStyle = barGradient;
            ctx.fillRect(barStartX, y, barWidth, 30);  // 37 * 0.8
            
            // Midline marker
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(midlineX - 2, y - 6, 5, 43);  // Scaled by 0.8: 3->2, 8->6, 6->5, 54->43
            
            // Determine which axis is dominant (higher value)
            const leftIsDominant = pair.left.value > pair.right.value;
            
            // Axis titles with transparency on non-dominant axis
            ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';  // 20 * 0.8
            ctx.textAlign = 'left';
            ctx.fillStyle = leftIsDominant 
                ? pair.left.color.replace(')', ', 0.9)').replace('rgb', 'rgba')
                : pair.left.color.replace(')', ', 0.5)').replace('rgb', 'rgba');
            ctx.fillText(pair.left.name.toUpperCase(), barStartX, y - 10);  // 13 * 0.8
            ctx.textAlign = 'right';
            ctx.fillStyle = leftIsDominant 
                ? pair.right.color.replace(')', ', 0.5)').replace('rgb', 'rgba')
                : pair.right.color.replace(')', ', 0.9)').replace('rgb', 'rgba');
            ctx.fillText(pair.right.name.toUpperCase(), barStartX + barWidth, y - 10);
            
            // Values inside bars with drop shadow for better visibility
            ctx.font = 'bold 23px "Courier New", monospace';  // 29 * 0.8
            
            // Add text shadow for better readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.textAlign = 'left';
            ctx.fillText(pair.left.value, barStartX + 11, y + 22);  // 14->11, 27->22
            ctx.textAlign = 'right';
            ctx.fillText(pair.right.value, barStartX + barWidth - 11, y + 22);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        });
    }
    
    calculateOctant(values = null) {
        // Use provided values or fall back to this.spectrum
        const s = values || this.spectrum;
        
        console.log('🎯 [Origin] calculateOctant called with values:', s);
        
        // Calculate xyz coordinates
        const x = (s.entropy || 0) - (s.oblivion || 0);
        const y = (s.liberty || 0) - (s.authority || 0);
        const z = (s.receptive || 0) - (s.skeptic || 0);
        
        console.log(`🎯 [Origin] Axis differences: x=${x}, y=${y}, z=${z}`);
        
        // Count balanced axes (difference of 0)
        const balancedCount = (x === 0 ? 1 : 0) + (y === 0 ? 1 : 0) + (z === 0 ? 1 : 0);
        
        console.log(`🎯 [Origin] Balanced axes count: ${balancedCount}`);
        
        // Handle special cases
        if (balancedCount === 3) {
            console.log('🎯 [Origin] → EQUILIBRIUM (all 3 axes balanced)');
            return 'equilibrium';
        }
        if (balancedCount === 2) {
            console.log('🎯 [Origin] → SINGLING (2 axes balanced)');
            return 'singling';
        }
        if (balancedCount === 1) {
            console.log('🎯 [Origin] → CONFUSED (1 axis balanced)');
            return 'confused';
        }
        
        // Normal octant - determine signs
        const xSign = x >= 0 ? '+' : '-';
        const ySign = y >= 0 ? '+' : '-';
        const zSign = z >= 0 ? '+' : '-';
        
        const code = xSign + ySign + zSign;
        console.log(`🎯 [Origin] Sign code: ${code}`);
        
        // Map to octant names
        const octantMap = {
            '+++': 'adaptive',
            '++-': 'chaotic',
            '+-+': 'prepared',
            '+--': 'intended',
            '-++': 'contented',
            '-+-': 'assertive',
            '--+': 'ordered',
            '---': 'guarded'
        };
        
        const octantName = octantMap[code] || 'equilibrium';
        console.log(`🎯 [Origin] → Final octant: ${octantName.toUpperCase()}`);
        
        return octantName;
    }
    
    getCoordinateString() {
        // Use animated values if animating, otherwise use final spectrum
        const s = this.animating ? this.animatedValues : this.spectrum;
        
        // Format helper: pad zeros to 2 digits (00 format)
        const fmt = (val) => {
            const rounded = Math.round(val);
            return rounded === 0 ? '00' : String(rounded);
        };
        
        return `O${fmt(s.oblivion)} A${fmt(s.authority)} S${fmt(s.skeptic)} E${fmt(s.entropy)} L${fmt(s.liberty)} R${fmt(s.receptive)}`;
    }
    
    truncateDisplayName(text, maxLength) {
        // Simple character-based truncation for HTML display
        if (!text || text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }
    
    truncateText(ctx, text, maxWidth) {
        // Measure text width
        const metrics = ctx.measureText(text);
        
        // If it fits, return as-is
        if (metrics.width <= maxWidth) {
            return text;
        }
        
        // Otherwise, truncate with ellipsis
        const ellipsis = '...';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        
        // Binary search for the right length
        let left = 0;
        let right = text.length;
        let result = text;
        
        while (left < right) {
            const mid = Math.floor((left + right + 1) / 2);
            const truncated = text.substring(0, mid) + ellipsis;
            const width = ctx.measureText(truncated).width;
            
            if (width <= maxWidth) {
                result = truncated;
                left = mid;
            } else {
                right = mid - 1;
            }
        }
        
        return result;
    }
    
    getOctantInfo(octantName) {
        const octantData = {
            'adaptive': { 
                desc: 'embracing change prolongs freedom',
                full: 'Adaptive dreamweavers are able to enjoy Entropy by leaning on their sense of Liberty, and a flexibly Receptive heart. They are good at rolling with the punches, and great explorers of others\' dreams.'
            },
            'chaotic': { 
                desc: 'increasing possibility unlocks momentum',
                full: 'Chaotic dreamweavers are able to leverage Entropy by channeling their sense of Liberty, and retaining cunning Skeptic doubt. They are always causing things to happen, and making others\' dreams more interesting.'
            },
            'prepared': { 
                desc: 'contemplative foresight averts disaster',
                full: 'Prepared dreamweavers are able to endure Entropy through the rigorous control of Authority, and a Receptive approach of problems. They are always ready for anything, and saving others\' reckless dreams.'
            },
            'intended': { 
                desc: 'independent action delivers results',
                full: 'Intended dreamweavers are able to wield Entropy without sacrificing the control of Authority, or the clarity of Skeptic views. They are incredibly driven, and very capable of navigating others\' dreams.'
            },
            'equilibrium': { 
                desc: 'centered only to self',
                full: 'Dreamweavers who have achieved true Equilibrium know the application and temperance of perfect balance. They are free from burdens, and can offer great assistance to many, if they can ever escape themselves.'
            },
            'confused': { 
                desc: 'split decision clouds judgment',
                full: 'Confused dreamers find themselves split evenly along a critical axis. Unable or unwilling to concede either side, they make troubled dreamweavers who often conjure their own peril.'
            },
            'singling': { 
                desc: 'narrow dogma tightens vision',
                full: 'Singling dreamweavers have made peace with all of the dreaming spectrum, save for one force. They often remain obsessive towards this pull until either equilibrium is found, or their doom.'
            },
            'contented': { 
                desc: 'relentless acceptance begets peace',
                full: 'Contented dreamweavers are able to enjoy Oblivion without losing their sense of Liberty, or their willingness to be Receptive. They are comfortably open, and relax others\' dreams with ease.'
            },
            'assertive': { 
                desc: 'outbound query solves doubt',
                full: 'Assertive dreamweavers are able to wield Oblivion while leveraging their sense of Liberty, and their cutting Skeptic view. They are dangerously sharp, and excellent at untangling others\' wayward dreams.'
            },
            'ordered': { 
                desc: 'disciplined governence builds structure',
                full: 'Ordered dreamweavers are able to leverage Oblivion by relying on a control of Authority, and a willing Receptive spirit. They are reliable organizers, and superb at providing structure to others\' dreams.'
            },
            'guarded': { 
                desc: 'protective rejection averts malinfluence',
                full: 'Guarded dreamweavers are able to endure Oblivion through the tight control of Authority, and a cunning Skeptic mindset. They are terrific at maintaining dreams, and protecting others\' idle dreams.'
            }
        };
        
        return octantData[octantName] || octantData['equilibrium'];
    }
    
    interpolateColors(colorA, colorB, progress) {
        // Parse RGB values from color strings
        const parseRGB = (colorStr) => {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [200, 200, 200];
        };
        
        const rgbA = parseRGB(colorA.base);
        const rgbB = parseRGB(colorB.base);
        const darkA = parseRGB(colorA.dark);
        const darkB = parseRGB(colorB.dark);
        
        // Ease the progress for smoother transition
        const eased = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // Interpolate RGB values
        const interpolatedBase = [
            Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * eased),
            Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * eased),
            Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * eased)
        ];
        
        const interpolatedDark = [
            Math.round(darkA[0] + (darkB[0] - darkA[0]) * eased),
            Math.round(darkA[1] + (darkB[1] - darkA[1]) * eased),
            Math.round(darkA[2] + (darkB[2] - darkA[2]) * eased)
        ];
        
        return {
            base: `rgb(${interpolatedBase[0]}, ${interpolatedBase[1]}, ${interpolatedBase[2]})`,
            dark: `rgb(${interpolatedDark[0]}, ${interpolatedDark[1]}, ${interpolatedDark[2]})`
        };
    }
    
    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn('Failed to load image:', url);
                resolve(null);
            };
            // Use avatar proxy for external images
            if (url && url.includes('cdn.bsky.app')) {
                img.src = `/api/avatar-proxy?url=${encodeURIComponent(url)}`;
            } else {
                img.src = url;
            }
        });
    }
    
    initBubbles() {
        // Initialize magic dust particles (homepage-style ambient particles)
        console.log('🫧 [Origin] Initializing ambient particles');
        this.initMagicDust();
    }
    
    initMagicDust() {
        // Create simple ambient wind particles (homepage-style)
        const dustContainer = document.querySelector('.magic-dust-container');
        if (!dustContainer) {
            console.warn('🌟 [Origin] Magic dust container not found');
            return;
        }
        
        console.log('✨ [Origin] Initializing ambient wind particles');
        
        // Create ambient particles that drift across screen
        setInterval(() => {
            if (!this.isActive) return;
            
            const particle = document.createElement('div');
            particle.className = 'wind-particle';
            if (Math.random() < 0.3) particle.classList.add('small');
            
            // Random entry from one of four sides
            const side = Math.floor(Math.random() * 4);
            let startX, startY, velocityX, velocityY;
            
            switch(side) {
                case 0: // Left
                    startX = -20;
                    startY = Math.random() * 100;
                    velocityX = 0.5 + Math.random() * 0.5;
                    velocityY = (Math.random() - 0.5) * 0.3;
                    break;
                case 1: // Right
                    startX = window.innerWidth + 20;
                    startY = Math.random() * 100;
                    velocityX = -(0.5 + Math.random() * 0.5);
                    velocityY = (Math.random() - 0.5) * 0.3;
                    break;
                case 2: // Top
                    startX = Math.random() * 100;
                    startY = -20;
                    velocityX = (Math.random() - 0.5) * 0.3;
                    velocityY = 0.5 + Math.random() * 0.5;
                    break;
                case 3: // Bottom
                    startX = Math.random() * 100;
                    startY = window.innerHeight + 20;
                    velocityX = (Math.random() - 0.5) * 0.3;
                    velocityY = -(0.5 + Math.random() * 0.5);
                    break;
            }
            
            particle.style.cssText = `
                position: absolute;
                left: ${startX}px;
                top: ${startY}%;
                width: ${Math.random() < 0.3 ? '2px' : '3px'};
                height: ${Math.random() < 0.3 ? '2px' : '3px'};
                background: rgba(232, 213, 196, ${0.2 + Math.random() * 0.3});
                border-radius: 50%;
                pointer-events: none;
                --vx: ${velocityX};
                --vy: ${velocityY};
            `;
            
            dustContainer.appendChild(particle);
            
            // Animate particle
            const duration = 10000 + Math.random() * 10000;
            const animation = particle.animate([
                { transform: 'translate(0, 0)', opacity: 0 },
                { transform: 'translate(0, 0)', opacity: 0.6, offset: 0.1 },
                { transform: `translate(calc(var(--vx) * ${duration}px), calc(var(--vy) * ${duration}px))`, opacity: 0.4, offset: 0.9 },
                { transform: `translate(calc(var(--vx) * ${duration}px), calc(var(--vy) * ${duration}px))`, opacity: 0 }
            ], {
                duration: duration,
                easing: 'linear'
            });
            
            animation.onfinish = () => particle.remove();
            
        }, 2000); // Create new particle every 2 seconds
        
        // Add CSS for wind particles if not present
        if (!document.querySelector('#wind-particle-styles')) {
            const style = document.createElement('style');
            style.id = 'wind-particle-styles';
            style.textContent = `
                .magic-dust-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 5;
                    overflow: hidden;
                }
                .wind-particles-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 6;
                    overflow: hidden;
                }
                .wind-particle {
                    will-change: transform, opacity;
                }
                .wind-particle.small {
                    transform: scale(0.6);
                }
            `;
            document.head.appendChild(style);
        }
        
        this.isActive = true;
    }
    
    addActionButtons() {
        const actionsContainer = document.getElementById('origin-actions');
        if (!actionsContainer) return;
        
        actionsContainer.innerHTML = '';
        
        // Match actions container width to scaled canvas width
        if (this.canvas) {
            const canvasDisplayWidth = this.canvas.style.width;
            if (canvasDisplayWidth) {
                actionsContainer.style.maxWidth = canvasDisplayWidth;
                console.log(`🎯 [Origin] Set actions width to match canvas: ${canvasDisplayWidth}`);
            }
        }
        
        // Check if user is logged in - check both localStorage and OAuth manager
        let isLoggedIn = false;
        
        // First check OAuth manager if available
        if (window.oauthManager && typeof window.oauthManager.getSession === 'function') {
            const session = window.oauthManager.getSession();
            isLoggedIn = !!(session && session.handle);
            console.log('🔐 [Origin] OAuth session check:', isLoggedIn, session?.handle);
        } else {
            // Fallback to localStorage
            const currentUserHandle = localStorage.getItem('bsky_handle');
            isLoggedIn = !!currentUserHandle;
            console.log('🔐 [Origin] localStorage check:', isLoggedIn, currentUserHandle);
        }
        
        // Button 1: Read More - go to library
        this.addButton(actionsContainer, 'Read More', () => {
            window.location.href = '/library.html';
        }, false);
        
        // Button 2: Explore Dreamweavers - try to go to the origin handle's dreamer profile if they have one
        this.addButton(actionsContainer, 'Explore Dreamweavers', async () => {
            // Try to fetch all dreamers and find one matching this handle
            try {
                const response = await fetch('/api/dreamers');
                if (response.ok) {
                    const dreamers = await response.json();
                    const dreamer = dreamers.find(d => d.handle === this.handle);
                    if (dreamer && dreamer.did) {
                        // Found dreamer profile - navigate to it with handle query param
                        window.location.href = `/dreamer.html?handle=${encodeURIComponent(this.handle)}`;
                        return;
                    }
                }
            } catch (error) {
                console.warn('Could not find dreamer profile:', error);
            }
            
            // Fallback: go to spectrum calculator
            window.location.href = '/spectrum.html';
        }, false);
        
        // Button 3: Discover Yourself (if not logged in) or Share Story (if logged in)
        if (!isLoggedIn) {
            this.addButton(actionsContainer, 'Discover Yourself', () => {
                // Show login popup (same as drawer avatar click)
                if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                    window.loginWidget.showLoginPopup();
                } else {
                    console.error('Login widget not available');
                    window.location.href = '/spectrum.html';
                }
            }, false);
        } else {
            this.addButton(actionsContainer, 'Share Story', () => {
                // Show sharelore popup
                if (window.shareLoreWidget && typeof window.shareLoreWidget.show === 'function') {
                    window.shareLoreWidget.show();
                } else {
                    console.error('ShareLore widget not available');
                    // Fallback to story page
                    window.location.href = '/story.html';
                }
            }, false);
        }
    }
    
    addButton(container, text, onClick, isPrimary = false) {
        const button = document.createElement('button');
        button.className = `origin-action-btn${isPrimary ? ' primary' : ''}`;
        button.textContent = text;
        button.onclick = onClick;
        container.appendChild(button);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀🚀🚀 [Origin] ===== DOM CONTENT LOADED =====');
    console.log('🚀 [Origin] Document ready state:', document.readyState);
    console.log('🚀 [Origin] Body element:', document.body);
    console.log('🚀 [Origin] Body classes:', document.body.className);
    
    const canvas = document.getElementById('origin-canvas');
    const container = document.getElementById('origin-display-container');
    const fullscreen = document.querySelector('.fullscreen-background');
    const bubbles = document.querySelector('.floating-elements');
    
    console.log('🚀 [Origin] Canvas exists:', !!canvas);
    console.log('🚀 [Origin] Container exists:', !!container);
    console.log('🚀 [Origin] Fullscreen bg exists:', !!fullscreen);
    console.log('🚀 [Origin] Floating elements exists:', !!bubbles);
    
    if (container) {
        const styles = window.getComputedStyle(container);
        console.log('🚀 [Origin] Container z-index:', styles.zIndex);
        console.log('🚀 [Origin] Container position:', styles.position);
        console.log('🚀 [Origin] Container display:', styles.display);
    }
    
    if (bubbles) {
        const styles = window.getComputedStyle(bubbles);
        console.log('🚀 [Origin] Bubbles z-index:', styles.zIndex);
    }
    
    console.log('🚀 [Origin] Creating new OriginScene instance...');
    window.originScene = new OriginScene();
    console.log('🚀 [Origin] OriginScene instance created');
});
