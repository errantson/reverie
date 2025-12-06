/**
 * BlueskyComposer Widget
 * Interface for composing and posting to Bluesky
 */

class BlueskyComposer {
    constructor() {
        console.log('✅ [bskycomposer.js] BlueskyComposer widget initialized');
        this.loadStyles();
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/bskycomposer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/bskycomposer.css';
            document.head.appendChild(link);
            console.log('✅ [bskycomposer.js] Styles loaded');
        }
    }

    /**
     * Show the composer interface
     * @param {Object} options - Configuration options
     * @param {Function} options.onSuccess - Callback when post is created (receives post data)
     * @param {Function} options.onCancel - Callback when user cancels
     */
    show(options = {}) {
        const { onSuccess = null, onCancel = null } = options;
        
        console.log('📝 [bskycomposer.js] Showing composer interface');
        
        // Get user session
        const session = window.oauthManager?.getSession();
        if (!session) {
            console.error('❌ [bskycomposer.js] No session found');
            if (onCancel) onCancel();
            return;
        }
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'bskycomposer-overlay';
        
        // Create box
        const box = document.createElement('div');
        box.className = 'bskycomposer-box';
        
        const avatar = session.avatar || session.profile?.avatar || '/souvenirs/dream/strange/icon.png';
        const handle = session.handle || 'dreamer';
        
        box.innerHTML = `
            <div class="bskycomposer-header">
                <img src="${avatar}" alt="${handle}" class="bskycomposer-avatar">
                <div class="bskycomposer-user">
                    <div class="bskycomposer-name">${session.displayName || handle}</div>
                    <div class="bskycomposer-handle">@${handle}</div>
                </div>
                <button class="bskycomposer-close" aria-label="Close">&times;</button>
            </div>
            <div class="bskycomposer-content">
                <div class="bskycomposer-instructions">
                    Share a story, dream, or thought with the mindscape.
                </div>
                <textarea 
                    class="bskycomposer-textarea" 
                    placeholder="What's on your mind, dreamer?"
                    maxlength="2000"
                    rows="8"></textarea>
                <div class="bskycomposer-meta">
                    <div class="bskycomposer-charcount">
                        <span class="bskycomposer-count">0</span> / 2000
                    </div>
                    <div class="bskycomposer-posting">
                        This will post to your Bluesky feed
                    </div>
                </div>
            </div>
            <div class="bskycomposer-actions">
                <button class="bskycomposer-btn secondary" id="bskyComposerCancelBtn">Cancel</button>
                <button class="bskycomposer-btn primary" id="bskyComposerPostBtn">
                    <svg viewBox="0 0 24 24" class="bskycomposer-btn-icon">
                        <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                    Share Story
                </button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // Fade in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
        
        // Get elements
        const textarea = box.querySelector('.bskycomposer-textarea');
        const charCount = box.querySelector('.bskycomposer-count');
        const postBtn = box.querySelector('#bskyComposerPostBtn');
        const cancelBtn = box.querySelector('#bskyComposerCancelBtn');
        const closeBtn = box.querySelector('.bskycomposer-close');
        
        // Focus textarea
        setTimeout(() => textarea.focus(), 100);
        
        // Update character count
        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            charCount.textContent = length;
            
            if (length > 1900) {
                charCount.style.color = '#ff6b6b';
            } else if (length > 1700) {
                charCount.style.color = '#ffa94d';
            } else {
                charCount.style.color = '';
            }
        });
        
        // Handle post
        const handlePost = async () => {
            const text = textarea.value.trim();
            
            if (!text) {
                textarea.style.borderColor = '#ff6b6b';
                textarea.focus();
                return;
            }
            
            // Disable controls
            postBtn.disabled = true;
            textarea.disabled = true;
            cancelBtn.disabled = true;
            
            // Show loading
            const originalBtnHTML = postBtn.innerHTML;
            postBtn.innerHTML = `
                <svg viewBox="0 0 24 24" class="bskycomposer-btn-icon bskycomposer-spinner">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/>
                </svg>
                Sharing...
            `;
            
            try {
                // Post to Bluesky
                const result = await window.oauthManager.createPost(text);
                
                console.log('✅ [bskycomposer.js] Story posted:', result);
                
                // Close overlay
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                
                if (onSuccess) {
                    onSuccess({
                        text: text,
                        uri: result.uri,
                        cid: result.cid,
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                console.error('❌ [bskycomposer.js] Failed to post:', error);
                
                // Restore controls
                postBtn.disabled = false;
                textarea.disabled = false;
                cancelBtn.disabled = false;
                postBtn.innerHTML = originalBtnHTML;
                
                // Show error
                const errorMsg = document.createElement('div');
                errorMsg.className = 'bskycomposer-error';
                errorMsg.textContent = 'Failed to share story. Please try again.';
                box.querySelector('.bskycomposer-content').appendChild(errorMsg);
                
                setTimeout(() => errorMsg.remove(), 3000);
            }
        };
        
        postBtn.addEventListener('click', handlePost);
        
        // Enter key with Ctrl/Cmd to post
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handlePost();
            }
        });
        
        // Cancel button
        const handleCancel = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            if (onCancel) {
                onCancel();
            }
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        
        // ESC key to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });
    }
}

// Auto-instantiate
if (typeof window !== 'undefined') {
    window.BlueskyComposer = BlueskyComposer;
    console.log('✅ [bskycomposer.js] BlueskyComposer class registered on window');
}
