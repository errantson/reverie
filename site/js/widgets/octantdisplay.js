class OctantDisplay {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.dreamer = null;
        this.pollingInterval = options.pollingInterval || null; // ms, null = no polling
        this.pollingTimer = null;
        this.did = options.did || null;
        this.showHeader = options.showHeader !== false; // default true
        this.showFooter = options.showFooter !== false; // default true
        this.loadStyles();
    }

    loadStyles() {
        // Load octant display CSS
        if (!document.querySelector('link[href*="css/widgets/octantdisplay.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/octantdisplay.css?v=1';
            document.head.appendChild(link);
        }
        
        // Load octants CSS for standardized octant colors
        if (!document.querySelector('link[href*="css/octants.css"]')) {
            const octantsLink = document.createElement('link');
            octantsLink.rel = 'stylesheet';
            octantsLink.href = '/css/octants.css';
            document.head.appendChild(octantsLink);
        }
        
        // Load axis explainer widget
        if (!document.querySelector('script[src*="js/widgets/axisexplainer.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/axisexplainer.js';
            document.head.appendChild(script);
        }
        
        // Load octant showcase widget
        if (!document.querySelector('script[src*="js/widgets/octantshowcase.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/octantshowcase.js';
            document.head.appendChild(script);
        }
    }

    async init() {
        this.renderLoading();
        
        // Fetch initial data
        await this.fetchData();
        
        // Start polling if configured
        if (this.pollingInterval) {
            this.startPolling();
        }
    }

    async fetchData() {
        try {
            if (!this.did) {
                // Try to get from session
                const session = window.oauthManager?.getSession();
                if (session?.did) {
                    this.did = session.did;
                } else {
                    this.renderError('No DID provided');
                    return;
                }
            }

            const response = await fetch(`/api/dreamers/${encodeURIComponent(this.did)}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch dreamer: ${response.status}`);
            }

            this.dreamer = await response.json();
            this.render();
        } catch (error) {
            console.error('Error fetching octant data:', error);
            this.renderError(error.message);
        }
    }

    startPolling() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }

        this.pollingTimer = setInterval(() => {
            this.fetchData();
        }, this.pollingInterval);
    }

    stopPolling() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    destroy() {
        this.stopPolling();
        this.container.innerHTML = '';
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="octant-display-loading">
                <div>Loading...</div>
            </div>
        `;
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="octant-display-error">
                <div>${message || 'Error loading octant data'}</div>
            </div>
        `;
    }

    getOctantInfo(octant) {
        // Calculate from spectrum if available to detect balanced states
        const spectrum = this.dreamer?.spectrum;
        
        if (spectrum) {
            const x = (spectrum.entropy || 0) - (spectrum.oblivion || 0);
            const y = (spectrum.liberty || 0) - (spectrum.authority || 0);
            const z = (spectrum.receptive || 0) - (spectrum.skeptic || 0);
            
            // Count balanced axes
            const balancedAxes = [];
            if (x === 0) balancedAxes.push('entropy/oblivion');
            if (y === 0) balancedAxes.push('liberty/authority');
            if (z === 0) balancedAxes.push('receptive/skeptic');
            
            // Return special states for balanced axes
            if (balancedAxes.length === 3) {
                return {
                    octantKey: 'equilibrium',
                    name: 'Equilibrium',
                    primaryAxes: [],
                    axes: '',
                    balancedAxes: []
                };
            }
            
            if (balancedAxes.length === 2) {
                return {
                    octantKey: 'singling',
                    name: 'Singling',
                    primaryAxes: [],
                    axes: '',
                    balancedAxes: balancedAxes
                };
            }
            
            if (balancedAxes.length === 1) {
                return {
                    octantKey: 'confused',
                    name: 'Confused',
                    primaryAxes: [],
                    axes: '',
                    balancedAxes: balancedAxes
                };
            }
        }
        
        // Otherwise use the octant value from the database
        if (!octant && this.dreamer?.spectrum?.octant) {
            octant = this.dreamer.spectrum.octant;
        }
        
        const octantCodeToName = {
            '+++': 'adaptive',
            '++-': 'chaotic',
            '+-+': 'prepared',
            '+--': 'intended',
            '-++': 'contented',
            '-+-': 'assertive',
            '--+': 'ordered',
            '---': 'guarded',
            'equilibrium': 'equilibrium',
            'confused': 'confused',
            'singling': 'singling'
        };
        
        const octantDisplayNames = {
            'adaptive': 'Adaptive',
            'chaotic': 'Chaotic',
            'intended': 'Intended',
            'prepared': 'Prepared',
            'contented': 'Contented',
            'assertive': 'Assertive',
            'ordered': 'Ordered',
            'guarded': 'Guarded',
            'equilibrium': 'Equilibrium',
            'confused': 'Confused',
            'singling': 'Singling'
        };
        
        const octantPrimaryAxes = {
            'adaptive': ['entropy', 'receptive', 'liberty'],
            'chaotic': ['entropy', 'skeptic', 'liberty'],
            'prepared': ['entropy', 'receptive', 'authority'],
            'intended': ['entropy', 'skeptic', 'authority'],
            'contented': ['oblivion', 'receptive', 'liberty'],
            'assertive': ['oblivion', 'skeptic', 'liberty'],
            'ordered': ['oblivion', 'receptive', 'authority'],
            'guarded': ['oblivion', 'skeptic', 'authority'],
            'equilibrium': [],
            'confused': [],
            'singling': []
        };
        
        let octantName = octant;
        if (octant?.match(/^[+-]{3}$/)) {
            octantName = octantCodeToName[octant] || octant;
        }
        
        const name = octantDisplayNames[octantName] || octantName || 'Unknown';
        const octantKey = octantName || 'equilibrium';
        const primaryAxes = octantPrimaryAxes[octantName] || [];
        const axes = primaryAxes.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(' • ');

        return {
            octantKey,
            name,
            primaryAxes,
            axes,
            balancedAxes: []
        };
    }

    getScoreClass(axis1, axis2, octantInfo) {
        // Helper function to determine CSS classes for score display
        const spectrum = this.dreamer?.spectrum;
        if (!spectrum) return '';
        
        const val1 = spectrum[axis1] || 0;
        const val2 = spectrum[axis2] || 0;
        
        // Check if this axis pair is balanced
        const axisKey = `${axis1}/${axis2}`;
        const reverseKey = `${axis2}/${axis1}`;
        const isBalanced = octantInfo.balancedAxes && 
                          (octantInfo.balancedAxes.includes(axisKey) || 
                           octantInfo.balancedAxes.includes(reverseKey));
        
        if (isBalanced) {
            // Both axes in a balanced pair should be shown as dominant with special styling
            return 'score-balanced score-balanced-pair';
        }
        
        // Normal behavior - higher value gets highlighted
        return val1 > val2 ? 'score-higher' : '';
    }

    async render() {
        const dreamer = this.dreamer;
        
        if (!dreamer || !dreamer.spectrum) {
            this.container.innerHTML = '<div class="octant-display-empty">No spectrum data</div>';
            return;
        }

        const s = dreamer.spectrum;
        const octant = s.octant || 'equilibrium';
        const octantInfo = this.getOctantInfo(octant);
        
        // Get heading for footer
        let headingDisplay = 'None';
        if (dreamer.heading) {
            if (dreamer.heading.startsWith('did:')) {
                try {
                    const response = await fetch('/api/dreamers');
                    const dreamers = await response.json();
                    const targetDreamer = dreamers.find(d => d.did === dreamer.heading);
                    if (targetDreamer) {
                        headingDisplay = targetDreamer.name || targetDreamer.handle;
                    }
                } catch (error) {
                    console.error('Error loading heading:', error);
                    headingDisplay = 'Unknown';
                }
            } else {
                headingDisplay = dreamer.heading;
            }
        }
        
        // Build header HTML
        const headerHtml = this.showHeader ? `<div class="octant-header">${octantInfo.name}</div>` : '';
        
        // Build footer HTML
        let footerHtml = '';
        if (this.showFooter) {
            footerHtml = `
                <div class="octant-footer">
                    <div class="octant-footer-left">
                        <span class="octant-footer-label">Heading</span>
                        <span class="octant-footer-value">${headingDisplay}</span>
                    </div>
                    <button class="octant-footer-btn" id="setHeadingBtn">
                        <div>SET</div>
                        <div>HEADING</div>
                    </button>
                </div>
            `;
        }
        
        // Build spectrum container HTML
        this.container.innerHTML = `
            <div class="octant-display-container octant-display-wide" data-octant="${octantInfo.octantKey}">
                ${headerHtml}
                <div class="octant-scores">
                    <div class="octant-score-row ${this.getScoreClass('entropy', 'oblivion', octantInfo)}" 
                         data-explainer="Entropy" 
                         title="Entropy">
                        <span class="score-value">${s.entropy || 0}</span>
                        <span class="score-label">ENTROPY</span>
                    </div>
                    <div class="octant-score-row ${this.getScoreClass('liberty', 'authority', octantInfo)}" 
                         data-explainer="Liberty" 
                         title="Liberty">
                        <span class="score-value">${s.liberty || 0}</span>
                        <span class="score-label">LIBERTY</span>
                    </div>
                    <div class="octant-score-row ${this.getScoreClass('receptive', 'skeptic', octantInfo)}" 
                         data-explainer="Receptive" 
                         title="Receptive">
                        <span class="score-value">${s.receptive || 0}</span>
                        <span class="score-label">RECEPTIVE</span>
                    </div>
                    <div class="octant-score-row ${this.getScoreClass('oblivion', 'entropy', octantInfo)}" 
                         data-explainer="Oblivion" 
                         title="Oblivion">
                        <span class="score-value">${s.oblivion || 0}</span>
                        <span class="score-label">OBLIVION</span>
                    </div>
                    <div class="octant-score-row ${this.getScoreClass('authority', 'liberty', octantInfo)}" 
                         data-explainer="Authority" 
                         title="Authority">
                        <span class="score-value">${s.authority || 0}</span>
                        <span class="score-label">AUTHORITY</span>
                    </div>
                    <div class="octant-score-row ${this.getScoreClass('skeptic', 'receptive', octantInfo)}" 
                         data-explainer="Skeptic" 
                         title="Skeptic">
                        <span class="score-value">${s.skeptic || 0}</span>
                        <span class="score-label">SKEPTIC</span>
                    </div>
                </div>
                ${footerHtml}
            </div>
        `;
        
        // Attach event listener for heading button
        if (this.showFooter) {
            const headingBtn = this.container.querySelector('#setHeadingBtn');
            if (headingBtn && this.options.onSetHeading) {
                headingBtn.onclick = () => this.options.onSetHeading(dreamer);
            } else if (headingBtn) {
                // Default behavior - hide if no handler
                headingBtn.style.display = 'none';
            }
        }
        
        // Initialize explainers after a short delay to ensure widgets are loaded
        setTimeout(() => this.initializeExplainers(), 200);
    }

    initializeExplainers() {
        // Attach axis explainer to spectrum score rows
        if (window.axisExplainerWidget) {
            const explainerElements = this.container.querySelectorAll('[data-explainer]');
            explainerElements.forEach(el => {
                const term = el.getAttribute('data-explainer');
                if (term && term !== 'Unknown') {
                    window.axisExplainerWidget.attach(el, term);
                }
            });
        }
        
        // Attach octant showcase to spectrum header (only if header is shown)
        if (this.showHeader && window.octantShowcaseWidget) {
            const spectrumHeader = this.container.querySelector('.octant-header');
            if (spectrumHeader) {
                window.octantShowcaseWidget.attach(spectrumHeader, null);
            }
        }
    }

    // Public method to update with new dreamer data (useful for profile pages)
    async updateDreamer(dreamer) {
        this.dreamer = dreamer;
        if (dreamer?.did) {
            this.did = dreamer.did;
        }
        await this.render();
    }

    // Public method to set DID and fetch fresh data
    async setDID(did) {
        this.did = did;
        await this.fetchData();
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.OctantDisplay = OctantDisplay;
}
