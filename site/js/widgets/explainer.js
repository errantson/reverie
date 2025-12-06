
class Explainer {
    constructor() {
        this.loadStyles();
        this.definitions = this.getDefinitions();
        this.activePopup = null;
    }
    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/explainer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/explainer.css?v=3';
            document.head.appendChild(link);
        }
    }
    getDefinitions() {
        return {
            'Oblivion': {
                title: 'Oblivion',
                text: 'The axis measuring one\'s relationship with meaninglessness and void. High oblivion dreamers embrace the chaotic, spontaneous nature of existence without seeking deeper purpose. Low oblivion dreamers resist meaninglessness and search for significance in their experiences.'
            },
            'Entropy': {
                title: 'Entropy',
                text: 'The axis measuring one\'s relationship with order and chaos. High entropy dreamers create surreal, abstract realities that prioritize experience over structure. Low entropy dreamers craft ordered, meaningful patterns in their dreamweaving.'
            },
            'Authority': {
                title: 'Authority',
                text: 'The axis measuring one\'s relationship with power and control. High authority dreamers prefer hierarchical structures and decisive leadership. Low authority dreamers value distributed power and collective decision-making.'
            },
            'Liberty': {
                title: 'Liberty',
                text: 'The axis measuring one\'s relationship with freedom and autonomy. High liberty dreamers prioritize individual choice and self-determination. Low liberty dreamers value community bonds and collective responsibility over personal freedom.'
            },
            'Skeptic': {
                title: 'Skeptic',
                text: 'The axis measuring one\'s relationship with belief and doubt. High skeptic dreamers question established truths and maintain critical distance from accepted wisdom. Low skeptic dreamers more readily accept teachings and trust in established knowledge.'
            },
            'Receptive': {
                title: 'Receptive',
                text: 'The axis measuring one\'s relationship with external influence and internal conviction. High receptive dreamers remain open to new ideas and allow their beliefs to shift with experience. Low receptive dreamers hold firmly to their convictions.'
            },
            'adaptive': {
                title: 'Adaptive',
                text: 'Entropy • Liberty • Receptive. Adaptive dreamers embrace change and spontaneity, value personal freedom, and remain open to new experiences and perspectives. They thrive in dynamic, uncertain environments.'
            },
            'chaotic': {
                title: 'Chaotic',
                text: 'Entropy • Liberty • Skeptic. Chaotic dreamers embrace chaos and personal freedom while maintaining firm convictions. They create wild, spontaneous experiences but hold steady to their core beliefs.'
            },
            'intended': {
                title: 'Intended',
                text: 'Entropy • Authority • Receptive. Intended dreamers embrace change and structure, accepting authority while remaining open to new ideas. They bring order to chaos through receptive leadership.'
            },
            'prepared': {
                title: 'Prepared',
                text: 'Entropy • Authority • Skeptic. Prepared dreamers embrace dynamic change within structured frameworks, combining strategic authority with firm convictions. They plan for chaos.'
            },
            'contented': {
                title: 'Contented',
                text: 'Oblivion • Liberty • Receptive. Contented dreamers embrace meaninglessness and personal freedom while remaining open to experiences. They find peace in accepting the void without rigid beliefs.'
            },
            'assertive': {
                title: 'Assertive',
                text: 'Oblivion • Liberty • Skeptic. Assertive dreamers accept meaninglessness and value freedom while holding firm convictions. They assert their views despite embracing existential uncertainty.'
            },
            'ordered': {
                title: 'Ordered',
                text: 'Oblivion • Authority • Receptive. Ordered dreamers accept meaninglessness while maintaining structure and remaining open to new interpretations. They impose order on the void flexibly.'
            },
            'guarded': {
                title: 'Guarded',
                text: 'Oblivion • Authority • Skeptic. Guarded dreamers accept meaninglessness while maintaining strict structures and firm beliefs. They protect against chaos through disciplined order and conviction.'
            },
        };
    }
    attach(element, term, color = null) {
        if (!this.definitions[term]) {
            console.warn(`No definition found for term: ${term}`);
            return;
        }
        element.classList.add('explainer-trigger');
        element.style.cursor = 'help';
        element.style.cursor = 'pointer';
        
        // Store the color on the element for later use
        if (color) {
            element.dataset.explainerColor = color;
        }
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.show(element, term, color);
        });
    }
    show(triggerElement, term, color = null) {
        this.hide();
        const def = this.definitions[term];
        if (!def) return;
        
        // Determine color with fallback hierarchy: passed color → user color → default purple
        let explainerColor = color;
        if (!explainerColor && triggerElement && triggerElement.dataset.explainerColor) {
            explainerColor = triggerElement.dataset.explainerColor;
        }
        if (!explainerColor) {
            explainerColor = getComputedStyle(document.documentElement)
                .getPropertyValue('--reverie-core-color').trim() || '#734ba1';
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'explainer-overlay';
        document.body.appendChild(overlay);
        this.overlay = overlay;
        const popup = document.createElement('div');
        popup.className = 'explainer-popup';
        popup.style.borderColor = explainerColor;
        popup.innerHTML = `
            <div class="explainer-header" style="background: ${explainerColor};">
                <img src="/assets/icon.png" alt="" class="explainer-icon">
                <span class="explainer-title">${def.title}</span>
            </div>
            <div class="explainer-text">${def.text}</div>
        `;
        document.body.appendChild(popup);
        this.activePopup = popup;
        setTimeout(() => {
            const rect = popup.getBoundingClientRect();
            popup.style.left = '50%';
            popup.style.top = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
        }, 10);
        setTimeout(() => {
            overlay.classList.add('active');
            popup.classList.add('active');
        }, 10);
        overlay.addEventListener('click', () => this.hide());
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') this.hide();
        };
        document.addEventListener('keydown', this.escapeHandler);
    }
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            setTimeout(() => {
                this.overlay.remove();
                this.overlay = null;
            }, 300);
        }
        if (this.activePopup) {
            this.activePopup.classList.remove('active');
            setTimeout(() => {
                this.activePopup.remove();
                this.activePopup = null;
            }, 300);
        }
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }
}
if (typeof window !== 'undefined') {
    window.explainerWidget = new Explainer();
}
window.Explainer = Explainer;
