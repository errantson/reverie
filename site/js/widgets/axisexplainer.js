
class AxisExplainer {
    constructor() {
        this.loadStyles();
        this.activePopup = null;
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/axisexplainer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/axisexplainer.css';
            document.head.appendChild(link);
        }
    }

    getAxisList() {
        return [
            // First axis pair: Entropy vs Oblivion
            [
                { label: 'Entropy', description: 'everything pushes the infinite expanse of entropy' },
                { label: 'Oblivion', description: 'nothingness pulls the absolute void of oblivion' }
            ],
            // Second axis pair: Liberty vs Authority
            [
                { label: 'Liberty', description: 'individual freedom outweighs things more often' },
                { label: 'Authority', description: 'hierarchal structure deters things less frequently' }
            ],
            // Third axis pair: Receptive vs Skeptic
            [
                { label: 'Receptive', description: 'being open empowers one to accept' },
                { label: 'Skeptic', description: 'being apart empowers one to improve' }
            ]
        ];
    }

    attach(element, axis, color = null) {
        element.classList.add('axis-explainer-trigger');
        element.style.cursor = 'pointer';
        
        if (color) {
            element.dataset.axisColor = color;
        }
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.show(element, color);
        });
    }

    show(triggerElement, color = null) {
        this.hide();
        
        // Determine color
        let axisColor = color;
        if (!axisColor && triggerElement.dataset.axisColor) {
            axisColor = triggerElement.dataset.axisColor;
        }
        if (!axisColor) {
            const userColor = getComputedStyle(document.documentElement).getPropertyValue('--user-color').trim();
            axisColor = userColor || '#734ba1';
        }
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'axis-explainer-overlay';
        
        // Create popup
        const popup = document.createElement('div');
        popup.className = 'axis-explainer-popup';
        popup.style.setProperty('--axis-color', axisColor);
        
        // Calculate position
        popup.style.left = '50%';
        popup.style.top = '50%';
        
        // Build axis list HTML
        const axisGroups = this.getAxisList();
        const groupsHTML = axisGroups.map(group => {
            const items = group.map(item => `
                <div class="axis-item">
                    <span class="axis-label">${item.label}</span>
                    <span class="axis-description">${item.description}</span>
                </div>
            `).join('');
            return `<div class="axis-group">${items}</div>`;
        }).join('');
        
        popup.innerHTML = `
            <div class="axis-explainer-header">
                <div class="axis-explainer-title">Definitions</div>
            </div>
            <div class="axis-explainer-list">
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
if (!window.axisExplainerWidget) {
    window.axisExplainerWidget = new AxisExplainer();
    console.log('✅ [AxisExplainer] Axis explainer widget loaded');
}

window.AxisExplainer = AxisExplainer;
