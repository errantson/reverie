/**
 * App Password Request Modal Widget
 * 
 * A contextual modal for requesting Bluesky app passwords with customizable
 * purpose descriptions and examples.
 */

class AppPasswordRequest {
    constructor() {
        this.modal = null;
        this.onSubmit = null;
        this.config = null;
    }

    /**
     * Show the modal with contextual information
     * @param {Object} config - Configuration object
     * @param {string} config.title - Modal title
     * @param {string} config.description - Purpose description (HTML allowed)
     * @param {string} config.featureName - The specific feature being accessed (e.g., "biblio.bond", "greeter role")
     * @param {string} [config.roleColor] - Optional role color (e.g., "greeter", "mapper", "cogitarian")
     * @param {Function} onSubmitCallback - Called with (appPassword) when submitted
     */
    show(config, onSubmitCallback) {
        this.config = config;
        this.onSubmit = onSubmitCallback;
        this.render();
    }

    render() {
        // Remove any existing modal
        this.close();

        // Create modal overlay
        this.modal = document.createElement('div');
        this.modal.id = 'app-password-request-modal';
        this.modal.className = 'modal';
        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        };

        // Apply role color class if provided
        const roleClass = this.config.roleColor ? `role-${this.config.roleColor}` : '';

        this.modal.innerHTML = `
            <div class="modal-content ${roleClass}" onclick="event.stopPropagation()">
                <div class="modal-intro">
                    <strong class="modal-title">${this.config.title}</strong>
                    <div class="modal-description">
                        ${this.config.description}
                    </div>
                </div>
                <div class="modal-body">
                    
                    <p style="margin-top: 0.25rem;"><strong>Reverie House requires permission to act on your behalf:</strong></p>
                    <ol>
                        <li>Go to <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">Bluesky Settings → App Passwords</a></li>
                        <li>Create a new password named "reverie"</li>
                        <li>Copy and paste it below</li>
                    </ol>
                    
                    <div class="form-group">
                        <label for="app-password-request-input">App Password for ${this.config.title}:</label>
                        <input type="text" 
                               id="app-password-request-input" 
                               placeholder="xxxx-xxxx-xxxx-xxxx" 
                               autocomplete="off" 
                               autocorrect="off" 
                               autocapitalize="off" 
                               spellcheck="false">
                        <p class="simple-note">This grants authority to work on your behalf. Revoke anytime in <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">Bluesky settings</a>.</p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="action-button authorize-btn" id="app-password-request-submit">BECOME ${this.config.title.toUpperCase()}</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Inject styles if not already present
        this.injectStyles();

        // Setup event listeners
        this.setupListeners();

        // Show modal with animation
        setTimeout(() => this.modal.classList.add('active'), 10);

        // Focus input
        const input = document.getElementById('app-password-request-input');
        if (input) input.focus();
    }

    injectStyles() {
        if (document.getElementById('app-password-request-styles')) return;

        const style = document.createElement('style');
        style.id = 'app-password-request-styles';
        style.textContent = `
            #app-password-request-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 999999;
                align-items: center;
                justify-content: center;
            }
            
            #app-password-request-modal.active {
                display: flex;
            }
            
            #app-password-request-modal .modal-content {
                background: #f8f5e6;
                border: 3px solid #8b7355;
                padding: 1.25rem 2rem;
                max-width: 520px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                position: relative;
                z-index: 1000000;
            }
            
            /* Role-specific border colors */
            #app-password-request-modal .modal-content.role-greeter {
                border-color: var(--role-greeter);
            }
            
            #app-password-request-modal .modal-content.role-mapper {
                border-color: var(--role-mapper);
            }
            
            #app-password-request-modal .modal-content.role-cogitarian {
                border-color: var(--role-cogitarian);
            }
            
            .modal-intro {
                text-align: center;
                color: #555;
                line-height: 1.6;
                margin-bottom: 1rem;
                padding-bottom: 0.75rem;
                border-bottom: 2px solid #e0d5c5;
            }
            
            .modal-title {
                display: block;
                font-size: 1.2rem;
                color: #5d4a37;
                margin-bottom: 0.5rem;
            }
            
            /* Role-specific title colors */
            .modal-content.role-greeter .modal-title {
                color: var(--role-greeter-dark);
            }
            
            .modal-content.role-mapper .modal-title {
                color: var(--role-mapper-dark);
            }
            
            .modal-content.role-cogitarian .modal-title {
                color: var(--role-cogitarian-dark);
            }
            
            .modal-description {
                max-width: 460px;
                margin: 0 auto;
                font-size: 0.85rem;
                color: #555;
                line-height: 1.4;
            }
            
            .modal-body {
                margin-bottom: 0;
                line-height: 1.5;
                color: #2c1810;
            }
            
            .modal-body a {
                color: #3d8b8b;
                text-decoration: none;
                font-weight: 500;
            }
            
            .modal-body a:hover {
                color: #2d6a6a;
                text-decoration: underline;
            }
            
            .modal-body ol {
                padding-left: 2rem;
                text-align: left;
                max-width: 380px;
                margin: 0.35rem auto;
                display: inline-block;
            }
            
            .modal-body li {
                margin-bottom: 0.25rem;
            }
            
            .modal-body p {
                text-align: center;
                margin: 0.35rem 0;
            }
            
            .modal-body p strong {
                display: block;
                margin-top: 1rem;
            }
            
            .form-group {
                margin: 0.75rem 0;
                text-align: center;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.4rem;
                font-weight: 600;
                color: #2c1810;
            }
            
            .form-group input {
                width: 100%;
                max-width: 300px;
                padding: 0.6rem;
                border: 2px solid #8b7355;
                background: white;
                font-family: 'Courier New', monospace;
                font-size: 1rem;
                text-align: center;
            }
            
            .form-group input:focus {
                outline: none;
                border-color: #5d4a37;
            }
            
            /* Role-specific input focus colors */
            .modal-content.role-greeter .form-group input:focus {
                border-color: var(--role-greeter);
            }
            
            .modal-content.role-mapper .form-group input:focus {
                border-color: var(--role-mapper);
            }
            
            .modal-content.role-cogitarian .form-group input:focus {
                border-color: var(--role-cogitarian);
            }
            
            .small-note {
                font-size: 0.85rem;
                color: #666;
                margin-top: 0.5rem;
            }
            
            .simple-note {
                font-size: 0.8rem;
                color: #666;
                margin-top: 0.5rem;
            }
            
            .modal-actions {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                margin-top: 0;
                gap: 0.25rem;
            }
            
            .action-button {
                padding: 0.75rem 1.5rem;
                background: #8b7355;
                color: white;
                border: none;
                font-weight: 700;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .action-button:hover:not(:disabled) {
                background: #5d4a37;
            }
            
            /* Role-specific button colors */
            .modal-content.role-greeter .action-button {
                background: var(--role-greeter);
            }
            
            .modal-content.role-greeter .action-button:hover:not(:disabled) {
                background: var(--role-greeter-dark);
            }
            
            .modal-content.role-mapper .action-button {
                background: var(--role-mapper);
            }
            
            .modal-content.role-mapper .action-button:hover:not(:disabled) {
                background: var(--role-mapper-dark);
            }
            
            .modal-content.role-cogitarian .action-button {
                background: var(--role-cogitarian);
            }
            
            .modal-content.role-cogitarian .action-button:hover:not(:disabled) {
                background: var(--role-cogitarian-dark);
            }
            
            .action-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .authorize-btn {
                min-width: 320px;
                padding: 0.7rem 2rem !important;
            }
            
            .appreciation-text {
                font-size: 0.8rem;
                font-style: italic;
                color: #666;
                text-align: center;
            }
            
            @media (max-width: 600px) {
                .modal-content {
                    width: 95%;
                    padding: 1rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupListeners() {
        const input = document.getElementById('app-password-request-input');
        const submitBtn = document.getElementById('app-password-request-submit');

        if (submitBtn) {
            submitBtn.onclick = () => this.handleSubmit();
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSubmit();
                }
            });
        }
    }

    async handleSubmit() {
        const input = document.getElementById('app-password-request-input');
        const submitBtn = document.getElementById('app-password-request-submit');

        if (!input) return;

        const appPassword = input.value.replace(/-/g, '').trim();

        if (!appPassword || appPassword.length !== 16) {
            alert('Please enter a valid 16-character app password');
            input.focus();
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'CONNECTING...';
        }

        try {
            if (this.onSubmit) {
                await this.onSubmit(appPassword);
            }
            this.close();
        } catch (error) {
            console.error('Error submitting app password:', error);
            alert(`Error: ${error.message}`);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = this.config.buttonText;
            }
        }
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

// Make globally available
window.AppPasswordRequest = AppPasswordRequest;
window.appPasswordRequest = new AppPasswordRequest();

console.log('✅ [AppPasswordRequest] Widget loaded');
