/**
 * CreateDreamer Widget
 * Handles account creation for Reverie House PDS
 */

class CreateDreamer {
    constructor() {
        this.PDS_URL = 'https://reverie.house'; // Reverie House PDS
        this.modal = null;
        this.onSuccessCallback = null;
        this.onCancelCallback = null;
        this.inviteCode = null; // Will be generated or retrieved
    }
    
    /**
     * Show the account creation modal
     * @param {Object} options - Options including onSuccess and onCancel callbacks
     */
    show(options = {}) {
        this.onSuccessCallback = options.onSuccess;
        this.onCancelCallback = options.onCancel;
        
        if (!this.modal) {
            this.createModal();
        }
        
        // Show the modal
        this.modal.classList.add('active');
        
        // Focus on username input
        setTimeout(() => {
            const usernameInput = this.modal.querySelector('#create-username');
            if (usernameInput) {
                usernameInput.focus();
            }
        }, 100);
    }
    
    /**
     * Hide the modal
     */
    hide() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    }
    
    /**
     * Create the modal HTML structure
     */
    createModal() {
        const modalHTML = `
            <div class="create-dreamer-overlay">
                <div class="create-dreamer-modal">
                    <div class="modal-body">
                        <div class="welcome-section">
                            <img src="/assets/logo.png" alt="Reverie House" class="welcome-logo">
                            <div class="welcome-content">
                                <p class="welcome-text">
                                    Welcome home, dreamweaver!<br>
                                    Your residence at Reverie House awaits.
                                </p>
                                
                                <p class="welcome-subtext">
                                    May this permanent home aid your travels throughout our wild mindscape, and help better it for all.
                                </p>
                            </div>
                        </div>
                        
                        <div class="atproto-info">
                            <img src="/assets/bluesky.png" alt="ATProto" class="atproto-logo">
                            <p class="atproto-text">
                                This identity will be recognized across all the atmosphere and blue sky beyond Reverie House as a representative among all dreamweavers.
                            </p>
                        </div>
                        
                        <form id="create-account-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="create-username">Username</label>
                                    <div class="username-wrapper">
                                        <input 
                                            type="text" 
                                            id="create-username" 
                                            name="username"
                                            placeholder="dreamer"
                                            maxlength="63"
                                            required
                                            autocomplete="off"
                                        />
                                        <span class="domain-suffix">.reverie.house</span>
                                    </div>
                                    <small class="help-text">Letters, numbers, and hyphens only</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="create-email">Email</label>
                                    <input 
                                        type="email" 
                                        id="create-email" 
                                        name="email"
                                        placeholder="your@email.com"
                                        required
                                        autocomplete="email"
                                    />
                                    <small class="help-text">For account recovery and important notices</small>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="create-password">Password</label>
                                    <input 
                                        type="password" 
                                        id="create-password" 
                                        name="password"
                                        placeholder="••••••••"
                                        minlength="8"
                                        required
                                        autocomplete="new-password"
                                    />
                                    <small class="help-text">At least 8 characters</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="create-password-confirm">Confirm Password</label>
                                    <input 
                                        type="password" 
                                        id="create-password-confirm" 
                                        name="password-confirm"
                                        placeholder="••••••••"
                                        minlength="8"
                                        required
                                        autocomplete="new-password"
                                    />
                                    <small class="help-text">Must match</small>
                                </div>
                            </div>
                            
                            <div class="capacity-section">
                                <div class="capacity-label">
                                    <span>Residence Capacity</span>
                                    <span class="capacity-count" id="capacity-count">Checking...</span>
                                </div>
                                <div class="capacity-bar">
                                    <div class="capacity-fill" id="capacity-fill" style="width: 0%"></div>
                                </div>
                                <p class="capacity-text">
                                    Reverie House is home to all dreamers, but residence expands with our capacity.<br>
                                    Each residence is a commitment we take very seriously.
                                </p>
                            </div>
                            
                            <div class="error-message" style="display: none;"></div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" id="cancel-create-btn">
                                    Not Yet
                                </button>
                                <button type="submit" class="btn-primary" id="create-account-btn">
                                    Claim Your Residence
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Create modal element
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHTML;
        this.modal = tempDiv.firstElementChild;
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Append to body
        document.body.appendChild(this.modal);
        
        // Show invite code input (no auto-generation)
        this.updateInviteCodeUI(true);
    }
    
    /**
     * Attach event listeners to modal elements
     */
    attachEventListeners() {
        // Cancel button
        const cancelBtn = this.modal.querySelector('#cancel-create-btn');
        cancelBtn.addEventListener('click', () => this.handleCancel());
        
        // Form submission
        const form = this.modal.querySelector('#create-account-form');
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.handleCancel();
            }
        });
        
        // Username input validation
        const usernameInput = this.modal.querySelector('#create-username');
        usernameInput.addEventListener('input', (e) => {
            // Only allow valid characters
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            this.checkUsernameAvailability(e.target.value);
        });
        
        // Password confirmation matching
        const passwordInput = this.modal.querySelector('#create-password');
        const confirmInput = this.modal.querySelector('#create-password-confirm');
        confirmInput.addEventListener('input', () => {
            if (confirmInput.value && confirmInput.value !== passwordInput.value) {
                confirmInput.setCustomValidity("Passwords don't match");
            } else {
                confirmInput.setCustomValidity('');
            }
        });
    }
    
    /**
     * Update UI to show invite code input (always visible now - no auto-generation)
     */
    updateInviteCodeUI(atCapacity) {
        const capacitySection = this.modal.querySelector('.capacity-section');
        const capacityText = capacitySection.querySelector('.capacity-text');
        const capacityBar = capacitySection.querySelector('.capacity-bar');
        
        // Change label to indicate invite code is required
        const capacityLabel = capacitySection.querySelector('.capacity-label span:first-child');
        capacityLabel.textContent = 'Invite Code Required';
        
        // Hide the capacity count
        const capacityCount = capacitySection.querySelector('#capacity-count');
        capacityCount.style.display = 'none';
        
        // Hide capacity bar
        capacityBar.style.display = 'none';
        
        // Add invite code input field if not already present
        if (!capacitySection.querySelector('.invite-code-input')) {
            const inviteInputHTML = `
                <div class="invite-code-input" style="margin-bottom: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 4px;">
                    <span style="font-family: monospace; font-size: 0.95rem; color: rgba(90, 74, 122, 0.7); user-select: none;">reverie-house-</span>
                    <input 
                        type="text" 
                        id="manual-invite-code" 
                        name="invite-code"
                        placeholder="xxxxx-xxxxx"
                        maxlength="11"
                        style="max-width: 130px; width: 100%; padding: 10px; font-family: monospace; border: 1.5px solid #d0c7f0; background: white; text-align: center; font-size: 0.95rem;"
                        autocomplete="off"
                        spellcheck="false"
                        required
                    />
                    <button 
                        type="button" 
                        id="take-public-key-btn"
                        style="padding: 8px 10px; font-size: 0.7rem; background: #5a4a7a; color: white; border: none; border-radius: 0; cursor: pointer; white-space: nowrap; font-weight: 400; transition: background 0.2s; text-transform: uppercase; letter-spacing: 0.5px;"
                        onmouseover="this.style.background='#704891'"
                        onmouseout="this.style.background='#5a4a7a'"
                    >
                        <div style="line-height: 1.3;">
                            <div style="font-size: 0.7rem;">TAKE RESIDENCE</div>
                            <div id="keys-remaining" style="font-size: 0.55rem; opacity: 0.7; margin-top: 2px;">? / 10 left</div>
                        </div>
                    </button>
                </div>
            `;
            // Insert after the label, before the capacity bar
            capacityBar.insertAdjacentHTML('afterend', inviteInputHTML);
            
            // Fetch and display available key count
            this.updateKeyCount();
            
            // Add click handler for TAKE PUBLIC KEY button
            const takeKeyBtn = capacitySection.querySelector('#take-public-key-btn');
            takeKeyBtn.addEventListener('click', () => this.takePublicKey());
            
            // Listen for manual invite code input
            const inviteInput = capacitySection.querySelector('#manual-invite-code');
            inviteInput.addEventListener('input', (e) => {
                let value = e.target.value;
                
                // Strip out the prefix if user pastes the full code
                if (value.toLowerCase().startsWith('reverie-house-')) {
                    value = value.substring(14); // Remove "reverie-house-"
                }
                
                // Only allow alphanumeric and dash
                value = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                
                // Auto-format: add dash after 5 characters if not present
                if (value.length === 5 && !value.includes('-')) {
                    value = value + '-';
                } else if (value.length > 6 && value.indexOf('-') !== 5) {
                    // Reformat if dash is in wrong place
                    value = value.replace(/-/g, '');
                    if (value.length > 5) {
                        value = value.substring(0, 5) + '-' + value.substring(5);
                    }
                }
                
                // Limit to xxxxx-xxxxx format (11 chars max)
                if (value.length > 11) {
                    value = value.substring(0, 11);
                }
                
                // Update the input value
                e.target.value = value;
                
                // Store the full invite code
                if (value.length >= 10) { // At least xxxxx-xxxx
                    this.inviteCode = 'reverie-house-' + value;
                    console.log('✅ Invite code set:', this.inviteCode);
                } else {
                    this.inviteCode = null;
                    console.log('⚠️ Invite code cleared (value too short):', value);
                }
            });
            
            // Handle paste events specially
            inviteInput.addEventListener('paste', (e) => {
                e.preventDefault();
                let pastedText = (e.clipboardData || window.clipboardData).getData('text');
                
                // Strip prefix if present
                if (pastedText.toLowerCase().startsWith('reverie-house-')) {
                    pastedText = pastedText.substring(14);
                }
                
                // Clean and format
                pastedText = pastedText.toLowerCase().replace(/[^a-z0-9-]/g, '');
                if (pastedText.length > 11) {
                    pastedText = pastedText.substring(0, 11);
                }
                
                // Set the value and trigger input event
                e.target.value = pastedText;
                e.target.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }
        
        // Update capacity text to reflect the new requirement
        capacityText.innerHTML = `
            Reverie House is home to all dreamers, but residency requires an invite code.<br>
            You may obtain one from an existing resident or community moderator.
        `;
        
        // Add login notice after the main capacity text
        if (!capacitySection.querySelector('.login-notice')) {
            const loginNoticeHTML = `
                <p class="login-notice" style="margin-top: 8px; font-family: monospace; font-size: 0.6rem; color: rgba(90, 74, 122, 0.65); font-style: italic; line-height: 1.3;">
                    No invite code? You may enter Reverie House with any <a href="#" id="login-instead-link" style="color: var(--reverie-core-color, #734ba1); text-decoration: underline;">Bluesky account</a>.
                </p>
            `;
            capacityText.insertAdjacentHTML('afterend', loginNoticeHTML);
            
            // Add login click handler
            setTimeout(() => {
                const loginLink = capacitySection.querySelector('#login-instead-link');
                if (loginLink) {
                    loginLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.hide();
                        // Trigger login via drawer
                        const drawerBtn = document.getElementById('drawerAvatarBtn');
                        if (drawerBtn) {
                            drawerBtn.click();
                        }
                    });
                }
            }, 100);
        }
    }
    
    /**
     * Update the count of available invite codes
     */
    async updateKeyCount() {
        try {
            const response = await fetch('/api/invite-codes/available');
            if (!response.ok) {
                console.error('❌ Failed to fetch invite codes:', response.status, response.statusText);
                return;
            }
            
            const data = await response.json();
            console.log('🔑 Invite code data received:', data);
            
            const keysRemaining = document.getElementById('keys-remaining');
            if (keysRemaining) {
                // Zero-pad single digit numbers (0-9 becomes 00-09)
                const availableFormatted = data.available.toString().padStart(2, '0');
                keysRemaining.textContent = `${availableFormatted} / 10 left`;
                console.log('✅ Updated keys remaining display:', availableFormatted);
            } else {
                console.warn('⚠️ Element #keys-remaining not found in DOM');
            }
        } catch (error) {
            console.error('❌ Failed to fetch key count:', error);
        }
    }
    
    /**
     * Take a public invite key from the pool
     */
    async takePublicKey() {
        const takeKeyBtn = this.modal.querySelector('#take-public-key-btn');
        const inviteInput = this.modal.querySelector('#manual-invite-code');
        
        // Disable button during request
        takeKeyBtn.disabled = true;
        takeKeyBtn.style.opacity = '0.6';
        takeKeyBtn.style.cursor = 'not-allowed';
        
        try {
            // Fetch a random available invite code
            const response = await fetch('/api/invite-codes/available');
            
            if (!response.ok) {
                throw new Error('Failed to fetch available codes');
            }
            
            const data = await response.json();
            
            if (data.count === 0) {
                alert('No residencies available at this time. Please contact support.');
                takeKeyBtn.disabled = false;
                takeKeyBtn.style.opacity = '1';
                takeKeyBtn.style.cursor = 'pointer';
                return;
            }
            
            // Get all available codes
            const codesResponse = await fetch('/api/invite-codes/list-available');
            if (!codesResponse.ok) {
                throw new Error('Failed to fetch code list');
            }
            
            const codesData = await codesResponse.json();
            const availableCodes = codesData.codes || [];
            
            if (availableCodes.length === 0) {
                alert('No residencies available at this time. Please contact support.');
                takeKeyBtn.disabled = false;
                takeKeyBtn.style.opacity = '1';
                takeKeyBtn.style.cursor = 'pointer';
                return;
            }
            
            // Pick a random code
            const randomCode = availableCodes[Math.floor(Math.random() * availableCodes.length)];
            
            // Fill in the invite code (without the prefix)
            const codeWithoutPrefix = randomCode.replace('reverie-house-', '');
            inviteInput.value = codeWithoutPrefix;
            inviteInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Update the count
            await this.updateKeyCount();
            
            // Re-enable button
            takeKeyBtn.disabled = false;
            takeKeyBtn.style.opacity = '1';
            takeKeyBtn.style.cursor = 'pointer';
            
        } catch (error) {
            console.error('Failed to take public key:', error);
            alert('Failed to retrieve public key. Please try again.');
            
            // Re-enable button
            takeKeyBtn.disabled = false;
            takeKeyBtn.style.opacity = '1';
            takeKeyBtn.style.cursor = 'pointer';
        }
    }
    
    /**
     * Check if username is available
     */
    async checkUsernameAvailability(username) {
        if (!username || username.length < 3) return;
        
        try {
            const handle = `${username}.reverie.house`;
            const response = await fetch(`/api/check-handle?handle=${encodeURIComponent(handle)}`);
            
            if (!response.ok) {
                // Backend unavailable, just skip the check silently
                return;
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return;
            }
            
            const data = await response.json();
            const usernameInput = this.modal.querySelector('#create-username');
            
            if (data.available) {
                usernameInput.classList.remove('taken');
                usernameInput.classList.add('available');
                usernameInput.setCustomValidity('');
            } else {
                usernameInput.classList.remove('available');
                usernameInput.classList.add('taken');
                
                // Set custom validity message based on reason
                if (data.reason === 'name_conflict') {
                    usernameInput.setCustomValidity('This name is already taken by another dreamer');
                } else {
                    usernameInput.setCustomValidity('This username is already taken');
                }
            }
        } catch (error) {
            // Silently fail - availability check is non-critical
        }
    }
    
    /**
     * Handle form submission
     */
    async handleSubmit(event) {
        event.preventDefault();
        
        const form = event.target;
        const submitBtn = this.modal.querySelector('#create-account-btn');
        const errorDisplay = this.modal.querySelector('.error-message');
        
        // Get form values
        const username = form.username.value.trim().toLowerCase();
        const email = form.email.value.trim();
        const password = form.password.value;
        const passwordConfirm = form['password-confirm'].value;
        
        // Validate
        if (!username || username.length < 3) {
            this.showError('Username must be at least 3 characters');
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showError("Passwords don't match");
            return;
        }
        
        if (password.length < 8) {
            this.showError('Password must be at least 8 characters');
            return;
        }
        
        // SAFEGUARD: Double-check username availability before submission
        const handle = `${username}.reverie.house`;
        try {
            const checkResponse = await fetch(`/api/check-handle?handle=${encodeURIComponent(handle)}`);
            if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (!checkData.available) {
                    if (checkData.reason === 'name_conflict') {
                        this.showError('This name is already taken by another dreamer. Please choose a different username.');
                    } else {
                        this.showError('This username is already taken. Please choose another.');
                    }
                    return;
                }
            }
        } catch (checkError) {
            console.warn('⚠️ Could not verify username availability:', checkError);
            // Continue anyway - backend will validate
        }
        
        // Validate invite code
        if (!this.inviteCode) {
            console.error('❌ No invite code set. this.inviteCode:', this.inviteCode);
            this.showError('Please enter a valid invite code');
            return;
        }
        
        console.log('✅ Using invite code:', this.inviteCode);
        
        // Ensure invite code has the proper format
        let inviteCode = this.inviteCode;
        if (!inviteCode.startsWith('reverie-house-')) {
            // If it looks like just the suffix (xxxxx-xxxxx), add the prefix
            if (/^[a-z0-9]{5}-[a-z0-9]{5}$/i.test(inviteCode)) {
                inviteCode = 'reverie-house-' + inviteCode;
            } else {
                this.showError('Invite code must be in format: xxxxx-xxxxx');
                return;
            }
        }
        
        // Validate full format (reverie-house-xxxxx-xxxxx)
        if (!/^reverie-house-[a-z0-9]{5}-[a-z0-9]{5}$/i.test(inviteCode)) {
            this.showError('Invalid invite code format');
            return;
        }
        
        // Hide any previous errors
        errorDisplay.style.display = 'none';
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        try {
            // Create account via PDS API
            const accountData = await this.createAccount({
                handle: `${username}.reverie.house`,
                email: email || undefined,
                password: password,
                inviteCode: inviteCode
            });
            
            // Auto-login and register with the new credentials
            if (accountData.accessJwt && accountData.refreshJwt) {
                try {
                    // Store credentials in OAuth manager (compatible with PDS session format)
                    if (window.oauthManager) {
                        const session = {
                            did: accountData.did,
                            sub: accountData.did,
                            handle: accountData.handle,
                            accessJwt: accountData.accessJwt,
                            refreshJwt: accountData.refreshJwt,
                            displayName: accountData.handle
                        };
                        
                        // Set in OAuth manager
                        window.oauthManager.currentSession = session;
                        
                        // Persist to localStorage (matching login.js format)
                        localStorage.setItem('BSKY_AGENT(sub)', accountData.did);
                        localStorage.setItem('pds_session', JSON.stringify(session));
                        
                        // CRITICAL: Register the dreamer BEFORE triggering oauth:login
                        // This ensures the profile exists before dashboard tries to load
                        console.log('🎫 Registering new dreamer...');
                        const registerResponse = await fetch('/api/register', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                                did: accountData.did,
                                handle: accountData.handle 
                            })
                        });
                        
                        if (registerResponse.ok) {
                            const registerResult = await registerResponse.json();
                            console.log('✅ Registration complete:', registerResult);
                            
                            // Enrich session with profile data from registration
                            if (registerResult.dreamer) {
                                session.displayName = registerResult.dreamer.display_name || registerResult.dreamer.name;
                                session.avatar = registerResult.dreamer.avatar;
                                session.profile = {
                                    handle: registerResult.dreamer.handle,
                                    displayName: registerResult.dreamer.display_name,
                                    avatar: registerResult.dreamer.avatar
                                };
                                
                                // Update stored session
                                localStorage.setItem('pds_session', JSON.stringify(session));
                                console.log('✅ Session enriched with profile data');
                                console.log('   Display Name:', session.displayName);
                                console.log('   Avatar:', session.avatar);
                            }
                        } else {
                            console.warn('⚠️ Registration failed, but continuing:', await registerResponse.text());
                        }
                        
                        // NOW trigger oauth:login event - dreamer profile exists
                        window.dispatchEvent(new CustomEvent('oauth:login', { 
                            detail: { session: session } 
                        }));
                        
                        // IMPORTANT: Also trigger profile-loaded event for UI updates
                        window.dispatchEvent(new CustomEvent('oauth:profile-loaded', {
                            detail: { session: session }
                        }));
                    } else {
                        console.warn('⚠️ OAuth manager not available for auto-login');
                    }
                } catch (loginError) {
                    console.error('❌ Auto-login failed:', loginError);
                    // Don't block success callback
                }
            }
            
            // Hide modal
            this.hide();
            
            // Call success callback
            if (this.onSuccessCallback) {
                this.onSuccessCallback({
                    username: username,
                    handle: `${username}.reverie.house`,
                    did: accountData.did,
                    email: email,
                    autoLoggedIn: !!accountData.accessJwt
                });
            }
            
        } catch (error) {
            console.error('❌ Account creation failed:', error);
            this.showError(error.message || 'Failed to create account. Please try again.');
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Claim Your Residence';
        }
    }
    
    /**
     * Create account via ATProto PDS API
     */
    async createAccount(accountData) {
        try {
            // Try the backend API first
            const response = await fetch('/api/create-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(accountData)
            });
            
            // Handle 502 Bad Gateway (backend service down)
            if (response.status === 502) {
                throw new Error('BACKEND_DOWN');
            }
            
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let error;
                
                if (contentType && contentType.includes('application/json')) {
                    error = await response.json();
                } else {
                    const text = await response.text();
                    error = { message: text || 'Account creation failed' };
                }
                
                // Provide user-friendly error messages
                let errorMessage = error.message || error.error || 'Account creation failed';
                
                // Handle specific error cases
                if (errorMessage.toLowerCase().includes('invite')) {
                    errorMessage = 'Invalid or expired invite code. Please check and try again.';
                } else if (errorMessage.toLowerCase().includes('name is already taken') || 
                           errorMessage.toLowerCase().includes('name conflict')) {
                    errorMessage = 'This name is already taken by another dreamer. Please choose a different username.';
                } else if (errorMessage.toLowerCase().includes('handle') || 
                           errorMessage.toLowerCase().includes('username')) {
                    errorMessage = 'This username is already taken. Please choose another.';
                } else if (errorMessage.toLowerCase().includes('email')) {
                    errorMessage = 'This email is already registered. Please use another.';
                }
                
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            // If backend is down, try direct PDS
            if (error.message === 'BACKEND_DOWN' || error.message.includes('fetch')) {
                try {
                    const pdsResponse = await fetch(`${this.PDS_URL}/xrpc/com.atproto.server.createAccount`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            handle: accountData.handle,
                            email: accountData.email,
                            password: accountData.password,
                            ...(accountData.inviteCode && { inviteCode: accountData.inviteCode })
                        })
                    });
                    
                    if (!pdsResponse.ok) {
                        const contentType = pdsResponse.headers.get('content-type');
                        let pdsError;
                        
                        if (contentType && contentType.includes('application/json')) {
                            pdsError = await pdsResponse.json();
                        } else {
                            const text = await pdsResponse.text();
                            pdsError = { message: text || 'Account creation failed' };
                        }
                        
                        let errorMessage = pdsError.message || pdsError.error || 'Account creation failed';
                        
                        // Handle specific PDS error cases with better messages
                        if (errorMessage.toLowerCase().includes('invalid') && errorMessage.toLowerCase().includes('invite')) {
                            errorMessage = 'Invalid invite code. Please check the code and try again.';
                        } else if (errorMessage.toLowerCase().includes('invite')) {
                            errorMessage = 'This invite code has already been used or has expired. Please obtain a new code.';
                        } else if (errorMessage.toLowerCase().includes('handle')) {
                            errorMessage = 'This username is already taken. Please choose another.';
                        } else if (errorMessage.toLowerCase().includes('email')) {
                            errorMessage = 'This email is already registered. Please use another email address.';
                        }
                        
                        throw new Error(errorMessage);
                    }
                    
                    const pdsResult = await pdsResponse.json();
                    return pdsResult;
                } catch (pdsError) {
                    // If it's already a formatted error with a good message, re-throw it
                    if (pdsError.message && 
                        !pdsError.message.includes('fetch') && 
                        !pdsError.message.includes('BACKEND_DOWN')) {
                        throw pdsError;
                    }
                    
                    // Generic fallback for network errors
                    throw new Error('Unable to create account. The service may be temporarily unavailable. Please try again in a moment.');
                }
            }
            
            // Re-throw already formatted errors
            throw error;
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const errorDisplay = this.modal.querySelector('.error-message');
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
        
        // Scroll to error
        errorDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    /**
     * Handle cancel
     */
    handleCancel() {
        this.hide();
        
        if (this.onCancelCallback) {
            this.onCancelCallback();
        }
    }
    
    /**
     * Clean up
     */
    destroy() {
        if (this.modal && this.modal.parentNode) {
            this.modal.remove();
        }
        this.modal = null;
    }
}

// Export to window
window.CreateDreamer = CreateDreamer;

console.log('✅ CreateDreamer widget loaded');
