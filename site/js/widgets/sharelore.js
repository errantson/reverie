/**
 * ShareLore Widget
 * Handles the "Share Your Dreams" modal for submitting posts to Reverie House lore
 * Extracted from story.html for reusability
 */

class ShareLore {
    constructor() {
        this.LORE_FARM_API = 'https://lore.farm';
        this.WORLD_DOMAIN = 'reverie.house';
        this.previewTimeout = null;
        this.hasValidPreview = false;
        this.currentPostAuthorDid = null;
        this.modal = null;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
        this.loadPreferences();
    }

    createModal() {
        // Create share modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'share-modal-overlay';
        overlay.id = 'shareModalOverlay';
        overlay.innerHTML = `
            <div class="share-modal">
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
                    
                    <!-- Stage 1 Actions -->
                    <div class="share-modal-actions">
                        <button class="share-cancel-btn" id="cancelShareBtn">Cancel</button>
                        <button class="share-modal-btn share-modal-btn-primary" id="submitLabelBtn" disabled>
                            <svg class="share-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>SHARE LORE</span>
                        </button>
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
                        <button class="share-modal-btn share-modal-btn-primary" id="submitLabelBtnConfirm">
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
                        <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M306.068,156.129c-6.566-5.771-14.205-10.186-22.912-13.244c-8.715-3.051-17.82-4.58-27.326-4.58 c-9.961,0-19.236,1.59-27.834,4.752c-8.605,3.171-16.127,7.638-22.576,13.41c-6.449,5.772-11.539,12.9-15.272,21.384 c-3.736,8.486-5.604,17.937-5.604,28.34h44.131c0-7.915,2.258-14.593,6.785-20.028c4.524-5.426,11.314-8.138,20.369-8.138 c8.598,0,15.328,2.661,20.197,7.974c4.864,5.322,7.297,11.942,7.297,19.856c0,3.854-0.965,7.698-2.887,11.543 c-1.922,3.854-4.242,7.586-6.959,11.197l-21.26,27.232c-4.527,5.884-16.758,22.908-16.758,40.316v10.187h44.129v-7.128 c0-2.938,0.562-5.996,1.699-9.168c1.127-3.162,6.453-10.904,8.268-13.168l21.264-28.243c4.752-6.333,8.705-12.839,11.881-19.518 c3.166-6.67,4.752-14.308,4.752-22.913c0-10.86-1.926-20.478-5.772-28.85C317.832,168.969,312.627,161.892,306.068,156.129z"></path><rect x="234.106" y="328.551" width="46.842" height="45.144"></rect><path d="M256,0C114.613,0,0,114.615,0,256s114.613,256,256,256c141.383,0,256-114.615,256-256S397.383,0,256,0z M256,448c-105.871,0-192-86.131-192-192S150.129,64,256,64c105.867,0,192,86.131,192,192S361.867,448,256,448z"></path></svg>
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

        // Stage 1 submit button — triggers URL processing (fetch + preview)
        const submitBtn = document.getElementById('submitLabelBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this._skipDebounce = true;
                this.handlePostUrlInput();
            });
        }

        // Stage 2 confirm submit button
        const submitConfirmBtn = document.getElementById('submitLabelBtnConfirm');
        if (submitConfirmBtn) {
            submitConfirmBtn.addEventListener('click', () => this.submitStoryLabel());
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelShareBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
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

        // Learn more link
        const learnMoreLink = document.getElementById('learnMoreLink');
        if (learnMoreLink) {
            learnMoreLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

        // Disable buttons — nothing is selected yet
        const stage1Btn = document.getElementById('submitLabelBtn');
        const confirmBtn = document.getElementById('confirmSubmitBtn');
        if (stage1Btn) stage1Btn.disabled = true;
        if (confirmBtn) confirmBtn.disabled = true;
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

            } else {
                characterSection.style.display = 'block';

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
        const overlay = document.getElementById('shareModalOverlay');
        
        if (overlay) {
            overlay.classList.add('active');
            
            // Show input stage, hide preview stage
            this.showInputStage();
            
            // Load recent posts carousel
            this.loadRecentPosts();
            
            // Load character status
            this.loadCharacterStatus();
            
            const statusMsg = document.getElementById('labelStatus');
            if (statusMsg) {
                statusMsg.className = 'share-modal-status';
                statusMsg.textContent = '';
            }
            
            const characterStatus = document.getElementById('characterStatus');
            if (characterStatus) {
                characterStatus.className = 'share-modal-status';
                characterStatus.textContent = '';
            }
            
            // Disable submit buttons until valid post (CSS :disabled handles styling)
            const submitBtn = document.getElementById('submitLabelBtn');
            if (submitBtn) submitBtn.disabled = true;
            const submitConfirmBtn = document.getElementById('submitLabelBtnConfirm');
            if (submitConfirmBtn) submitConfirmBtn.disabled = true;
            
            this.hasValidPreview = false;
            this.currentPostAuthorDid = null;

            // ── Mobile keyboard handling ──────────────────────────
            this._cleanupKeyboard();
            const isMobile = window.matchMedia('(max-width: 600px)').matches;
            this._kbCleanup = [];

            if (isMobile && window.visualViewport) {
                const modal = overlay.querySelector('.share-modal');
                const kbThreshold = 100;
                const onViewportResize = () => {
                    const keyboardOpen = (window.innerHeight - window.visualViewport.height) > kbThreshold;
                    overlay.classList.toggle('keyboard-active', keyboardOpen);
                    if (modal) modal.classList.toggle('keyboard-active', keyboardOpen);
                    if (keyboardOpen && document.activeElement?.closest('.share-modal')) {
                        document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                };
                window.visualViewport.addEventListener('resize', onViewportResize);
                this._kbCleanup.push(() => window.visualViewport.removeEventListener('resize', onViewportResize));
            }

            if (isMobile) {
                const onInputFocus = (e) => {
                    if (e.target.closest('.share-modal')) {
                        setTimeout(() => {
                            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        }, 300);
                    }
                };
                overlay.addEventListener('focusin', onInputFocus);
                this._kbCleanup.push(() => overlay.removeEventListener('focusin', onInputFocus));
            }
        }
    }

    _cleanupKeyboard() {
        if (this._kbCleanup) {
            this._kbCleanup.forEach(fn => fn());
            this._kbCleanup = [];
        }
    }

    async loadRecentPosts() {
        try {
            const session = await window.oauthManager.getSession();
            if (!session?.did) return;
            
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${session.did}&limit=10`);
            if (!response.ok) throw new Error('Failed to fetch posts');
            
            const data = await response.json();
            const posts = data.feed || [];
            
            if (posts.length === 0) {

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
                    const did = post.author.did;
                    const postId = post.uri.split('/').pop();
                    const url = `https://bsky.app/profile/${did}/post/${postId}`;
                    
                    const input = document.getElementById('postUriInput');
                    if (input) {
                        input.value = url;
                        this._skipDebounce = true;
                        this.handlePostUrlInput();
                    }
                });
                
                scroll.appendChild(postCard);
            });
            
            carousel.style.display = 'block';
            // Reset scroll position so the first card is fully visible
            scroll.scrollLeft = 0;            
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
            overlay.classList.remove('keyboard-active');
            const modal = overlay.querySelector('.share-modal');
            if (modal) modal.classList.remove('keyboard-active');
            this._cleanupKeyboard();
            window.dispatchEvent(new CustomEvent('sharelore:cancel'));
        }
    }

    async handlePostUrlInput() {
        const input = document.getElementById('postUriInput');
        const url = input.value.trim();
        const preview = document.getElementById('postPreview');
        const confirmBtn = document.getElementById('submitLabelBtnConfirm');
        const stage1Btn = document.getElementById('submitLabelBtn');
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
            confirmBtn.disabled = true;
            stage1Btn.disabled = true;
            return;
        }
        
        // Enable Stage 1 button as manual trigger while URL is present
        stage1Btn.disabled = false;
        
        // Wait for user to stop typing (skip debounce if called from
        // recent-post click, which sets _skipDebounce before calling)
        const delay = this._skipDebounce ? 0 : 500;
        this._skipDebounce = false;
        
        this.previewTimeout = setTimeout(async () => {
            const parsed = this.bskyUrlToAtUri(url);
            if (!parsed) {
                preview.classList.remove('active');
                return;
            }
            
            try {
                // Resolve AT URI — bskyUrlToAtUri returns either a
                // string (AT URI) or an object { handle, postId }
                const atUri = typeof parsed === 'string'
                    ? parsed
                    : `at://${parsed.handle}/app.bsky.feed.post/${parsed.postId}`;
                
                const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`);
                if (!response.ok) return;
                
                const data = await response.json();
                const post = data.thread?.post;
                
                if (post) {
                    // Store the post author's DID for later validation
                    this.currentPostAuthorDid = post.author.did;
                    
                    // Check if this post belongs to the logged-in user
                    const session = window.oauthManager ? window.oauthManager.getSession() : null;
                    const userDid = session ? (session.did || session.sub) : null;
                    
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
                    
                    // Enable/disable confirm button based on ownership
                    if (userDid && this.currentPostAuthorDid === userDid) {
                        this.hasValidPreview = true;
                        confirmBtn.disabled = false;
                    } else {
                        this.hasValidPreview = false;
                        confirmBtn.disabled = true;
                        
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
                confirmBtn.disabled = true;
            }
        }, delay);
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
        const btn = document.getElementById('submitLabelBtnConfirm');
        const status = document.getElementById('labelStatus');
        
        const url = input.value.trim();
        if (!url) {
            status.className = 'share-modal-status error';
            status.textContent = 'Please enter a Bluesky post URL';
            return;
        }
        
        // Disable button during submission
        btn.disabled = true;
        btn.innerHTML = '<span>Adding to canon...</span>';
        status.className = 'share-modal-status info';
        status.textContent = 'Processing your request...';
        
        try {
            // Parse the URL
            const parsed = this.bskyUrlToAtUri(url);
            if (!parsed) {
                throw new Error('Invalid Bluesky post URL format');
            }
            
            // Check if user is logged in
            const session = window.oauthManager ? window.oauthManager.getSession() : null;
            
            if (!session) {
                throw new Error('You must be logged in to label posts. Please log in first.');
            }
            
            const userDid = session.did || session.sub;
            
            // Verify the post belongs to the logged in user
            if (!this.currentPostAuthorDid) {
                throw new Error('Unable to verify post ownership. Please try loading the post again.');
            }
            
            if (this.currentPostAuthorDid !== userDid) {
                throw new Error('You can only submit your own posts to the lore archive.');
            }
            
            // Convert URL to AT URI format
            const parsedUri = this.bskyUrlToAtUri(url);
            if (!parsedUri) throw new Error('Invalid Bluesky post URL format');
            
            const atUri = typeof parsedUri === 'string'
                ? parsedUri
                : `at://${this.currentPostAuthorDid}/app.bsky.feed.post/${parsedUri.postId}`;
            

            
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
                    userDid: userDid,
                    label: 'lore:reverie.house'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }
            
            const result = await response.json();
            
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
            btn.innerHTML = `
                <svg class="share-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>SHARE LORE</span>`;
        }
    }
}

// Export class
window.ShareLore = ShareLore;

// Auto-initialize on story.html page (check for stories-container)
if (document.getElementById('stories-container')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.shareLoreWidget = new ShareLore();
        });
    } else {
        window.shareLoreWidget = new ShareLore();
    }
}
