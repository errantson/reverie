/**
 * Simple Popup Widget
 * A lightweight notification/message popup system for Reverie House
 * 
 * Usage:
 *   Popup.show('Message text');
 *   Popup.show('Message text', { type: 'info', duration: 5000 });
 *   Popup.show('Message text', { 
 *     type: 'warning',
 *     buttons: [
 *       { text: 'OK', onClick: () => {} },
 *       { text: 'Cancel', onClick: () => {} }
 *     ]
 *   });
 */

class PopupWidget {
    constructor() {
        this.activePopups = [];
        this.maxPopups = 3;
        this.lastCursorX = window.innerWidth / 2;
        this.lastCursorY = window.innerHeight / 2;
        
        // Track cursor position
        document.addEventListener('mousemove', (e) => {
            this.lastCursorX = e.clientX;
            this.lastCursorY = e.clientY;
        });
    }

    /**
     * Show a popup message
     * @param {string} message - The message to display
     * @param {Object} options - Configuration options
     * @param {string} options.title - Optional title for the popup
     * @param {string} options.type - Popup type: 'info', 'warning', 'error', 'success' (default: 'info')
     * @param {number} options.duration - Auto-dismiss duration in ms (default: 4000, 0 = no auto-dismiss)
     * @param {Array} options.buttons - Array of button objects with {text, onClick} properties
     * @param {boolean} options.dismissible - Can be dismissed by clicking X (default: true)
     * @returns {Object} Popup instance with dismiss() method
     */
    show(message, options = {}) {
        const {
            title = '',
            type = 'info',
            duration = 4000,
            buttons = [],
            dismissible = true
        } = options;

        // Remove oldest popup if at max capacity
        if (this.activePopups.length >= this.maxPopups) {
            this.activePopups[0].dismiss();
        }

        // Create shadowbox backdrop if first popup
        if (this.activePopups.length === 0) {
            this.createShadowbox();
        }

        // Create popup container
        const popup = document.createElement('div');
        popup.className = `reverie-popup reverie-popup-${type}`;
        
        // Create content wrapper
        const content = document.createElement('div');
        content.className = 'reverie-popup-content';
        
        // Add title if provided
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'reverie-popup-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }
        
        // Add message
        const messageEl = document.createElement('div');
        messageEl.className = 'reverie-popup-message';
        messageEl.innerHTML = message; // Use innerHTML to support HTML tags
        content.appendChild(messageEl);
        
        // Add buttons if provided
        if (buttons.length > 0) {
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'reverie-popup-buttons';
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = 'reverie-popup-btn';
                button.textContent = btn.text;
                button.onclick = () => {
                    if (btn.onClick) btn.onClick();
                    popupInstance.dismiss();
                };
                buttonsContainer.appendChild(button);
            });
            
            content.appendChild(buttonsContainer);
        }
        
        popup.appendChild(content);
        
        // Add close button if dismissible
        if (dismissible) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'reverie-popup-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => popupInstance.dismiss();
            popup.appendChild(closeBtn);
        }
        
        // Create popup instance
        const popupInstance = {
            element: popup,
            dismiss: () => {
                popup.classList.add('reverie-popup-hiding');
                setTimeout(() => {
                    if (popup.parentElement) {
                        popup.remove();
                    }
                    const index = this.activePopups.indexOf(popupInstance);
                    if (index > -1) {
                        this.activePopups.splice(index, 1);
                    }
                    // Remove shadowbox if no more popups
                    if (this.activePopups.length === 0) {
                        this.removeShadowbox();
                    }
                }, 300);
            }
        };
        
        // Add to active popups
        this.activePopups.push(popupInstance);
        
        // Add to DOM
        document.body.appendChild(popup);
        
        // Set transform-origin based on cursor position
        const originX = (this.lastCursorX / window.innerWidth) * 100;
        const originY = (this.lastCursorY / window.innerHeight) * 100;
        popup.style.transformOrigin = `${originX}% ${originY}%`;
        
        // Trigger animation
        requestAnimationFrame(() => {
            popup.classList.add('reverie-popup-visible');
        });
        
        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                if (popup.parentElement) {
                    popupInstance.dismiss();
                }
            }, duration);
        }
        
        return popupInstance;
    }

    /**
     * Create shadowbox backdrop
     */
    createShadowbox() {
        if (this.shadowbox) return;
        
        this.shadowbox = document.createElement('div');
        this.shadowbox.className = 'reverie-popup-shadowbox';
        document.body.appendChild(this.shadowbox);
        
        requestAnimationFrame(() => {
            this.shadowbox.classList.add('reverie-popup-shadowbox-visible');
        });
    }

    /**
     * Remove shadowbox backdrop
     */
    removeShadowbox() {
        if (!this.shadowbox) return;
        
        this.shadowbox.classList.remove('reverie-popup-shadowbox-visible');
        setTimeout(() => {
            if (this.shadowbox && this.shadowbox.parentElement) {
                this.shadowbox.remove();
                this.shadowbox = null;
            }
        }, 300);
    }

    /**
     * Dismiss all active popups
     */
    dismissAll() {
        [...this.activePopups].forEach(popup => popup.dismiss());
    }
}

// Create global singleton instance
window.Popup = new PopupWidget();

console.log('✅ [Popup] Simple popup widget loaded');
