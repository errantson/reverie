/**
 * Mapper Role Component
 * 
 * Handles the Spectrum Mapper role:
 * - Displays origin coordinate examples
 * - Maps dreamer origins on the spectrum
 */

class MapperRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'mapper-content-section';
        this.originExamples = [];
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('mapper');
    }
    
    /**
     * Initialize the role
     */
    init() {
        this.setupEventListeners();
        return this;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('role:changed', (event) => {
            if (event.detail.role === 'mapper') {
                this.show();
            } else {
                this.hide();
            }
        });
    }
    
    /**
     * Show the mapper content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.updateOriginCoordinateExample();
        }
    }
    
    /**
     * Hide the mapper content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Update the origin coordinate example with random values
     */
    updateOriginCoordinateExample() {
        const exampleEl = document.getElementById('origin-coordinate-example');
        if (!exampleEl) return;
        
        // Generate random 2-digit values for each coordinate
        const O = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const A = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const S = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const R = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const L = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const E = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        
        exampleEl.innerHTML = `
            <div style="text-align: center; letter-spacing: 2px; font-weight: 600; font-family: 'Courier New', monospace;">
                O${O} A${A} S${S} R${R} L${L} E${E}
            </div>
        `;
    }
    
    /**
     * Get origin examples for modal
     */
    getExamples() {
        return [{
            text: this.generateRandomOrigin()
        }];
    }
    
    /**
     * Generate a random origin string
     */
    generateRandomOrigin() {
        const O = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const A = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const S = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const R = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const L = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        const E = String(Math.floor(Math.random() * 99)).padStart(2, '0');
        
        return `<div style="text-align: center; letter-spacing: 2px; font-weight: 600; font-family: 'Courier New', monospace;">O${O} A${A} S${S} R${R} L${L} E${E}</div>`;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapperRole;
}

// Make available globally
window.MapperRole = MapperRole;
