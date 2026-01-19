if (typeof window.OCTANT_MODALITIES === 'undefined') {
    window.OCTANT_MODALITIES = {
        '+++': 'Flow',
        '++-': 'Experiment',
        '+-+': 'Command',
        '+--': 'Strategy',
        '-++': 'Peace',
        '-+-': 'Wisdom',
        '--+': 'Order',
        '---': 'Guard'
    };
}
if (typeof window.OCTANT_RGB === 'undefined') {
    window.OCTANT_RGB = {
        '+++': { r: 100, g: 255, b: 200 },
        '++-': { r: 100, g: 200, b: 255 },
        '+-+': { r: 255, g: 180, b: 100 },  // prepared - orange
        '+--': { r: 255, g: 100, b: 150 },  // intended - red
        '-++': { r: 255, g: 150, b: 255 },
        '-+-': { r: 150, g: 150, b: 255 },
        '--+': { r: 255, g: 255, b: 100 },
        '---': { r: 200, g: 100, b: 255 },
        'confused': { r: 127, g: 125, b: 105 },  // #7F7D69
        'uncertain': { r: 65, g: 65, b: 65 },    // #414141
        'equilibrium': { r: 200, g: 200, b: 200 }
    };
}
if (typeof window.OCTANT_COLORS === 'undefined') {
    window.OCTANT_COLORS = {
        '+++': 'rgb(100, 255, 200)',
        '++-': 'rgb(100, 200, 255)',
        '+-+': 'rgb(255, 180, 100)',  // prepared - orange
        '+--': 'rgb(255, 100, 150)',  // intended - red
        '-++': 'rgb(255, 150, 255)',
        '-+-': 'rgb(150, 150, 255)',
        '--+': 'rgb(255, 255, 100)',
        '---': 'rgb(200, 100, 255)',
        'confused': 'rgb(127, 125, 105)',  // #7F7D69
        'uncertain': 'rgb(65, 65, 65)',    // #414141
        'equilibrium': 'rgb(200, 200, 200)'
    };
}
if (typeof window.ROTATION_LIMIT === 'undefined') {
    window.ROTATION_LIMIT = Math.PI * 0.4;
}
if (typeof window.MOMENTUM_FRICTION === 'undefined') {
    window.MOMENTUM_FRICTION = 0.95;
}
if (typeof window.MOMENTUM_THRESHOLD === 'undefined') {
    window.MOMENTUM_THRESHOLD = 0.0001;
}
const OCTANT_MODALITIES = window.OCTANT_MODALITIES;
const OCTANT_RGB = window.OCTANT_RGB;
const OCTANT_COLORS = window.OCTANT_COLORS;
const ROTATION_LIMIT = window.ROTATION_LIMIT;
const MOMENTUM_FRICTION = window.MOMENTUM_FRICTION;
const MOMENTUM_THRESHOLD = window.MOMENTUM_THRESHOLD;
class SpectrumVisualizer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isTouchDevice = this.detectTouchDevice();
        this.userColor = options.userColor || '#734ba1';
        this.options = {
            showLabels: options.showLabels !== false,
            showAllNames: options.showAllNames || this.isTouchDevice,
            filterDreamers: options.filterDreamers || null,
            initialZoom: options.initialZoom || 1.2,
            showControls: options.showControls !== false,
            onNameClick: options.onNameClick || null,
            onDotClick: options.onDotClick || null,
            userColor: options.userColor || '#734ba1'
        };
        this.currentView = '3d';
        this.miniProfile = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.camera = {
            rotX: 0.3,
            rotY: 0.5,
            zoom: this.options.initialZoom,
            autoRotate: true,
            velocityX: 0,
            velocityY: 0
        };
        this.stillnessTimer = 0;
        this.stillnessThreshold = 8;
        this.isStill = false;
        this.cameraTween = {
            active: false,
            startRotX: 0,
            startRotY: 0,
            targetRotX: 0,
            targetRotY: 0,
            progress: 0,
            duration: 0.8
        };
        this.zoomTween = {
            active: false,
            startZoom: 0,
            targetZoom: 0,
            progress: 0,
            duration: 0.6
        };
        this.mouse = { x: 0, y: 0, down: false, lastX: 0, lastY: 0, lastTime: 0 };
        this.hoveredDreamer = null;
        this.labelBounds = [];
        this.time = 0;
        this.dreamers = [];
        this.octantDreamers = {};
        this.zones = [];
        this.liveUpdateInterval = options.liveUpdateInterval || 120000;
        this.liveUpdateEnabled = options.liveUpdate !== false;
        this.lastUpdateTime = Date.now();
        this.guardianRules = null;
        this.aggregateBarred = null;
        if (this.options.showControls) {
            this.createControlPanel();
        }
        this.loadGuardianRules().then(() => this.loadDreamers());
        this.loadZones();
        this.setupControls();
        if (this.options.showControls && typeof MiniProfile !== 'undefined') {
            this.miniProfile = new MiniProfile(SpectrumVisualizer);
        }
        if (this.liveUpdateEnabled) {
            this.startLiveUpdates();
        }
        this.animate();
    }
    detectTouchDevice() {
        const hasTouch = (
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0)
        );
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        return hasTouch || isIOS || isIPadOS;
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.width || 600;
        const height = rect.height || this.canvas.height || 600;
        if (width > 0 && height > 0) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.centerX = this.canvas.width / 2;
            
            // Calculate centerY to align with viewport center
            // The canvas position is offset by margins, but we want to render at viewport center
            const viewportHeight = window.innerHeight;
            const viewportCenter = viewportHeight / 2;
            const canvasTop = rect.top;
            
            // Calculate offset from canvas top to viewport center
            const offsetFromCanvasTop = viewportCenter - canvasTop;
            
            // Always use viewport-aligned center if it falls within canvas bounds
            // This accounts for the asymmetric CSS layout (20px top, -130px bottom)
            if (offsetFromCanvasTop >= 0 && offsetFromCanvasTop <= height) {
                this.centerY = offsetFromCanvasTop;
            } else {
                // Fallback to canvas center if viewport center is outside canvas
                this.centerY = this.canvas.height / 2;
            }
        } else {
            console.warn('⚠️ [SpectrumVisualizer] Canvas has 0 dimensions, using fallback');
            this.canvas.width = 600;
            this.canvas.height = 600;
            this.centerX = 300;
            this.centerY = 300;
        }
    }
    createControlPanel() {
        let sidebar = this.canvas.parentElement.querySelector('.sidebar');
        if (!sidebar) {
            sidebar = document.querySelector('.sidebar');
        }
        if (!sidebar) return;
        const panel = document.createElement('div');
        panel.className = 'view-control-section';
        panel.innerHTML = `
            <div class="view-section-title">Controls</div>
            <button class="control-btn ${this.options.showLabels ? 'active' : ''}" id="toggleLabels" style="margin-bottom: 12px;">
                <span class="control-label">Axis Names</span>
            </button>
            <button class="control-btn ${this.options.showAllNames ? 'active' : ''}" id="toggleAllNames" style="margin-bottom: 12px; display: ${this.isTouchDevice ? 'none' : 'block'};">
                <span class="control-label">Dreamer Names</span>
            </button>
            <button class="control-btn" id="fitZoom" style="margin-bottom: 18px;">
                <span class="control-label">Fit Zoom</span>
            </button>
            <div style="height: 24px;"></div>
            <div class="view-section-title">Perspective</div>
            <div class="view-buttons">
                <button class="view-btn active" data-view="3d">
                    <span class="view-label">Balance</span>
                </button>
                <button class="view-btn" data-view="power-structure">
                    <span class="view-label">Force</span>
                </button>
                <button class="view-btn" data-view="belief-agency">
                    <span class="view-label">Agency</span>
                </button>
                <button class="view-btn" data-view="change-freedom">
                    <span class="view-label">Position</span>
                </button>
            </div>
        `;
        sidebar.insertBefore(panel, sidebar.firstChild);
        const toggleLabels = panel.querySelector('#toggleLabels');
        toggleLabels.addEventListener('click', () => {
            this.options.showLabels = !this.options.showLabels;
            toggleLabels.classList.toggle('active', this.options.showLabels);
        });
        const toggleAllNames = panel.querySelector('#toggleAllNames');
        toggleAllNames.addEventListener('click', () => {
            if (this.isTouchDevice) {
                return;
            }
            this.options.showAllNames = !this.options.showAllNames;
            toggleAllNames.classList.toggle('active', this.options.showAllNames);
        });
        const fitZoom = panel.querySelector('#fitZoom');
        fitZoom.addEventListener('click', () => {
            this.fitZoomToDreamers();
        });
        const viewButtons = panel.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.snapToView(view);
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
    createHeadingPanel() {
        const checkAndCreatePanel = () => {
            const session = window.oauthManager?.getSession();
            if (!session || !session.handle) {
                return;
            }
            if (!session.handle.endsWith('.reverie.house') && session.handle !== 'reverie.house') {
                return;
            }
            const canvasContainer = this.canvas.parentElement;
            if (!canvasContainer) return;
            
            // Only create heading panel in drawer, not in deluxe mode
            if (canvasContainer.closest('.deluxe-mode')) {
                return;
            }
            
            if (canvasContainer.querySelector('.spectrum-heading-banner')) {
                return;
            }
            const headingBanner = document.createElement('div');
            headingBanner.className = 'spectrum-heading-banner';
            const avatarUrl = session.avatar || '/assets/icon_face.png';
            const displayName = session.displayName || session.handle;
            headingBanner.innerHTML = `
                <div class="heading-banner-content">
                    <div class="heading-user-section">
                        <img src="${avatarUrl}" alt="${displayName}" class="heading-avatar" onerror="this.src='/assets/icon_face.png'">
                        <div class="heading-user-text">
                            <div class="heading-user-name">${displayName}</div>
                            <div class="heading-current" id="headingCurrentDisplay">Loading heading...</div>
                        </div>
                    </div>
                    <div class="heading-controls-section">
                        <select id="headingSelect" class="heading-select">
                            <option value="">Drift</option>
                            <option value="home">Home</option>
                            <option value="origin">Origin</option>
                            <option value="affix">Affix</option>
                            <option value="keeper">Reverie House</option>
                            <optgroup label="Axes">
                                <option value="entropy">Entropy</option>
                                <option value="oblivion">Oblivion</option>
                                <option value="liberty">Liberty</option>
                                <option value="authority">Authority</option>
                                <option value="receptive">Receptive</option>
                                <option value="skeptic">Skeptic</option>
                            </optgroup>
                            <optgroup label="Toward Dreamer">
                                <option value="dreamer:select">Select Dreamer...</option>
                            </optgroup>
                        </select>
                        <button id="headingConfirmBtn" class="heading-confirm-btn" disabled>Confirm</button>
                    </div>
                </div>
                <div id="headingStatus" class="heading-status"></div>
                <div id="dreamerSearchContainer" class="dreamer-search-container" style="display: none;">
                    <input type="text" id="dreamerSearchInput" placeholder="Type to search dreamers..." class="dreamer-search-input">
                    <div id="dreamerSearchResults" class="dreamer-search-results"></div>
                </div>
            `;
            if (!document.getElementById('spectrum-heading-styles')) {
                const styles = document.createElement('style');
                styles.id = 'spectrum-heading-styles';
                styles.textContent = `
                    .spectrum-heading-banner {
                        background: linear-gradient(135deg, rgba(139, 123, 168, 0.08), rgba(107, 79, 161, 0.08));
                        border-bottom: 2px solid #8b7ba8;
                        padding: 16px 20px;
                        margin-bottom: 16px;
                    }
                    .heading-banner-content {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        flex-wrap: wrap;
                    }
                    .heading-user-section {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex: 0 0 auto;
                    }
                    .heading-avatar {
                        width: 56px;
                        height: 56px;
                        border-radius: 50%;
                        border: 3px solid #8b7ba8;
                        object-fit: cover;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    .heading-user-text {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .heading-user-name {
                        font-weight: 700;
                        font-size: 1.1rem;
                        color: #372e42;
                    }
                    .heading-current {
                        font-size: 0.85rem;
                        color: #6b4fa1;
                        font-family: monospace;
                        font-weight: 600;
                    }
                    .heading-controls-section {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex: 1 1 auto;
                        min-width: 0;
                    }
                    .heading-select {
                        flex: 1;
                        padding: 10px 12px;
                        border: 2px solid #8b7ba8;
                        border-radius: 8px;
                        background: #fff;
                        color: #372e42;
                        font-family: monospace;
                        font-size: 0.9rem;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        min-width: 200px;
                    }
                    .heading-select:hover {
                        border-color: #6b4fa1;
                        box-shadow: 0 2px 8px rgba(107, 79, 161, 0.15);
                    }
                    .heading-select:focus {
                        outline: none;
                        border-color: #6b4fa1;
                        box-shadow: 0 0 0 3px rgba(107, 79, 161, 0.1);
                    }
                    .heading-confirm-btn {
                        padding: 10px 24px;
                        background: #6b4fa1;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 0.9rem;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                    }
                    .heading-confirm-btn:hover:not(:disabled) {
                        background: #5a3f8a;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(107, 79, 161, 0.3);
                    }
                    .heading-confirm-btn:active:not(:disabled) {
                        transform: translateY(0);
                    }
                    .heading-confirm-btn:disabled {
                        background: #ccc;
                        cursor: not-allowed;
                        opacity: 0.6;
                    }
                    .heading-status {
                        font-size: 0.8rem;
                        color: #8b7ba8;
                        margin-top: 12px;
                        text-align: center;
                        min-height: 1.2rem;
                    }
                    .dreamer-search-container {
                        margin-top: 12px;
                        border-top: 1px solid #e0d4e8;
                        padding-top: 12px;
                    }
                    .dreamer-search-input {
                        width: 100%;
                        padding: 10px 12px;
                        border: 2px solid #8b7ba8;
                        border-radius: 8px;
                        font-family: monospace;
                        font-size: 0.9rem;
                    }
                    .dreamer-search-input:focus {
                        outline: none;
                        border-color: #6b4fa1;
                        box-shadow: 0 0 0 3px rgba(107, 79, 161, 0.1);
                    }
                    .dreamer-search-results {
                        max-height: 200px;
                        overflow-y: auto;
                        margin-top: 8px;
                        background: white;
                        border: 1px solid #e0d4e8;
                        border-radius: 6px;
                    }
                    .dreamer-result-item {
                        padding: 10px 12px;
                        cursor: pointer;
                        transition: background 0.15s;
                        border-bottom: 1px solid #f0f0f0;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .dreamer-result-item:last-child {
                        border-bottom: none;
                    }
                    .dreamer-result-item:hover {
                        background: #f5f3f7;
                    }
                    .dreamer-result-avatar {
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        border: 1px solid #e0d4e8;
                        object-fit: cover;
                    }
                    .dreamer-result-text {
                        flex: 1;
                        min-width: 0;
                    }
                    .dreamer-result-name {
                        font-weight: 600;
                        font-size: 0.9rem;
                        color: #372e42;
                    }
                    .dreamer-result-handle {
                        font-size: 0.75rem;
                        color: #999;
                    }
                    @media (max-width: 768px) {
                        .heading-banner-content {
                            flex-direction: column;
                            align-items: stretch;
                        }
                        .heading-user-section {
                            justify-content: center;
                        }
                        .heading-controls-section {
                            flex-direction: column;
                        }
                        .heading-select {
                            width: 100%;
                        }
                        .heading-confirm-btn {
                            width: 100%;
                        }
                    }
                `;
                document.head.appendChild(styles);
            }
            canvasContainer.style.position = 'relative';
            canvasContainer.style.paddingTop = '0';
            canvasContainer.insertBefore(headingBanner, canvasContainer.firstChild);
            this.canvas.style.marginTop = '0';
            this.originalHeading = null;
            this.selectedDreamerDid = null;
            this.loadCurrentHeading(session.did, session);
            const select = document.getElementById('headingSelect');
            const confirmBtn = document.getElementById('headingConfirmBtn');
            const searchContainer = document.getElementById('dreamerSearchContainer');
            const searchInput = document.getElementById('dreamerSearchInput');
            const searchResults = document.getElementById('dreamerSearchResults');
            select.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'dreamer:select') {
                    searchContainer.style.display = 'block';
                    searchInput.focus();
                    this.loadDreamerSearch();
                } else {
                    searchContainer.style.display = 'none';
                    this.selectedDreamerDid = null;
                }
                const currentSelection = value.startsWith('did:') ? this.selectedDreamerDid : value;
                confirmBtn.disabled = (currentSelection === this.originalHeading);
            });
            searchInput.addEventListener('input', (e) => {
                this.filterDreamers(e.target.value);
            });
            confirmBtn.addEventListener('click', () => {
                const value = select.value;
                let headingToSet = value;
                if (value === 'dreamer:select' && this.selectedDreamerDid) {
                    headingToSet = this.selectedDreamerDid;
                }
                this.setHeading(session.did, headingToSet, session);
            });
        };
        checkAndCreatePanel();
        window.addEventListener('oauth:login', checkAndCreatePanel);
        window.addEventListener('oauth:profile-loaded', checkAndCreatePanel);
    }
    async loadDreamerSearch() {
        try {
            const response = await fetch('/api/dreamers');
            this.allDreamers = await response.json();
            this.filterDreamers('');
        } catch (error) {
            console.error('Failed to load dreamers:', error);
        }
    }
    filterDreamers(searchTerm) {
        const searchResults = document.getElementById('dreamerSearchResults');
        if (!searchResults || !this.allDreamers) return;
        const term = searchTerm.toLowerCase();
        const filtered = this.allDreamers.filter(d => 
            d.name.toLowerCase().includes(term) || 
            d.handle.toLowerCase().includes(term) ||
            (d.display_name && d.display_name.toLowerCase().includes(term))
        ).slice(0, 10);
        if (filtered.length === 0) {
            searchResults.innerHTML = '<div style="padding: 12px; text-align: center; color: #999;">No dreamers found</div>';
            return;
        }
        searchResults.innerHTML = filtered.map(d => `
            <div class="dreamer-result-item" data-did="${d.did}" data-name="${d.display_name || d.name}">
                <img src="${d.avatar || '/assets/icon_face.png'}" class="dreamer-result-avatar" onerror="this.src='/assets/icon_face.png'">
                <div class="dreamer-result-text">
                    <div class="dreamer-result-name">${d.display_name || d.name}</div>
                    <div class="dreamer-result-handle">@${d.handle}</div>
                </div>
            </div>
        `).join('');
        searchResults.querySelectorAll('.dreamer-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const did = item.dataset.did;
                const name = item.dataset.name;
                this.selectedDreamerDid = did;
                const select = document.getElementById('headingSelect');
                const searchContainer = document.getElementById('dreamerSearchContainer');
                const confirmBtn = document.getElementById('headingConfirmBtn');
                let option = select.querySelector(`option[value="did:${did}"]`);
                if (!option) {
                    option = document.createElement('option');
                    option.value = 'dreamer:select';
                    option.textContent = `→ ${name}`;
                    select.querySelector('optgroup[label="Toward Dreamer"]').appendChild(option);
                }
                select.value = 'dreamer:select';
                option.textContent = `→ ${name}`;
                searchContainer.style.display = 'none';
                confirmBtn.disabled = false;
            });
        });
    }
    async loadCurrentHeading(did, session) {
        const currentDisplay = document.getElementById('headingCurrentDisplay');
        const select = document.getElementById('headingSelect');
        const confirmBtn = document.getElementById('headingConfirmBtn');
        if (!currentDisplay || !select) return;
        currentDisplay.textContent = 'Loading...';
        try {
            const response = await fetch('/api/heading/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ did })
            });
            const data = await response.json();
            if (data.success) {
                this.originalHeading = data.heading || '';
                const headingDisplay = this.formatHeadingDisplay(data.heading);
                currentDisplay.textContent = `Current: ${headingDisplay}`;
                if (data.heading && data.heading.startsWith('did:')) {
                    this.loadDreamerName(data.heading, select);
                } else {
                    select.value = data.heading || '';
                }
                confirmBtn.disabled = true;
            } else {
                currentDisplay.textContent = 'Error loading heading';
                currentDisplay.style.color = '#d9534f';
            }
        } catch (error) {
            console.error('Failed to load heading:', error);
            currentDisplay.textContent = 'Error loading heading';
            currentDisplay.style.color = '#d9534f';
        }
    }
    async loadDreamerName(did, select) {
        try {
            const response = await fetch('/api/dreamers');
            const dreamers = await response.json();
            const dreamer = dreamers.find(d => d.did === did);
            if (dreamer) {
                const name = dreamer.display_name || dreamer.name;
                const option = document.createElement('option');
                option.value = 'dreamer:select';
                option.textContent = `→ ${name}`;
                select.querySelector('optgroup[label="Toward Dreamer"]').appendChild(option);
                select.value = 'dreamer:select';
                this.selectedDreamerDid = did;
            }
        } catch (error) {
            console.error('Failed to load dreamer name:', error);
        }
    }
    formatHeadingDisplay(heading) {
        if (!heading) return 'Drift';
        if (heading === 'keeper') return 'Reverie House';
        if (heading === 'affix') return 'Affix';
        if (heading === 'home') return 'Home';
        if (heading === 'origin') return 'Origin';
        if (heading.endsWith('+')) {
            const axis = heading.slice(0, -1);
            return axis.charAt(0).toUpperCase() + axis.slice(1);
        }
        if (heading.startsWith('did:')) return 'Dreamer';
        return heading.charAt(0).toUpperCase() + heading.slice(1);
    }
    async setHeading(did, heading, session) {
        const statusDiv = document.getElementById('headingStatus');
        const confirmBtn = document.getElementById('headingConfirmBtn');
        const currentDisplay = document.getElementById('headingCurrentDisplay');
        if (!statusDiv) return;
        statusDiv.textContent = 'Saving heading...';
        statusDiv.style.color = '#8b7ba8';
        confirmBtn.disabled = true;
        try {
            const response = await fetch('/api/heading/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    did, 
                    heading: heading || null,
                    name: session.displayName || session.handle
                })
            });
            const data = await response.json();
            if (data.success) {
                this.originalHeading = heading || '';
                const headingDisplay = this.formatHeadingDisplay(heading);
                currentDisplay.textContent = `Current: ${headingDisplay}`;
                statusDiv.textContent = '✓ Heading saved to canon';
                statusDiv.style.color = '#5cb85c';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            } else {
                statusDiv.textContent = '✗ ' + (data.error || 'Failed to save');
                statusDiv.style.color = '#d9534f';
                confirmBtn.disabled = false;
            }
        } catch (error) {
            console.error('Failed to set heading:', error);
            statusDiv.textContent = '✗ Error saving';
            statusDiv.style.color = '#d9534f';
            confirmBtn.disabled = false;
        }
    }
    snapToView(view) {
        this.camera.autoRotate = false;
        this.camera.velocityX = 0;
        this.camera.velocityY = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        switch(view) {
            case '3d':
                targetRotX = 0.3;
                targetRotY = 0.5;
                this.camera.autoRotate = true;
                this.currentView = '3d';
                break;
            case 'power-structure':
                targetRotX = 0;
                targetRotY = 0;
                this.currentView = 'xy';
                break;
            case 'belief-agency':
                targetRotX = 0;
                targetRotY = Math.PI / 2;
                this.currentView = 'yz';
                break;
            case 'change-freedom':
                targetRotX = Math.PI / 2;
                targetRotY = 0;
                this.currentView = 'xz';
                break;
        }
        const currentRotY = this.camera.rotY;
        const rotYDiff = targetRotY - (currentRotY % (Math.PI * 2));
        if (rotYDiff > Math.PI) {
            targetRotY = currentRotY - (Math.PI * 2 - rotYDiff);
        } else if (rotYDiff < -Math.PI) {
            targetRotY = currentRotY + (Math.PI * 2 + rotYDiff);
        } else {
            targetRotY = currentRotY + rotYDiff;
        }
        this.cameraTween.active = true;
        this.cameraTween.startRotX = this.camera.rotX;
        this.cameraTween.startRotY = this.camera.rotY;
        this.cameraTween.targetRotX = targetRotX;
        this.cameraTween.targetRotY = targetRotY;
        this.cameraTween.progress = 0;
    }
    shouldShowLabel(label) {
        if (this.currentView === '3d') return true;
        switch(this.currentView) {
            case 'xy':
                return label !== 'Receptive' && label !== 'Skeptic';
            case 'xz':
                return label !== 'Authority' && label !== 'Liberty';
            case 'yz':
                return label !== 'Entropy' && label !== 'Oblivion';
            default:
                return true;
        }
    }
    fitZoomToDreamers() {
        if (this.dreamers.length === 0) return;
        if (this.dreamers.length === 1) {
            this.zoomTween.active = true;
            this.zoomTween.startZoom = this.camera.zoom;
            this.zoomTween.targetZoom = 1.2;
            this.zoomTween.progress = 0;
            return;
        }
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        this.dreamers.forEach(d => {
            minX = Math.min(minX, d.x);
            maxX = Math.max(maxX, d.x);
            minY = Math.min(minY, d.y);
            maxY = Math.max(maxY, d.y);
            minZ = Math.min(minZ, d.z);
            maxZ = Math.max(maxZ, d.z);
        });
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const rangeZ = maxZ - minZ;
        const maxRange = Math.max(rangeX, rangeY, rangeZ);
        if (maxRange < 10) {
            this.zoomTween.active = true;
            this.zoomTween.startZoom = this.camera.zoom;
            this.zoomTween.targetZoom = 1.5;
            this.zoomTween.progress = 0;
            return;
        }
        const canvasSize = Math.min(this.canvas.width, this.canvas.height);
        const targetScale = (canvasSize * 0.65) / maxRange;
        const targetZoom = targetScale / 2.5;
        const maxZoom = canvasSize < 500 ? 4.0 : 3.5;
        const clampedZoom = Math.max(0.8, Math.min(maxZoom, targetZoom));
        this.zoomTween.active = true;
        this.zoomTween.startZoom = this.camera.zoom;
        this.zoomTween.targetZoom = clampedZoom;
        this.zoomTween.progress = 0;
    }
    async loadGuardianRules() {
        try {
            const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
            
            if (token) {
                // Logged-in user: check if they're a ward/charge
                const response = await fetch('/api/guardian/my-rules', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    this.guardianRules = await response.json();
                    if (this.guardianRules?.has_guardian) {
                    }
                }
                
                // Check if user has community shield enabled
                let shieldEnabled = true; // Default to ON
                try {
                    const shieldResponse = await fetch('/api/user/shield', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (shieldResponse.ok) {
                        const shieldData = await shieldResponse.json();
                        shieldEnabled = shieldData.community_shield !== false;
                    }
                } catch (e) {
                    console.warn('[Spectrum] Failed to check shield status:', e);
                }
                
                // If shield is enabled, also load aggregate barred list
                if (shieldEnabled) {
                    const aggregateResponse = await fetch('/api/guardian/aggregate-barred');
                    if (aggregateResponse.ok) {
                        this.aggregateBarred = await aggregateResponse.json();
                    }
                } else {
                    this.aggregateBarred = null;
                }
            } else {
                // Guest user: load aggregate barred list
                this.guardianRules = null;
                const response = await fetch('/api/guardian/aggregate-barred');
                
                if (response.ok) {
                    this.aggregateBarred = await response.json();
                    if (this.aggregateBarred?.barred_dids?.length > 0) {
                    }
                }
            }
        } catch (error) {
            console.warn('[Spectrum] Failed to load guardian rules:', error);
            this.guardianRules = null;
            this.aggregateBarred = null;
        }
    }
    filterDreamersByGuardian(dreamers) {
        if (!dreamers || dreamers.length === 0) return dreamers;
        
        let beforeCount = dreamers.length;
        
        // Always apply user's own barred users first (user as their own guardian)
        if (this.guardianRules?.own_barred_dids?.length > 0) {
            const ownBarredDids = new Set(this.guardianRules.own_barred_dids);
            dreamers = dreamers.filter(d => !ownBarredDids.has(d.did));
            beforeCount = dreamers.length;
        }
        
        // Logged-in ward/charge filtering (guardian relationship)
        if (this.guardianRules?.has_guardian) {
            if (this.guardianRules.filter_mode === 'whitelist') {
                const allowedDids = new Set(this.guardianRules.filter_dids);
                dreamers = dreamers.filter(d => allowedDids.has(d.did));
            } else if (this.guardianRules.filter_mode === 'blacklist') {
                const barredDids = new Set(this.guardianRules.filter_dids);
                dreamers = dreamers.filter(d => !barredDids.has(d.did));
            }
            // Note: still apply aggregate below if shield is on
        }
        
        // Aggregate barred filtering (for guests AND logged-in users with Community Shield ON)
        if (this.aggregateBarred?.barred_dids?.length > 0) {
            const barredDids = new Set(this.aggregateBarred.barred_dids);
            dreamers = dreamers.filter(d => !barredDids.has(d.did));
        }
        
        return dreamers;
    }
    async loadDreamers() {
        try {
            const response = await fetch('/api/dreamers');
            const dreamersData = await response.json();
            let filteredData = dreamersData.filter(d => d.spectrum);
            
            // Apply guardian filtering
            filteredData = this.filterDreamersByGuardian(filteredData);
            
            if (this.options.filterDreamers && Array.isArray(this.options.filterDreamers)) {
                filteredData = filteredData.filter(d => 
                    this.options.filterDreamers.includes(d.name) || 
                    this.options.filterDreamers.includes(d.display_name) ||
                    this.options.filterDreamers.includes(d.handle)
                );
            }
            const oldPositions = {};
            if (this.dreamers) {
                this.dreamers.forEach(d => {
                    oldPositions[d.handle] = { x: d.x, y: d.y, z: d.z, targetX: d.targetX, targetY: d.targetY, targetZ: d.targetZ };
                });
            }
            this.dreamers = filteredData.map(d => {
                const s = d.spectrum;
                const targetX = s.entropy - s.oblivion;
                const targetY = s.liberty - s.authority;
                const targetZ = s.receptive - s.skeptic;
                const oldPos = oldPositions[d.handle];
                let currentX, currentY, currentZ;
                if (oldPos) {
                    currentX = oldPos.targetX !== undefined ? oldPos.x : oldPos.x;
                    currentY = oldPos.targetY !== undefined ? oldPos.y : oldPos.y;
                    currentZ = oldPos.targetZ !== undefined ? oldPos.z : oldPos.z;
                } else {
                    currentX = targetX;
                    currentY = targetY;
                    currentZ = targetZ;
                }
                return {
                    name: d.display_name || d.name,
                    handle: d.handle,
                    did: d.did,
                    avatar: d.avatar,
                    description: d.description,
                    display_name: d.display_name,
                    arrival: d.arrival,
                    spectrum: s,
                    kindred: d.kindred,
                    souvenirs: d.souvenirs || {},
                    x: currentX,
                    y: currentY,
                    z: currentZ,
                    targetX: targetX,
                    targetY: targetY,
                    targetZ: targetZ,
                    phase: oldPos ? oldPositions[d.handle].phase || Math.random() * Math.PI * 2 : Math.random() * Math.PI * 2
                };
            });
            this.categorizeDreamers();
            if (!this.hasLoadedOnce) {
                setTimeout(() => {
                    this.fitZoomToDreamers();
                }, 100);
                this.hasLoadedOnce = true;
            }
            this.lastUpdateTime = Date.now();
        } catch (error) {
            console.error('Failed to load dreamers:', error);
        }
    }
    async loadZones() {
        try {
            const response = await fetch('/api/zones');
            const zonesData = await response.json();
            this.zones = zonesData.map(z => {
                let color = z.color;
                if (typeof color === 'string') {
                    try {
                        color = JSON.parse(color);
                    } catch (e) {
                        color = {r: 120, g: 120, b: 120, a: 0.15};
                    }
                }
                return {
                    ...z,
                    color: color || {r: 120, g: 120, b: 120, a: 0.15}
                };
            });
        } catch (error) {
            console.error('Failed to load zones:', error);
        }
    }
    startLiveUpdates() {
        this.liveUpdateTimer = setInterval(() => {
            this.loadDreamers();
        }, this.liveUpdateInterval);
    }
    stopLiveUpdates() {
        if (this.liveUpdateTimer) {
            clearInterval(this.liveUpdateTimer);
            this.liveUpdateTimer = null;
        }
    }
    setLiveUpdateInterval(milliseconds) {
        this.liveUpdateInterval = milliseconds;
        if (this.liveUpdateEnabled && this.liveUpdateTimer) {
            this.stopLiveUpdates();
            this.startLiveUpdates();
        }
    }
    categorizeDreamers() {
        this.octantDreamers = {
            '+++': [],
            '++-': [],
            '+-+': [],
            '+--': [],
            '-++': [],
            '-+-': [],
            '--+': [],
            '---': []
        };
        this.dreamers.forEach(d => {
            // Skip dreamers who are in equilibrium - they shouldn't be in any octant
            if (this.isNearCenter && this.isNearCenter(d)) {
                return;
            }
            
            const xSign = d.x > 0 ? '+' : '-';
            const ySign = d.y > 0 ? '+' : '-';
            const zSign = d.z > 0 ? '+' : '-';
            const key = xSign + ySign + zSign;
            this.octantDreamers[key].push(d);
        });
        this.updateOctantSidebar();
    }
    updateOctantSidebar() {
        const legendContainer = document.querySelector('.legend');
        if (legendContainer) {
            legendContainer.innerHTML = '';
            Object.keys(OCTANT_MODALITIES).forEach(key => {
                const modality = OCTANT_MODALITIES[key];
                const dreamers = this.octantDreamers[key];
                const leaderName = dreamers.length > 0 ? dreamers[0].name : '---';
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-color" style="background: ${OCTANT_COLORS[key]};"></div>
                    <div class="legend-text">
                        <div class="legend-label">${modality}</div>
                        <div class="legend-leader">${leaderName}</div>
                    </div>
                `;
                legendContainer.appendChild(item);
            });
        }
    }
    setupControls() {
        let touchStartDistance = 0;
        let touchStartZoom = 1;
        const handleDragStart = (clientX, clientY) => {
            this.mouse.down = true;
            this.mouse.lastX = clientX;
            this.mouse.lastY = clientY;
            this.mouse.lastTime = Date.now();
            this.mouse.hasDragged = false;
            this.camera.autoRotate = false;
            this.camera.velocityX = 0;
            this.camera.velocityY = 0;
            this.stillnessTimer = 0;
            this.isStill = false;
            this.cameraTween.active = false;
        };
        const handleDragMove = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            // Account for canvas scaling (displayed size vs internal resolution)
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (clientX - rect.left) * scaleX;
            this.mouse.y = (clientY - rect.top) * scaleY;
            if (this.mouse.down) {
                const currentTime = Date.now();
                const dt = Math.max(1, currentTime - this.mouse.lastTime);
                const dx = clientX - this.mouse.lastX;
                const dy = clientY - this.mouse.lastY;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    this.mouse.hasDragged = true;
                    if (this.currentView !== '3d') {
                        this.currentView = '3d';
                        const viewButtons = document.querySelectorAll('.view-btn');
                        viewButtons.forEach(btn => {
                            btn.classList.toggle('active', btn.dataset.view === '3d');
                        });
                    }
                }
                this.camera.velocityY = (dx * 0.01) / dt * 16;
                this.camera.velocityX = (dy * 0.01) / dt * 16;
                this.camera.rotY += dx * 0.01;
                this.camera.rotX += dy * 0.01;
                this.camera.rotX = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, this.camera.rotX));
                this.mouse.lastX = clientX;
                this.mouse.lastY = clientY;
                this.mouse.lastTime = currentTime;
            }
        };
        const handleDragEnd = () => {
            this.mouse.down = false;
            // Delay resetting hasDragged to allow click event to check it first
            setTimeout(() => {
                this.mouse.hasDragged = false;
            }, 10);
        };
        this.canvas.addEventListener('mousedown', (e) => {
            handleDragStart(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mousemove', (e) => {
            handleDragMove(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseup', handleDragEnd);
        this.canvas.addEventListener('mouseleave', handleDragEnd);
        const getTouchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                handleDragStart(touch.clientX, touch.clientY);
            } else if (e.touches.length === 2) {
                this.mouse.down = false;
                touchStartDistance = getTouchDistance(e.touches);
                touchStartZoom = this.camera.zoom;
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.mouse.down) {
                const touch = e.touches[0];
                handleDragMove(touch.clientX, touch.clientY);
            } else if (e.touches.length === 2) {
                const currentDistance = getTouchDistance(e.touches);
                const scale = currentDistance / touchStartDistance;
                this.camera.zoom = Math.max(0.5, Math.min(3.0, touchStartZoom * scale));
            }
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!this.mouse.hasDragged && e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const rect = this.canvas.getBoundingClientRect();
                const tapX = touch.clientX - rect.left;
                const tapY = touch.clientY - rect.top;
                this.handleCanvasClick(tapX, tapY);
            }
            handleDragEnd();
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            handleDragEnd();
        }, { passive: false });
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.zoom *= (1 - e.deltaY * 0.001);
            this.camera.zoom = Math.max(0.5, Math.min(3, this.camera.zoom));
            this.stillnessTimer = 0;
            this.isStill = false;
        });
        this.canvas.addEventListener('click', (e) => {
            // Don't trigger click if user was dragging
            if (this.mouse.hasDragged) {
                return;
            }
            
            const rect = this.canvas.getBoundingClientRect();
            // Account for canvas scaling (displayed size vs internal resolution)
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;
            this.handleCanvasClick(clickX, clickY);
        });
    }
    handleCanvasClick(clickX, clickY) {
        let clickedLabel = null;
        for (const label of this.labelBounds) {
            if (clickX >= label.x && clickX <= label.x + label.width &&
                clickY >= label.y && clickY <= label.y + label.height) {
                clickedLabel = label;
                break;
            }
        }
        if (clickedLabel && this.options.onNameClick) {
            this.options.onNameClick(clickedLabel.name);
            return;
        }
        let clickedDreamer = this.hoveredDreamer;
        if (!clickedDreamer) {
            let minDistance = Infinity;
            let closestDreamer = null;
            let closestRadius = 0;
            for (const dreamer of this.dreamers) {
                const pos = this.project3D(dreamer.x, dreamer.y, dreamer.z);
                const dx = clickX - pos.x;
                const dy = clickY - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const depthScale = 1 + (pos.z / 400);
                const clampedScale = Math.max(0.5, Math.min(1.5, depthScale));
                const baseRadius = 8 * clampedScale;
                const breath = Math.sin(this.time * 2 + dreamer.phase) * 0.15 + 1;
                const radius = baseRadius * breath;
                if (distance < minDistance) {
                    minDistance = distance;
                    closestDreamer = dreamer;
                    closestRadius = radius;
                }
            }
            if (closestDreamer && minDistance < closestRadius + 30) {
                clickedDreamer = closestDreamer;
            }
        }
        if (clickedDreamer) {
            if (this.options.onDotClick) {
                this.options.onDotClick(clickedDreamer);
            } else if (this.miniProfile) {
                this.miniProfile.show(clickedDreamer);
            }
        }
    }
    renderDreamerDot(ctx, pos, radius, clampedScale, color, isErrantson, isHovered) {
        if (isErrantson) {
            const bubbleGlowRadius = radius + (isHovered ? 12 : 8) * clampedScale;
            const bubbleGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, bubbleGlowRadius);
            bubbleGlow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${isHovered ? 0.25 : 0.15})`);
            bubbleGlow.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
            bubbleGlow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
            ctx.fillStyle = bubbleGlow;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, bubbleGlowRadius, 0, Math.PI * 2);
            ctx.fill();
            const bubbleGradient = ctx.createRadialGradient(
                pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.1,
                pos.x, pos.y, radius
            );
            bubbleGradient.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
            bubbleGradient.addColorStop(0.4, `rgba(${color.r * 0.3 + 255 * 0.7}, ${color.g * 0.3 + 255 * 0.7}, ${color.b * 0.3 + 255 * 0.7}, 0.85)`);
            bubbleGradient.addColorStop(1, `rgba(${color.r * 0.4 + 150 * 0.6}, ${color.g * 0.4 + 150 * 0.6}, ${color.b * 0.4 + 150 * 0.6}, 0.75)`);
            ctx.fillStyle = bubbleGradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
            const shineGradient = ctx.createRadialGradient(
                pos.x - radius * 0.35, pos.y - radius * 0.35, 0,
                pos.x - radius * 0.25, pos.y - radius * 0.25, radius * 0.65
            );
            shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
            shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = shineGradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = (isHovered ? 3.5 : 2.8) * clampedScale;
            ctx.stroke();
            const shadowGradient = ctx.createRadialGradient(
                pos.x + radius * 0.3, pos.y + radius * 0.3, 0,
                pos.x, pos.y, radius
            );
            shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            shadowGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
            shadowGradient.addColorStop(1, `rgba(${color.r * 0.3}, ${color.g * 0.3}, ${color.b * 0.3}, 0.15)`);
            ctx.fillStyle = shadowGradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const glowRadius = radius + (isHovered ? 15 : 8) * clampedScale;
            const gradient = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, glowRadius);
            gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
            gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isHovered ? '#ffffff' : `rgba(255, 255, 255, 0.6)`;
            ctx.lineWidth = (isHovered ? 3.5 : 2.8) * clampedScale;
            ctx.stroke();
        }
    }
    rotatePoint3D(x, y, z) {
        let cos = Math.cos(this.camera.rotY);
        let sin = Math.sin(this.camera.rotY);
        let x1 = x * cos - z * sin;
        let z1 = x * sin + z * cos;
        cos = Math.cos(this.camera.rotX);
        sin = Math.sin(this.camera.rotX);
        let y1 = y * cos - z1 * sin;
        let z2 = y * sin + z1 * cos;
        return { x: x1, y: y1, z: z2 };
    }
    project3D(x, y, z) {
        const rotated = this.rotatePoint3D(x, y, z);
        const scale = (400 / (400 + rotated.z)) * this.camera.zoom;
        return {
            x: this.centerX + rotated.x * scale,
            y: this.centerY - rotated.y * scale,
            z: rotated.z,
            scale: scale
        };
    }
    getOctantColor(x, y, z) {
        // Check for confused/uncertain/equilibrium states first
        const threshold = 0.1;
        
        // Count how many axes are near zero (balanced)
        let balancedCount = 0;
        if (Math.abs(x) < threshold) balancedCount++;
        if (Math.abs(y) < threshold) balancedCount++;
        if (Math.abs(z) < threshold) balancedCount++;
        
        // Equilibrium: all three axes balanced
        if (balancedCount === 3) {
            return OCTANT_RGB['equilibrium'];
        }
        
        // Singling/Uncertain: two axes balanced
        if (balancedCount === 2) {
            return OCTANT_RGB['uncertain'];
        }
        
        // Confused: one axis balanced
        if (balancedCount === 1) {
            return OCTANT_RGB['confused'];
        }
        
        // Standard octant color
        const xSign = x > 0 ? '+' : '-';
        const ySign = y > 0 ? '+' : '-';
        const zSign = z > 0 ? '+' : '-';
        const key = xSign + ySign + zSign;
        const baseColor = OCTANT_RGB[key];
        let { r, g, b } = baseColor;
        const distance = Math.sqrt(x*x + y*y + z*z);
        const maxDistance = 173;
        const intensity = Math.min(1, distance / maxDistance);
        const fade = 0.4 + (intensity * 0.6);
        r = Math.round(255 - (255 - r) * fade);
        g = Math.round(255 - (255 - g) * fade);
        b = Math.round(255 - (255 - b) * fade);
        return { r, g, b };
    }
    isPointInSphere(dreamer, zone) {
        const dx = dreamer.x - zone.center_coords.x;
        const dy = dreamer.y - zone.center_coords.y;
        const dz = dreamer.z - zone.center_coords.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        return distance <= zone.radius;
    }
    isPointInHull(dreamer, zone) {
        if (!zone.point_coords || zone.point_coords.length < 4) return false;
        const px = dreamer.x;
        const py = dreamer.y;
        const pz = dreamer.z;
        const points3D = zone.point_coords.map(p => ({
            x: (p.entropy || 0) - (p.oblivion || 0),
            y: (p.liberty || 0) - (p.authority || 0),
            z: (p.receptive || 0) - (p.skeptic || 0)
        }));
        const centroid = {
            x: points3D.reduce((sum, p) => sum + p.x, 0) / points3D.length,
            y: points3D.reduce((sum, p) => sum + p.y, 0) / points3D.length,
            z: points3D.reduce((sum, p) => sum + p.z, 0) / points3D.length
        };
        const n = points3D.length;
        const tolerance = 0.1;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    const p1 = points3D[i];
                    const p2 = points3D[j];
                    const p3 = points3D[k];
                    const v1x = p2.x - p1.x, v1y = p2.y - p1.y, v1z = p2.z - p1.z;
                    const v2x = p3.x - p1.x, v2y = p3.y - p1.y, v2z = p3.z - p1.z;
                    const nx = v1y * v2z - v1z * v2y;
                    const ny = v1z * v2x - v1x * v2z;
                    const nz = v1x * v2y - v1y * v2x;
                    const normalLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    if (normalLen < 0.001) continue;
                    let posCount = 0, negCount = 0;
                    for (let m = 0; m < n; m++) {
                        if (m === i || m === j || m === k) continue;
                        const p = points3D[m];
                        const dot = nx * (p.x - p1.x) + ny * (p.y - p1.y) + nz * (p.z - p1.z);
                        if (dot > tolerance) posCount++;
                        else if (dot < -tolerance) negCount++;
                    }
                    const isHullFace = (posCount === 0 || negCount === 0);
                    if (!isHullFace) continue;
                    const faceCenterX = (p1.x + p2.x + p3.x) / 3;
                    const faceCenterY = (p1.y + p2.y + p3.y) / 3;
                    const faceCenterZ = (p1.z + p2.z + p3.z) / 3;
                    const toCentroidX = centroid.x - faceCenterX;
                    const toCentroidY = centroid.y - faceCenterY;
                    const toCentroidZ = centroid.z - faceCenterZ;
                    const centroidDot = nx * toCentroidX + ny * toCentroidY + nz * toCentroidZ;
                    const pointDot = nx * (px - p1.x) + ny * (py - p1.y) + nz * (pz - p1.z);
                    if ((centroidDot > 0 && pointDot < -tolerance) || 
                        (centroidDot < 0 && pointDot > tolerance)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    animate() {
        this.time += 0.016;
        if (this.dreamers) {
            this.dreamers.forEach(d => {
                if (d.targetX !== undefined) {
                    const lerpFactor = 0.3;
                    d.x += (d.targetX - d.x) * lerpFactor;
                    d.y += (d.targetY - d.y) * lerpFactor;
                    d.z += (d.targetZ - d.z) * lerpFactor;
                    if (Math.abs(d.targetX - d.x) < 0.01) d.x = d.targetX;
                    if (Math.abs(d.targetY - d.y) < 0.01) d.y = d.targetY;
                    if (Math.abs(d.targetZ - d.z) < 0.01) d.z = d.targetZ;
                }
            });
        }
        if (this.cameraTween.active) {
            this.cameraTween.progress += 0.016 / this.cameraTween.duration;
            if (this.cameraTween.progress >= 1) {
                this.camera.rotX = this.cameraTween.targetRotX;
                this.camera.rotY = this.cameraTween.targetRotY;
                this.cameraTween.active = false;
            } else {
                const t = this.cameraTween.progress;
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.camera.rotX = this.cameraTween.startRotX + (this.cameraTween.targetRotX - this.cameraTween.startRotX) * eased;
                this.camera.rotY = this.cameraTween.startRotY + (this.cameraTween.targetRotY - this.cameraTween.startRotY) * eased;
                if (this.cameraTween.progress < 0.1 || this.cameraTween.progress > 0.9) {
                }
            }
        }
        if (this.zoomTween.active) {
            this.zoomTween.progress += 0.016 / this.zoomTween.duration;
            if (this.zoomTween.progress >= 1) {
                this.camera.zoom = this.zoomTween.targetZoom;
                this.zoomTween.active = false;
            } else {
                const t = this.zoomTween.progress;
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.camera.zoom = this.zoomTween.startZoom + (this.zoomTween.targetZoom - this.zoomTween.startZoom) * eased;
            }
        }
        if (!this.cameraTween.active) {
            if (this.camera.autoRotate) {
                this.camera.rotY += 0.003;
                this.stillnessTimer = 0;
                this.isStill = false;
            } else if (!this.mouse.down) {
                this.camera.rotY += this.camera.velocityY;
                this.camera.rotX += this.camera.velocityX;
                this.camera.rotX = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, this.camera.rotX));
                this.camera.velocityY *= MOMENTUM_FRICTION;
                this.camera.velocityX *= MOMENTUM_FRICTION;
                if (Math.abs(this.camera.velocityY) < MOMENTUM_THRESHOLD && Math.abs(this.camera.velocityX) < MOMENTUM_THRESHOLD) {
                    this.camera.velocityY = 0;
                    this.camera.velocityX = 0;
                }
                if (this.currentView === '3d' && this.camera.velocityY === 0 && this.camera.velocityX === 0) {
                    this.stillnessTimer += 0.016;
                    if (this.stillnessTimer >= this.stillnessThreshold && !this.isStill) {
                        this.isStill = true;
                    }
                    if (this.isStill) {
                        const rampDuration = 2;
                        const timeSinceStill = this.stillnessTimer - this.stillnessThreshold;
                        const rampProgress = Math.min(1, timeSinceStill / rampDuration);
                        const easedProgress = rampProgress * rampProgress;
                        const targetSpeed = 0.002;
                        this.camera.rotY += targetSpeed * easedProgress;
                    }
                } else {
                    this.stillnessTimer = 0;
                    this.isStill = false;
                }
            }
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.render();
        if (this.hoveredDreamer) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = this.mouse.down ? 'grabbing' : 'grab';
        }
        requestAnimationFrame(() => this.animate());
    }
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    render() {
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            console.warn('[SpectrumVisualizer] Canvas has zero dimensions!', {width: this.canvas.width, height: this.canvas.height});
            return;
        }
        this.ctx.save();
        const centerX = this.centerX;
        const centerY = this.centerY;
        const project = (x, y, z) => {
            const cosX = Math.cos(this.camera.rotX);
            const sinX = Math.sin(this.camera.rotX);
            const cosY = Math.cos(this.camera.rotY);
            const sinY = Math.sin(this.camera.rotY);
            let x1 = x * cosY + z * sinY;
            let z1 = -x * sinY + z * cosY;
            let y1 = y * cosX - z1 * sinX;
            let z2 = y * sinX + z1 * cosX;
            const scale = this.camera.zoom * 2.5;
            return {
                x: centerX + x1 * scale,
                y: centerY - y1 * scale,
                z: z2
            };
        };
        const axisLength = 2000;
        const labelDistance = 90;
        const origin = project(0, 0, 0);
        function axisLabelPos(axisVec) {
            const mag = Math.sqrt(axisVec[0]*axisVec[0] + axisVec[1]*axisVec[1] + axisVec[2]*axisVec[2]);
            const nx = axisVec[0] / mag;
            const ny = axisVec[1] / mag;
            const nz = axisVec[2] / mag;
            return project(nx * labelDistance, ny * labelDistance, nz * labelDistance);
        }
        const xNeg = project(-axisLength, 0, 0);
        const xPos = project(axisLength, 0, 0);
        const yNeg = project(0, -axisLength, 0);
        const yPos = project(0, axisLength, 0);
        const zNeg = project(0, 0, -axisLength);
        const zPos = project(0, 0, axisLength);
        const xNegLabel = axisLabelPos([-1,0,0]);
        const xPosLabel = axisLabelPos([1,0,0]);
        const yNegLabel = axisLabelPos([0,-1,0]);
        const yPosLabel = axisLabelPos([0,1,0]);
        const zNegLabel = axisLabelPos([0,0,-1]);
        const zPosLabel = axisLabelPos([0,0,1]);
        let axisSegments = [
            { from: xNeg, to: origin, z: (xNeg.z + origin.z) / 2, label: 'Oblivion', labelPos: xNegLabel },
            { from: origin, to: xPos, z: (origin.z + xPos.z) / 2, label: 'Entropy', labelPos: xPosLabel },
            { from: yNeg, to: origin, z: (yNeg.z + origin.z) / 2, label: 'Authority', labelPos: yNegLabel },
            { from: origin, to: yPos, z: (origin.z + yPos.z) / 2, label: 'Liberty', labelPos: yPosLabel },
            { from: zNeg, to: origin, z: (zNeg.z + origin.z) / 2, label: 'Skeptic', labelPos: zNegLabel },
            { from: origin, to: zPos, z: (origin.z + zPos.z) / 2, label: 'Receptive', labelPos: zPosLabel }
        ];
        let shouldHideYAxis = false;
        if (this.currentView === 'xz') {
            if (this.cameraTween.active) {
                shouldHideYAxis = this.cameraTween.progress > 0.5;
            } else {
                shouldHideYAxis = true;
            }
        }
        if (shouldHideYAxis) {
            axisSegments = axisSegments.filter(seg => seg.label !== 'Authority' && seg.label !== 'Liberty');
        }
        const dreamersWithPos = this.dreamers.map(d => {
            const pos = project(d.x, d.y, d.z);
            const zonesContaining = this.zones.filter(zone => {
                if (zone.type === 'sphere') {
                    return this.isPointInSphere(d, zone);
                } else if (zone.type === 'hull') {
                    return this.isPointInHull(d, zone);
                }
                return false;
            });
            return { dreamer: d, pos, zonesContaining };
        });
        this.zones.forEach(zone => {
            if (zone.type === 'sphere') {
                this.renderSphereZone(zone, project);
            } else if (zone.type === 'hull') {
                this.renderSimpleHullZone(zone, project);
            }
        });
        const renderQueue = [
            ...axisSegments.map(seg => ({ type: 'axis', data: seg, z: seg.z })),
            ...dreamersWithPos.map(d => ({ type: 'dreamer', data: d, z: d.pos.z })),
            { type: 'origin', data: origin, z: origin.z }
        ].sort((a, b) => a.z - b.z);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.hoveredDreamer = null;
        this.labelBounds = [];
        for (const item of renderQueue) {
            if (item.type === 'axis') {
                // Parse userColor to get rgba version
                const userColorRgba = this.userColor ? this.hexToRgba(this.userColor, 0.35) : 'rgba(115, 75, 161, 0.35)';
                this.ctx.strokeStyle = userColorRgba;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(item.data.from.x, item.data.from.y);
                this.ctx.lineTo(item.data.to.x, item.data.to.y);
                this.ctx.stroke();
                if (this.options.showLabels && this.shouldShowLabel(item.data.label)) {
                    const label = item.data.label;
                    const labelPos = item.data.labelPos;
                    const isVerticalAxis = (label === 'Authority' || label === 'Liberty');
                    const isHorizontalInPosition = (this.currentView === 'xz' && (label === 'Skeptic' || label === 'Receptive'));
                    if (isVerticalAxis || isHorizontalInPosition) {
                        this.ctx.save();
                        this.ctx.font = '600 11px monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillStyle = this.userColor || '#6b4fa1';
                        let fixedY;
                        if (label === 'Liberty' || label === 'Skeptic') {
                            fixedY = 20;
                        } else if (label === 'Authority' || label === 'Receptive') {
                            fixedY = this.canvas.height - 20;
                        }
                        const displayLabel = this.simplifiedLabels && this.simplifiedLabels[label] 
                            ? this.simplifiedLabels[label] 
                            : label;
                        this.ctx.fillText(displayLabel, centerX, fixedY);
                        this.ctx.restore();
                    } else {
                        if (this.currentView === '3d') {
                            const dx = item.data.to.x - item.data.from.x;
                            const dy = item.data.to.y - item.data.from.y;
                            let angle = Math.atan2(dy, dx);
                            if (angle > Math.PI / 2) {
                                angle -= Math.PI;
                            } else if (angle < -Math.PI / 2) {
                                angle += Math.PI;
                            }
                            this.ctx.save();
                            this.ctx.translate(labelPos.x, labelPos.y);
                            this.ctx.rotate(angle);
                            this.ctx.font = '600 11px monospace';
                            this.ctx.textAlign = 'center';
                            this.ctx.textBaseline = 'middle';
                            this.ctx.fillStyle = this.userColor || '#6b4fa1';
                            this.ctx.fillText(label, 0, -7);
                            this.ctx.restore();
                        } else {
                            this.ctx.save();
                            this.ctx.font = '600 11px monospace';
                            this.ctx.textAlign = 'center';
                            this.ctx.textBaseline = 'bottom';
                            this.ctx.fillStyle = this.userColor || '#6b4fa1';
                            const from = item.data.from;
                            const to = item.data.to;
                            const dx = to.x - from.x;
                            const dy = to.y - from.y;
                            const length = Math.sqrt(dx * dx + dy * dy);
                            const usePositiveEnd = (label === 'Entropy' || label === 'Receptive');
                            let targetX, targetY;
                            if (usePositiveEnd) {
                                targetX = to.x;
                                targetY = to.y;
                            } else {
                                targetX = from.x;
                                targetY = from.y;
                            }
                            const buffer = 30;
                            const clampedX = Math.max(buffer, Math.min(this.canvas.width - buffer, targetX));
                            const clampedY = Math.max(buffer, Math.min(this.canvas.height - buffer, targetY));
                            let finalX = clampedX;
                            let finalY = clampedY;
                            if (clampedX !== targetX || clampedY !== targetY) {
                                const moveBackDistance = 10;
                                const dirX = dx / length;
                                const dirY = dy / length;
                                if (usePositiveEnd) {
                                    finalX = clampedX - dirX * moveBackDistance;
                                    finalY = clampedY - dirY * moveBackDistance;
                                } else {
                                    finalX = clampedX + dirX * moveBackDistance;
                                    finalY = clampedY + dirY * moveBackDistance;
                                }
                            }
                            const displayLabel = this.simplifiedLabels && this.simplifiedLabels[label] 
                                ? this.simplifiedLabels[label] 
                                : label;
                            this.ctx.fillText(displayLabel, finalX, finalY - 7);
                            this.ctx.restore();
                        }
                    }
                }
            } else if (item.type === 'origin') {
                this.ctx.fillStyle = 'rgba(115, 75, 161, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(item.data.x, item.data.y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (item.type === 'dreamer') {
                const { dreamer, pos, zonesContaining } = item.data;
                this.renderDreamer(dreamer, pos, zonesContaining);
            }
        }
        this.ctx.restore();
    }
    renderDreamer(dreamer, pos, zonesContaining = []) {
        const depthScale = 1 + (pos.z / 400);
        const clampedScale = Math.max(0.5, Math.min(1.5, depthScale));
        const breath = Math.sin(this.time * 2 + dreamer.phase) * 0.15 + 1;
        const baseRadius = 8 * clampedScale;
        const radius = baseRadius * breath;
        const dx = this.mouse.x - pos.x;
        const dy = this.mouse.y - pos.y;
        const isHovered = dx * dx + dy * dy < (radius + 5) ** 2;
        if (isHovered) {
            this.hoveredDreamer = dreamer;
        }
        let color = this.getOctantColor(dreamer.x, dreamer.y, dreamer.z);
        if (zonesContaining && zonesContaining.length > 0) {
            const zoneColor = zonesContaining[0].color;
            const blendAmount = 0.4;
            color = {
                r: Math.round(color.r * (1 - blendAmount) + zoneColor.r * blendAmount),
                g: Math.round(color.g * (1 - blendAmount) + zoneColor.g * blendAmount),
                b: Math.round(color.b * (1 - blendAmount) + zoneColor.b * blendAmount)
            };
        }
        const isErrantson = dreamer.name === 'errantson' || dreamer.name === 'Reverie House';
        this.renderDreamerDot(this.ctx, pos, radius, clampedScale, color, isErrantson, isHovered);
        const shouldShowLabel = isHovered || (this.options.showAllNames && dreamer.name !== 'Reverie House');
        if (shouldShowLabel) {
            // Truncate long names with ellipsis (max 20 chars to handle outliers)
            const maxNameLength = 20;
            const displayName = dreamer.name.length > maxNameLength 
                ? dreamer.name.substring(0, maxNameLength) + '...' 
                : dreamer.name;
            
            this.ctx.font = 'bold 13px monospace';
            const metrics = this.ctx.measureText(displayName);
            const padding = 6;
            const labelHeight = 18 + padding * 2;
            const labelWidth = metrics.width + padding * 2;
            const idealLabelY = pos.y - radius - 25;
            const buffer = 10;
            let labelX = pos.x;
            let labelY = idealLabelY;
            const halfWidth = labelWidth / 2;
            if (labelX - halfWidth < buffer) {
                labelX = buffer + halfWidth;
            } else if (labelX + halfWidth > this.canvas.width - buffer) {
                labelX = this.canvas.width - buffer - halfWidth;
            }
            if (labelY - labelHeight < buffer) {
                labelY = buffer + labelHeight;
            }
            const lineStartY = pos.y - radius;
            const lineEndY = labelY + padding;
            const userColorRgba = this.userColor ? this.hexToRgba(this.userColor, 0.25) : 'rgba(107, 79, 161, 0.25)';
            this.ctx.strokeStyle = userColorRgba;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, lineStartY);
            this.ctx.lineTo(labelX, lineEndY);
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            this.ctx.fillRect(
                labelX - halfWidth,
                labelY - labelHeight,
                labelWidth,
                labelHeight
            );
            this.labelBounds.push({
                name: dreamer.name,
                x: labelX - halfWidth,
                y: labelY - labelHeight,
                width: labelWidth,
                height: labelHeight
            });
            this.ctx.fillStyle = '#372e42';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(displayName, labelX, labelY - labelHeight / 2);
        }
    }
    renderZones() {
        this.zones.forEach(zone => {
            if (zone.type === 'sphere') {
                this.renderSphereZone(zone);
            } else if (zone.type === 'hull') {
                this.renderHullZone(zone);
            }
        });
    }
    renderSphereZone(zone, project) {
        const color = zone.color;
        let centerX = 0, centerY = 0, centerZ = 0;
        if (zone.center_coords) {
            const c = zone.center_coords;
            centerX = (c.entropy || 0) - (c.oblivion || 0);
            centerY = (c.liberty || 0) - (c.authority || 0);
            centerZ = (c.receptive || 0) - (c.skeptic || 0);
        } else if (zone.center_did) {
            const dreamer = this.dreamers.find(d => d.handle && d.handle.includes(zone.center_did.split(':')[2]));
            if (dreamer) {
                centerX = dreamer.x;
                centerY = dreamer.y;
                centerZ = dreamer.z;
            } else {
                return;
            }
        }
        const projectFn = project || ((x, y, z) => this.project3D(x, y, z));
        const centerPos = projectFn(centerX, centerY, centerZ);
        const radiusPoint = projectFn(centerX + zone.radius, centerY, centerZ);
        const screenRadius = Math.abs(radiusPoint.x - centerPos.x);
        this.ctx.save();
        this.ctx.globalAlpha = color.a || 0.15;
        this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.beginPath();
        this.ctx.arc(centerPos.x, centerPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = (color.a || 0.15) * 2;
        this.ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore();
    }
    renderSimpleHullZone(zone, project) {
        if (!zone.point_coords || zone.point_coords.length < 4) return;
        const color = zone.color;
        const projectFn = project || ((x, y, z) => this.project3D(x, y, z));
        const points3D = zone.point_coords.map(p => {
            const x = (p.entropy || 0) - (p.oblivion || 0);
            const y = (p.liberty || 0) - (p.authority || 0);
            const z = (p.receptive || 0) - (p.skeptic || 0);
            return { 
                x, y, z,
                projected: projectFn(x, y, z)
            };
        });
        this.ctx.save();
        const centroid = {
            x: points3D.reduce((sum, p) => sum + p.x, 0) / points3D.length,
            y: points3D.reduce((sum, p) => sum + p.y, 0) / points3D.length,
            z: points3D.reduce((sum, p) => sum + p.z, 0) / points3D.length
        };
        const faces = [];
        const n = points3D.length;
        const tolerance = 0.1;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    const p1 = points3D[i];
                    const p2 = points3D[j];
                    const p3 = points3D[k];
                    const v1x = p2.x - p1.x, v1y = p2.y - p1.y, v1z = p2.z - p1.z;
                    const v2x = p3.x - p1.x, v2y = p3.y - p1.y, v2z = p3.z - p1.z;
                    const nx = v1y * v2z - v1z * v2y;
                    const ny = v1z * v2x - v1x * v2z;
                    const nz = v1x * v2y - v1y * v2x;
                    const normalLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    if (normalLen < 0.001) continue;
                    let posCount = 0, negCount = 0;
                    for (let m = 0; m < n; m++) {
                        if (m === i || m === j || m === k) continue;
                        const p = points3D[m];
                        const dot = nx * (p.x - p1.x) + ny * (p.y - p1.y) + nz * (p.z - p1.z);
                        if (dot > tolerance) posCount++;
                        else if (dot < -tolerance) negCount++;
                    }
                    const isHullFace = (posCount === 0 || negCount === 0);
                    if (isHullFace) {
                        const faceCenterX = (p1.x + p2.x + p3.x) / 3;
                        const faceCenterY = (p1.y + p2.y + p3.y) / 3;
                        const faceCenterZ = (p1.z + p2.z + p3.z) / 3;
                        const outwardX = faceCenterX - centroid.x;
                        const outwardY = faceCenterY - centroid.y;
                        const outwardZ = faceCenterZ - centroid.z;
                        const dotProduct = nx * outwardX + ny * outwardY + nz * outwardZ;
                        if (dotProduct > 0) {
                            const avgZ = (p1.projected.z + p2.projected.z + p3.projected.z) / 3;
                            faces.push({
                                points: [p1.projected, p2.projected, p3.projected],
                                z: avgZ
                            });
                        }
                    }
                }
            }
        }
        faces.sort((a, b) => a.z - b.z);
        for (const face of faces) {
            this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a || 0.15})`;
            this.ctx.beginPath();
            this.ctx.moveTo(face.points[0].x, face.points[0].y);
            this.ctx.lineTo(face.points[1].x, face.points[1].y);
            this.ctx.lineTo(face.points[2].x, face.points[2].y);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(1, (color.a || 0.15) * 3)})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
    renderHullZone(zone, project) {
        if (!zone.vertices || !zone.edges) return;
        const color = zone.color;
        const projectFn = project || ((x, y, z) => this.project3D(x, y, z));
        const vertices3D = zone.vertices.map(v => {
            const x = (v.entropy || 0) - (v.oblivion || 0);
            const y = (v.liberty || 0) - (v.authority || 0);
            const z = (v.receptive || 0) - (v.skeptic || 0);
            return { x, y, z };
        });
        const projectedVertices = vertices3D.map(v => projectFn(v.x, v.y, v.z));
        this.ctx.save();
        this.ctx.globalAlpha = (color.a || 0.15) * 2;
        this.ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.lineWidth = 1.5;
        zone.edges.forEach(edge => {
            const [i, j, k] = edge;
            this.ctx.beginPath();
            this.ctx.moveTo(projectedVertices[i].x, projectedVertices[i].y);
            this.ctx.lineTo(projectedVertices[j].x, projectedVertices[j].y);
            this.ctx.lineTo(projectedVertices[k].x, projectedVertices[k].y);
            this.ctx.closePath();
            this.ctx.stroke();
        });
        this.ctx.globalAlpha = color.a || 0.15;
        this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        zone.edges.forEach(edge => {
            const [i, j, k] = edge;
            const v1 = projectedVertices[i];
            const v2 = projectedVertices[j];
            const v3 = projectedVertices[k];
            const dx1 = v2.x - v1.x;
            const dy1 = v2.y - v1.y;
            const dx2 = v3.x - v1.x;
            const dy2 = v3.y - v1.y;
            const cross = dx1 * dy2 - dy1 * dx2;
            if (cross > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(v1.x, v1.y);
                this.ctx.lineTo(v2.x, v2.y);
                this.ctx.lineTo(v3.x, v3.y);
                this.ctx.closePath();
                this.ctx.fill();
            }
        });
        this.ctx.restore();
    }
}
window.SpectrumVisualizer = SpectrumVisualizer;
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('spectrumCanvas');
    // Only auto-initialize if SpectrumDeluxe hasn't been loaded
    // (SpectrumDeluxe will handle initialization for spectrum.html)
    if (canvas && typeof SpectrumDeluxe === 'undefined') {
        console.log('🎨 [spectrum.js] Auto-initializing base SpectrumVisualizer');
        new SpectrumVisualizer(canvas);
    } else if (canvas) {
        console.log('🎨 [spectrum.js] Skipping auto-init (SpectrumDeluxe will handle it)');
    }
});
