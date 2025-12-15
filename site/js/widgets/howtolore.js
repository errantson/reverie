/**
 * How to Lore Widget
 * Displays lore.farm explanation modal using shadowbox
 */

class HowToLore {
    constructor() {
        this.el = null; // overlay element
        this.container = null; // modal container
        this.loremasters = [];
        this.dreamers = [];
        this.userColor = window.colorManager?.color || window.colorManager?.getColor?.() || '#734ba1';
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    setData(loremasters = [], dreamers = []) {
        this.loremasters = loremasters;
        this.dreamers = dreamers;
    }

    async show() {
        // If an existing explanation overlay exists, reuse it
        if (document.getElementById('howToLoreOverlay')) {
            const existing = document.getElementById('howToLoreOverlay');
            existing.classList.add('active');
            this.el = existing;
            this.container = existing.querySelector('.explanation-modal');
            this._trapFocus();
            return;
        }

        // Build overlay using existing page styles (.explanation-modal-overlay / .explanation-modal)
        this.el = document.createElement('div');
        this.el.id = 'howToLoreOverlay';
        this.el.className = 'explanation-modal-overlay active';
        this.el.setAttribute('role', 'dialog');
        this.el.setAttribute('aria-modal', 'true');
        this.el.setAttribute('aria-label', 'About lore.farm');

        this.container = document.createElement('div');
        this.container.className = 'explanation-modal';
        this.container.innerHTML = this.buildContent();

        // Close button (visible and accessible)
        const closeBtn = document.createElement('button');
        closeBtn.className = 'explanation-modal-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => this.close());

        this.container.appendChild(closeBtn);
        this.el.appendChild(this.container);
        document.body.appendChild(this.el);

        // Load loremasters if none provided
        if (!this.loremasters || this.loremasters.length === 0) {
            this._loadLoremastersIntoContainer();
        } else {
            this._renderLoremasters();
        }

        // Click outside to close
        this.el.addEventListener('click', (e) => {
            if (e.target === this.el) this.close();
        });

        document.addEventListener('keydown', this._onKeyDown);
        this._trapFocus();
    }

    buildContent() {
        return `
            <h2>lore.farm</h2>
            <p>
                <strong><a href="https://lore.farm" target="_blank" rel="noopener">lore.farm</a></strong>
                is a decentralized canonization and proof-of-lore system for shared creative worlds across
                <a href="https://atproto.com" target="_blank" rel="noopener">ATProtocol</a>.
            </p>

            <div style="margin:18px 0; padding:12px; background:#fafafa; border-left:4px solid #b794d6;">
                <div style="font-weight:600; margin-bottom:8px;">lore</div>
                <div style="color:#555;">Any dreamer may use this label to signify their dreams as intended for our collective <strong>Reverie House</strong> lore.</div>
            </div>

            <div style="margin:18px 0; padding:12px; background:#fafafa; border-left:4px solid ${this.userColor};">
                <div style="font-weight:600; margin-bottom:8px;">canon</div>
                <div style="color:#555;">This label signifies that a dream has been declared part of the collective <strong>Reverie House</strong> canon by the loremasters.</div>
            </div>

            <div id="howToLoreLoremasters" class="loremasters-list">
                <div style="text-align:center; color:#999; padding:20px;">Loading loremasters...</div>
            </div>

            <div style="display:flex; justify-content:center; margin-top:32px;">
                <button id="howToLoreBackBtn" type="button" style="
                    background: ${this.userColor};
                    color: #fff;
                    border: none;
                    border-radius: 0;
                    font-weight: 700;
                    font-size: 1rem;
                    padding: 12px 36px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    box-shadow: 0 2px 8px rgba(115,75,161,0.10);
                    cursor: pointer;
                    transition: background 0.2s;
                    outline: none;
                ">BACK</button>
            </div>

            <p style="margin-top:18px; color:#999; font-size:0.95em;">Learn more at <a href="https://lore.farm" target="_blank" rel="noopener" style="color:${this.userColor};">lore.farm</a></p>
        `;
    }
    // ...existing code...
    async show() {
        // ...existing code...

        // Add event listener for BACK button
        setTimeout(() => {
            const backBtn = this.container.querySelector('#howToLoreBackBtn');
            if (backBtn) {
                backBtn.addEventListener('click', () => this.close());
                backBtn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.close();
                    }
                });
            }
        }, 0);
    }

    async _loadLoremastersIntoContainer() {
        try {
            const response = await fetch(`https://lore.farm/api/worlds/${window.location.hostname.replace(/^www\\./, '')}`);
            if (!response.ok) throw new Error('Failed to fetch world data');
            const world = await response.json();
            const ids = world.loremasters || [];
            this.loremasters = ids;
            this._renderLoremasters();
        } catch (err) {
            const el = this.container.querySelector('#howToLoreLoremasters');
            if (el) el.innerHTML = `<div style="text-align:center; color:#666; padding:20px;">Unable to load loremasters.</div>`;
            console.error('HowToLore: failed to load loremasters', err);
        }
    }

    _renderLoremasters() {
        const el = this.container.querySelector('#howToLoreLoremasters');
        if (!el) return;

        if (!Array.isArray(this.loremasters) || this.loremasters.length === 0) {
            el.innerHTML = `<div style="text-align:center; color:#999; padding:20px;">No loremasters configured</div>`;
            return;
        }

        // If loremasters are full profile objects, normalize to {did, handle, avatar}
        const items = this.loremasters.map(lm => {
            if (typeof lm === 'string') return { did: lm };
            return lm;
        }).map(lm => {
            const handle = lm.handle || (lm.did || '').split(':').pop();
            const avatar = lm.avatar || '/assets/icon_face.png';
            const did = lm.did || '';
            const dreamer = (this.dreamers || []).find(d => d.did === did);
            const url = dreamer ? `/dreamer?did=${encodeURIComponent(did)}` : `https://bsky.app/profile/${handle}`;
            return `
                <div class="loremaster-item">
                    <img src="${avatar}" alt="${handle}" class="loremaster-avatar" onerror="this.src='/assets/icon_face.png'">
                    <a href="${url}" class="dreamer-link loremaster-link" data-dreamer-did="${encodeURIComponent(did)}">${dreamer ? (dreamer.name || `@${handle}`) : `@${handle}`}</a>
                </div>
            `;
        }).join('');

        el.innerHTML = items;
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') this.close();
        if (e.key === 'Tab') this._maintainFocus(e);
    }

    _trapFocus() {
        // Focus first focusable element in modal
        const focusable = this.container.querySelectorAll('a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
        if (focusable && focusable.length) {
            focusable[0].focus();
        } else {
            this.container.setAttribute('tabindex', '-1');
            this.container.focus();
        }
    }

    _maintainFocus(e) {
        const focusable = Array.from(this.container.querySelectorAll('a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])'))
            .filter(el => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
        }
    }

    close() {
        if (this.el) {
            this.el.classList.remove('active');
            this.el.remove();
        }
        document.removeEventListener('keydown', this._onKeyDown);
    }
}

// Make globally available
window.HowToLore = HowToLore;
