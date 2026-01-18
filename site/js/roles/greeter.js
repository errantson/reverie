/**
 * Greeter Role Component
 * 
 * Handles the Greeter of Reveries role:
 * - Displaying greeting templates
 * - Greeting events feed
 * - Worker activation/deactivation
 */

class GreeterRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'greeter-content-section';
        this.greetingExamples = [];
        this.greetingEvents = [];
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadGreetingTemplates = this.loadGreetingTemplates.bind(this);
        this.loadGreetingEvents = this.loadGreetingEvents.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('greeter');
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
        // Listen for role selection
        window.addEventListener('role:changed', (event) => {
            if (event.detail.role === 'greeter') {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // Listen for WorkEvents
        if (window.WorkEvents) {
            window.WorkEvents.on(window.WorkEvents.EVENTS.GREETER_ACTIVATED, () => {
                this.loadGreetingEvents();
            });
            window.WorkEvents.on(window.WorkEvents.EVENTS.GREETER_STEPPED_DOWN, () => {
                this.loadGreetingEvents();
            });
        }
    }
    
    /**
     * Show the greeter content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.loadGreetingTemplates();
            this.loadGreetingEvents();
        }
    }
    
    /**
     * Hide the greeter content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Load greeting templates from API
     */
    async loadGreetingTemplates() {
        try {
            const response = await fetch('/api/work/greeter/templates');
            if (response.ok) {
                const data = await response.json();
                this.greetingExamples = data.templates || [];
                this.renderGreetingExamples();
            }
        } catch (error) {
            console.error('Failed to load greeting templates:', error);
        }
    }
    
    /**
     * Render greeting examples
     */
    renderGreetingExamples() {
        const container = document.getElementById('greeting-examples');
        if (!container || this.greetingExamples.length === 0) return;
        
        const html = this.greetingExamples.map(template => `
            <div class="greeting-example">
                <div class="greeting-text">${template.text}</div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Load greeting events feed
     */
    async loadGreetingEvents() {
        const container = document.getElementById('greeter-greetings-display');
        if (!container) return;
        
        container.innerHTML = '<div class="greeting-text">Loading greetings...</div>';
        
        try {
            const response = await fetch('/api/work/greeter/events?limit=10');
            if (response.ok) {
                const data = await response.json();
                this.greetingEvents = data.events || [];
                this.renderGreetingEvents();
            } else {
                container.innerHTML = '<div class="greeting-text">No recent greetings</div>';
            }
        } catch (error) {
            console.error('Failed to load greeting events:', error);
            container.innerHTML = '<div class="greeting-text">Failed to load greetings</div>';
        }
    }
    
    /**
     * Render greeting events
     */
    async renderGreetingEvents() {
        const container = document.getElementById('greeter-greetings-display');
        if (!container) return;
        
        if (this.greetingEvents.length === 0) {
            container.innerHTML = '<div class="greeting-text">No recent greetings</div>';
            return;
        }
        
        // Fetch dreamer info for each event
        const eventsWithInfo = await Promise.all(this.greetingEvents.map(async (event) => {
            const dreamerInfo = await window.workCore?.fetchDreamerInfo(event.target_did);
            return {
                ...event,
                dreamer: dreamerInfo
            };
        }));
        
        const html = eventsWithInfo.map(event => {
            const name = event.dreamer?.display_name || event.dreamer?.handle || 'Unknown';
            const avatar = event.dreamer?.avatar || '/assets/default-avatar.png';
            const color = event.dreamer?.color_hex || '#8b7355';
            const timeAgo = this.formatTimeAgo(event.created_at);
            
            return `
                <div class="greeting-event" style="border-left: 3px solid ${color};">
                    <img src="${avatar}" alt="${name}" class="greeting-avatar" style="border-color: ${color};">
                    <div class="greeting-info">
                        <span class="greeting-name" style="color: ${color};">${name}</span>
                        <span class="greeting-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Format time ago
     */
    formatTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const seconds = Math.floor((now - then) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        
        return then.toLocaleDateString();
    }
    
    /**
     * Get greeting examples for modal
     */
    getExamples() {
        return this.greetingExamples;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GreeterRole;
}

// Make available globally
window.GreeterRole = GreeterRole;
