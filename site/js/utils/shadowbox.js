/**
 * Shadowbox Utility
 * Universal method for displaying dialogue.js in an isolated shadowbox overlay
 */

class Shadowbox {
    constructor(options = {}) {
        this.overlay = null;
        this.closeButton = null;
        this.contentContainer = null;
        this.dialogue = null;
        this.onClose = options.onClose || null;
        this.showCloseButton = options.showCloseButton !== false; // Default true
        this.zIndex = null;
    }

    /**
     * Create and show the shadowbox
     */
    create() {
        // Calculate z-index based on number of active shadowboxes
        const stackLevel = Shadowbox.activeShadowboxes.length;
        this.zIndex = Shadowbox.baseZIndex + (stackLevel * 100);

        // Add this shadowbox to active stack
        Shadowbox.activeShadowboxes.push(this);

        console.log(`🎭 [Shadowbox] Creating shadowbox at z-index ${this.zIndex} (stack level ${stackLevel})`);

        // Only prevent scroll if this is the first shadowbox
        if (stackLevel === 0) {
            // Prevent body scroll and layout shifts
            this.originalBodyOverflow = document.body.style.overflow || '';
            this.originalBodyWidth = document.body.style.width || '';
            this.originalHtmlOverflow = document.documentElement.style.overflow || '';
            this.originalHtmlWidth = document.documentElement.style.width || '';

            // Set body and html width to current width to prevent layout shift when scrollbar disappears
            const currentWidth = document.body.offsetWidth;
            document.body.style.width = currentWidth + 'px';
            document.documentElement.style.width = currentWidth + 'px';
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }

        // If there's a previously active shadowbox, dim and disable it
        const prev = Shadowbox.activeShadowboxes[Shadowbox.activeShadowboxes.length - 2];
        if (prev && prev.overlay) {
            // Save previous styles so we can restore later
            prev._savedPointerEvents = prev.overlay.style.pointerEvents || '';
            prev._savedOpacity = prev.overlay.style.opacity || '';
            prev._savedFilter = prev.overlay.style.filter || '';

            // Dim and disable interaction on previous overlay
            prev.overlay.style.transition = prev.overlay.style.transition || 'opacity 0.12s ease, filter 0.12s ease';
            prev.overlay.style.pointerEvents = 'none';
            prev.overlay.style.opacity = '0.6';
            prev.overlay.style.filter = 'brightness(0.85)';
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'shadowbox-overlay';
        // Start hidden for transition
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: ${this.zIndex};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.12s ease;
        `;

        // Create content container (dialogue will be appended here)
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'shadowbox-content';
        this.contentContainer.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        `;

        // Create close button if enabled
        if (this.showCloseButton) {
            this.closeButton = document.createElement('button');
            this.closeButton.textContent = '✕';
            this.closeButton.className = 'shadowbox-close';
            this.closeButton.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid rgba(255, 255, 255, 0.3);
                color: white;
                font-size: 24px;
                width: 48px;
                height: 48px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.18s;
                z-index: ${this.zIndex + 1};
            `;
            this.closeButton.onmouseover = () => {
                this.closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
                this.closeButton.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            };
            this.closeButton.onmouseout = () => {
                this.closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
                this.closeButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            };
            this.closeButton.onclick = () => this.close();

            this.overlay.appendChild(this.closeButton);
        }

        this.overlay.appendChild(this.contentContainer);
        // initial content transform for smoother open animation
        this.contentContainer.style.transform = 'translateY(8px) scale(0.99)';
        this.contentContainer.style.transition = 'transform 180ms ease, opacity 120ms ease';

        // Allow click-outside to close (always enabled)
        // Check for clicks on both overlay and contentContainer
        const handleOutsideClick = (e) => {
            if (e.target === this.overlay || e.target === this.contentContainer) {
                console.log('🎭 [Shadowbox] Clicked outside dialogue, closing');
                this.close();
            }
        };
        
        this.overlay.addEventListener('click', handleOutsideClick);
        this.contentContainer.addEventListener('click', handleOutsideClick);

        document.body.appendChild(this.overlay);

        // Trigger open transition on next frame
        requestAnimationFrame(() => {
            this.overlay.style.opacity = '1';
            this.contentContainer.style.transform = 'translateY(0) scale(1)';
        });

        return this;
    }

    /**
     * Load and display a dialogue by key
     * @param {string} key - Dialogue key to load
     * @param {Object} callbackContext - Context for button callbacks
     */
    async showDialogue(key, callbackContext = {}) {
        if (!this.overlay) {
            this.create();
        }

        // Ensure dialogue.js is loaded (should be in HTML now)
        if (!window.Dialogue) {
            console.warn('⚠️ [Shadowbox] Dialogue widget not loaded yet, waiting...');
            await new Promise(resolve => {
                const checkDialogue = () => {
                    if (window.Dialogue) {
                        resolve();
                    } else {
                        setTimeout(checkDialogue, 50);
                    }
                };
                checkDialogue();
            });
        }

        // Create dialogue widget
        this.dialogue = new window.Dialogue({
            typewriterSpeed: 30,
            onComplete: () => {
                // Quick close on completion
                setTimeout(() => this.close(), 100);
            },
            callbackContext: {
                ...callbackContext,
                // Provide shadowbox reference for closing
                _shadowbox: this,
                // Override end callback to close shadowbox
                end: () => {
                    if (this.dialogue) {
                        this.dialogue.end();
                    }
                    this.close(); // Immediate close on manual end
                }
            }
        });

        // Initialize the dialogue (creates its container and appends to body)
        this.dialogue.init();

        // CRITICAL: Move the dialogue container into the shadowbox
        // The dialogue widget creates its own container on body, we need to move it
        const dialogueContainer = this.dialogue.container;
        if (dialogueContainer && dialogueContainer.parentNode === document.body) {
            // Remove from body and append to our content container
            document.body.removeChild(dialogueContainer);
            this.contentContainer.appendChild(dialogueContainer);
            
            // Make it visible within the shadowbox
            dialogueContainer.style.position = 'relative';
            dialogueContainer.style.zIndex = 'auto';
        }

        // Start the dialogue
        console.log(`🎭 [Shadowbox] Starting dialogue: ${key}`);
        await this.dialogue.startFromKey(key);
    }

    /**
     * Show dialogue from pre-loaded data (for gatekeep responses)
     * @param {Object} dialogueData - Dialogue data with messages array
     * @param {Object} callbackContext - Context for button callbacks
     */
    async showDialogueData(dialogueData, callbackContext = {}) {
        if (!this.overlay) {
            this.create();
        }

        // Ensure dialogue.js is loaded
        if (!window.Dialogue) {
            await this.loadDialogueScript();
        }

        // Create dialogue widget
        this.dialogue = new window.Dialogue({
            typewriterSpeed: 30,
            onComplete: () => {
                setTimeout(() => this.close(), 100);
            },
            callbackContext: {
                ...callbackContext,
                end: () => {
                    if (this.dialogue) {
                        this.dialogue.end();
                    }
                    this.close(); // Immediate close on manual end
                }
            }
        });

        // Initialize the dialogue
        this.dialogue.init();

        // Move dialogue container into shadowbox
        const dialogueContainer = this.dialogue.container;
        if (dialogueContainer && dialogueContainer.parentNode === document.body) {
            document.body.removeChild(dialogueContainer);
            this.contentContainer.appendChild(dialogueContainer);
            
            dialogueContainer.style.position = 'relative';
            dialogueContainer.style.zIndex = 'auto';
        }

        // Start dialogue with pre-loaded data
        console.log(`🎭 [Shadowbox] Starting dialogue from data:`, dialogueData.key);
        await this.dialogue.startFromData(dialogueData);
    }

    /**
     * Close and remove the shadowbox
     */
    close() {
        console.log(`🎭 [Shadowbox] Closing shadowbox at z-index ${this.zIndex}`);
        
        // Remove this shadowbox from active stack
        const index = Shadowbox.activeShadowboxes.indexOf(this);
        if (index > -1) {
            Shadowbox.activeShadowboxes.splice(index, 1);
        }
        
        // Restore the previous shadowbox (if any) so it's interactive again
        const newTop = Shadowbox.activeShadowboxes[Shadowbox.activeShadowboxes.length - 1];
        if (newTop && newTop.overlay) {
            try {
                newTop.overlay.style.pointerEvents = newTop._savedPointerEvents || '';
                newTop.overlay.style.opacity = newTop._savedOpacity || '1';
                newTop.overlay.style.filter = newTop._savedFilter || '';
            } catch (e) {
                console.warn('⚠️ [Shadowbox] Failed to restore underlying overlay styles', e);
            }
            delete newTop._savedPointerEvents;
            delete newTop._savedOpacity;
            delete newTop._savedFilter;
        }
        
        if (this.dialogue) {
            this.dialogue.end();
            this.dialogue = null;
        }

        if (this.overlay) {
            // Only restore scroll if this was the last shadowbox
            if (Shadowbox.activeShadowboxes.length === 0) {
                // Restore body and html scroll and width
                if (this.originalBodyOverflow !== undefined) {
                    if (this.originalBodyOverflow === '') {
                        document.body.style.removeProperty('overflow');
                    } else {
                        document.body.style.overflow = this.originalBodyOverflow;
                    }
                }
                if (this.originalBodyWidth !== undefined) {
                    if (this.originalBodyWidth === '') {
                        document.body.style.removeProperty('width');
                    } else {
                        document.body.style.width = this.originalBodyWidth;
                    }
                }
                if (this.originalHtmlOverflow !== undefined) {
                    if (this.originalHtmlOverflow === '') {
                        document.documentElement.style.removeProperty('overflow');
                    } else {
                        document.documentElement.style.overflow = this.originalHtmlOverflow;
                    }
                }
                if (this.originalHtmlWidth !== undefined) {
                    if (this.originalHtmlWidth === '') {
                        document.documentElement.style.removeProperty('width');
                    } else {
                        document.documentElement.style.width = this.originalHtmlWidth;
                    }
                }
            }
            
            // Animate content down slightly then fade overlay
            try {
                this.contentContainer.style.transform = 'translateY(8px) scale(0.99)';
            } catch (e) {}
            // Quick fade out
            this.overlay.style.transition = 'opacity 0.15s ease-out';
            this.overlay.style.opacity = '0';
            
            // Remove after fade
            setTimeout(() => {
                if (this.overlay) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }, 150);
        }

        if (this.onClose) {
            this.onClose();
        }
    }
    
    /**
     * Check if shadowbox is currently open
     */
    isOpen() {
        return this.overlay !== null && document.body.contains(this.overlay);
    }
}

// Static array to track all active shadowboxes for stacking
Shadowbox.activeShadowboxes = [];
Shadowbox.baseZIndex = 10700;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shadowbox;
}

// Make available globally
window.Shadowbox = Shadowbox;
