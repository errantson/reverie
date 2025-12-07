/**
 * BlueskyPoster Widget
 * Seamlessly posts to Bluesky threads with AT Protocol integration
 */

class BlueskyPoster {
    constructor() {
        console.log('✅ [bskyposter.js] BlueskyPoster widget initialized');
        this.loadStyles();
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/bskyposter.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/bskyposter.css';
            document.head.appendChild(link);
            console.log('✅ [bskyposter.js] Styles loaded');
        }
    }

    /**
     * Prompt user for their name and post to a Bluesky thread
     * @param {string} threadUri - AT URI of the thread to post to
     * @param {Object} options - Configuration options
     * @param {Function} options.onSuccess - Callback when post succeeds (receives name and post result)
     * @param {Function} options.onCancel - Callback when user cancels
     * @param {string} options.promptText - Custom prompt text (default: "What do they call you?")
     * @param {string} options.descriptionText - Custom description (default: "Share your name...")
     */
    async promptAndPost(threadUri, options = {}) {
        console.log('🔵 [bskyposter.js] promptAndPost called', { threadUri, options });
        
        const {
            onSuccess = null,
            onCancel = null,
            promptText = "What do they call you?",
            descriptionText = "Share your name in the thread below.",
            placeholder = "Your name...",
            maxLength = 50
        } = options;

        // Check if user is already authenticated
        const session = window.oauthManager?.getSession();
        console.log('🔵 [bskyposter.js] Session check:', session ? `Found: ${session.handle || session.did}` : 'Not found');
        
        if (!session) {
            // Not logged in - need to authenticate first
            console.log('🔵 [bskyposter.js] Showing auth prompt');
            this.showAuthPrompt(threadUri, options);
            return;
        }

        // User is logged in - show the input prompt
        console.log('🔵 [bskyposter.js] Showing input prompt');
        this.showInputPrompt(threadUri, session, {
            onSuccess,
            onCancel,
            promptText,
            descriptionText,
            placeholder,
            maxLength
        });
    }

    /**
     * Show authentication prompt for non-logged-in users
     */
    showAuthPrompt(threadUri, options) {
        const overlay = document.createElement('div');
        overlay.className = 'bskyposter-overlay';
        
        const box = document.createElement('div');
        box.className = 'bskyposter-box';
        box.innerHTML = `
            <div class="bskyposter-icon">
                <svg viewBox="0 0 600 530" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/>
                </svg>
            </div>
            <div class="bskyposter-title">Sign in to continue</div>
            <div class="bskyposter-description">
                You'll need to connect your Bluesky account to share your name.
            </div>
            <div class="bskyposter-actions">
                <button class="bskyposter-btn primary" id="bskySignInBtn">Sign in with Bluesky</button>
                <button class="bskyposter-btn secondary" id="bskyCancelBtn">Maybe Later</button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // Fade in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
        
        // Sign in button
        const signInBtn = box.querySelector('#bskySignInBtn');
        signInBtn.addEventListener('click', () => {
            // Store pending action
            sessionStorage.setItem('bskyposter_pending', JSON.stringify({
                threadUri,
                options
            }));
            
            // Close overlay
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            
            // Open drawer/login
            const drawerBtn = document.getElementById('drawerAvatarBtn');
            if (drawerBtn) {
                drawerBtn.click();
            } else if (window.spectrumDrawer) {
                window.spectrumDrawer.open();
            }
        });
        
        // Cancel button
        const cancelBtn = box.querySelector('#bskyCancelBtn');
        cancelBtn.addEventListener('click', () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            if (options.onCancel) {
                options.onCancel();
            }
        });
        
        // Listen for successful login
        const loginHandler = () => {
            const pending = sessionStorage.getItem('bskyposter_pending');
            if (pending) {
                sessionStorage.removeItem('bskyposter_pending');
                const { threadUri, options } = JSON.parse(pending);
                // Wait a moment for session to settle
                setTimeout(() => {
                    this.promptAndPost(threadUri, options);
                }, 500);
            }
        };
        
        window.addEventListener('oauth:login', loginHandler, { once: true });
    }

    /**
     * Show input prompt for authenticated users
     */
    showInputPrompt(threadUri, session, options) {
        const {
            onSuccess,
            onCancel,
            promptText,
            descriptionText,
            placeholder,
            maxLength
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'bskyposter-overlay';
        
        const box = document.createElement('div');
        box.className = 'bskyposter-box';
        
        // Get user avatar
        const avatar = session.avatar || session.profile?.avatar || '/souvenirs/dream/strange/icon.png';
        const handle = session.handle || 'dreamer';
        
        box.innerHTML = `
            <div class="bskyposter-header">
                <img src="${avatar}" alt="${handle}" class="bskyposter-avatar">
                <div class="bskyposter-handle">@${handle}</div>
            </div>
            <div class="bskyposter-title">${promptText}</div>
            <div class="bskyposter-description">${descriptionText}</div>
            <input 
                type="text" 
                class="bskyposter-input" 
                placeholder="${placeholder}" 
                maxlength="${maxLength}"
                autocomplete="off"
                spellcheck="false">
            <div class="bskyposter-hint">
                This will post to the thread as @${handle}
            </div>
            <div class="bskyposter-actions">
                <button class="bskyposter-btn primary" id="bskyPostBtn">
                    <svg viewBox="0 0 24 24" class="bskyposter-btn-icon">
                        <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                    Post
                </button>
                <button class="bskyposter-btn secondary" id="bskyCancelBtn">Cancel</button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // Fade in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
        
        // Focus input
        const input = box.querySelector('.bskyposter-input');
        setTimeout(() => input.focus(), 100);
        
        // Post button
        const postBtn = box.querySelector('#bskyPostBtn');
        const handlePost = async () => {
            const text = input.value.trim();
            
            if (!text) {
                input.style.borderColor = '#ff6b6b';
                input.focus();
                return;
            }
            
            // Disable controls
            postBtn.disabled = true;
            input.disabled = true;
            
            // Show loading state
            const originalBtnHTML = postBtn.innerHTML;
            postBtn.innerHTML = `
                <svg viewBox="0 0 24 24" class="bskyposter-btn-icon bskyposter-spinner">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/>
                </svg>
                Posting...
            `;
            
            try {
                // Post using oauth-manager
                console.log('🔵 [bskyposter.js] Posting to Bluesky...', { text, threadUri });
                const result = await window.oauthManager.createPost(text, threadUri);
                console.log('✅ [bskyposter.js] Post successful:', result);
                
                // Success!
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                
                if (onSuccess) {
                    onSuccess(text, result);
                }
                
            } catch (error) {
                console.error('❌ [bskyposter.js] Post failed:', error);
                
                // Restore controls
                postBtn.disabled = false;
                input.disabled = false;
                postBtn.innerHTML = originalBtnHTML;
                
                // Show error
                const errorMsg = document.createElement('div');
                errorMsg.className = 'bskyposter-error';
                errorMsg.textContent = 'Failed to post. Please try again.';
                box.insertBefore(errorMsg, box.querySelector('.bskyposter-actions'));
                
                setTimeout(() => errorMsg.remove(), 3000);
            }
        };
        
        postBtn.addEventListener('click', handlePost);
        
        // Enter key to post
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePost();
            }
        });
        
        // Cancel button
        const cancelBtn = box.querySelector('#bskyCancelBtn');
        cancelBtn.addEventListener('click', () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            if (onCancel) {
                onCancel();
            }
        });
        
        // ESC key to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
}

// Auto-instantiate
if (typeof window !== 'undefined') {
    window.BlueskyPoster = BlueskyPoster;
    console.log('✅ [bskyposter.js] BlueskyPoster class registered on window');
}
