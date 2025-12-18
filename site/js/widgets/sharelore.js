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
                <!-- Close Button -->
                <button class="share-modal-close" id="closeShareModal" aria-label="Close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                
                <!-- Header Section -->
                <div class="share-modal-header">
                    <h2 class="share-modal-title">Submit to Canon</h2>
                    <p class="share-modal-subtitle">
                        Submit a dream for the communal <strong>Reverie House</strong> canon
                    </p>
                </div>
                
                <!-- Stage 1: Input & Recent Posts -->
                <div class="share-stage share-stage-input" id="stageInput">
                    <!-- Recent Posts Section -->
                    <div class="share-section share-recent-section" id="recentPostsCarousel" style="display: none;">
                        <label class="share-section-label">Your Recent Posts</label>
                        <div class="share-recent-posts-scroll" id="recentPostsScroll">
                            <!-- Posts will be inserted here -->
                        </div>
                    </div>
                    
                    <!-- Input Section -->
                    <div class="share-section">
                        <label class="share-section-label" for="postUriInput">
                            Bluesky Post URL
                        </label>
                        <div class="share-input-wrapper">
                            <svg class="share-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            <input 
                                type="text" 
                                id="postUriInput" 
                                class="share-modal-input" 
                                placeholder="https://bsky.app/profile/yourhandle/post/..."
                                autocomplete="off"
                                spellcheck="false"
                            />
                        </div>
                    </div>
                </div>
                
                <!-- Stage 2: Preview & Actions -->
                <div class="share-stage share-stage-preview" id="stagePreview" style="display: none;">
                    <!-- Preview Section -->
                    <div class="share-section">
                        <div class="share-preview-card" id="postPreview">
                            <div class="share-preview-header">
                                <img id="previewAvatar" class="share-preview-avatar" src="" alt="">
                                <div class="share-preview-author">
                                    <div class="share-preview-name" id="previewName"></div>
                                    <div class="share-preview-handle" id="previewHandle"></div>
                                </div>
                            </div>
                            <div class="share-preview-content">
                                <div class="share-preview-text" id="previewText"></div>
                                <img id="previewImage" class="share-preview-image" style="display: none;" src="" alt="">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status Messages -->
                    <div class="share-modal-status" id="labelStatus"></div>
                    
                    <!-- Action Buttons -->
                    <div class="share-modal-actions">
                        <button class="share-back-btn" id="backToInputBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            Back
                        </button>
                        <button class="share-modal-btn share-modal-btn-primary" id="submitLabelBtn">
                            <svg class="share-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>SHARE LORE</span>
                        </button>
                    </div>
                    
                    <!-- Character Application Section -->
                    <div class="share-character-section" id="characterSection" style="display: none;">
                        <div class="share-character-card">
                            <div class="share-character-content">
                                <div class="share-character-info">
                                    <div class="share-character-label">Character Account</div>
                                    <div class="share-character-description">Note this dreamweaver and their entire history as eligible for lore and canon applications, at the pervue of reverie.house loremasters.</div>
                                </div>
                                <label class="character-toggle">
                                    <input type="checkbox" 
                                           id="registerCharacterCheck" 
                                           onchange="window.shareLoreWidget.handleCharacterToggle(this.checked)">
                                    <span class="character-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="share-modal-status" id="characterStatus"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="share-modal-footer">
                    <a class="learn-more-link" id="learnMoreLink">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Learn more about lore.farm labels
                    </a>
                </div>
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

        // Back button
        const backBtn = document.getElementById('backToInputBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showInputStage());
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

    showInputStage() {
        const inputStage = document.getElementById('stageInput');
        const previewStage = document.getElementById('stagePreview');
        
        if (inputStage) inputStage.style.display = 'block';
        if (previewStage) previewStage.style.display = 'none';
        
        // Clear input
        const input = document.getElementById('postUriInput');
        if (input) input.value = '';
        
        // Reset state
        this.hasValidPreview = false;
        this.currentPostAuthorDid = null;
    }

    async showPreviewStage() {
        const inputStage = document.getElementById('stageInput');
        const previewStage = document.getElementById('stagePreview');
        
        if (inputStage) inputStage.style.display = 'none';
        if (previewStage) previewStage.style.display = 'block';
        
        // Check character status and hide toggle if already registered
        await this.checkAndUpdateCharacterSection();
        
        // Apply user color to modal
        this.applyUserColor();
    }

    loadPreferences() {
        // Load character registration status when modal opens
        this.loadCharacterStatus();
    }
    
    async checkAndUpdateCharacterSection() {
        try {
            const session = window.oauthManager ? window.oauthManager.getSession() : null;
            if (!session?.did) {
                // Not logged in, hide character section
                const characterSection = document.getElementById('characterSection');
                if (characterSection) characterSection.style.display = 'none';
                return;
            }
            
            // Check if user is already registered as a character
            const response = await fetch('/api/dreamers');
            if (!response.ok) return;
            
            const dreamers = await response.json();
            const userDreamer = dreamers.find(d => d.did === session.did);
            
            const characterSection = document.getElementById('characterSection');
            if (!characterSection) return;
            
            // Only show character section if user is NOT already registered
            if (userDreamer && userDreamer.display_name) {
                characterSection.style.display = 'none';
                console.log('✅ [Share] User already registered as character, hiding toggle');
            } else {
                characterSection.style.display = 'block';
                console.log('ℹ️ [Share] User not registered, showing character toggle');
            }
        } catch (error) {
            console.error('Failed to check character status:', error);
        }
    }
    
    applyUserColor() {
        // Get user color from color manager if available
        const userColor = window.colorManager?.color || window.colorManager?.getColor?.() || '#556C53';
        if (userColor) {
            const modal = document.querySelector('.share-modal');
            if (modal) {
                modal.style.setProperty('--user-color', userColor);
                console.log('🎨 [Share] Applied user color:', userColor);
            }
        }
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
            
            // Show input stage, hide preview stage
            this.showInputStage();
            
            // Load recent posts carousel
            this.loadRecentPosts();
            
            // Load character status
            this.loadCharacterStatus();
            
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
                
                // Get author info
                const avatar = post.author.avatar || '';
                const displayName = post.author.displayName || post.author.handle;
                const handle = post.author.handle;
                
                const postCard = document.createElement('div');
                postCard.className = 'share-recent-post-card';
                
                if (imageUrl) {
                    // Image-focused layout
                    postCard.innerHTML = `
                        <img src="${imageUrl}" class="share-recent-post-image-large" alt="">
                        <div class="share-recent-post-author-info">
                            <img src="${avatar}" class="share-recent-post-avatar" alt="">
                            <div class="share-recent-post-author-text">
                                <div class="share-recent-post-author-name">${this.escapeHtml(displayName)}</div>
                                <div class="share-recent-post-author-handle">@${this.escapeHtml(handle)}</div>
                            </div>
                        </div>
                    `;
                } else {
                    // Text-focused layout
                    postCard.innerHTML = `
                        <div class="share-recent-post-date">${this.formatPostDate(post.indexedAt)}</div>
                        <div class="share-recent-post-text">${this.escapeHtml(truncated)}</div>
                        <div class="share-recent-post-author-info">
                            <img src="${avatar}" class="share-recent-post-avatar" alt="">
                            <div class="share-recent-post-author-text">
                                <div class="share-recent-post-author-name">${this.escapeHtml(displayName)}</div>
                                <div class="share-recent-post-author-handle">@${this.escapeHtml(handle)}</div>
                            </div>
                        </div>
                    `;
                }
                
                postCard.addEventListener('click', () => {
                    const handle = post.author.handle;
                    const postId = post.uri.split('/').pop();
                    const url = `https://bsky.app/profile/${handle}/post/${postId}`;
                    
                    const input = document.getElementById('postUriInput');
                    if (input) {
                        input.value = url;
                        // Trigger the input handler which will switch to preview stage
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
                    
                    // Switch to preview stage
                    this.showPreviewStage();
                    
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
            // Prefer using the OAuth manager token set (handles refresh/DPoP),
            // fall back to localStorage admin/oauth tokens.
            let authHeader = null;
            try {
                if (window.oauthManager && typeof window.oauthManager.getTokenSet === 'function') {
                    const tokenSet = await window.oauthManager.getTokenSet('auto');
                    if (tokenSet && tokenSet.access_token) {
                        const type = tokenSet.token_type || 'Bearer';
                        authHeader = `${type} ${tokenSet.access_token}`;
                    }
                }
            } catch (err) {
                console.warn('Unable to retrieve token from oauthManager.getTokenSet():', err);
            }

            if (!authHeader) {
                // Try conventional localStorage keys used elsewhere in the app
                const fallback = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token') || localStorage.getItem('reverie_token');
                if (fallback) authHeader = `Bearer ${fallback}`;
            }

            if (!authHeader) {
                throw new Error('Missing OAuth token; please log in again.');
            }

            // Some server endpoints in this project expect `X-Auth-Token` instead
            // of or in addition to the Authorization header (see dashboard.js).
            let xAuthToken = null;
            try {
                if (window.oauthManager && typeof window.oauthManager.getAuthToken === 'function') {
                    xAuthToken = window.oauthManager.getAuthToken();
                }
            } catch (err) {
                console.warn('Error calling oauthManager.getAuthToken():', err);
            }

            // Fallbacks for X-Auth-Token
            if (!xAuthToken) {
                const sessionObj = window.oauthManager ? window.oauthManager.getSession && window.oauthManager.getSession() : null;
                if (sessionObj && sessionObj.accessJwt) {
                    xAuthToken = sessionObj.accessJwt;
                }
            }
            if (!xAuthToken) {
                xAuthToken = localStorage.getItem('reverie_token') || localStorage.getItem('admin_token') || localStorage.getItem('oauth_token') || '';
            }

            const headers = {
                'Content-Type': 'application/json'
            };
            if (authHeader) headers['Authorization'] = authHeader;
            if (xAuthToken) headers['X-Auth-Token'] = xAuthToken;

            const response = await fetch('/api/lore/apply-label', {
                method: 'POST',
                headers,
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
