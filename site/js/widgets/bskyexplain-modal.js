/**
 * Bluesky Explanation Modal Widget
 * 
 * A modal popup that explains what Bluesky is and how souvenirs work at Reverie House.
 * Can be opened from dialogue buttons or other UI elements.
 * 
 * Usage:
 * const modal = new BskyExplainModal();
 * modal.open();
 * 
 * Or from a dialogue button:
 * {
 *   text: 'What is Bluesky?',
 *   popup: 'bskyexplain'
 * }
 */

class BskyExplainModal {
    constructor() {
        this.container = null;
        this.overlay = null;
        this.modalBox = null;
        this.isOpen = false;
        
        this.loadStyles();
    }
    
    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/bskyexplain-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/bskyexplain-modal.css';
            document.head.appendChild(link);
        }
    }
    
    /**
     * Open the Bluesky explanation modal
     */
    open() {
        if (this.isOpen) {
            console.log('⚠️ Bluesky explanation modal already open');
            return;
        }
        
        this.isOpen = true;
        this.render();
        
        // Animate in
        requestAnimationFrame(() => {
            if (this.overlay) {
                this.overlay.classList.add('visible');
            }
        });
    }
    
    render() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'bskyexplain-overlay';
        
        // Create modal box
        this.modalBox = document.createElement('div');
        this.modalBox.className = 'bskyexplain-modal';
        
        // Create body with logo, embed, and actions
        const body = document.createElement('div');
        body.className = 'bskyexplain-modal-body';
        body.innerHTML = `
            <div class="bskyexplain-content">
                <div class="bskyexplain-embed-container">
                    <blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:yauphjufk7phkwurn266ybx2/app.bsky.feed.post/3lljjzcydwc25" data-bluesky-cid="bafyreihxtgu2vh6zdqzvmrchyy2c73y2eqjrskplzvzzvebcov35kxegoq">
                        <p lang="en">What do they call you between dreams?<br><br>Reply with your name, and I'll remember you.</p>
                        &mdash; errantson (<a href="https://bsky.app/profile/did:plc:yauphjufk7phkwurn266ybx2?ref_src=embed">@reverie.house</a>) 
                        <a href="https://bsky.app/profile/did:plc:yauphjufk7phkwurn266ybx2/post/3lljjzcydwc25?ref_src=embed">November 14, 2024 at 5:05 PM</a>
                    </blockquote>
                </div>
                
                <p class="bskyexplain-text">You can answer on Bluesky and come right back — or login to continue.</p>
                
                <div class="bskyexplain-actions">
                    <a href="https://bsky.app/profile/reverie.house/post/3lljjzcydwc25" target="_blank" rel="noopener noreferrer" class="bskyexplain-btn bskyexplain-btn-primary">
                        Answer on Bluesky
                    </a>
                    <p class="bskyexplain-footer-text">
                        Need an account? Keep talking to errantson
                    </p>
                </div>
            </div>
        `;
        
        // Assemble modal
        this.modalBox.appendChild(body);
        this.overlay.appendChild(this.modalBox);
        
        // Add to DOM
        document.body.appendChild(this.overlay);
        
        // Load Bluesky embed script
        if (!document.querySelector('script[src*="embed.bsky.app"]')) {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://embed.bsky.app/static/embed.js';
            script.charset = 'utf-8';
            document.head.appendChild(script);
        } else {
            // Refresh embeds if script already loaded
            setTimeout(() => {
                if (window.bluesky && window.bluesky.scan) {
                    window.bluesky.scan();
                }
            }, 100);
        }
        
        // Attach event listeners
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        // Action buttons
        const loginBtn = this.modalBox.querySelector('[data-action="login"]');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.close();
                // Trigger login widget
                if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                    window.loginWidget.showLoginPopup();
                }
            });
        }
        
        // Click outside to close (stop propagation to prevent shadowbox from closing)
        this.overlay.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from reaching shadowbox behind
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Also prevent modal box clicks from propagating
        this.modalBox.addEventListener('click', (e) => {
            e.stopPropagation();
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
    window.BskyExplainModal = BskyExplainModal;
    
    // Create a global instance for easy access
    window.bskyExplainModal = new BskyExplainModal();
    
    console.log('✅ [BskyExplainModal] Widget loaded');
}
