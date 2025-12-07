/**
 * Spectrum Preview Widget
 * 
 * A tool for the Spectrum Mapper to preview octant calculations for any dreamer.
 * Shows when a user is the active Spectrum Mapper, displays disabled when no mapper is active.
 * 
 * Usage:
 * const preview = new SpectrumPreview(container, { isMapper: true });
 */

import { 
    OCTANT_DESCRIPTIONS, 
    AXIS_COLORS, 
    CANVAS_DIMENSIONS,
    getOctantInfo,
    configurePixelPerfectCanvas,
    loadImage as loadImageUtil,
    calculateAxisPercentage,
    drawSpectrumBar,
    formatCoordinates
} from '../utils/spectrum-utils.js';

import { 
    calculateFacets as calculateBlueskyFacets,
    createBlueskyComposeUrl,
    proxyImageUrl
} from '../utils/bluesky-utils.js';

class SpectrumPreview {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            isMapper: false, // Whether user is the active mapper
            parentModal: null, // Reference to parent modal (if opened in modal)
            ...options
        };
        
        this.octantDisplay = null;
        this.currentDid = null;
        this.currentDisplayName = null;
        this.currentHandle = null;
        this.isLoading = false;
        this.hasCalculated = false; // Track if calculation has been done
        
        // Curated list of Bluesky handles related to dreams, consciousness, metaphysics, philosophy, surrealism
        this.suggestionHandles = [
            'levarburton.bsky.social'
        ];
        
        // Secret message for console explorers
        if (this.options.isMapper && !window._spectrumPreviewMessageShown) {
            console.log('%cSpectrum Calculator Unlocked', 'color: #734ba1; font-size: 14px; font-weight: bold;');
            console.log('%cIt\'s okay that you did this.', 'color: #999; font-style: italic;');
            window._spectrumPreviewMessageShown = true;
        }
        
        this.loadStyles();
        this.loadDependencies();
        this.render();
    }
    
    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/spectrumpreview.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/spectrumpreview.css';
            document.head.appendChild(link);
        }
    }
    
    loadDependencies() {
        // Load OctantDisplay widget
        if (!document.querySelector('script[src*="js/widgets/octantdisplay.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/octantdisplay.js';
            document.head.appendChild(script);
        }
    }
    
    render() {
        const disabledClass = this.options.isMapper ? '' : 'disabled';
        const disabledAttr = this.options.isMapper ? '' : 'disabled';
        
        // Pick a random suggestion handle for placeholder
        const randomHandle = this.suggestionHandles[Math.floor(Math.random() * this.suggestionHandles.length)];
        
        this.container.innerHTML = `
            <div class="spectrum-preview-widget ${disabledClass}">
                <div class="spectrum-preview-header">
                    <div class="spectrum-preview-title">Spectrum Calculator</div>
                </div>
                
                <div class="spectrum-preview-helper-text">
                    Enter a dreamer's handle or id to deduce their spectrum origin.
                </div>
                
                <div class="spectrum-preview-body">
                    <div class="spectrum-preview-left">
                        <div class="spectrum-preview-input-group">
                            <input 
                                type="text" 
                                id="spectrum-handle-input"
                                class="spectrum-preview-input"
                                placeholder="@${randomHandle}"
                                ${disabledAttr}
                            >
                            <button 
                                id="spectrum-calculate-btn"
                                class="spectrum-preview-calculate-btn"
                                ${disabledAttr}
                            >
                                Calculate Origin
                            </button>
                        </div>
                    </div>
                    
                    <div class="spectrum-preview-right">
                        <div class="spectrum-preview-results" id="spectrum-preview-results">
                            <!-- Octant display will be initialized here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        if (this.options.isMapper) {
            this.attachEventListeners();
        }
        
        // Initialize empty octant display
        this.initializeEmptyOctant();
    }
    
    initializeEmptyOctant() {
        const resultsContainer = document.getElementById('spectrum-preview-results');
        if (!resultsContainer) return;
        
        // Wait for OctantDisplay to be available
        if (window.OctantDisplay) {
            this.octantDisplay = new window.OctantDisplay(resultsContainer, {
                did: null,
                showHeader: true,  // Show header like dashboard
                showFooter: false, // Hide footer (heading: None)
                pollingInterval: null
            });
            
            // Set empty/zeroed data with correct structure
            this.octantDisplay.updateDreamer({
                spectrum: {
                    oblivion: 0,
                    authority: 0,
                    skeptic: 0,
                    receptive: 0,
                    liberty: 0,
                    entropy: 0,
                    octant: 'equilibrium'
                },
                display_name: 'Unknown',
                handle: 'unknown'
            });
        } else {
            // Retry after delay
            setTimeout(() => this.initializeEmptyOctant(), 200);
        }
    }
    
    attachEventListeners() {
        const input = document.getElementById('spectrum-handle-input');
        const calculateBtn = document.getElementById('spectrum-calculate-btn');
        
        if (input && calculateBtn) {
            // Calculate/Invite on button click
            calculateBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // Prevent any default behavior
                
                console.log('🖱️ [Button] Clicked - State check:');
                console.log('  hasCalculated:', this.hasCalculated);
                console.log('  currentHandle:', this.currentHandle);
                console.log('  octantDisplay exists:', !!this.octantDisplay);
                console.log('  octantDisplay.dreamer exists:', !!(this.octantDisplay && this.octantDisplay.dreamer));
                
                // Check if we're in "invite" mode (after calculation)
                if (this.hasCalculated && this.currentHandle && this.octantDisplay && this.octantDisplay.dreamer) {
                    console.log('✅ [Button] Entering INVITE mode - composing origin post');
                    
                    // Close the parent modal if it exists (to let user see the post modal)
                    if (this.options.parentModal && typeof this.options.parentModal.close === 'function') {
                        console.log('🚪 [Button] Closing spectrum calculator modal');
                        this.options.parentModal.close();
                    }
                    
                    // Compose and post the origin declaration
                    await this.composeOriginPost(this.currentHandle);
                } else if (!this.isLoading) {
                    console.log('🔄 [Button] Entering CALCULATE mode - fetching spectrum');
                    console.log('  Reason: Missing required state for INVITE mode');
                    // Calculate spectrum
                    this.calculateSpectrum().then(handle => {
                        if (handle) {
                            this.hasCalculated = true;
                            calculateBtn.textContent = `Invite @${handle}`;
                            console.log('✅ [Button] Calculation complete, button now says "Invite @' + handle + '"');
                        }
                    });
                } else {
                    console.log('⏳ [Button] Already loading, ignoring click');
                }
            });
            
            // Reset button when input changes
            input.addEventListener('input', () => {
                if (this.hasCalculated) {
                    this.hasCalculated = false;
                    calculateBtn.textContent = 'Calculate Origin';
                }
            });
            
            // Calculate on Enter key
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !this.hasCalculated) {
                    this.calculateSpectrum().then(handle => {
                        if (handle) {
                            this.hasCalculated = true;
                            calculateBtn.textContent = `Invite @${handle}`;
                        }
                    });
                }
            });
        }
    }
    
    async calculateSpectrum() {
        if (this.isLoading) {
            console.log('⏳ [Calculate] Already loading, aborting');
            return null;
        }
        
        const input = document.getElementById('spectrum-handle-input');
        const resultsContainer = document.getElementById('spectrum-preview-results');
        const calculateBtn = document.getElementById('spectrum-calculate-btn');
        
        if (!input || !resultsContainer) {
            console.log('❌ [Calculate] Missing input or results container');
            return null;
        }
        
        let identifier = input.value.trim();
        console.log('📝 [Calculate] Input value:', identifier);
        
        if (!identifier) {
            this.showError('Please enter a handle or DID');
            return null;
        }
        
        // Normalize handle (remove @ if present)
        if (identifier.startsWith('@')) {
            identifier = identifier.substring(1);
        }
        
        console.log('🚀 [Calculate] Starting calculation for:', identifier);
        
        this.isLoading = true;
        calculateBtn.textContent = 'Processing...';
        calculateBtn.disabled = true;
        
        try {
            // Determine if it's a handle or DID
            const isHandle = !identifier.startsWith('did:');
            const queryParam = isHandle ? `handle=${encodeURIComponent(identifier)}` : `did=${encodeURIComponent(identifier)}`;
            
            // Single API call to calculate spectrum, store data, and generate image
            console.log('📡 [Calculate] Fetching spectrum data...');
            calculateBtn.textContent = 'Calculating spectrum...';
            
            const spectrumResponse = await fetch(`/api/spectrum/calculate?${queryParam}`);
            if (!spectrumResponse.ok) {
                const error = await spectrumResponse.json();
                throw new Error(error.error || 'Failed to calculate spectrum');
            }
            
            const spectrumData = await spectrumResponse.json();
            console.log('✅ [Calculate] Received spectrum data:', spectrumData);
            
            // Store current dreamer info including image URL
            this.currentDid = spectrumData.did;
            this.currentDisplayName = spectrumData.display_name || spectrumData.handle || 'Dreamer';
            this.currentHandle = spectrumData.handle;
            this.currentSpectrumImageUrl = spectrumData.spectrum_image_url; // Store for later use
            
            console.log('💾 [Calculate] Stored dreamer data');
            
            // Show results with OctantDisplay widget first
            this.displayResults(spectrumData);
            
            // Generate and upload the origin image immediately in the background
            calculateBtn.textContent = 'Generating image...';
            try {
                const imageResult = await this.generateAndUploadOriginImage(
                    spectrumData.handle,
                    spectrumData.display_name || spectrumData.handle,
                    spectrumData.spectrum.octant,
                    spectrumData.spectrum
                );
                
                if (imageResult.success) {
                    this.currentSpectrumImageUrl = imageResult.url;
                    console.log('✅ [Calculate] Image generated and uploaded:', imageResult.url);
                    calculateBtn.textContent = 'Ready ✓';
                } else {
                    console.warn('⚠️  [Calculate] Image generation failed, will generate on invite');
                    calculateBtn.textContent = 'Ready (no preview)';
                }
            } catch (error) {
                console.warn('⚠️  [Calculate] Image generation error:', error);
                calculateBtn.textContent = 'Ready (no preview)';
            }
            
            return spectrumData.handle || identifier;
            
        } catch (error) {
            console.error('Spectrum calculation error:', error);
            this.showError(error.message || 'Failed to calculate spectrum');
            return null;
        } finally {
            this.isLoading = false;
            calculateBtn.disabled = false;
        }
    }
    
    displayResults(data) {
        const resultsContainer = document.getElementById('spectrum-preview-results');
        if (!resultsContainer) return;
        
        // Update existing octant display if it exists
        if (this.octantDisplay) {
            this.octantDisplay.updateDreamer(data);
        } else {
            // Create new octant display
            if (window.OctantDisplay) {
                this.octantDisplay = new window.OctantDisplay(resultsContainer, {
                    did: this.currentDid,
                    showHeader: true,  // Show header like dashboard
                    showFooter: false, // Hide footer (heading: None)
                    pollingInterval: null
                });
                this.octantDisplay.updateDreamer(data);
            } else {
                // Fallback if OctantDisplay not loaded yet
                resultsContainer.innerHTML = `
                    <div class="spectrum-preview-loading">
                        Loading octant display...
                    </div>
                `;
                setTimeout(() => this.displayResults(data), 500);
            }
        }
    }
    
    async composeOriginPost(handle) {
        try {
            console.log('🎨 [Compose] Starting origin post composition for @' + handle);
            
            const calculateBtn = document.getElementById('spectrum-calculate-btn');
            calculateBtn.textContent = 'Composing...';
            calculateBtn.disabled = true;
            
            // Show progress modal
            this.showProgressModal();
            this.updateProgress('Validating data...', 10);
            
            // Validate that we have calculated data
            if (!this.hasCalculated || !this.octantDisplay || !this.octantDisplay.dreamer) {
                throw new Error('Please calculate a spectrum first');
            }
            
            console.log('✅ [Compose] Data validated');
            
            // Get dreamer data
            const spectrum = this.octantDisplay?.dreamer?.spectrum;
            const displayName = this.currentDisplayName || handle;
            const octantName = spectrum?.octant || 'equilibrium';
            const coordinateText = this.getCoordinateString();
            
            console.log('📊 [Compose] Octant: ' + octantName + ', Display name: ' + displayName);
            console.log('📊 [Compose] Spectrum values:', spectrum);
            
            // Check if we have a pre-generated server image
            let blob = null;
            let dataUrl = null;
            
            if (this.currentSpectrumImageUrl) {
                this.updateProgress('Using pre-generated image...', 60);
                console.log('✅ [Compose] Using pre-generated server image:', this.currentSpectrumImageUrl);
                
                try {
                    // Fetch the pre-generated image
                    const imageResponse = await fetch(this.currentSpectrumImageUrl);
                    if (imageResponse.ok) {
                        blob = await imageResponse.blob();
                        dataUrl = this.currentSpectrumImageUrl;
                        console.log('✅ [Compose] Loaded server image (' + (blob.size / 1024).toFixed(2) + ' KB)');
                        this.updateProgress('Image loaded!', 100);
                    } else {
                        console.warn('⚠️ [Compose] Server image not ready, falling back to client generation');
                        blob = null;
                        dataUrl = null;
                    }
                } catch (error) {
                    console.warn('⚠️ [Compose] Failed to fetch server image, falling back:', error);
                    blob = null;
                    dataUrl = null;
                }
            }
            
            // Fall back to client-side generation if no server image
            if (!blob || !dataUrl) {
                this.updateProgress('Generating image...', 20);
                console.log('🎨 [Compose] Generating image client-side...');
                
                const result = await this.generateOriginImageCanvas(handle, displayName, octantName, spectrum);
                blob = result.blob;
                dataUrl = result.dataUrl;
            }
            
            this.updateProgress('Complete!', 100);
            
            // Show post instructions modal with image
            setTimeout(() => {
                this.hideProgressModal();
                this.showPostInstructions(handle, coordinateText, octantName, dataUrl, blob);
            }, 300);
            
            calculateBtn.textContent = `Invite @${handle}`;
            calculateBtn.disabled = false;
            
        } catch (error) {
            console.error('❌ [Compose] Failed to compose origin post:', error);
            this.hideProgressModal();
            alert('Failed to compose post: ' + error.message);
            
            const calculateBtn = document.getElementById('spectrum-calculate-btn');
            if (calculateBtn) {
                calculateBtn.textContent = `Invite @${this.currentHandle}`;
                calculateBtn.disabled = false;
            }
        }
    }
    
    async generateOriginImageCanvas(handle, displayName, octantName, spectrum) {
        try {
            // Create landscape canvas for social media (1280x720)
            this.updateProgress('Creating canvas...', 25);
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 1280;
            finalCanvas.height = 720;
            const ctx = finalCanvas.getContext('2d');
            
            // Configure for pixel-perfect rendering
            configurePixelPerfectCanvas(ctx);
            
            console.log(`🎨 [Compose] Canvas created: 1280x720 (landscape, pixel-perfect mode)`);
            this.updateProgress('Loading background image...', 60);
            
            // Load and draw the landscape background (originBG.png)
            let bgImage;
            try {
                bgImage = await loadImageUtil('/assets/originBG.png?v=' + Date.now());
                ctx.drawImage(bgImage, 0, 0, finalCanvas.width, finalCanvas.height);
                console.log('✅ [Compose] Landscape background (originBG) drawn');
            } catch (e) {
                console.warn('⚠️ [Compose] Could not load background, using fallback:', e);
                // Fallback: Dark gradient background
                const gradient = ctx.createLinearGradient(0, 0, 0, finalCanvas.height);
                gradient.addColorStop(0, '#0a0806');
                gradient.addColorStop(1, '#1a1410');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            }
            
            // Generate particles - larger size
            const particleCount = Math.floor(80 + Math.random() * 40);
            for (let i = 0; i < particleCount; i++) {
                const x = Math.random() * finalCanvas.width;
                const y = Math.random() * finalCanvas.height;
                const size = Math.random() * 3 + 1;  // 1-4px (was 0.5-2.5px)
                const opacity = Math.random() * 0.6 + 0.2;
                
                ctx.fillStyle = `rgba(212, 175, 55, ${opacity})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Generate souvenir bubbles - fewer and larger
            const bubbleCount = Math.floor(4 + Math.random() * 4);  // 4-8 bubbles (was 8-15)
            try {
                // Get random souvenir icons from API directly
                const response = await fetch('/api/souvenirs');
                const rawData = await response.json();
                const allSouvenirs = Object.entries(rawData).map(([key, data]) => ({
                    key: data.key,
                    name: data.name,
                    icon: data.icon
                }));
                const shuffled = allSouvenirs.sort(() => Math.random() - 0.5);
                const souvenirs = shuffled.slice(0, Math.min(bubbleCount, shuffled.length));
                
                // Draw each souvenir as a bubble on canvas - homepage.js style
                for (let i = 0; i < bubbleCount; i++) {
                    const souvenir = souvenirs[i % souvenirs.length];
                    const x = Math.random() * finalCanvas.width;
                    const y = Math.random() * finalCanvas.height;
                    const size = 80 + Math.random() * 60;  // 80-140px (was 50-80px)
                    const rotation = Math.random() * Math.PI * 2;
                    
                    // Draw bubble with homepage.js styling
                    const gradient = ctx.createRadialGradient(
                        x - size * 0.2, y - size * 0.2, 0,  // Offset light source (30% at 30%)
                        x, y, size / 2
                    );
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                    gradient.addColorStop(1, 'rgba(200, 220, 255, 0.4)');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Border
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    
                    // Inner shadow effect
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-atop';
                    const innerShadow = ctx.createRadialGradient(
                        x + size * 0.15, y + size * 0.15, 0,
                        x, y, size / 2
                    );
                    innerShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    innerShadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)');
                    ctx.fillStyle = innerShadow;
                    ctx.beginPath();
                    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    
                    // Load and draw souvenir icon (80% of bubble size)
                    try {
                        const iconImage = await loadImageUtil(souvenir.icon);
                        const iconSize = size * 0.80;
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(rotation);
                        ctx.globalAlpha = 0.85;
                        // Add subtle drop shadow on icon
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
                        ctx.shadowBlur = 4;
                        ctx.shadowOffsetY = 2;
                        ctx.drawImage(iconImage, -iconSize/2, -iconSize/2, iconSize, iconSize);
                        ctx.restore();
                    } catch (e) {
                        console.warn('Could not load souvenir icon:', souvenir.icon);
                    }
                }
                console.log(`✅ [Compose] Drew ${bubbleCount} souvenir bubbles (homepage style)`);
            } catch (e) {
                console.warn('⚠️ [Compose] Could not load souvenir bubbles, using fallback:', e);
                // Fallback: simple bubbles
                for (let i = 0; i < bubbleCount; i++) {
                    const x = Math.random() * finalCanvas.width;
                    const y = Math.random() * finalCanvas.height;
                    const size = 50 + Math.random() * 30;
                    const gradient = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size / 2);
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
                    gradient.addColorStop(1, 'rgba(200, 220, 255, 0.3)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            this.updateProgress('Loading logo and avatar...', 65);
            
            // Load Reverie House logo
            let logo;
            try {
                logo = await loadImageUtil('/assets/logo.png?v=' + Date.now());
                console.log('✅ [Compose] Logo loaded');
            } catch (e) {
                console.warn('⚠️ [Compose] Could not load logo:', e);
            }
            
            this.updateProgress('Loading avatar...', 70);
            
            // Load avatar with proxy fallback
            let avatarImage = null;
            try {
                const avatarUrl = this.octantDisplay?.dreamer?.avatar;
                if (avatarUrl) {
                    console.log('🔍 [Compose] Attempting to load avatar:', avatarUrl);
                    // Try proxy first (correct endpoint: /api/avatar-proxy)
                    const proxyUrl = `/api/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`;
                    try {
                        avatarImage = await loadImageUtil(proxyUrl);
                        console.log('✅ [Compose] Avatar loaded via proxy');
                    } catch (proxyError) {
                        console.log('⚠️ [Compose] Proxy failed, trying CORS direct load');
                        avatarImage = await new Promise((resolve, reject) => {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            img.onload = () => resolve(img);
                            img.onerror = () => reject(new Error('Failed to load avatar'));
                            img.src = avatarUrl;
                        });
                        console.log('✅ [Compose] Avatar loaded directly');
                    }
                }
            } catch (e) {
                console.log('⚠️ [Compose] Could not load avatar:', e.message);
            }
            
            this.updateProgress('Drawing octant display...', 80);
            console.log('🎨 [Compose] Drawing octant display (left and down)');
            
            // Get coordinate string
            const coordinateText = this.getCoordinateString();
            
            // OCTANT DISPLAY BOX - Wide format for landscape canvas
            const boxWidth = 880;   // Wide format
            const boxHeight = 630;  // Proportional height
            const boxX = 20;        // 20px from left edge
            const boxY = (finalCanvas.height - boxHeight) / 2;  // Vertically centered
            
            this.updateProgress('Drawing octant display...', 75);
            
            // Skip welcome panel for landscape format - focus on octant box
            // (Logo can be added later if there's space on the right)
            
            // Get octant color mapping
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
            
            const octantColor = octantColors[octantName] || octantColors['equilibrium'];
            
            // Background box with drop shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 25;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;
            ctx.fillStyle = 'rgba(26, 20, 16, 0.85)';
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            
            // Reset shadow for border
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Border with octant color
            ctx.strokeStyle = octantColor.base.replace(')', ', 0.6)').replace('rgb', 'rgba');
            ctx.lineWidth = 3;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            
            // Profile section - avatar on left, text stacked vertically on right
            let profileY = boxY + 22;  // Raised further up (was 30)
            
            // Avatar - 15% larger (105 → 121)
            const avatarSize = 121;  // 105 * 1.15
            const avatarX = boxX + 28;  // More left (was 36)
            const avatarY = profileY - 4;  // Raised 4px
            
            if (avatarImage) {
                console.log('🖼️ [Compose] Drawing avatar at', avatarX, avatarY, 'size:', avatarSize);
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
                
                // Border around avatar
                ctx.strokeStyle = octantColor.base.replace(')', ', 0.8)').replace('rgb', 'rgba');
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.stroke();
                console.log('✅ [Compose] Avatar drawn successfully');
            } else {
                console.warn('⚠️ [Compose] No avatar image available');
            }
            
            // Text stacked vertically next to avatar
            const profileTextX = avatarX + avatarSize + 28;  // Increased margin (was 24)
            let textY = avatarY;
            
            // Display name - 15% larger (34 → 39)
            ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
            ctx.font = 'bold 39px system-ui, -apple-system, sans-serif';  // 34 * 1.15
            ctx.textAlign = 'left';
            ctx.fillText(displayName, profileTextX, textY + 32);  // 28 * 1.15
            
            // Handle - 15% larger (27 → 31)
            textY += 53;  // 46 * 1.15
            ctx.fillStyle = 'rgba(201, 184, 168, 0.75)';
            ctx.font = '31px system-ui, -apple-system, sans-serif';  // 27 * 1.15
            ctx.fillText(`@${handle}`, profileTextX, textY + 19);  // 10 * 1.15 + 2px + 2px + 3px drop
            
            // Coordinate string - 15% larger (23 → 26)
            textY += 39;  // 34 * 1.15
            ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
            ctx.font = 'bold 26px "Courier New", monospace';  // 23 * 1.15
            ctx.fillText(coordinateText, profileTextX, textY + 16);  // 5 * 1.15 + 4px + 4px + 2px drop
            
            // Octant name below avatar - 15% larger (38 → 44)
            profileY = avatarY + avatarSize + 44;  // 38 * 1.15
            ctx.fillStyle = octantColor.base;
            ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';  // 38 * 1.15
            ctx.textAlign = 'left';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 8;  // 7 * 1.15
            ctx.fillText(octantName.toUpperCase(), boxX + 48, profileY);  // 42 * 1.15
            ctx.shadowBlur = 0;
            
            // Octant description - 15% larger (23 → 26)
            const octantInfo = getOctantInfo(octantName);
            profileY += 41;  // 36 * 1.15
            ctx.fillStyle = octantColor.base;  // Use octant color instead of gray
            ctx.font = 'italic 26px Georgia, serif';  // 23 * 1.15
            ctx.textAlign = 'left';
            ctx.fillText(octantInfo.desc, boxX + 48, profileY);
            
            // Divider
            profileY += 28;  // 24 * 1.15
            ctx.strokeStyle = octantColor.base;  // Use octant color
            ctx.beginPath();
            ctx.moveTo(boxX + 55, profileY);  // 48 * 1.15
            ctx.lineTo(boxX + boxWidth - 55, profileY);
            ctx.stroke();
            
            // Three cross-pushing weight bars (axis pairs) - 15% larger
            profileY += 58;  // 50 * 1.15
            const barWidth = boxWidth - 110;  // 96 * 1.15
            const barHeight = 81;  // 70 * 1.15
            const barSpacing = 36;  // Reduced vertical padding (was 48)
            
            // Define axis colors
            const axisColors = {
                oblivion: 'rgb(150, 120, 180)',
                entropy: 'rgb(255, 120, 80)',
                authority: 'rgb(200, 60, 60)',
                liberty: 'rgb(80, 180, 255)',
                skeptic: 'rgb(255, 200, 80)',
                receptive: 'rgb(120, 220, 160)'
            };
            
            const axisPairs = [
                {
                    left: { name: 'Oblivion', value: spectrum.oblivion, color: axisColors.oblivion },
                    right: { name: 'Entropy', value: spectrum.entropy, color: axisColors.entropy }
                },
                {
                    left: { name: 'Authority', value: spectrum.authority, color: axisColors.authority },
                    right: { name: 'Liberty', value: spectrum.liberty, color: axisColors.liberty }
                },
                {
                    left: { name: 'Skeptic', value: spectrum.skeptic, color: axisColors.skeptic },
                    right: { name: 'Receptive', value: spectrum.receptive, color: axisColors.receptive }
                }
            ];
            
            axisPairs.forEach((pair, i) => {
                const y = profileY + i * (barHeight + barSpacing);
                const barStartX = boxX + 55;  // 48 * 1.15
                
                // Calculate midline position
                const total = pair.left.value + pair.right.value;
                const leftRatio = pair.left.value / total;
                const midlineX = barStartX + (barWidth * leftRatio);
                
                // Background track - 15% thicker (36 → 41)
                ctx.fillStyle = 'rgba(50, 40, 45, 0.6)';
                ctx.fillRect(barStartX, y, barWidth, 41);  // 36 * 1.15
                
                // Full gradient bar - 15% thicker
                const barGradient = ctx.createLinearGradient(barStartX, 0, barStartX + barWidth, 0);
                barGradient.addColorStop(0, pair.left.color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
                barGradient.addColorStop(leftRatio, pair.left.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
                barGradient.addColorStop(leftRatio, pair.right.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
                barGradient.addColorStop(1, pair.right.color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
                ctx.fillStyle = barGradient;
                ctx.fillRect(barStartX, y, barWidth, 41);  // 36 * 1.15
                
                // Midline marker - white instead of gold
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(midlineX - 3.5, y - 9, 7, 60);  // Scaled dimensions
                
                // Axis titles above bars - 15% larger (19 → 22)
                ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';  // 19 * 1.15
                ctx.textAlign = 'left';
                ctx.fillStyle = pair.left.color.replace(')', ', 0.9)').replace('rgb', 'rgba');
                ctx.fillText(pair.left.name.toUpperCase(), barStartX, y - 14);  // 12 * 1.15
                ctx.textAlign = 'right';
                ctx.fillStyle = pair.right.color.replace(')', ', 0.9)').replace('rgb', 'rgba');
                ctx.fillText(pair.right.name.toUpperCase(), barStartX + barWidth, y - 14);
                
                // Values INSIDE bars - more transparent white with drop shadow
                ctx.font = 'bold 32px "Courier New", monospace';  // Larger for prominence
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                
                // Left value
                ctx.textAlign = 'left';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';  // More transparent (was 0.85)
                ctx.fillText(Math.round(pair.left.value), barStartX + 15, y + 30);  // Inside bar, vertically centered
                
                // Right value
                ctx.textAlign = 'right';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';  // More transparent (was 0.85)
                ctx.fillText(Math.round(pair.right.value), barStartX + barWidth - 15, y + 30);  // Inside bar, vertically centered
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            });
            
            // Add logo to bottom-right corner, aligned with box bottom
            if (logo) {
                const logoWidth = 330;  // 10% larger (300 * 1.1)
                const logoHeight = (logo.height / logo.width) * logoWidth;
                const logoX = boxX + boxWidth - logoWidth - 30 + (logoWidth * 1.25) - 15 - 5 - 4;  // Move left 4px more
                const logoY = boxY + boxHeight - logoHeight - 20 + 5;  // Move down 5px (20px margin - 5)
                
                // Draw logo with dark shadow behind it
                ctx.shadowColor = 'rgba(0, 0, 0, 1)';  // Full black
                ctx.shadowBlur = 60;  // Even more blur for softer dark shadow
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 25;  // Larger offset for more prominent shadow
                ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                console.log('✅ [Compose] Logo added to bottom-right');
            }
            
            console.log('✅ [Compose] Octant display complete');
            const blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
            const dataUrl = finalCanvas.toDataURL('image/png');
            console.log('✅ [Compose] Image created (' + (blob.size / 1024).toFixed(2) + ' KB)');
            
            return { blob, dataUrl };
        } catch (error) {
            console.error('❌ [ImageGen] Canvas generation failed:', error);
            throw error;
        }
    }
    
    async generateAndUploadOriginImage(handle, displayName, octantName, spectrum) {
        /**
         * Generate origin image and upload it to the server immediately
         * This makes the image available for OG previews right away
         */
        try {
            console.log('🎨 [Upload] Generating origin image for immediate upload...');
            
            // Generate the canvas image
            const { blob, dataUrl } = await this.generateOriginImageCanvas(handle, displayName, octantName, spectrum);
            
            // Upload to server
            const formData = new FormData();
            formData.append('image', blob, `${handle}.png`);
            formData.append('handle', handle);
            
            console.log('📤 [Upload] Uploading image to server...');
            const uploadResponse = await fetch('/api/spectrum/save-image', {
                method: 'POST',
                body: formData
            });
            
            if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                console.log('✅ [Upload] Image uploaded successfully:', result.url);
                return { success: true, url: result.url };
            } else {
                const error = await uploadResponse.json();
                console.error('❌ [Upload] Upload failed:', error);
                return { success: false, error: error.error };
            }
            
        } catch (error) {
            console.error('❌ [Upload] Image generation/upload failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    getCoordinateString() {
        if (!this.octantDisplay || !this.octantDisplay.dreamer) {
            return '';
        }
        
        const spectrum = this.octantDisplay.dreamer.spectrum;
        if (!spectrum) return '';
        
        const pad = (num) => String(Math.round(num)).padStart(2, '0');
        
        return `O${pad(spectrum.oblivion)} A${pad(spectrum.authority)} S${pad(spectrum.skeptic)} R${pad(spectrum.receptive)} L${pad(spectrum.liberty)} E${pad(spectrum.entropy)}`;
    }
    
    async calculateFacets(text, handle) {
        // Use the utility function from bluesky-utils.js
        return await calculateBlueskyFacets(text);
    }
    
    async showPostInstructions(handle, coordinateText, octantName, imageDataUrl, imageBlob) {
        // Add CSS for spin animation
        if (!document.getElementById('spectrum-spin-style')) {
            const style = document.createElement('style');
            style.id = 'spectrum-spin-style';
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Ensure handle has full .bsky.social suffix for proper Bluesky mention detection
        const fullHandle = handle.includes('.') ? handle : `${handle}.bsky.social`;
        const mentionHandle = fullHandle.replace('@', ''); // Remove @ if present for clean @mention
        
        // Clean handle for URL (remove @ only, preserve full domain)
        const cleanHandle = mentionHandle; // Already has full domain from earlier
        
        // Create shorter dynamic URL: reverie.house/origin/{full.handle}
        const originUrl = `https://reverie.house/origin/${cleanHandle}`;
        
        // Simple post text with @mention
        // Bluesky will auto-detect and linkify the @mention when posted
        const postText = `Welcome to Reverie House, @${mentionHandle}

What kind of dreamweaver are you?
${originUrl}`;
        
        console.log('📝 [Post] Generated post text:', postText);
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'spectrum-post-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #1a1410;
            padding: 1.25rem;
            border: 1px solid #734ba1;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;
        
        modal.innerHTML = `
            <!-- Image Preview -->
            <div style="margin-bottom: 0.75rem; max-width: 90%; margin-left: auto; margin-right: auto;">
                <img id="origin-image" src="${imageDataUrl}" style="width: 100%; height: auto; border: 1px solid #555; display: block; cursor: pointer;" alt="Origin declaration" title="Click to copy image to clipboard">
            </div>
            
            <!-- Post Text -->
            <div style="margin-bottom: 0.75rem; max-width: 80%; margin-left: auto; margin-right: auto;">
                <div style="background: #0a0806; padding: 0.6rem; font-family: 'Courier New', monospace; color: #fff; border: 1px solid #444; cursor: pointer; white-space: pre-wrap; font-size: 0.75rem; line-height: 1.4;" onclick="
                    navigator.clipboard.writeText(this.dataset.text);
                    this.style.borderColor = '#734ba1';
                    const hint = this.nextElementSibling;
                    hint.textContent = 'Copied to clipboard';
                    hint.style.color = '#9dff9d';
                    setTimeout(() => {
                        this.style.borderColor = '#444';
                        hint.textContent = 'Click to copy';
                        hint.style.color = '#888';
                    }, 2000);
                " data-text="${postText.replace(/"/g, '&quot;')}">${postText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div style="font-size: 0.75rem; color: #888; margin-top: 0.25rem;">
                    Click to copy
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="max-width: 320px; margin-left: auto; margin-right: auto; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem;">
                <button id="open-bsky-btn" style="width: 100%; padding: 0.55rem; background: #1185fe; color: white; border: none; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                    <img src="/assets/bluesky.png" style="width: 16px; height: 16px; filter: brightness(0.75);" onerror="this.style.display='none'">
                    <span>Invite via Bluesky</span>
                </button>
                <button onclick="this.closest('.spectrum-post-modal').remove()" style="width: 100%; padding: 0.55rem; background: #2a2420; color: #aaa; border: 1px solid #444; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
                    Close
                </button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add Bluesky handler - save image to server and open compose with text
        const bskyBtn = document.getElementById('open-bsky-btn');
        if (bskyBtn) {
            bskyBtn.addEventListener('click', async () => {
                try {
                    bskyBtn.disabled = true;
                    bskyBtn.innerHTML = `
                        <span>Saving image...</span>
                    `;
                    
                    // Use full handle for filename (preserve domain)
                    const fullHandle = mentionHandle; // Already cleaned, has full domain
                    
                    // Save image to server at /spectrum/{full.handle}.png
                    const formData = new FormData();
                    formData.append('image', imageBlob, `${fullHandle}.png`);
                    formData.append('handle', fullHandle);
                    
                    const saveResponse = await fetch('/api/spectrum/save-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!saveResponse.ok) {
                        throw new Error('Failed to save image to server');
                    }
                    
                    const { imageUrl } = await saveResponse.json();
                    
                    // Calculate facets using server-side API (more reliable)
                    console.log('📝 [Bluesky] Generating facets using server API...');
                    const facetsResponse = await fetch('/api/spectrum/generate-facets', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ text: postText })
                    });
                    
                    let facets = [];
                    if (facetsResponse.ok) {
                        const facetsData = await facetsResponse.json();
                        facets = facetsData.facets || [];
                        console.log('✅ [Bluesky] Server-generated facets:', facets);
                        console.log(`   Found ${facets.length} facet(s)`);
                    } else {
                        console.warn('⚠️ [Bluesky] Failed to generate facets from server, mentions may not be linked');
                    }
                    
                    // Open Bluesky compose URL
                    // Note: The intent URL doesn't support facets, but Bluesky's composer
                    // will auto-detect and linkify the @mentions when the user posts
                    const composeUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(postText)}`;
                    window.open(composeUrl, '_blank');
                    
                    // Show success message and re-enable button after 2 seconds
                    bskyBtn.innerHTML = `
                        <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span>Opened in Bluesky</span>
                    `;
                    
                    // Re-enable button after 2 seconds
                    setTimeout(() => {
                        bskyBtn.disabled = false;
                        bskyBtn.innerHTML = `
                            <img src="/assets/bluesky.png" style="width: 16px; height: 16px; filter: brightness(0.75);" onerror="this.style.display='none'">
                            <span>Invite via Bluesky</span>
                        `;
                    }, 2000);
                    
                } catch (error) {
                    console.error('Failed to prepare Bluesky post:', error);
                    alert('Failed to save image or open Bluesky. Please try again.');
                    bskyBtn.disabled = false;
                    bskyBtn.innerHTML = `
                        <img src="/assets/bluesky.png" style="width: 16px; height: 16px; filter: brightness(0.75);" onerror="this.style.display='none'">
                        <span>Invite via Bluesky</span>
                    `;
                }
            });
        }
        
        // Add image click-to-copy handler (visual feedback only, no hint element)
        const originImage = modal.querySelector('#origin-image');
        originImage.addEventListener('click', async () => {
            try {
                // Convert blob to clipboard item
                const clipboardItem = new ClipboardItem({ 'image/png': imageBlob });
                await navigator.clipboard.write([clipboardItem]);
                
                // Visual feedback on border only
                originImage.style.borderColor = '#734ba1';
                
                setTimeout(() => {
                    originImage.style.borderColor = '#555';
                }, 2000);
            } catch (error) {
                console.error('Failed to copy image:', error);
                // Just border color change for error too
                originImage.style.borderColor = '#ff6b6b';
                setTimeout(() => {
                    originImage.style.borderColor = '#555';
                }, 3000);
            }
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
    
    showError(message) {
        // Don't replace the octant display - just reset it to zeros and show error in console
        console.warn('Spectrum Preview Error:', message);
        
        // Reset octant display to zeros if it exists
        if (this.octantDisplay) {
            this.octantDisplay.updateDreamer({
                spectrum: {
                    oblivion: 0,
                    authority: 0,
                    skeptic: 0,
                    receptive: 0,
                    liberty: 0,
                    entropy: 0,
                    octant: 'equilibrium'
                },
                display_name: message,
                handle: 'error'
            });
        }
    }
    
    setMapperStatus(isMapper) {
        this.options.isMapper = isMapper;
        this.render();
    }
    
    showProgressModal() {
        // Remove existing modal if any
        this.hideProgressModal();
        
        const overlay = document.createElement('div');
        overlay.id = 'spectrum-progress-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: linear-gradient(135deg, #2c1810 0%, #4a3428 100%);
            padding: 2.5rem;
            border: 3px solid #734ba1;
            min-width: 400px;
            text-align: center;
        `;
        
        modal.innerHTML = `
            <h2 style="color: #e8d5c4; margin: 0 0 1.5rem 0; font-size: 1.5rem;">
                Calculating Origins
            </h2>
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
                <div id="progress-message" style="color: #c9b8a8; margin-bottom: 0.5rem; min-height: 24px;">
                    Initializing...
                </div>
                <div style="background: rgba(0,0,0,0.5); height: 30px; border-radius: 15px; overflow: hidden; position: relative;">
                    <div id="progress-bar" style="background: linear-gradient(90deg, #734ba1, #a67dd4); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                    <div id="progress-percent" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-weight: bold; font-size: 14px;">
                        0%
                    </div>
                </div>
            </div>
            <div id="progress-preview" style="max-height: 300px; overflow: hidden; margin-top: 1rem; display: none;">
                <!-- Preview will be inserted here -->
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }
    
    updateProgress(message, percent) {
        const messageEl = document.getElementById('progress-message');
        const barEl = document.getElementById('progress-bar');
        const percentEl = document.getElementById('progress-percent');
        
        if (messageEl) messageEl.textContent = message;
        if (barEl) barEl.style.width = percent + '%';
        if (percentEl) percentEl.textContent = Math.round(percent) + '%';
        
        console.log(`📊 [Progress] ${percent}% - ${message}`);
    }
    
    hideProgressModal() {
        const modal = document.getElementById('spectrum-progress-modal');
        if (modal) {
            modal.remove();
        }
    }
    
    showImagePreview(canvas) {
        const previewContainer = document.getElementById('progress-preview');
        if (!previewContainer) return;
        
        // Convert canvas to image
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.cssText = `
            max-width: 100%;
            border: 2px solid #734ba1;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        
        previewContainer.innerHTML = '';
        previewContainer.appendChild(img);
        previewContainer.style.display = 'block';
        
        console.log('👁️ [Compose] Preview displayed in progress modal');
    }
}

// Export for ES6 modules
export default SpectrumPreview;

// Also export to window for non-module scripts
if (typeof window !== 'undefined') {
    window.SpectrumPreview = SpectrumPreview;
}
