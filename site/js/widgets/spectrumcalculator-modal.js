/**
 * Spectrum Calculator Modal Widget
 * 
 * A modal version of the Spectrum Preview that can be opened from dialogue buttons
 * or other UI elements. Shows the spectrum calculator in a centered modal overlay.
 * 
 * Usage:
 * const modal = new SpectrumCalculatorModal();
 * modal.open();
 * 
 * Or from a dialogue button:
 * {
 *   text: 'OPEN CALCULATOR',
 *   callback: 'openSpectrumCalculator'
 * }
 */

class SpectrumCalculatorModal {
    constructor() {
        this.container = null;
        this.overlay = null;
        this.modalBox = null;
        this.spectrumWidget = null;
        this.isOpen = false;
        
        this.loadStyles();
    }
    
    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/spectrumcalculator-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/spectrumcalculator-modal.css';
            document.head.appendChild(link);
        }
    }
    
    /**
     * Open the spectrum calculator modal
     * @param {boolean} isMapper - Whether the user is the active mapper (enables calculator)
     * @param {boolean} showDeluxe - Force show origin calculator and octant explainer
     */
    async open(isMapper = false, showDeluxe = false) {
        if (this.isOpen) {
            console.log('⚠️ Spectrum calculator modal already open');
            return;
        }
        
        // Check if user is mapper if not explicitly provided
        let mapperInfo = null;
        if (!isMapper) {
            mapperInfo = await this.checkMapperStatus();
            isMapper = mapperInfo.isActive;
        }
        
        this.isOpen = true;
        this.render(isMapper, mapperInfo, showDeluxe);
        
        // Animate in
        requestAnimationFrame(() => {
            if (this.overlay) {
                this.overlay.classList.add('visible');
            }
        });
    }
    
    /**
     * Check if there is an active mapper (enables calculator for everyone)
     */
    async checkMapperStatus() {
        try {
            // Use public endpoint to check if anyone is currently the mapper
            const response = await fetch('/api/work/mapper/info');
            
            if (response.ok) {
                const data = await response.json();
                const workers = data.workers || [];
                // Calculator is unlocked if there's any active mapper
                return {
                    isActive: workers.length > 0 && data.status === 'active',
                    mapperHandle: workers.length > 0 ? workers[0].handle : null,
                    mapperDid: workers.length > 0 ? workers[0].did : null
                };
            }
            
            return { isActive: false, mapperHandle: null, mapperDid: null };
        } catch (error) {
            console.error('Failed to check mapper status:', error);
            return { isActive: false, mapperHandle: null, mapperDid: null };
        }
    }
    
    render(isMapper, mapperInfo = null, showDeluxe = false) {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'spectrum-calculator-overlay';
        
        // Create modal box
        this.modalBox = document.createElement('div');
        this.modalBox.className = 'spectrum-calculator-modal';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'spectrum-calculator-modal-header';
        header.innerHTML = `
            <h2 class="spectrum-calculator-modal-title">
                <img src="/assets/icon.png" style="width: 24px; height: 24px; margin-right: 0.5rem; vertical-align: middle;" alt="">
                Spectrum Calculator
            </h2>
            <button class="spectrum-calculator-close-btn" aria-label="Close">×</button>
        `;
        
        // Create body (container for spectrum widget)
        const body = document.createElement('div');
        body.className = 'spectrum-calculator-modal-body';
        body.id = 'spectrum-calculator-modal-body';
        
        // Create footer with info
        const footer = document.createElement('div');
        footer.className = 'spectrum-calculator-modal-footer';
        
        if (isMapper) {
            const mapperHandle = mapperInfo?.mapperHandle || 'unknown';
            const mapperDid = mapperInfo?.mapperDid;
            
            let mapperLink = `@${mapperHandle}`;
            if (mapperDid) {
                mapperLink = `<a href="/dreamer?did=${encodeURIComponent(mapperDid)}">@${mapperHandle}</a>`;
            }
            
            footer.innerHTML = `
                <p class="mapper-status active">
                    <span class="status-indicator"></span>
                    Powered by Spectrum Mapper ${mapperLink}
                </p>
            `;
        } else {
            footer.innerHTML = `
                <p class="mapper-status inactive">
                    <span class="status-indicator"></span>
                    Calculator available when a Spectrum Mapper is active
                </p>
                <p class="calculator-hint">
                    The Spectrum Calculator is a tool available to all dreamers when someone is actively serving as Spectrum Mapper.
                    <a href="/work.html" class="become-mapper-link">Learn about becoming a Mapper</a>
                </p>
            `;
        }
        
        // Assemble modal
        this.modalBox.appendChild(header);
        this.modalBox.appendChild(body);
        this.modalBox.appendChild(footer);
        this.overlay.appendChild(this.modalBox);
        
        // Add to DOM
        document.body.appendChild(this.overlay);
        
        // Initialize spectrum widget inside modal
        this.initSpectrumWidget(isMapper, showDeluxe);
        
        // Attach event listeners
        this.attachEventListeners();
    }
    
    initSpectrumWidget(isMapper, showDeluxe = false) {
        const container = document.getElementById('spectrum-calculator-modal-body');
        if (!container) return;
        
        // Wait for SpectrumPreview to be available
        if (window.SpectrumPreview) {
            this.spectrumWidget = new window.SpectrumPreview(container, {
                isMapper: isMapper,
                showDeluxe: showDeluxe,  // Force show origin calculator and explainer
                parentModal: this  // Pass reference to modal for closing
            });
        } else {
            // Load the script if not available
            console.log('⏳ Loading SpectrumPreview widget...');
            const script = document.createElement('script');
            script.src = '/js/widgets/spectrumpreview.js?v=' + Date.now();
            script.onload = () => {
                this.spectrumWidget = new window.SpectrumPreview(container, {
                    isMapper: isMapper,
                    showDeluxe: showDeluxe,  // Force show origin calculator and explainer
                    parentModal: this  // Pass reference to modal for closing
                });
            };
            document.head.appendChild(script);
        }
    }
    
    attachEventListeners() {
        // Close button
        const closeBtn = this.modalBox.querySelector('.spectrum-calculator-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Escape key to close
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        // Animate out
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.container = null;
                this.overlay = null;
                this.modalBox = null;
                this.spectrumWidget = null;
            }, 300);
        }
        
        // Remove escape listener
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.SpectrumCalculatorModal = SpectrumCalculatorModal;
    
    // Create a global instance for easy access
    window.spectrumCalculatorModal = new SpectrumCalculatorModal();
    
    // Register as a dialogue button callback
    if (!window.dialogueCallbacks) {
        window.dialogueCallbacks = {};
    }
    
    window.dialogueCallbacks.openSpectrumCalculator = async function() {
        console.log('🔢 Opening Spectrum Calculator from dialogue');
        await window.spectrumCalculatorModal.open();
    };
}
