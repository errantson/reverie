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
     * @param {Array} [config.examples] - Optional array of example objects with {text: "..."}
     * @param {string} [config.exampleLabel] - Label for examples section
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

        const showExamples = this.config.examples && this.config.examples.length > 0;
        const exampleHTML = showExamples ? `
            <div class="example-post-preview" id="modal-example-preview">
                <div class="example-header">
                    <button class="example-nav-btn" onclick="window.appPasswordRequest.previousExample()">‹</button>
                    <div class="example-label">${this.config.exampleLabel || 'Examples'}</div>
                    <button class="example-nav-btn" onclick="window.appPasswordRequest.nextExample()">›</button>
                </div>
                <div class="example-post" id="example-post">
                    <div class="post-text">${this.config.examples[0].text}</div>
                </div>
            </div>
        ` : '';

        this.modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-intro">
                    <strong>${this.config.title}</strong><br>
                    <div style="max-width: 500px; margin: 0.5rem auto 0 auto; font-size: 10pt;">
                        ${this.config.description}
                    </div>
                </div>
                <div class="modal-body">
                    ${exampleHTML}
                    
                    <p style="margin-top: 1rem;"><strong>Reverie House requires permission to act on your behalf:</strong></p>
                    <ol>
                        <li>Go to <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">Bluesky Settings → App Passwords</a></li>
                        <li>Create a new password named "reverie-house"</li>
                        <li>Copy and paste it below</li>
                    </ol>
                    
                    <div class="form-group">
                        <label for="app-password-request-input">App Password <span>for ${this.config.featureName}</span>:</label>
                        <input type="text" 
                               id="app-password-request-input" 
                               placeholder="xxxx-xxxx-xxxx-xxxx" 
                               autocomplete="off" 
                               autocorrect="off" 
                               autocapitalize="off" 
                               spellcheck="false">
                        <p class="small-note">This grants Reverie House authority to work on your behalf. Once connected, you'll have access to the full suite of features. You can revoke this anytime in your <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">Bluesky settings</a>.</p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="action-button authorize-btn" id="app-password-request-submit">GRANT AUTHORITY</button>
                    <div class="appreciation-text">we appreciate your authority in this matter</div>
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

        // Initialize example index
        this.currentExampleIndex = 0;

        // Hide nav buttons if only one example
        if (showExamples && this.config.examples.length <= 1) {
            const navBtns = this.modal.querySelectorAll('.example-nav-btn');
            navBtns.forEach(btn => btn.style.display = 'none');
        }
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
                max-width: 550px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                position: relative;
                z-index: 1000000;
            }
            
            .modal-intro {
                text-align: center;
                color: #555;
                line-height: 1.4;
                margin-bottom: 1rem;
            }
            
            .modal-intro strong {
                font-size: 1.1rem;
                color: #5d4a37;
            }
            
            .modal-body {
                margin-bottom: 0.25rem;
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
                margin: 0.5rem auto;
                display: inline-block;
            }
            
            .modal-body li {
                margin-bottom: 0.35rem;
            }
            
            .modal-body p {
                text-align: center;
                margin: 0.5rem 0;
            }
            
            .modal-body p strong {
                display: block;
                margin-top: 1rem;
            }
            
            .form-group {
                margin: 1rem 0;
                text-align: center;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: #2c1810;
            }
            
            .form-group input {
                width: 100%;
                max-width: 300px;
                padding: 0.75rem;
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
            
            .small-note {
                font-size: 0.85rem;
                color: #666;
                margin-top: 0.5rem;
            }
            
            .modal-actions {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                margin-top: 0.25rem;
                gap: 0.35rem;
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
            
            .action-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .authorize-btn {
                min-width: 280px;
                padding: 0.85rem 2rem !important;
            }
            
            .appreciation-text {
                font-size: 0.85rem;
                font-style: italic;
                color: #666;
                text-align: center;
            }
            
            .example-post-preview {
                margin: 1rem 0;
                padding: 0.85rem;
                background: white;
                border: 2px solid #8b7355;
                border-radius: 0;
            }
            
            .example-header {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                margin-bottom: 0.5rem;
            }
            
            .example-nav-btn {
                background: #8b7355;
                color: white;
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1.3rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                padding: 0;
                line-height: 1;
                font-weight: bold;
            }
            
            .example-nav-btn:hover {
                background: #5d4a37;
                transform: scale(1.1);
            }
            
            .example-nav-btn:active {
                transform: scale(0.95);
            }
            
            .example-label {
                font-size: 0.85rem;
                font-weight: 700;
                color: #8b7355;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                text-align: center;
                flex: 1;
            }
            
            .example-post {
                background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
                border: 1px solid #e0e0e0;
                border-radius: 0;
                padding: 0.75rem;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                min-height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .post-text {
                font-size: 0.9rem;
                line-height: 1.4;
                color: #1a1a1a;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                text-align: left;
                width: 100%;
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

    nextExample() {
        if (!this.config.examples || this.config.examples.length === 0) return;
        
        this.currentExampleIndex = (this.currentExampleIndex + 1) % this.config.examples.length;
        this.updateExample();
    }

    previousExample() {
        if (!this.config.examples || this.config.examples.length === 0) return;
        
        this.currentExampleIndex = (this.currentExampleIndex - 1 + this.config.examples.length) % this.config.examples.length;
        this.updateExample();
    }

    updateExample() {
        const examplePost = document.getElementById('example-post');
        if (examplePost && this.config.examples && this.config.examples[this.currentExampleIndex]) {
            examplePost.innerHTML = `<div class="post-text">${this.config.examples[this.currentExampleIndex].text}</div>`;
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
