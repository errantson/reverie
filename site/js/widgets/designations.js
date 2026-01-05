/**
 * Designation Explainer - Simple Glossary Popup
 */

class DesignationExplainer {
    constructor() {
        this.activePopup = null;
        this.boundEscapeHandler = null;
        this.loadStyles();
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/designations.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/designations.css';
            document.head.appendChild(link);
        }
    }

    attach(element, designation = null, color = null) {
        element.classList.add('designation-trigger');
        if (color) element.dataset.designationColor = color;
        if (designation) element.dataset.designation = designation;
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.show(element, designation, color);
        });
    }

    show(triggerElement = null, designation = null, color = null) {
        this.hide();
        
        let accentColor = color || triggerElement?.dataset.designationColor;
        if (!accentColor) {
            const userColor = getComputedStyle(document.documentElement).getPropertyValue('--user-color').trim();
            accentColor = userColor || '#734ba1';
        }

        const currentDesignation = (designation || triggerElement?.dataset.designation || triggerElement?.textContent?.trim() || '').toUpperCase();
        
        const overlay = document.createElement('div');
        overlay.className = 'designation-overlay';
        
        const popup = document.createElement('div');
        popup.className = 'designation-popup';
        popup.style.setProperty('--designation-color', accentColor);
        
        popup.innerHTML = `
            <div class="designation-header">
                <span class="designation-title">Designations</span>
                <button class="designation-close" aria-label="Close">×</button>
            </div>
            <div class="designation-list">
                ${this._buildGlossary(currentDesignation)}
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            popup.classList.add('active');
        });
        
        this.activePopup = { overlay, popup };
        
        overlay.addEventListener('click', () => this.hide());
        popup.querySelector('.designation-close').addEventListener('click', () => this.hide());
        
        this.boundEscapeHandler = (e) => {
            if (e.key === 'Escape') this.hide();
        };
        document.addEventListener('keydown', this.boundEscapeHandler);
    }

    hide() {
        if (!this.activePopup) return;
        
        const { overlay, popup } = this.activePopup;
        overlay.classList.remove('active');
        popup.classList.remove('active');
        
        if (this.boundEscapeHandler) {
            document.removeEventListener('keydown', this.boundEscapeHandler);
            this.boundEscapeHandler = null;
        }
        
        setTimeout(() => {
            overlay.remove();
            popup.remove();
        }, 300);
        
        this.activePopup = null;
    }

    _buildGlossary(currentDesignation) {
        const sections = [
            {
                name: 'Titles',
                terms: [
                    ['KEEPER OF REVERIE HOUSE', 'stalwart of our canon'],
                    ['HOUSE PATRON', 'benefactor to many']
                ]
            },
            {
                name: 'Familiarities',
                terms: [
                    ['KNOWN', 'recognized figure of lore'],
                    ['WELL-KNOWN', 'familiar character of lore'],
                    ['REVERED', 'essential pillar of canon']
                ]
            },
            {
                name: 'Roles',
                terms: [
                    ['GREETER OF REVERIES', 'a welcoming guide'],
                    ['SPECTRUM MAPPER', 'a cartographic expert'],
                    ['COGITARIAN', 'a humanizing intelligence'],
                    ['PROVISIONER', 'a caring helper']
                ]
            },
            {
                name: 'Status',
                terms: [
                    ['DREAMER', 'one within our wild mindscape'],
                    ['DREAMWEAVER', 'one unique, capable, and aware'],
                    ['RESIDENT', 'one who stays at Reverie House'],
                    ['FORMER', 'one who has since dissipated']
                ]
            },
            {
                name: 'Affinity',
                terms: [
                    ['READER', 'has opened a book or two'],
                    ['PATRON', 'has earmarked many pages'],
                    ['ALTRUIST', 'has lost volumes in lending']
                ]
            }
        ];

        return sections.map(section => {
            const items = section.terms.map(([label, desc]) => {
                const isActive = currentDesignation.includes(label);
                return `
                    <div class="designation-item ${isActive ? 'active' : ''}">
                        <span class="designation-label">${label}</span>
                        <span class="designation-desc">${desc}</span>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="designation-section">
                    <div class="designation-section-title">${section.name}</div>
                    ${items}
                </div>
            `;
        }).join('');
    }
}

if (!window.designationExplainerWidget) {
    window.designationExplainerWidget = new DesignationExplainer();
    window.statusExplainerWidget = window.designationExplainerWidget;
}

window.DesignationExplainer = DesignationExplainer;
