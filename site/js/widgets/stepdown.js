/**
 * Step Down Widget
 * 
 * Provides a consistent, dramatic popup interface for stepping down from roles
 * Used by both work.html and dashboard.js
 */

class StepDownWidget {
    constructor() {
        this.injectStyles();
    }

    /**
     * Inject CSS styles for the step-down popup
     */
    injectStyles() {
        if (document.getElementById('stepdown-widget-styles')) {
            return; // Already injected
        }

        const style = document.createElement('style');
        style.id = 'stepdown-widget-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes popIn {
                0% { transform: scale(0.3); opacity: 0; }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }

            .stepdown-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }

            .stepdown-popup {
                background: linear-gradient(135deg, #8b7355 0%, #a0826d 100%);
                padding: 2.5rem 3rem;
                border: 5px solid #5d4a37;
                border-radius: 0;
                box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
                max-width: 550px;
                text-align: center;
                animation: popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                position: relative;
            }

            .stepdown-title {
                color: white;
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 1rem;
                line-height: 1.5;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .stepdown-message {
                color: rgba(255, 255, 255, 0.95);
                font-size: 1.1rem;
                margin-bottom: 2rem;
                line-height: 1.7;
            }

            .stepdown-buttons {
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
            }

            .stepdown-cancel,
            .stepdown-confirm {
                padding: 0.9rem 2.5rem;
                font-weight: 700;
                font-size: 1.05rem;
                cursor: pointer;
                border-radius: 0;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
                transition: all 0.2s;
                border: 3px solid;
            }

            .stepdown-cancel {
                background: white;
                color: #8b7355;
                border-color: #8b7355;
            }

            .stepdown-cancel:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            }

            .stepdown-confirm {
                background: #5d4a37;
                color: white;
                border-color: #3d2a1f;
            }

            .stepdown-confirm:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                background: #4a3a2e;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show the step-down confirmation popup
     * @param {string} role - The role to step down from (e.g., 'greeter')
     * @param {function} onConfirm - Callback function when user confirms step down
     */
    show(role, onConfirm) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'stepdown-overlay';

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'stepdown-popup';

        // Role-specific messages
        const roleDisplayName = this.getRoleDisplayName(role);
        const roleMessage = this.getRoleMessage(role);

        popup.innerHTML = `
            <div class="stepdown-title">
                Step Down as ${roleDisplayName}?
            </div>
            <div class="stepdown-message">
                ${roleMessage}
            </div>
            <div class="stepdown-buttons">
                <button class="stepdown-cancel">
                    NEVERMIND
                </button>
                <button class="stepdown-confirm">
                    STEP DOWN NOW
                </button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Button handlers
        const cancelBtn = popup.querySelector('.stepdown-cancel');
        const confirmBtn = popup.querySelector('.stepdown-confirm');

        cancelBtn.onclick = () => {
            overlay.remove();
        };

        confirmBtn.onclick = async () => {
            overlay.remove();
            if (typeof onConfirm === 'function') {
                await onConfirm();
            }
        };

        // Close on overlay click (optional)
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
    }

    /**
     * Get display name for a role
     */
    getRoleDisplayName(role) {
        const roleNames = {
            'greeter': 'Greeter',
            'moderator': 'Moderator',
            'curator': 'Curator'
        };
        return roleNames[role] || role.charAt(0).toUpperCase() + role.slice(1);
    }

    /**
     * Get step-down message for a role
     */
    getRoleMessage(role) {
        const messages = {
            'greeter': 'You will <strong>immediately cease</strong> to be Greeter of Reveries.<br><br>This work will be left vacant until someone new volunteers.',
            'moderator': 'You will <strong>immediately cease</strong> to be a Moderator.<br><br>This role will be left vacant until someone new volunteers.',
            'curator': 'You will <strong>immediately cease</strong> to be a Curator.<br><br>This role will be left vacant until someone new volunteers.'
        };
        return messages[role] || `You will <strong>immediately cease</strong> this role.<br><br>This work will be left vacant until someone new volunteers.`;
    }
}

// Create a global singleton instance
window.StepDownWidget = new StepDownWidget();
