/**
 * Octant Showcase Widget
 * Unified component for displaying octants in a 3x3 grid
 * Used both in spectrum page (inline) and as popup explainer
 */

class OctantShowcase {
    constructor() {
        this.loadStyles();
        this.activePopup = null;
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/octantshowcase.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/octantshowcase.css';
            document.head.appendChild(link);
        }
    }

    getOctantDefinitions() {
        return {
            'adaptive': {
                name: 'ADAPTIVE',
                axes: 'Entropy • Liberty • Receptive',
                description: 'embracing change prolongs freedom'
            },
            'chaotic': {
                name: 'CHAOTIC',
                axes: 'Entropy • Liberty • Skeptic',
                description: 'increasing possibility unlocks momentum'
            },
            'prepared': {
                name: 'PREPARED',
                axes: 'Entropy • Authority • Receptive',
                description: 'contemplative foresight averts disaster'
            },
            'intended': {
                name: 'INTENDED',
                axes: 'Entropy • Authority • Skeptic',
                description: 'independent action delivers results'
            },
            'equilibrium': {
                name: 'EQUILIBRIUM',
                axes: 'Afforded Balance',
                description: 'centered only to self'
            },
            'contented': {
                name: 'CONTENTED',
                axes: 'Oblivion • Liberty • Receptive',
                description: 'relentless acceptance begets peace'
            },
            'assertive': {
                name: 'ASSERTIVE',
                axes: 'Oblivion • Liberty • Skeptic',
                description: 'outbound query solves doubt'
            },
            'ordered': {
                name: 'ORDERED',
                axes: 'Oblivion • Authority • Receptive',
                description: 'disciplined governence builds structure'
            },
            'guarded': {
                name: 'GUARDED',
                axes: 'Oblivion • Authority • Skeptic',
                description: 'protective rejection averts malinfluence'
            }
        };
    }

    getOctantOrder() {
        // 3x3 grid order with equilibrium in center
        return [
            'adaptive',     // top-left
            'chaotic',      // top-center
            'prepared',     // top-right
            'intended',     // middle-left
            'equilibrium',  // CENTER
            'contented',    // middle-right
            'assertive',    // bottom-left
            'ordered',      // bottom-center
            'guarded'       // bottom-right
        ];
    }

    getOctantCodeMap() {
        return {
            'adaptive': '+++',
            'chaotic': '++-',
            'prepared': '+-+',
            'intended': '+--',
            'contented': '-++',
            'assertive': '-+-',
            'ordered': '--+',
            'guarded': '---'
        };
    }

    /**
     * Render octant grid into a container element (for spectrum page)
     * @param {HTMLElement} container - Container element
     * @param {Object} octantDreamers - Map of octant codes to dreamer arrays
     * @param {Array} allDreamers - All dreamers for equilibrium calculation
     * @param {Function} isNearCenter - Function to check if dreamer is near center
     */
    renderInline(container, octantDreamers = {}, allDreamers = [], isNearCenter = null) {
        if (!container) return;

        const definitions = this.getOctantDefinitions();
        const order = this.getOctantOrder();
        const codeMap = this.getOctantCodeMap();

        container.innerHTML = '';

        order.forEach(octantKey => {
            const definition = definitions[octantKey];
            if (!definition) return;

            const card = document.createElement('div');
            card.className = `octant-card octant-${octantKey}`;

            if (octantKey === 'equilibrium') {
                // Equilibrium card
                const balanceDreamers = isNearCenter && allDreamers 
                    ? allDreamers.filter(d => isNearCenter(d))
                    : [];
                const displayDreamers = this.getRandomDreamers(balanceDreamers, 4);

                card.innerHTML = `
                    <div class="octant-header">
                        <div class="octant-title">
                            <h4 class="octant-name">${definition.name}</h4>
                        </div>
                    </div>
                    <div class="octant-axes">${definition.axes}</div>
                    <div class="octant-description">${definition.description}</div>
                    <div class="octant-dreamers">
                        ${this.renderDreamerAvatars(displayDreamers)}
                    </div>
                `;
            } else {
                // Regular octant card
                const octantCode = codeMap[octantKey];
                const dreamers = octantDreamers[octantCode] || [];
                const displayDreamers = this.getRandomDreamers(dreamers, 4);

                card.innerHTML = `
                    <div class="octant-header">
                        <div class="octant-title">
                            <h4 class="octant-name">${definition.name}</h4>
                        </div>
                    </div>
                    <div class="octant-axes">${this.renderAxesWithExplainer(definition.axes)}</div>
                    <div class="octant-description">${definition.description}</div>
                    <div class="octant-dreamers">
                        ${this.renderDreamerAvatars(displayDreamers)}
                    </div>
                `;
            }

            container.appendChild(card);
        });

        // Initialize axis explainer for inline display
        this.initializeAxisExplainer();
    }

    /**
     * Show as popup (for profile page explainer)
     * @param {HTMLElement} triggerElement - Element that triggered the popup
     * @param {string} color - Optional color for popup border
     * @param {Object} octantDreamers - Optional map of octant codes to dreamer arrays
     * @param {Array} allDreamers - Optional all dreamers for equilibrium
     * @param {Function} isNearCenter - Optional function to check if dreamer is near center
     */
    async showPopup(triggerElement, color = null, octantDreamers = null, allDreamers = null, isNearCenter = null) {
        console.log('[OctantShowcase] showPopup called', { 
            hasOctantDreamers: !!octantDreamers, 
            hasAllDreamers: !!allDreamers,
            hasIsNearCenter: !!isNearCenter
        });
        
        this.hidePopup();

        // Determine color
        let popupColor = color;
        if (!popupColor && triggerElement?.dataset.octantColor) {
            popupColor = triggerElement.dataset.octantColor;
        }
        if (!popupColor) {
            const userColor = getComputedStyle(document.documentElement).getPropertyValue('--user-color').trim();
            popupColor = userColor || '#734ba1';
        }

        // Fetch dreamer data if not provided
        if (!octantDreamers || !allDreamers) {
            console.log('[OctantShowcase] Fetching dreamers from /api/dreamers...');
            try {
                const response = await fetch('/api/dreamers');
                console.log('[OctantShowcase] Fetch response:', response.status, response.ok);
                if (response.ok) {
                    allDreamers = await response.json();
                    console.log('[OctantShowcase] Fetched dreamers:', allDreamers?.length);
                    // Categorize dreamers by octant
                    octantDreamers = this.categorizeDreamers(allDreamers);
                    isNearCenter = (d) => this.isNearCenter(d);
                    console.log('[OctantShowcase] Categorized into octants:', Object.keys(octantDreamers).map(k => `${k}: ${octantDreamers[k].length}`).join(', '));
                } else {
                    console.warn('[OctantShowcase] Failed to fetch dreamers:', response.status);
                    octantDreamers = {};
                    allDreamers = [];
                }
            } catch (error) {
                console.warn('[OctantShowcase] Could not fetch dreamers for octant popup:', error);
                octantDreamers = {};
                allDreamers = [];
            }
        } else {
            console.log('[OctantShowcase] Using provided dreamer data');
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'octant-showcase-overlay';

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'octant-showcase-popup';
        popup.style.setProperty('--popup-color', popupColor);

        // Calculate position
        popup.style.left = '50%';
        popup.style.top = '50%';

        // Build grid - identical to inline version
        const definitions = this.getOctantDefinitions();
        const order = this.getOctantOrder();
        const codeMap = this.getOctantCodeMap();

        // Ensure octantDreamers is initialized
        if (!octantDreamers) {
            console.warn('[OctantShowcase] octantDreamers is still null, initializing to empty');
            octantDreamers = {};
        }
        if (!allDreamers) {
            console.warn('[OctantShowcase] allDreamers is still null, initializing to empty');
            allDreamers = [];
        }

        console.log('[OctantShowcase] Building popup with:', {
            octantDreamersKeys: Object.keys(octantDreamers),
            octantDreamersCounts: Object.keys(octantDreamers).map(k => `${k}:${octantDreamers[k]?.length || 0}`).join(', '),
            allDreamersCount: allDreamers?.length || 0
        });

        const cardsHTML = order.map(octantKey => {
            const definition = definitions[octantKey];
            if (!definition) return '';

            let dreamersHTML = '';
            if (octantKey === 'equilibrium') {
                // Equilibrium card
                const balanceDreamers = isNearCenter && allDreamers 
                    ? allDreamers.filter(d => isNearCenter(d))
                    : [];
                const displayDreamers = this.getRandomDreamers(balanceDreamers, 4);
                dreamersHTML = this.renderDreamerAvatars(displayDreamers);
            } else {
                // Regular octant card
                const octantCode = codeMap[octantKey];
                const dreamers = octantDreamers[octantCode] || [];
                const displayDreamers = this.getRandomDreamers(dreamers, 4);
                dreamersHTML = this.renderDreamerAvatars(displayDreamers);
            }

            return `
                <div class="octant-card octant-${octantKey}">
                    <div class="octant-header">
                        <div class="octant-title">
                            <h4 class="octant-name">${definition.name}</h4>
                        </div>
                    </div>
                    <div class="octant-axes">${this.renderAxesWithExplainer(definition.axes)}</div>
                    <div class="octant-description">${definition.description}</div>
                    <div class="octant-dreamers">
                        ${dreamersHTML}
                    </div>
                </div>
            `;
        }).join('');

        popup.innerHTML = `
            <div class="octant-showcase-header">
                <div class="octant-showcase-title">Octant Definitions</div>
            </div>
            <div class="octant-showcase-grid">
                ${cardsHTML}
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Trigger reflow for animation
        popup.offsetHeight;

        overlay.classList.add('active');
        popup.classList.add('active');

        this.activePopup = { overlay, popup };

        // Close on overlay click
        overlay.addEventListener('click', () => this.hidePopup());

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hidePopup();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Initialize axis explainer for popup
        setTimeout(() => this.initializeAxisExplainer(), 100);
    }

    hidePopup() {
        if (!this.activePopup) return;

        const { overlay, popup } = this.activePopup;

        overlay.classList.remove('active');
        popup.classList.remove('active');

        setTimeout(() => {
            overlay.remove();
            popup.remove();
        }, 300);

        this.activePopup = null;
    }

    /**
     * Attach click handler to trigger popup
     */
    attach(element, color = null) {
        console.log('[OctantShowcase] attach() called on element:', element);
        element.classList.add('octant-showcase-trigger');
        element.style.cursor = 'pointer';

        if (color) {
            element.dataset.octantColor = color;
        }

        element.addEventListener('click', (e) => {
            console.log('[OctantShowcase] Click event triggered on element');
            e.stopPropagation();
            this.showPopup(element, color);
        });
    }

    // Helper methods

    renderDreamerAvatars(dreamers) {
        if (!dreamers || dreamers.length === 0) {
            return '<div class="octant-empty">No dreamers yet</div>';
        }

        return dreamers.map(dreamer => {
            const avatarUrl = dreamer.avatar || '/assets/icon_face.png';
            const displayName = dreamer.name || dreamer.handle;

            return `
                <a href="/dreamer?did=${encodeURIComponent(dreamer.did)}" 
                   class="dreamer-avatar-link"
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
        // Skip explainer for equilibrium's "Afforded Balance"
        if (axesText === 'Afforded Balance') {
            return axesText;
        }

        // Split by bullet and add data-explainer to each axis
        const axes = axesText.split(' • ');
        return axes.map(axis => `<span class="axis-explainer-trigger" data-explainer="${axis}">${axis}</span>`).join(' • ');
    }

    initializeAxisExplainer() {
        if (window.axisExplainerWidget) {
            const explainerElements = document.querySelectorAll('.axis-explainer-trigger[data-explainer]');
            explainerElements.forEach(el => {
                const term = el.getAttribute('data-explainer');
                if (term) {
                    window.axisExplainerWidget.attach(el, term);
                }
            });
        }
    }

    getRandomDreamers(dreamers, count) {
        if (!dreamers || dreamers.length === 0) return [];
        if (dreamers.length <= count) return dreamers;

        // Shuffle and take first 'count' items
        const shuffled = [...dreamers].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    /**
     * Categorize dreamers by octant based on their spectrum values
     * @param {Array} dreamers - Array of dreamer objects with spectrum data
     * @returns {Object} Map of octant codes to dreamer arrays
     */
    categorizeDreamers(dreamers) {
        const octantDreamers = {
            '+++': [], // adaptive
            '++-': [], // chaotic
            '+-+': [], // prepared
            '+--': [], // intended
            '-++': [], // contented
            '-+-': [], // assertive
            '--+': [], // ordered
            '---': []  // guarded
        };

        // Map octant names to codes
        const octantNameToCode = {
            'adaptive': '+++',
            'chaotic': '++-',
            'prepared': '+-+',
            'intended': '+--',
            'contented': '-++',
            'assertive': '-+-',
            'ordered': '--+',
            'guarded': '---'
        };

        dreamers.forEach(dreamer => {
            // Skip if no spectrum data
            if (!dreamer.spectrum?.octant) {
                return;
            }

            const dbOctant = dreamer.spectrum.octant;
            
            // Skip equilibrium
            if (dbOctant === 'equilibrium') {
                return;
            }

            // Convert name to code if needed
            const octantCode = dbOctant.match(/^[+-]{3}$/) ? dbOctant : octantNameToCode[dbOctant];
            
            if (octantCode && octantDreamers[octantCode]) {
                octantDreamers[octantCode].push(dreamer);
            }
        });

        return octantDreamers;
    }

    /**
     * Check if a dreamer is near the center (equilibrium)
     * @param {Object} dreamer - Dreamer object with spectrum data
     * @returns {boolean} True if near center
     */
    isNearCenter(dreamer) {
        // Use the database octant value - it's the source of truth
        return dreamer.spectrum?.octant === 'equilibrium';
    }
}

// Initialize global instance
if (!window.octantShowcaseWidget) {
    window.octantShowcaseWidget = new OctantShowcase();
    console.log('✅ [OctantShowcase] Octant showcase widget loaded');
}

window.OctantShowcase = OctantShowcase;
