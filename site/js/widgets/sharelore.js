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
        this.currentSubjectUri = null;
        this.currentRecordType = null;
        this.currentPostCid = null;
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
                    <div class="share-header-notice" id="shareHeaderNotice" style="display: none;"></div>
                    <a class="learn-more-link" id="learnMoreLink">
                        <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M306.068,156.129c-6.566-5.771-14.205-10.186-22.912-13.244c-8.715-3.051-17.82-4.58-27.326-4.58 c-9.961,0-19.236,1.59-27.834,4.752c-8.605,3.171-16.127,7.638-22.576,13.41c-6.449,5.772-11.539,12.9-15.272,21.384 c-3.736,8.486-5.604,17.937-5.604,28.34h44.131c0-7.915,2.258-14.593,6.785-20.028c4.524-5.426,11.314-8.138,20.369-8.138 c8.598,0,15.328,2.661,20.197,7.974c4.864,5.322,7.297,11.942,7.297,19.856c0,3.854-0.965,7.698-2.887,11.543 c-1.922,3.854-4.242,7.586-6.959,11.197l-21.26,27.232c-4.527,5.884-16.758,22.908-16.758,40.316v10.187h44.129v-7.128 c0-2.938,0.562-5.996,1.699-9.168c1.127-3.162,6.453-10.904,8.268-13.168l21.264-28.243c4.752-6.333,8.705-12.839,11.881-19.518 c3.166-6.67,4.752-14.308,4.752-22.913c0-10.86-1.926-20.478-5.772-28.85C317.832,168.969,312.627,161.892,306.068,156.129z"></path><rect x="234.106" y="328.551" width="46.842" height="45.144"></rect><path d="M256,0C114.613,0,0,114.615,0,256s114.613,256,256,256c141.383,0,256-114.615,256-256S397.383,0,256,0z M256,448c-105.871,0-192-86.131-192-192S150.129,64,256,64c105.867,0,192,86.131,192,192S361.867,448,256,448z"></path></svg>
                        Learn more about lore.farm labels
                    </a>
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
                                <h3 class="share-preview-title" id="previewTitle" style="display: none;"></h3>
                                <div class="share-preview-text" id="previewText"></div>
                                <img id="previewImage" class="share-preview-image" style="display: none;" src="" alt="">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status Messages -->
                    <div class="share-modal-status" id="labelStatus"></div>
                    
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
                    <div class="share-footer-input-wrapper">
                        <svg class="share-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        <input 
                            type="text" 
                            id="postUriInput" 
                            class="share-modal-input" 
                            placeholder="https://bsky.app/profile/yourhandle/post/... or https://branchline.ink/bud/... or at://did:plc:.../site.standard.document/..."
                            autocomplete="off"
                            spellcheck="false"
                        />
                    </div>
                    <div class="share-modal-actions share-modal-actions-footer">
                        <button class="share-cancel-btn" id="cancelShareBtn">Cancel</button>
                        <button class="share-back-btn" id="backToInputBtn" style="display: none;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            Back
                        </button>
                        <button class="share-modal-btn share-modal-btn-primary" id="submitLabelBtn" disabled>
                            <svg class="share-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>SHARE LORE</span>
                        </button>
                        <button class="share-modal-btn share-modal-btn-primary" id="submitLabelBtnConfirm" style="display: none;" disabled>
                            <svg class="share-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>SHARE LORE</span>
                        </button>
                    </div>
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
        const stage1Btn = document.getElementById('submitLabelBtn');
        const confirmBtn = document.getElementById('submitLabelBtnConfirm');
        const backBtn = document.getElementById('backToInputBtn');
        
        if (inputStage) inputStage.style.display = 'block';
        if (previewStage) previewStage.style.display = 'none';
        if (stage1Btn) stage1Btn.style.display = 'inline-flex';
        if (confirmBtn) confirmBtn.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        
        // Clear input
        const input = document.getElementById('postUriInput');
        if (input && !input.value) input.value = '';
        
        // Reset state
        this.hasValidPreview = false;
        this.currentPostAuthorDid = null;
        this.currentSubjectUri = null;
        this.currentRecordType = null;
        this.currentPostCid = null;

        // Disable buttons — nothing is selected yet
        const confirmPreviewBtn = document.getElementById('confirmSubmitBtn');
        if (stage1Btn) stage1Btn.disabled = true;
        if (confirmBtn) confirmBtn.disabled = true;
        if (confirmPreviewBtn) confirmPreviewBtn.disabled = true;
    }

    async showPreviewStage() {
        const inputStage = document.getElementById('stageInput');
        const previewStage = document.getElementById('stagePreview');
        const stage1Btn = document.getElementById('submitLabelBtn');
        const confirmBtn = document.getElementById('submitLabelBtnConfirm');
        const backBtn = document.getElementById('backToInputBtn');
        
        if (inputStage) inputStage.style.display = 'none';
        if (previewStage) previewStage.style.display = 'block';
        if (previewStage) previewStage.scrollTop = 0;
        const previewCard = document.getElementById('postPreview');
        const previewText = document.getElementById('previewText');
        if (previewCard) previewCard.scrollTop = 0;
        if (previewText) previewText.scrollTop = 0;
        if (stage1Btn) stage1Btn.style.display = 'none';
        if (confirmBtn) confirmBtn.style.display = 'inline-flex';
        if (backBtn) backBtn.style.display = 'inline-flex';
        
        // Check character status and hide toggle if already registered
        await this.checkAndUpdateCharacterSection();
        
        // Apply user color to modal
        this.applyUserColor();
    }

    setHeaderNotice(message = '') {
        const noticeEl = document.getElementById('shareHeaderNotice');
        const learnMoreLink = document.getElementById('learnMoreLink');
        const hasMessage = !!(message && message.trim());

        if (noticeEl) {
            noticeEl.textContent = hasMessage ? message : '';
            noticeEl.style.display = hasMessage ? 'block' : 'none';
        }

        if (learnMoreLink) {
            learnMoreLink.style.display = hasMessage ? 'none' : 'inline-flex';
        }
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
            
            // Check character status via indexer API
            const response = await fetch(
                `${this.LORE_FARM_API}/api/worlds/${this.WORLD_DOMAIN}/characters/${session.did}/indexed`
            );
            
            const characterSection = document.getElementById('characterSection');
            const characterCheck = document.getElementById('registerCharacterCheck');
            
            if (characterSection && characterCheck) {
                characterSection.style.display = 'block';
                if (response.ok) {
                    const data = await response.json();
                    characterCheck.checked = !!data.member;
                    // Store the rkey if registered, needed for unregister
                    this._characterRkey = data.rkey || null;
                } else {
                    characterCheck.checked = false;
                    this._characterRkey = null;
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
            if (isChecked) {
                // Register: write farm.lore.character record to user's PDS
                const result = await window.oauthManager.createRecord('farm.lore.character', {
                    world: this.WORLD_DOMAIN,
                    createdAt: new Date().toISOString(),
                });
                // Extract rkey from the returned URI for future unregister
                const rkeyMatch = result.uri.match(/\/([^/]+)$/);
                this._characterRkey = rkeyMatch ? rkeyMatch[1] : null;
                // Notify lore.farm to index immediately
                try {
                    await fetch(`${this.LORE_FARM_API}/api/notify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uri: result.uri }),
                    });
                } catch (e) {
                    console.warn('Character notify failed:', e);
                }
            } else {
                // Unregister: delete character record from user's PDS
                if (!this._characterRkey) {
                    // Try to fetch the rkey from the indexer
                    const resp = await fetch(
                        `${this.LORE_FARM_API}/api/worlds/${this.WORLD_DOMAIN}/characters/${session.did}/indexed`
                    );
                    if (resp.ok) {
                        const data = await resp.json();
                        this._characterRkey = data.rkey;
                    }
                }
                if (!this._characterRkey) {
                    throw new Error('Could not find character record to remove');
                }
                await window.oauthManager.deleteRecord('farm.lore.character', this._characterRkey);
                this._characterRkey = null;
            }
            
            if (statusEl) {
                statusEl.className = 'share-modal-status success';
                statusEl.textContent = isChecked 
                    ? '✓ Registered as character for this world' 
                    : '✓ Removed character registration';
                    
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
            const input = document.getElementById('postUriInput');
            if (input) input.value = '';
            
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
            this.currentSubjectUri = null;
            this.currentRecordType = null;
            this.currentPostCid = null;
            this.setHeaderNotice('');

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
            
            const response = await fetch(`/bsky/xrpc/app.bsky.feed.getAuthorFeed?actor=${session.did}&limit=10`);
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

    utf8ByteOffsetToCharIndex(text, byteOffset) {
        const target = Math.max(0, Number(byteOffset) || 0);
        let currentByte = 0;
        let currentIndex = 0;

        for (const symbol of text) {
            if (target <= currentByte) {
                return currentIndex;
            }
            currentByte += new TextEncoder().encode(symbol).length;
            currentIndex += symbol.length;
            if (target < currentByte) {
                return currentIndex;
            }
        }

        return currentIndex;
    }

    renderBranchlinePreviewText(text, formatting) {
        const source = typeof text === 'string' ? text : '';
        if (!source) {
            return '<p style="margin: 0;">No text available</p>';
        }

        const ranges = Array.isArray(formatting)
            ? formatting
                .map((entry) => {
                    const type = entry?.type;
                    if (type !== 'bold' && type !== 'italic') return null;
                    const start = this.utf8ByteOffsetToCharIndex(source, entry?.start);
                    const end = this.utf8ByteOffsetToCharIndex(source, entry?.end);
                    if (end <= start) return null;
                    return { type, start, end };
                })
                .filter(Boolean)
                .sort((a, b) => a.start - b.start || a.end - b.end)
            : [];

        const wrapParagraphs = (htmlText) => {
            const paragraphHtml = htmlText
                .split(/\n\s*\n/)
                .map((paragraph) => `<p style="margin: 0 0 14px 0;">${paragraph.replace(/\n/g, '<br>')}</p>`)
                .join('');
            return paragraphHtml || '<p style="margin: 0;">No text available</p>';
        };

        if (!ranges.length) {
            return wrapParagraphs(this.escapeHtml(source));
        }

        const starts = new Map();
        const ends = new Map();
        ranges.forEach((range) => {
            if (!starts.has(range.start)) starts.set(range.start, []);
            if (!ends.has(range.end)) ends.set(range.end, []);
            starts.get(range.start).push(range.type);
            ends.get(range.end).push(range.type);
        });

        const points = Array.from(new Set([0, source.length, ...starts.keys(), ...ends.keys()])).sort((a, b) => a - b);
        const active = new Set();
        let html = '';

        for (let i = 0; i < points.length - 1; i += 1) {
            const point = points[i];
            const nextPoint = points[i + 1];

            (ends.get(point) || []).forEach((type) => active.delete(type));
            (starts.get(point) || []).forEach((type) => active.add(type));

            if (nextPoint <= point) continue;

            let segment = this.escapeHtml(source.slice(point, nextPoint));
            if (active.has('bold')) segment = `<strong>${segment}</strong>`;
            if (active.has('italic')) segment = `<em>${segment}</em>`;
            html += segment;
        }

        return wrapParagraphs(html);
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
        this.setHeaderNotice('');
        
        if (!url) {
            preview.classList.remove('active');
            this.hasValidPreview = false;
            this.currentPostAuthorDid = null;
            this.currentSubjectUri = null;
            this.currentRecordType = null;
            this.currentPostCid = null;
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
            const parsed = this.parseSupportedUrl(url);
            if (!parsed) {
                preview.classList.remove('active');
                this.setHeaderNotice('Please enter a valid Bluesky or Branchline post URL.');
                return;
            }
            
            try {
                const session = window.oauthManager ? window.oauthManager.getSession() : null;
                const userDid = session ? (session.did || session.sub) : null;

                if (parsed.type === 'branchline' || parsed.type === 'standard') {
                    const response = await fetch('/api/preview-post', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uri: parsed.atUri }),
                    });
                    if (!response.ok) return;

                    const data = await response.json();
                    if (!data.ok || !data.record) return;

                    const record = data.record;
                    const author = data.author || {};
                    this.currentPostAuthorDid = data.did || author.did || '';
                    this.currentPostCid = data.cid || '';
                    this.currentSubjectUri = data.uri || parsed.atUri;
                    this.currentRecordType = record.$type || (parsed.type === 'standard' ? 'site.standard.document' : 'ink.branchline.bud');

                    document.getElementById('previewAvatar').src = author.avatar || '/assets/icon_face.png';
                    document.getElementById('previewName').textContent = author.displayName || author.handle || 'Unknown';
                    document.getElementById('previewHandle').textContent = '@' + (author.handle || this.currentPostAuthorDid || 'unknown');
                    const previewTitle = document.getElementById('previewTitle');
                    const previewText = document.getElementById('previewText');
                    const rawTitle = record.title || '';
                    const rawText = record.text || record.textContent || '';

                    if (previewTitle) {
                        if (rawTitle) {
                            previewTitle.textContent = rawTitle;
                            previewTitle.style.display = 'block';
                        } else {
                            previewTitle.textContent = '';
                            previewTitle.style.display = 'none';
                        }
                    }

                    if (previewText) {
                        previewText.innerHTML = this.renderBranchlinePreviewText(
                            rawText,
                            Array.isArray(record.formatting) ? record.formatting : []
                        );
                        const previewStage = document.getElementById('stagePreview');
                        if (previewStage) previewStage.scrollTop = 0;
                        const previewCard = document.getElementById('postPreview');
                        if (previewCard) previewCard.scrollTop = 0;
                        requestAnimationFrame(() => {
                            if (previewStage) previewStage.scrollTop = 0;
                            if (previewCard) previewCard.scrollTop = 0;
                        });
                    }

                    const previewImg = document.getElementById('previewImage');
                    previewImg.style.display = 'none';

                    this.showPreviewStage();

                    if (userDid && this.currentPostAuthorDid === userDid) {
                        this.hasValidPreview = true;
                        confirmBtn.disabled = false;
                        this.setHeaderNotice('');
                    } else {
                        this.hasValidPreview = false;
                        confirmBtn.disabled = true;
                        if (userDid && this.currentPostAuthorDid !== userDid) {
                            this.setHeaderNotice('You may only enter your own dreams to the lore.');
                        }
                    }
                    return;
                }

                const atUri = parsed.atUri;
                const response = await fetch(`/bsky/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`);
                if (!response.ok) return;

                const data = await response.json();
                const post = data.thread?.post;

                if (post) {
                    this.currentPostAuthorDid = post.author.did;
                    this.currentPostCid = post.cid;
                    this.currentSubjectUri = post.uri || atUri;
                    this.currentRecordType = 'app.bsky.feed.post';

                    document.getElementById('previewAvatar').src = post.author.avatar || '';
                    document.getElementById('previewName').textContent = post.author.displayName || post.author.handle;
                    document.getElementById('previewHandle').textContent = '@' + post.author.handle;
                    const previewTitle = document.getElementById('previewTitle');
                    const previewText = document.getElementById('previewText');
                    if (previewTitle) {
                        previewTitle.textContent = '';
                        previewTitle.style.display = 'none';
                    }
                    if (previewText) {
                        previewText.textContent = post.record.text || '';
                        const previewStage = document.getElementById('stagePreview');
                        if (previewStage) previewStage.scrollTop = 0;
                        const previewCard = document.getElementById('postPreview');
                        if (previewCard) previewCard.scrollTop = 0;
                    }

                    const previewImg = document.getElementById('previewImage');
                    if (post.embed?.images && post.embed.images.length > 0) {
                        previewImg.src = post.embed.images[0].thumb || post.embed.images[0].fullsize;
                        previewImg.style.display = 'block';
                    } else {
                        previewImg.style.display = 'none';
                    }

                    this.showPreviewStage();

                    if (userDid && this.currentPostAuthorDid === userDid) {
                        this.hasValidPreview = true;
                        confirmBtn.disabled = false;
                        this.setHeaderNotice('');
                    } else {
                        this.hasValidPreview = false;
                        confirmBtn.disabled = true;

                        if (userDid && this.currentPostAuthorDid !== userDid) {
                            this.setHeaderNotice('You may only enter your own dreams to the lore.');
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching post preview:', error);
                this.hasValidPreview = false;
                this.currentPostAuthorDid = null;
                this.currentSubjectUri = null;
                this.currentRecordType = null;
                this.currentPostCid = null;
                confirmBtn.disabled = true;
            }
        }, delay);
    }

    parseSupportedUrl(url) {
        const directAt = this.atUriToParsed(url);
        if (directAt) {
            return directAt;
        }

        const bsky = this.bskyUrlToAtUri(url);
        if (bsky) {
            const atUri = typeof bsky === 'string'
                ? bsky
                : `at://${bsky.handle}/app.bsky.feed.post/${bsky.postId}`;
            return { type: 'bsky', atUri, parsed: bsky };
        }

        const branchline = this.branchlineUrlToAtUri(url);
        if (branchline) {
            return { type: 'branchline', atUri: branchline };
        }

        return null;
    }

    atUriToParsed(uri) {
        if (typeof uri !== 'string' || !uri.startsWith('at://')) {
            return null;
        }
        const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)/);
        if (!match) return null;
        const collection = match[2];
        if (collection === 'app.bsky.feed.post') {
            return { type: 'bsky', atUri: uri, parsed: uri };
        }
        if (collection === 'ink.branchline.bud') {
            return { type: 'branchline', atUri: uri };
        }
        if (collection === 'site.standard.document') {
            return { type: 'standard', atUri: uri };
        }
        return null;
    }

    branchlineUrlToAtUri(url) {
        try {
            // https://branchline.ink/bud/did:plc:xxx/rkey
            const match = url.match(/branchline\.ink\/bud\/([^\/]+)\/([^\/\?#]+)/i);
            if (!match) return null;
            const did = decodeURIComponent(match[1]);
            const rkey = decodeURIComponent(match[2]);
            if (!did.startsWith('did:')) return null;
            return `at://${did}/ink.branchline.bud/${rkey}`;
        } catch (error) {
            console.error('Error parsing branchline URL:', error);
            return null;
        }
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
            status.textContent = 'Please enter a post URL';
            return;
        }
        
        // Disable button during submission
        btn.disabled = true;
        btn.innerHTML = '<span>Adding to canon...</span>';
        status.className = 'share-modal-status info';
        status.textContent = 'Processing your request...';
        
        try {
            // Parse the URL
            const parsed = this.parseSupportedUrl(url);
            if (!parsed) {
                throw new Error('Invalid post URL format');
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
            const atUri = this.currentSubjectUri || parsed.atUri;

            // Ensure we have the post CID (stored during preview)
            if (!this.currentPostCid) {
                throw new Error('Post CID not available. Please reload the preview.');
            }

            // Write farm.lore.content record directly to user's PDS
            const result = await window.oauthManager.createRecord('farm.lore.content', {
                subject: {
                    uri: atUri,
                    cid: this.currentPostCid,
                },
                world: this.WORLD_DOMAIN,
                createdAt: new Date().toISOString(),
            });
            
            status.className = 'share-modal-status success';
            status.textContent = '✓ Your story has been added to the canon!';
            input.value = '';
            document.getElementById('postPreview').classList.remove('active');

            // Notify lore.farm to index the record immediately
            try {
                await fetch(`${this.LORE_FARM_API}/api/notify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uri: result.uri }),
                });
            } catch (e) {
                console.warn('Notify hint failed (record will sync via Jetstream):', e);
            }

            // Trigger success event
            window.dispatchEvent(new CustomEvent('sharelore:success', { detail: result }));
            
            // Close after delay
            setTimeout(() => {
                this.close();
            }, 2000);
            
        } catch (error) {
            console.error('Error creating lore record:', error);
            status.className = 'share-modal-status error';
            status.textContent = error.message || 'Failed to submit lore. Please try again.';
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
