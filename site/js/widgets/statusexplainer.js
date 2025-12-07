
class StatusExplainer {
    constructor() {
        this.loadStyles();
        this.activePopup = null;
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/statusexplainer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/statusexplainer.css';
            document.head.appendChild(link);
        }
    }

    getStatusList() {
        return [
            // Work roles
            [
                { label: 'Keeper of Reverie House', description: 'stalwart for the canon of our wild mindscape' },
                { label: 'Greeter of Reveries', description: 'welcoming guide for newcomers to Reverie House' }
            ],
            // Lore status
            [
                { label: 'Revered Character', description: 'honored storyteller whose tales instantly become canon' },
                { label: 'Well-Known Character', description: 'recognized voice whose stories inherently enrich our lore' },
                { label: 'Known Character', description: 'willing participant and subject of our shared narrative' }
            ],
            // Server status
            [
                { label: 'Resident', description: 'a literal fixture of Reverie House' },
                { label: 'Dreamweaver', description: 'dedicated crafter of exquisite dreams' },
                { label: 'Dreamer', description: 'liberated explorer of our wild mindscape' }
            ]
        ];
    }

    attach(element, status, color = null) {
        element.classList.add('status-explainer-trigger');
        element.style.cursor = 'pointer';
        
        if (color) {
            element.dataset.statusColor = color;
        }
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.show(element, color);
        });
    }

    show(triggerElement, color = null) {
        this.hide();
        
        // Determine color
        let statusColor = color;
        if (!statusColor && triggerElement.dataset.statusColor) {
            statusColor = triggerElement.dataset.statusColor;
        }
        if (!statusColor) {
            const userColor = getComputedStyle(document.documentElement).getPropertyValue('--user-color').trim();
            statusColor = userColor || '#734ba1';
        }
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'status-explainer-overlay';
        
        // Create popup
        const popup = document.createElement('div');
        popup.className = 'status-explainer-popup';
        popup.style.setProperty('--status-color', statusColor);
        
        // Calculate position
        popup.style.left = '50%';
        popup.style.top = '50%';
        
        // Build status list HTML
        const statusGroups = this.getStatusList();
        const groupsHTML = statusGroups.map(group => {
            const items = group.map(item => `
                <div class="status-item">
                    <span class="status-label">${item.label}</span>
                    <span class="status-description">${item.description}</span>
                </div>
            `).join('');
            return `<div class="status-group">${items}</div>`;
        }).join('');
        
        popup.innerHTML = `
            <div class="status-explainer-header">
                <div class="status-explainer-title">Definitions</div>
            </div>
            <div class="status-explainer-list">
                ${groupsHTML}
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
        overlay.addEventListener('click', () => this.hide());
        
        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    hide() {
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
}

// Initialize global instance
if (!window.statusExplainerWidget) {
    window.statusExplainerWidget = new StatusExplainer();
    console.log('✅ [StatusExplainer] Status explainer widget loaded');
}

window.StatusExplainer = StatusExplainer;
