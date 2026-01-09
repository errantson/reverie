/* Spectrum Deluxe Visualizer - Enhanced version for dedicated spectrum page */


// Inherit all the constants and base functionality from spectrum.js
// This file extends SpectrumVisualizer for the dedicated spectrum page

class SpectrumDeluxe extends SpectrumVisualizer {
    constructor(canvas, options = {}) {
        // Call parent constructor with enhanced options
        super(canvas, {
            ...options,
            showControls: false, // We'll create custom controls
            onDotClick: (dreamer) => {
                // Navigate to dreamer page when clicking on a dot
                // Use handle if available for clean URLs
                if (dreamer.handle) {
                    const cleanHandle = dreamer.handle.replace('.bsky.social', '');
                    window.location.href = `/dreamers/${encodeURIComponent(cleanHandle)}`;
                } else if (dreamer.name) {
                    window.location.href = `/dreamers/${encodeURIComponent(dreamer.name)}`;
                }
            }
        });
        
        // Remove the old sidebar-based controls if they exist
        const oldSidebar = document.querySelector('.sidebar');
        if (oldSidebar) {
            oldSidebar.remove();
        }
        
        // Track if modality section has been created
        this.modalitySectionCreated = false;
        
        // Create floating control overlay
        this.createFloatingControls();
    }
    
    createFloatingControls() {
        // Find or create the canvas container
        const canvasContainer = this.canvas.parentElement;
        if (!canvasContainer) return;
        
        // Create top control bar (single row, no title)
        const controlBar = document.createElement('div');
        controlBar.className = 'spectrum-control-bar';
        controlBar.innerHTML = `
            <div class="control-bar-section control-bar-toggles">
                <label class="control-toggle-inline">
                    <input type="checkbox" id="toggleLabels" ${this.options.showLabels ? 'checked' : ''}>
                    <span class="toggle-slider-inline"></span>
                    <span class="toggle-label-inline">Axis Labels</span>
                </label>
                <label class="control-toggle-inline" style="display: ${this.isTouchDevice ? 'none' : 'flex'};">
                    <input type="checkbox" id="toggleAllNames" ${this.options.showAllNames ? 'checked' : ''}>
                    <span class="toggle-slider-inline"></span>
                    <span class="toggle-label-inline">Show All Names</span>
                </label>
            </div>
            <div class="control-bar-section control-bar-views">
                <button class="view-btn-bar active" data-view="3d" title="Balanced 3D perspective">Balance</button>
                <button class="view-btn-bar" data-view="power-structure" title="Power vs Structure">Force</button>
                <button class="view-btn-bar" data-view="belief-agency" title="Belief vs Agency">Agency</button>
                <button class="view-btn-bar" data-view="change-freedom" title="Change vs Freedom">Position</button>
            </div>
            <div class="control-bar-section control-bar-actions">
                <button class="action-btn-bar action-btn-icon" id="exploreOctantsBtn" title="Explore the octants of the spectrum">
                    <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                </button>
                <button class="action-btn-bar action-btn-icon" id="calculateOriginsBtn" title="Open Spectrum Calculator">
                    <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </button>
                <button class="action-btn-bar" id="fitZoom" title="Fit all dreamers in view">Fit View</button>
                <button class="action-btn-bar" id="resetView" title="Reset to default view">Reset</button>
            </div>
        `;
        
        // Insert at the beginning of canvas container
        canvasContainer.insertBefore(controlBar, canvasContainer.firstChild);
        
        // Create floating action buttons (bottom left)
        this.createFloatingActionButtons();
        
        // Check mapper status and show button if active
        this.checkMapperStatusForButton();
        
        // Create simple timeline scrubber (now just for timeline functionality)
        this.createTimelineScrubber(canvasContainer);
        
        // Setup event listeners
        this.setupDeluxeControls();
    }
    
    createTimelineScrubber(canvasContainer) {
        const scrubberContainer = document.createElement('div');
        scrubberContainer.className = 'spectrum-timeline-scrubber';
        scrubberContainer.innerHTML = `
            <div class="timeline-label">History</div>
            <input type="range" class="timeline-slider" id="timelineSlider" 
                   min="0" max="100" value="100" 
                   title="Scrub through spectrum history">
            <div class="timeline-time" id="timelineTime">Now</div>
        `;
        canvasContainer.appendChild(scrubberContainer);
        
        // Load and initialize timeline data
        this.initializeTimeline();
    }
    
    createFloatingActionButtons() {
        // Create floating action buttons container
        const floatingActions = document.createElement('div');
        floatingActions.className = 'spectrum-floating-actions';
        floatingActions.innerHTML = `
            <button class="floating-action-btn" id="floatingExploreOctantsBtn" title="Explore the octants of the spectrum">
                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Explore Octants
            </button>
            <button class="floating-action-btn" id="floatingCalculateOriginsBtn" title="Open Spectrum Calculator">
                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                Calculate Origins
            </button>
        `;
        
        // Append to body so it's fixed position
        document.body.appendChild(floatingActions);
        
        // Store references
        this.floatingExploreBtn = document.getElementById('floatingExploreOctantsBtn');
        this.floatingCalculateBtn = document.getElementById('floatingCalculateOriginsBtn');
    }
    
    async initializeTimeline() {
        try {
            const response = await fetch('/api/database/spectrum_snapshots');
            const result = await response.json();
            
            if (result.status === 'success' && result.data.length > 0) {
                this.snapshots = result.data;
                this.currentSnapshotIndex = this.snapshots.length - 1; // Start at most recent
                
                const slider = document.getElementById('timelineSlider');
                if (slider) {
                    slider.max = this.snapshots.length - 1;
                    slider.value = this.currentSnapshotIndex;
                    
                    slider.addEventListener('input', (e) => {
                        this.currentSnapshotIndex = parseInt(e.target.value);
                        this.loadSnapshotData(this.currentSnapshotIndex);
                    });
                    
                    // Show scrubber since we have data
                    document.querySelector('.spectrum-timeline-scrubber').style.display = 'flex';
                }
                
                this.updateTimelineLabel();
            }
        } catch (error) {
            console.warn('Timeline scrubber: No snapshot data available');
        }
    }
    
    async loadSnapshotData(index) {
        const snapshot = this.snapshots[index];
        if (!snapshot) return;
        
        try {
            // Fetch detailed snapshot data
            const response = await fetch(`/api/database/spectrum_snapshots/${snapshot.id}`);
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                const snapshotData = JSON.parse(result.data.snapshot_data);
                
                // Update dreamers data from snapshot
                this.dreamers = snapshotData.dreamers.map(d => ({
                    did: d.did,
                    handle: d.handle,
                    name: d.name,
                    display_name: d.display_name,
                    spectrum: d.spectrum,
                    heading: d.heading
                }));
                
                this.updateTimelineLabel();
                this.render();
            }
        } catch (error) {
            console.error('Failed to load snapshot data:', error);
        }
    }
    
    updateTimelineLabel() {
        const timeLabel = document.getElementById('timelineTime');
        if (!timeLabel || !this.snapshots) return;
        
        if (this.currentSnapshotIndex === this.snapshots.length - 1) {
            timeLabel.textContent = 'Now';
        } else {
            const snapshot = this.snapshots[this.currentSnapshotIndex];
            const date = new Date(snapshot.created_at);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 60) {
                timeLabel.textContent = `${diffMins}m ago`;
            } else if (diffHours < 24) {
                timeLabel.textContent = `${diffHours}h ago`;
            } else {
                timeLabel.textContent = `${diffDays}d ago`;
            }
        }
    }
    
    // Override project3D to support true 2D orthographic projection for flat views
    project3D(x, y, z) {
        const rotated = this.rotatePoint3D(x, y, z);
        
        // For 2D views, use orthographic projection (no perspective)
        if (this.currentView === 'xy' || this.currentView === 'yz' || this.currentView === 'xz') {
            const scale = this.camera.zoom * 2.5;
            return {
                x: this.centerX + rotated.x * scale,
                y: this.centerY - rotated.y * scale,
                z: rotated.z,
                scale: scale
            };
        }
        
        // For 3D view, use perspective projection
        const scale = (400 / (400 + rotated.z)) * this.camera.zoom;
        return {
            x: this.centerX + rotated.x * scale,
            y: this.centerY - rotated.y * scale,
            z: rotated.z,
            scale: scale
        };
    }
    
    setupDeluxeControls() {
        console.log('[SpectrumDeluxe] setupDeluxeControls called');
        
        // Axis labels toggle
        const toggleLabels = document.getElementById('toggleLabels');
        if (toggleLabels) {
            toggleLabels.addEventListener('change', (e) => {
                                this.options.showLabels = e.target.checked;
            });
        }
        
        // All names toggle
        const toggleAllNames = document.getElementById('toggleAllNames');
        if (toggleAllNames && !this.isTouchDevice) {
            toggleAllNames.addEventListener('change', (e) => {
                                this.options.showAllNames = e.target.checked;
            });
        }
        
        // View buttons
        const viewButtons = document.querySelectorAll('.view-btn-bar');
                viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                                this.snapToView(view);
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                            });
        });
        
        // Fit zoom button
        const fitZoom = document.getElementById('fitZoom');
        if (fitZoom) {
            fitZoom.addEventListener('click', () => {
                this.fitZoomToDreamers();
            });
        }
        
        // Reset view button
        const resetView = document.getElementById('resetView');
        if (resetView) {
            resetView.addEventListener('click', () => {
                this.snapToView('3d');
                this.camera.zoom = this.options.initialZoom || 1.2;
                const viewButtons = document.querySelectorAll('.view-btn-bar');
                viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === '3d'));
            });
        }
        
        // Explore Octants button
        const exploreOctantsBtn = document.getElementById('exploreOctantsBtn');
        if (exploreOctantsBtn) {
            exploreOctantsBtn.addEventListener('click', () => {
                this.openOctantShowcase();
            });
        }
        
        // Calculate Origins button
        const calcButton = document.getElementById('calculateOriginsBtn');
        if (calcButton) {
            calcButton.addEventListener('click', () => {
                console.log('[SpectrumDeluxe] Calculator button clicked - opening calculator');
                this.openSpectrumCalculator();
            });
        }
        
        // Floating Explore Octants button
        if (this.floatingExploreBtn) {
            this.floatingExploreBtn.addEventListener('click', () => {
                this.openOctantShowcase();
            });
        }
        
        // Floating Calculate Origins button
        if (this.floatingCalculateBtn) {
            this.floatingCalculateBtn.addEventListener('click', () => {
                console.log('[SpectrumDeluxe] Floating calculator button clicked - opening calculator');
                this.openSpectrumCalculator();
            });
        }
    }

    showMapperOfflinePopup(buttonElement) {
        console.log('[SpectrumDeluxe] showMapperOfflinePopup called', buttonElement);
        
        // Use the Popup widget if available
        if (typeof Popup !== 'undefined') {
            Popup.show("Unfortunately, the <strong>Origin Calculator</strong> is only functional while there is an active <a href='/spectrum.html'>Spectrum Mapper</a> working.\n\nSee the <a href='/work.html'>Open Workshop</a> for availability.", {
                title: 'Origin Calculator Offline',
                type: 'info',
                duration: 0, // Don't auto-dismiss
                buttons: [
                    {
                        text: 'Go to Open Workshop',
                        onClick: () => {
                            window.location.href = '/work.html';
                        }
                    },
                    {
                        text: 'Close',
                        onClick: () => {} // Just dismiss
                    }
                ]
            });
        } else {
            // Fallback to confirm if Popup not loaded
            if (confirm('Unfortunately, the Origin Calculator is only functional while there is an active Spectrum Mapper working.\n\nSee the Open Workshop for availability.\n\nGo to Open Workshop?')) {
                window.location.href = '/work.html';
            }
        }
    }
    
    openOctantShowcase() {
        // Dynamically load octantshowcase.js if not already loaded
        if (!document.querySelector('script[src*="octantshowcase.js"]')) {
            console.log('[Spectrum] Loading octantshowcase.js...');
            const script = document.createElement('script');
            script.src = '/js/widgets/octantshowcase.js';
            script.onload = () => {
                console.log('[Spectrum] octantshowcase.js loaded');
                this.showOctantShowcase();
            };
            script.onerror = () => {
                console.error('[Spectrum] Failed to load octantshowcase.js');
            };
            document.head.appendChild(script);
        } else {
            // Already loaded, just show it
            this.showOctantShowcase();
        }
    }
    
    showOctantShowcase() {
        // Wait for OctantShowcase to be available
        const attemptShow = () => {
            if (typeof OctantShowcase !== 'undefined') {
                console.log('[Spectrum] Creating OctantShowcase instance');
                // Create instance if not exists
                if (!window.octantShowcaseWidget) {
                    window.octantShowcaseWidget = new OctantShowcase();
                }
                // Call showPopup directly on the button
                console.log('[Spectrum] Calling showPopup');
                const exploreBtn = document.getElementById('exploreOctantsBtn');
                if (exploreBtn) {
                    window.octantShowcaseWidget.showPopup(exploreBtn);
                }
            } else {
                console.warn('[Spectrum] OctantShowcase not yet available, waiting...');
                setTimeout(attemptShow, 100);
            }
        };
        attemptShow();
    }
    
    async checkMapperStatusForButton() {
        console.log('[SpectrumDeluxe] checkMapperStatusForButton called');
        // MAPPER LIMITATION REMOVED - button is always enabled
        
        const calcButton = document.getElementById('calculateOriginsBtn');
        if (calcButton) {
            console.log('[SpectrumDeluxe] Enabling calculator button (mapper check disabled)');
            calcButton.classList.remove('disabled');
            calcButton.style.cursor = 'pointer';
            calcButton.title = 'Open Spectrum Calculator';
        }
        
        // Also update floating button
        if (this.floatingCalculateBtn) {
            console.log('[SpectrumDeluxe] Enabling floating calculator button (mapper check disabled)');
            this.floatingCalculateBtn.classList.remove('disabled');
            this.floatingCalculateBtn.style.cursor = 'pointer';
            this.floatingCalculateBtn.title = 'Open Spectrum Calculator';
        }
    }
    
    async openSpectrumCalculator() {
        // Load the spectrum calculator modal if not already loaded
        if (!window.SpectrumCalculatorModal) {
            const script = document.createElement('script');
            script.src = '/js/widgets/spectrumcalculator-modal.js';
            script.onload = () => {
                this.initAndOpenCalculator();
            };
            document.head.appendChild(script);
        } else {
            this.initAndOpenCalculator();
        }
    }
    
    async initAndOpenCalculator() {
        if (!window.spectrumCalculatorModal) {
            window.spectrumCalculatorModal = new SpectrumCalculatorModal();
        }
        await window.spectrumCalculatorModal.open();
    }
    
    createModalitySection() {
        // Find the spectrum visualization container
        const spectrumViz = document.querySelector('.spectrum-visualization');
        if (!spectrumViz) return;
        
        // Create modality section using unified octant showcase
        const modalitySection = document.createElement('div');
        modalitySection.className = 'modality-section';
        modalitySection.innerHTML = `
            <div class="modality-grid" id="modalityGrid">
                <!-- Octant cards will be inserted here by OctantShowcase -->
            </div>
        `;
        
        // Insert after the spectrum container
        const spectrumContainer = spectrumViz.querySelector('.spectrum-container');
        if (spectrumContainer) {
            spectrumContainer.insertAdjacentElement('afterend', modalitySection);
        }
        
        // Update modality data
        this.updateModalityDisplay();
    }
    
    updateModalityDisplay() {
        const modalityGrid = document.getElementById('modalityGrid');
        if (!modalityGrid || !window.octantShowcaseWidget) return;
        
        // Use unified octant showcase to render the grid
        window.octantShowcaseWidget.renderInline(
            modalityGrid,
            this.octantDreamers,
            this.dreamers,
            (d) => this.isNearCenter(d)
        );
    }
    
    renderDreamerAvatars(dreamers) {
        if (!dreamers || dreamers.length === 0) {
            return '<div class="octant-empty octant-text-darker">No dreamers yet</div>';
        }
        
        return dreamers.map(dreamer => {
            const avatarUrl = dreamer.avatar || '/assets/icon_face.png';
            const displayName = dreamer.name || dreamer.handle;
            const cleanHandle = dreamer.handle ? dreamer.handle.replace('.bsky.social', '') : displayName;
            
            return `
                <a href="/dreamers/${encodeURIComponent(cleanHandle)}" 
                   class="dreamer-avatar-link dreamer-link"
                   data-dreamer-did="${dreamer.did}"
                   title="${displayName}">
                    <img src="${avatarUrl}" 
                         alt="${displayName}"
                         class="octant-dreamer-avatar"
                         onerror="this.src='/assets/icon_face.png'">
                </a>
            `;
        }).join('');
    }
    
    renderAxesWithExplainer(axesText) {
        // Split by bullet and add data-explainer to each axis
        const axes = axesText.split(' • ');
        return axes.map(axis => `<span data-explainer="${axis}">${axis}</span>`).join(' • ');
    }
    
    initializeModalityExplainer() {
        if (window.explainerWidget) {
            const explainerElements = document.querySelectorAll('.modality-card [data-explainer]');
            explainerElements.forEach(el => {
                const term = el.getAttribute('data-explainer');
                if (term) {
                    // Get the octant color from CSS classes
                    const card = el.closest('.modality-card');
                    let color = null;
                    
                    // Check which octant class is applied
                    if (card) {
                        const octantClasses = ['adaptive', 'chaotic', 'intended', 'prepared', 'contented', 'assertive', 'ordered', 'guarded', 'equilibrium'];
                        for (const octant of octantClasses) {
                            if (card.classList.contains(`octant-bg-${octant}`)) {
                                // Get the computed color from the CSS variable
                                const computedStyle = getComputedStyle(card);
                                color = computedStyle.backgroundColor;
                                break;
                            }
                        }
                    }
                    
                    // Fallback to user color for balance/equilibrium
                    if (!color && card && card.classList.contains('modality-balance')) {
                        color = getComputedStyle(document.documentElement)
                            .getPropertyValue('--reverie-core-color').trim() || '#734ba1';
                    }
                    
                    window.explainerWidget.attach(el, term, color);
                }
            });
                    } else {
            console.warn('⚠️ Explainer widget not loaded yet, retrying...');
            setTimeout(() => this.initializeModalityExplainer(), 500);
        }
    }
    
    isNearCenter(dreamer) {
        // Check for equilibrium by comparing paired spectrum axes
        // A dreamer is in equilibrium when all axis pairs are balanced
        if (dreamer.spectrum) {
            const s = dreamer.spectrum;
            
            // Calculate differences for each axis pair
            const x = (s.entropy || 0) - (s.oblivion || 0);
            const y = (s.liberty || 0) - (s.authority || 0);
            const z = (s.receptive || 0) - (s.skeptic || 0);
            
            // Equilibrium means all pairs are balanced (differences are zero)
            // This catches both origin (0,0,0,0,0,0) and balanced states like (44,44,44,44,44,44)
            return x === 0 && y === 0 && z === 0;
        }
        
        // Fallback: check if coordinates are near origin (for legacy compatibility)
        const threshold = 0.3;
        return Math.abs(dreamer.x) < threshold && 
               Math.abs(dreamer.y) < threshold && 
               Math.abs(dreamer.z) < threshold;
    }
    
    getRandomDreamers(dreamers, count) {
        // Check if errantson/reverie.house is in this list
        const errantsonIndex = dreamers.findIndex(d => 
            d.handle === 'reverie.house' || d.name === 'errantson'
        );
        
        // If errantson is found, put them first
        if (errantsonIndex >= 0) {
            const errantson = dreamers[errantsonIndex];
            const others = dreamers.filter((d, i) => i !== errantsonIndex);
            const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
            return [errantson, ...shuffledOthers.slice(0, count - 1)];
        }
        
        // Otherwise, just shuffle and return
        const shuffled = [...dreamers].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }
    
    renderDreamerRows(dreamers) {
        // Always show 3 rows, even if empty
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const dreamer = dreamers[i];
            if (dreamer) {
                // Determine the proper handle to display
                let displayHandle = '';
                if (dreamer.handle) {
                    // Check if it's already a full handle with domain
                    if (dreamer.handle.includes('.')) {
                        displayHandle = '@' + dreamer.handle;
                    } else {
                        // Fallback to name.reverie.house format
                        displayHandle = '@' + dreamer.name + '.reverie.house';
                    }
                } else {
                    displayHandle = '@' + dreamer.name + '.reverie.house';
                }
                
                // Use avatar or fallback to icon_face.png
                const avatarUrl = dreamer.avatar || '/assets/icon_face.png';
                
                rows.push(`
                    <div class="dreamer-row">
                        <img src="${avatarUrl}" 
                             alt="${displayHandle}" 
                             class="dreamer-avatar dreamer-link"
                             data-dreamer-did="${dreamer.did}"
                             onerror="this.src='/assets/icon_face.png'">
                        <a href="/dreamer.html?handle=${encodeURIComponent(dreamer.name)}" 
                           class="dreamer-name dreamer-link"
                           data-dreamer-did="${dreamer.did}">${displayHandle}</a>
                    </div>
                `);
            } else {
                // Empty row for visual consistency
                rows.push('<div class="dreamer-row dreamer-row-empty"></div>');
            }
        }
        return rows.join('');
    }
    
    // Override categorizeDreamers to create modality section only once
    categorizeDreamers() {
        super.categorizeDreamers();
        
        // Initialize dreamer hover widget with current dreamers data
        if (typeof DreamerHoverWidget !== 'undefined' && this.dreamers && this.dreamers.length > 0) {
            if (!this.dreamerHoverWidget) {
                this.dreamerHoverWidget = new DreamerHoverWidget(this.dreamers);
                this.dreamerHoverWidget.init();
                                
                // Setup canvas hover tracking
                this.setupCanvasHoverTracking();
            } else {
                // Update existing widget with new data
                this.dreamerHoverWidget.setDreamers(this.dreamers);
                            }
        }
        
        // Only create and populate modality section once
        // DISABLED: Don't create modality section on spectrum.html - use Explore Octants button instead
        /*
        if (!this.modalitySectionCreated) {
            if (!document.querySelector('.modality-section')) {
                this.createModalitySection();
            } else {
                this.updateModalityDisplay();
            }
            this.modalitySectionCreated = true;
        }
        */
    }
    
    setupCanvasHoverTracking() {
        // Track the last hovered dreamer to avoid redundant updates
        this.lastHoveredDid = null;
        this.canvasHoverElement = null;
        
        // Monitor mousemove on canvas to detect hover changes
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.dreamerHoverWidget) return;
            
            // Check if we have a currently hovered dreamer
            const hovered = this.hoveredDreamer;
            
            if (hovered && hovered.did) {
                // If this is a new hover, trigger the widget
                if (this.lastHoveredDid !== hovered.did) {
                    this.lastHoveredDid = hovered.did;
                    
                    // Create or update a persistent hover element at the mouse position
                    if (!this.canvasHoverElement) {
                        this.canvasHoverElement = document.createElement('div');
                        this.canvasHoverElement.className = 'dreamer-link canvas-hover-trigger';
                        this.canvasHoverElement.style.position = 'fixed';
                        this.canvasHoverElement.style.pointerEvents = 'none';
                        this.canvasHoverElement.style.width = '1px';
                        this.canvasHoverElement.style.height = '1px';
                        this.canvasHoverElement.style.opacity = '0';
                        this.canvasHoverElement.style.zIndex = '-1';
                        document.body.appendChild(this.canvasHoverElement);
                    }
                    
                    // Update position and DID
                    this.canvasHoverElement.style.left = `${e.clientX}px`;
                    this.canvasHoverElement.style.top = `${e.clientY}px`;
                    this.canvasHoverElement.setAttribute('data-dreamer-did', hovered.did);
                    
                    // Show the hover card
                    this.dreamerHoverWidget.show(this.canvasHoverElement, hovered.did);
                } else if (this.canvasHoverElement) {
                    // Same dreamer, just update position
                    this.canvasHoverElement.style.left = `${e.clientX}px`;
                    this.canvasHoverElement.style.top = `${e.clientY}px`;
                }
            } else {
                // No dreamer hovered, clear tracking
                if (this.lastHoveredDid !== null) {
                    this.lastHoveredDid = null;
                    this.dreamerHoverWidget.hide();
                    if (this.canvasHoverElement) {
                        this.canvasHoverElement.remove();
                        this.canvasHoverElement = null;
                    }
                }
            }
        });
        
        // Hide hover card when mouse leaves canvas
        this.canvas.addEventListener('mouseleave', () => {
            if (this.dreamerHoverWidget) {
                this.lastHoveredDid = null;
                this.dreamerHoverWidget.hide();
                if (this.canvasHoverElement) {
                    this.canvasHoverElement.remove();
                    this.canvasHoverElement = null;
                }
            }
        });
    }
}

// Export to window
window.SpectrumDeluxe = SpectrumDeluxe;
