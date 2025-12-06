/**
 * ShareLore Widget
 * Handles the "Share Your Dreams" modal for submitting posts to Reverie House lore
 * Extracted from story.html for reusability
 */

class ShareLore {
    constructor() {
        console.log('🏗️ [sharelore.js] ShareLore constructor called');
        this.LORE_FARM_API = 'https://lore.farm';
        this.WORLD_DOMAIN = 'reverie.house';
        this.previewTimeout = null;
        this.hasValidPreview = false;
        this.currentPostAuthorDid = null;
        this.modal = null;
        console.log('   Calling init()...');
        this.init();
    }

    init() {
        console.log('🎬 [sharelore.js] Initializing ShareLore widget');
        
        // Create modal HTML
        console.log('   Creating modal...');
        this.createModal();
        console.log('   Modal created, element:', this.modal);
        
        // Set up event listeners
        console.log('   Setting up event listeners...');
        this.setupEventListeners();
        console.log('   Event listeners set up');
        
        // Load character registration preference
        console.log('   Loading preferences...');
        this.loadPreferences();
        console.log('   Preferences loaded');
        
        console.log('✅ [sharelore.js] ShareLore widget initialized');
    }

    createModal() {
        // Create share modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'share-modal-overlay';
        overlay.id = 'shareModalOverlay';
        overlay.innerHTML = `
            <div class="share-modal">
                <h2 class="share-modal-title">Share Your Dreams</h2>
                <p>
                    Submit or select a dream for the communal <b>Reverie House</b> lore:
                </p>
                
                <!-- Recent Posts Carousel -->
                <div class="share-recent-posts" id="recentPostsCarousel" style="display: none;">
                    <div class="share-recent-posts-scroll" id="recentPostsScroll">
                        <!-- Posts will be inserted here -->
                    </div>
                </div>
                
                <input 
                    type="text" 
                    id="postUriInput" 
                    class="share-modal-input" 
                    placeholder="https://bsky.app/profile/yourhandle/post/..."
                />
                
                <div class="share-modal-preview" id="postPreview">
                    <div class="share-modal-preview-header">
                        <img id="previewAvatar" class="share-modal-preview-avatar" src="" alt="">
                        <div class="share-modal-preview-author">
                            <div class="share-modal-preview-name" id="previewName"></div>
                            <div class="share-modal-preview-handle" id="previewHandle"></div>
                        </div>
                    </div>
                    <div class="share-modal-preview-text" id="previewText"></div>
                    <img id="previewImage" class="share-modal-preview-image" style="display: none;" src="" alt="">
                </div>
                
                <button class="share-modal-btn" id="submitLabelBtn">
                    Add to Shared Lore
                </button>
                <div class="share-modal-status" id="labelStatus"></div>
                
                <!-- Character Application Toggle -->
                <div class="share-character-section" id="characterSection" style="display: none;">
                    <div class="share-character-row">
                        <span class="share-character-label">Apply as Character for lore.farm</span>
                        <label class="character-toggle">
                            <input type="checkbox" 
                                   id="registerCharacterCheck" 
                                   onchange="window.shareLoreWidget.handleCharacterToggle(this.checked)">
                            <span class="character-toggle-slider"></span>
                        </label>
                    </div>
                    <div class="share-modal-status" id="characterStatus"></div>
                </div>
                
                <a class="learn-more-link" id="learnMoreLink">learn more about lore.farm labels</a>
                <div class="share-modal-close-text" id="closeShareModal">Close</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.modal = overlay;
    }

    setupEventListeners() {
        // Post URL input
        const input = document.getElementById('postUriInput');
        if (input) {
            input.addEventListener('input', () => this.handlePostUrlInput());
        }

        // Submit button
        const submitBtn = document.getElementById('submitLabelBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitStoryLabel());
        }

        // Close button
        const closeBtn = document.getElementById('closeShareModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Click outside to close
        const overlay = document.getElementById('shareModalOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });
        }

        // Learn more link (optional - can be handled externally)
        const learnMoreLink = document.getElementById('learnMoreLink');
        if (learnMoreLink) {
            learnMoreLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Trigger custom event for external handling
                window.dispatchEvent(new CustomEvent('sharelore:learnMore'));
            });
        }
    }

    loadPreferences() {
        // Load character registration status when modal opens
        this.loadCharacterStatus();
    }
    
    async loadCharacterStatus() {
        try {
            const session = window.oauthManager ? window.oauthManager.getSession() : null;
            if (!session?.did) {
                return; // Not logged in, hide character section
            }
            
            // Fetch character status
            const response = await fetch('/api/lore/character-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ did: session.did })
            });
            
            if (response.ok) {
                const data = await response.json();
                const characterSection = document.getElementById('characterSection');
                const characterCheck = document.getElementById('registerCharacterCheck');
                
                if (characterSection && characterCheck) {
                    characterSection.style.display = 'block';
                    characterCheck.checked = data.is_character || false;
                }
            }
        } catch (error) {
            console.error('Failed to load character status:', error);
        }
    }
    
    async handleCharacterToggle(isChecked) {
        const statusEl = document.getElementById('characterStatus');
        const session = window.oauthManager ? window.oauthManager.getSession() : null;
        
        if (!session?.did) {
            if (statusEl) {
                statusEl.className = 'share-modal-status error';
                statusEl.textContent = 'Please log in first';
            }
            return;
        }
        
        try {
            const endpoint = isChecked ? '/api/lore/register-character' : '/api/lore/unregister-character';
            const token = localStorage.getItem('oauth_token');
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userDid: session.did,
                    characterName: session.handle || session.did,
                    worldDomain: this.WORLD_DOMAIN
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update character status');
            }
            
            if (statusEl) {
                statusEl.className = 'share-modal-status success';
                statusEl.textContent = isChecked 
                    ? '✓ Applied as character for lore.farm' 
                    : '✓ Removed from character applications';
                    
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.className = 'share-modal-status';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Failed to toggle character status:', error);
            
            // Revert checkbox
            const characterCheck = document.getElementById('registerCharacterCheck');
            if (characterCheck) {
                characterCheck.checked = !isChecked;
            }
            
            if (statusEl) {
                statusEl.className = 'share-modal-status error';
                statusEl.textContent = error.message || 'Failed to update character status';
            }
        }
    }

    show() {
        console.log('📺 [sharelore.js] show() called');
        
        const overlay = document.getElementById('shareModalOverlay');
        console.log('   Overlay element:', overlay);
        
        if (overlay) {
            console.log('   Adding "active" class to overlay');
            overlay.classList.add('active');
            
            // Reset form
            const input = document.getElementById('postUriInput');
            if (input) {
                console.log('   Resetting input field');
                input.value = '';
            } else {
                console.warn('⚠️ [sharelore.js] postUriInput not found');
            }
            
            // Load recent posts carousel
            this.loadRecentPosts();
            
            // Load character status
            this.loadCharacterStatus();
            
            const preview = document.getElementById('postPreview');
            if (preview) {
                console.log('   Hiding preview');
                preview.classList.remove('active');
            } else {
                console.warn('⚠️ [sharelore.js] postPreview not found');
            }
            
            const statusMsg = document.getElementById('labelStatus');
            if (statusMsg) {
                console.log('   Resetting status message');
                statusMsg.className = 'share-modal-status';
                statusMsg.textContent = '';
            } else {
                console.warn('⚠️ [sharelore.js] labelStatus not found');
            }
            
            const characterStatus = document.getElementById('characterStatus');
            if (characterStatus) {
                console.log('   Resetting character status');
                characterStatus.className = 'share-modal-status';
                characterStatus.textContent = '';
            } else {
                console.warn('⚠️ [sharelore.js] characterStatus not found');
            }
            
            // Disable submit button until valid post
            const submitBtn = document.getElementById('submitLabelBtn');
            if (submitBtn) {
                console.log('   Disabling submit button');
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            } else {
                console.warn('⚠️ [sharelore.js] submitLabelBtn not found');
            }
            
            this.hasValidPreview = false;
            this.currentPostAuthorDid = null;
            
            console.log('✅ [sharelore.js] Modal shown successfully');
        } else {
            console.error('❌ [sharelore.js] shareModalOverlay element not found in DOM');
            console.log('   Available elements with id containing "share":', 
                Array.from(document.querySelectorAll('[id*="share"]')).map(el => el.id));
        }
    }

    async loadRecentPosts() {
        console.log('📚 [sharelore.js] Loading recent posts...');
        
        try {
            const session = await window.oauthManager.getSession();
            if (!session?.did) {
                console.log('   No session, skipping recent posts');
                return;
            }
            
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${session.did}&limit=10`);
            if (!response.ok) throw new Error('Failed to fetch posts');
            
            const data = await response.json();
            const posts = data.feed || [];
            
            if (posts.length === 0) {
                console.log('   No recent posts found');
                return;
            }
            
            const carousel = document.getElementById('recentPostsCarousel');
            const scroll = document.getElementById('recentPostsScroll');
            
            if (!carousel || !scroll) return;
            
            scroll.innerHTML = '';
            
            posts.forEach(item => {
                const post = item.post;
                const text = post.record?.text || '';
                const truncated = text.length > 60 ? text.substring(0, 60) + '...' : text;
                
                // Check for images
                const embed = post.record?.embed;
                let imageUrl = '';
                if (embed?.images?.[0]?.thumb) {
                    imageUrl = embed.images[0].thumb;
                } else if (embed?.media?.images?.[0]?.thumb) {
                    imageUrl = embed.media.images[0].thumb;
                }
                
                const postCard = document.createElement('div');
                postCard.className = 'share-recent-post-card';
                postCard.innerHTML = `
                    <div class="share-recent-post-date">${this.formatPostDate(post.indexedAt)}</div>
                    ${imageUrl ? `<img src="${imageUrl}" class="share-recent-post-image" alt="">` : ''}
                    <div class="share-recent-post-text">${this.escapeHtml(truncated)}</div>
                `;
                
                postCard.addEventListener('click', () => {
                    const handle = post.author.handle;
                    const postId = post.uri.split('/').pop();
                    const url = `https://bsky.app/profile/${handle}/post/${postId}`;
                    
                    const input = document.getElementById('postUriInput');
                    if (input) {
                        input.value = url;
                        this.handlePostUrlInput();
                    }
                });
                
                scroll.appendChild(postCard);
            });
            
            carousel.style.display = 'block';
            console.log(`✅ Loaded ${posts.length} recent posts`);
            
        } catch (error) {
            console.error('❌ Failed to load recent posts:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatPostDate(isoDate) {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    close() {
        const overlay = document.getElementById('shareModalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            
            // Dispatch cancel event
            window.dispatchEvent(new CustomEvent('sharelore:cancel'));
            console.log('📢 [sharelore.js] Dispatched sharelore:cancel event');
        }
    }

    async handlePostUrlInput() {
        const input = document.getElementById('postUriInput');
        const url = input.value.trim();
        const preview = document.getElementById('postPreview');
        const submitBtn = document.getElementById('submitLabelBtn');
        const statusMsg = document.getElementById('labelStatus');
        
        // Clear previous timeout
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        
        // Clear any previous error messages
        statusMsg.className = 'share-modal-status';
        statusMsg.textContent = '';
        
        if (!url) {
            preview.classList.remove('active');
            this.hasValidPreview = false;
            this.currentPostAuthorDid = null;
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
            return;
        }
        
        // Wait for user to stop typing
        this.previewTimeout = setTimeout(async () => {
            const parsed = this.bskyUrlToAtUri(url);
            if (!parsed) {
                preview.classList.remove('active');
                return;
            }
            
            try {
                // Fetch post details
                const atUri = parsed.handle && parsed.postId 
                    ? `at://${parsed.handle}/app.bsky.feed.post/${parsed.postId}`
                    : url;
                
                const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`);
                if (!response.ok) return;
                
                const data = await response.json();
                const post = data.thread?.post;
                
                if (post) {
                    // Store the post author's DID for later validation
                    this.currentPostAuthorDid = post.author.did;
                    
                    // Check if this post belongs to the logged-in user
                    const session = window.oauthManager ? window.oauthManager.getSession() : null;
                    const userDid = session ? session.did : null;
                    
                    // Populate preview
                    document.getElementById('previewAvatar').src = post.author.avatar || '';
                    document.getElementById('previewName').textContent = post.author.displayName || post.author.handle;
                    document.getElementById('previewHandle').textContent = '@' + post.author.handle;
                    document.getElementById('previewText').textContent = post.record.text || '';
                    
                    // Handle image
                    const previewImg = document.getElementById('previewImage');
                    if (post.embed?.images && post.embed.images.length > 0) {
                        previewImg.src = post.embed.images[0].thumb || post.embed.images[0].fullsize;
                        previewImg.style.display = 'block';
                    } else {
                        previewImg.style.display = 'none';
                    }
                    
                    preview.classList.add('active');
                    
                    // Only enable submit button if the post belongs to the logged-in user
                    if (userDid && this.currentPostAuthorDid === userDid) {
                        this.hasValidPreview = true;
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';
                    } else {
                        this.hasValidPreview = false;
                        submitBtn.disabled = true;
                        submitBtn.style.opacity = '0.5';
                        submitBtn.style.cursor = 'not-allowed';
                        
                        // Show error message if trying to submit someone else's post
                        if (userDid && this.currentPostAuthorDid !== userDid) {
                            statusMsg.className = 'share-modal-status error';
                            statusMsg.textContent = 'You may only enter your own dreams to the lore.';
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching post preview:', error);
                preview.classList.remove('active');
                this.hasValidPreview = false;
                this.currentPostAuthorDid = null;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            }
        }, 500);
    }

    bskyUrlToAtUri(url) {
        try {
            // Handle formats like:
            // https://bsky.app/profile/handle.domain/post/abc123
            // https://bsky.app/profile/did:plc:xxx/post/abc123
            const match = url.match(/bsky\.app\/profile\/([^\/]+)\/post\/([^\/\?]+)/);
            if (!match) return null;
            
            const actor = match[1];
            const postId = match[2];
            
            // If actor is a DID, use it directly
            if (actor.startsWith('did:')) {
                return `at://${actor}/app.bsky.feed.post/${postId}`;
            }
            
            // Otherwise we need to resolve the handle to DID
            return { handle: actor, postId: postId };
        } catch (error) {
            console.error('Error parsing Bluesky URL:', error);
            return null;
        }
    }

    async submitStoryLabel() {
        const input = document.getElementById('postUriInput');
        const btn = document.getElementById('submitLabelBtn');
        const status = document.getElementById('labelStatus');
        
        const url = input.value.trim();
        if (!url) {
            status.className = 'share-modal-status error';
            status.textContent = 'Please enter a Bluesky post URL';
            return;
        }
        
        // Disable button during submission
        btn.disabled = true;
        btn.textContent = 'Adding to canon...';
        status.className = 'share-modal-status info';
        status.textContent = 'Processing your request...';
        
        try {
            // Parse the URL
            const parsed = this.bskyUrlToAtUri(url);
            if (!parsed) {
                throw new Error('Invalid Bluesky post URL format');
            }
            
            // Check if user is logged in
            console.log('🔍 [Share] Step 1: Checking OAuth session...');
            const session = window.oauthManager ? window.oauthManager.getSession() : null;
            console.log('🔍 [Share] OAuth manager exists:', !!window.oauthManager);
            console.log('🔍 [Share] Session exists:', !!session);
            
            if (!session) {
                console.error('❌ [Share] No session found');
                throw new Error('You must be logged in to label posts. Please log in first.');
            }
            
            console.log('✅ [Share] Session found:', {
                did: session.did,
                handle: session.handle || 'unknown'
            });
            
            // Verify the post belongs to the logged in user
            console.log('🔍 [Share] Step 2: Verifying post ownership...');
            console.log('🔍 [Share] Current post author DID:', this.currentPostAuthorDid);
            console.log('🔍 [Share] Session DID:', session.did);
            
            if (!this.currentPostAuthorDid) {
                console.error('❌ [Share] No currentPostAuthorDid available');
                throw new Error('Unable to verify post ownership. Please try loading the post again.');
            }
            
            if (this.currentPostAuthorDid !== session.did) {
                console.error('❌ [Share] DID mismatch:', {
                    postAuthor: this.currentPostAuthorDid,
                    sessionUser: session.did
                });
                throw new Error('You can only submit your own posts to the lore archive.');
            }
            
            console.log('✅ [Share] Ownership verified');
            console.log('📤 [Share] Step 3: Sending label application request...');
            
            // Convert URL to AT URI format
            const parsedUri = this.bskyUrlToAtUri(url);
            let atUri;
            
            if (typeof parsedUri === 'string') {
                // Already an AT URI
                atUri = parsedUri;
            } else if (parsedUri && parsedUri.handle && parsedUri.postId) {
                // Need to construct AT URI from DID we already have
                atUri = `at://${this.currentPostAuthorDid}/app.bsky.feed.post/${parsedUri.postId}`;
            } else {
                throw new Error('Failed to parse post URL');
            }
            
            console.log('📤 [Share] Request payload:', {
                uri: atUri,
                userDid: session.did,
                label: 'lore:reverie.house'
            });
            
            // Make request to Reverie proxy endpoint
            const response = await fetch('/api/lore/apply-label', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uri: atUri,
                    userDid: session.did,
                    label: 'lore:reverie.house'
                })
            });
            
            console.log('📥 [Share] Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });
            
            if (!response.ok) {
                console.error('❌ [Share] Response not OK');
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ [Share] Error data:', errorData);
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ [Share] Success! Result:', result);
            
            status.className = 'share-modal-status success';
            status.textContent = '✓ Your story has been added to the canon!';
            input.value = '';
            document.getElementById('postPreview').classList.remove('active');
            
            // Trigger success event
            window.dispatchEvent(new CustomEvent('sharelore:success', { detail: result }));
            
            // Close after delay
            setTimeout(() => {
                this.close();
            }, 2000);
            
        } catch (error) {
            console.error('Error applying label:', error);
            status.className = 'share-modal-status error';
            status.textContent = error.message || 'Failed to apply label. Please try again.';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Add to Shared Lore';
        }
    }
}

// Export class (don't auto-initialize - let pages create their own instance)
console.log('📦 [sharelore.js] Exporting ShareLore class to window.ShareLore');
window.ShareLore = ShareLore;
console.log('✅ [sharelore.js] ShareLore class available at window.ShareLore:', window.ShareLore);

// Only auto-initialize on story.html page (check for stories-container)
if (document.getElementById('stories-container')) {
    console.log('📄 [sharelore.js] story.html detected, auto-initializing...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 [sharelore.js] DOM loaded, creating ShareLore instance for story.html');
            window.shareLoreWidget = new ShareLore();
            console.log('✅ [sharelore.js] ShareLore widget assigned to window.shareLoreWidget:', window.shareLoreWidget);
        });
    } else {
        console.log('📄 [sharelore.js] DOM already loaded, creating ShareLore instance for story.html');
        window.shareLoreWidget = new ShareLore();
        console.log('✅ [sharelore.js] ShareLore widget assigned to window.shareLoreWidget:', window.shareLoreWidget);
    }
} else {
    console.log('� [sharelore.js] Not story.html, skipping auto-initialization (will be created on-demand)');
}
