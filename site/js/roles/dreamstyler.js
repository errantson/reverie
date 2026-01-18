/**
 * Dreamstyler Role Component
 * 
 * Handles the Dreamstyler multi-worker role:
 * - Find Dreamstylers list
 * - Entreat functionality
 * - Aesthetic adjustments (Tangled commits)
 */

class DreamstylerRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'dreamstyler-content-section';
        this.workers = [];
        this.commits = [];
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadDreamstylerList = this.loadDreamstylerList.bind(this);
        this.entreatDreamstyler = this.entreatDreamstyler.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('dreamstyler');
    }
    
    /**
     * Initialize the role
     */
    init() {
        this.setupEventListeners();
        return this;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('role:changed', (event) => {
            if (event.detail.role === 'dreamstyler') {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // Listen for activation/deactivation
        if (window.WorkEvents) {
            window.WorkEvents.on(window.WorkEvents.EVENTS.DREAMSTYLER_ACTIVATED, () => {
                this.loadDreamstylerList();
            });
            window.WorkEvents.on(window.WorkEvents.EVENTS.DREAMSTYLER_STEPPED_DOWN, () => {
                this.loadDreamstylerList();
            });
        }
    }
    
    /**
     * Show the dreamstyler content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.loadDreamstylerList();
            this.loadDreamstylerCommits();
        }
    }
    
    /**
     * Hide the dreamstyler content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Load dreamstyler list
     */
    async loadDreamstylerList() {
        const listContainer = document.getElementById('dreamstyler-list');
        if (!listContainer) return;
        
        try {
            const response = await fetch('/api/work/dreamstyler/status');
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            this.workers = data.role_info?.workers || [];
            
            if (this.workers.length === 0) {
                listContainer.innerHTML = `
                    <div class="dreamstyler-empty">
                        <div class="dreamstyler-empty-text">No Dreamstylers yet</div>
                        <p style="color: #888; font-size: 0.75rem; margin-top: 0.5rem;">Be the first to style dreams</p>
                    </div>
                `;
                return;
            }
            
            // Fetch all worker details in parallel
            const workerDetails = await Promise.all(this.workers.map(async (worker) => {
                const dreamer = await window.workCore?.fetchDreamerInfo(worker.did);
                return {
                    did: worker.did,
                    handle: dreamer?.handle || 'unknown',
                    displayName: dreamer?.display_name || dreamer?.handle || 'Unknown',
                    avatar: dreamer?.avatar || '/assets/default-avatar.png',
                    color: dreamer?.color_hex || '#9e75e5'
                };
            }));
            
            // Build the list HTML
            const listHTML = workerDetails.map(w => {
                const bgColor = w.color + '20'; // 20 is hex for ~12% opacity
                return `
                    <div class="dreamstyler-row" style="background: ${bgColor}; border-left: 3px solid ${w.color};">
                        <a href="/dreamer?did=${encodeURIComponent(w.did)}" class="dreamstyler-link dreamer-link" data-did="${w.did}">
                            <img src="${w.avatar}" alt="${w.handle}" class="dreamstyler-avatar" style="border-color: ${w.color};">
                            <span class="dreamstyler-name" style="color: ${w.color};">${w.displayName}</span>
                        </a>
                        <button class="dreamstyler-entreat-btn" style="background: ${w.color}; border-color: ${w.color};" onclick="window.dreamstylerRole?.entreatDreamstyler('${w.handle}')">ENTREAT</button>
                    </div>
                `;
            }).join('');
            
            listContainer.innerHTML = listHTML;
            
            // Initialize dreamer hover
            setTimeout(() => {
                if (window.DreamerHover) window.DreamerHover.init();
            }, 100);
            
        } catch (error) {
            console.error('Failed to load dreamstyler list:', error);
            listContainer.innerHTML = '<div class="dreamstyler-empty">Error loading dreamstylers</div>';
        }
    }
    
    /**
     * Load dreamstyler commits from Tangled
     */
    async loadDreamstylerCommits() {
        const container = document.getElementById('dreamstyler-commits-list');
        if (!container) return;
        
        try {
            const response = await fetch('/api/tangled/commits?tag=dreamstyler&limit=5');
            if (response.ok) {
                const data = await response.json();
                this.commits = data.commits || [];
                this.renderCommits();
            }
        } catch (error) {
            console.error('Failed to load dreamstyler commits:', error);
        }
    }
    
    /**
     * Render commits
     */
    renderCommits() {
        const container = document.getElementById('dreamstyler-commits-list');
        if (!container) return;
        
        if (this.commits.length === 0) {
            // Show empty placeholder rows
            container.innerHTML = `
                <div class="commit-row empty-row even"></div>
                <div class="commit-row empty-row odd"></div>
                <div class="commit-row empty-row even"></div>
                <div class="commit-row empty-row odd"></div>
                <div class="commit-row empty-row even"></div>
            `;
            return;
        }
        
        const html = this.commits.map((commit, index) => {
            const message = commit.message?.split('\n')[0] || 'No message';
            const author = commit.author || 'Unknown';
            const date = commit.date ? new Date(commit.date).toLocaleDateString() : '';
            
            return `
                <div class="commit-row ${index % 2 === 0 ? 'even' : 'odd'}">
                    <span class="commit-message">${message}</span>
                    <span class="commit-meta">${author} • ${date}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Check if user can entreat (must be dreamweaver)
     */
    async canUserEntreat() {
        const session = window.workCore?.getSession();
        if (!session) return { allowed: false, reason: 'login' };
        
        const handle = session.profile?.handle || session.handle || '';
        const userDid = session.sub || session.did;
        
        // Check handle first (fast path)
        let isDreamweaver = handle.endsWith('.reverie.house');
        
        // If not a .reverie.house handle, check PDS
        if (!isDreamweaver && userDid) {
            try {
                const didResponse = await fetch(`https://plc.directory/${userDid}`);
                if (didResponse.ok) {
                    const didDoc = await didResponse.json();
                    const pdsService = didDoc.service?.find(s => s.id === '#atproto_pds');
                    if (pdsService?.serviceEndpoint) {
                        isDreamweaver = pdsService.serviceEndpoint.includes('reverie.house');
                    }
                }
            } catch (e) {
                console.warn('Failed to resolve PDS for dreamweaver check:', e);
            }
        }
        
        if (!isDreamweaver) {
            return { allowed: false, reason: 'not_dreamweaver', handle };
        }
        
        return { allowed: true };
    }
    
    /**
     * Resolve handle to DID
     */
    async resolveDreamstylerDid(handle) {
        try {
            // First try via our API (faster, cached)
            const response = await fetch(`/api/resolve-handle/${encodeURIComponent(handle)}`);
            if (response.ok) {
                const data = await response.json();
                return data.did;
            }
            // Fallback to public API
            const publicResponse = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
            if (publicResponse.ok) {
                const data = await publicResponse.json();
                return data.did;
            }
        } catch (e) {
            console.warn('Failed to resolve handle:', e);
        }
        return null;
    }
    
    /**
     * Entreat a dreamstyler
     */
    async entreatDreamstyler(handle) {
        const entreatStatus = await this.canUserEntreat();
        
        if (!entreatStatus.allowed) {
            switch (entreatStatus.reason) {
                case 'login':
                    if (window.loginWidget?.showLoginPopup) {
                        window.loginWidget.showLoginPopup();
                    }
                    return;
                case 'not_dreamweaver':
                    if (window.changeHandleWidget) {
                        window.changeHandleWidget.show({
                            reason: 'entreat_dreamstyler',
                            dreamstylerHandle: handle,
                            roleColor: 'var(--role-dreamstyler)',
                            roleColorLight: 'var(--role-dreamstyler-light)',
                            roleClass: 'dreamstyler',
                            onSuccess: () => this.entreatDreamstyler(handle)
                        });
                    } else {
                        window.workCore?.showCelebration('Entreating dreamstylers is only available to dreamweavers.', 'error');
                    }
                    return;
            }
            return;
        }
        
        // Show the entreat form popup
        this.showEntreatPopup(handle);
    }
    
    /**
     * Show entreat popup
     */
    async showEntreatPopup(dreamstylerHandle) {
        // Remove existing popup if any
        const existingPopup = document.querySelector('.entreat-popup-overlay');
        if (existingPopup) existingPopup.remove();
        
        // Fetch dreamstyler's color
        let dreamstylerColor = '#9e75e5';
        try {
            const dreamstylerDid = await this.resolveDreamstylerDid(dreamstylerHandle);
            if (dreamstylerDid) {
                const dreamer = await window.workCore?.fetchDreamerInfo(dreamstylerDid);
                if (dreamer) {
                    dreamstylerColor = dreamer.color_hex || '#9e75e5';
                }
            }
        } catch (e) {
            console.warn('Could not fetch dreamstyler color:', e);
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'entreat-popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(26, 21, 32, 0.4);
            backdrop-filter: blur(3px);
            z-index: 10003;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        const popup = document.createElement('div');
        popup.className = 'entreat-popup';
        popup.style.cssText = `
            background: rgba(255, 255, 255, 0.97);
            padding: 1.5rem 2rem 2rem;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-top: 3px solid ${dreamstylerColor};
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
            max-width: 440px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
        `;
        
        popup.innerHTML = `
            <div style="margin-bottom: 1.25rem;">
                <h2 style="color: ${dreamstylerColor}; margin: 0 0 0.25rem; font-size: 1.1rem; font-weight: 500;">Entreat ${dreamstylerHandle}</h2>
                <p style="color: rgba(26, 21, 32, 0.5); font-size: 0.8rem; margin: 0;">Your request will be made public</p>
            </div>
            
            <form id="entreat-form" style="display: flex; flex-direction: column; gap: 0.9rem;">
                <div>
                    <label style="display: block; color: rgba(26, 21, 32, 0.7); font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 500;">Domain</label>
                    <input type="text" id="entreat-domain" placeholder="domain.world" 
                        style="width: 100%; padding: 0.6rem 0.75rem; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.12); color: rgba(26, 21, 32, 0.9); font-size: 0.9rem; box-sizing: border-box;"
                        required>
                </div>
                
                <div>
                    <label style="display: block; color: rgba(26, 21, 32, 0.7); font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 500;">Tangled Repository</label>
                    <input type="text" id="entreat-repo" placeholder="https://tangled.example.com/repo"
                        style="width: 100%; padding: 0.6rem 0.75rem; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.12); color: rgba(26, 21, 32, 0.9); font-size: 0.9rem; box-sizing: border-box;"
                        required>
                </div>
                
                <div>
                    <label style="display: block; color: rgba(26, 21, 32, 0.7); font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 500;">Request</label>
                    <textarea id="entreat-request" placeholder="What does your dream need help with?"
                        maxlength="200" rows="3"
                        style="width: 100%; padding: 0.6rem 0.75rem; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.12); color: rgba(26, 21, 32, 0.9); font-size: 0.9rem; resize: vertical; font-family: inherit; box-sizing: border-box;"
                        required></textarea>
                    <div style="text-align: right; font-size: 0.7rem; color: rgba(26, 21, 32, 0.35); margin-top: 0.15rem;">
                        <span id="entreat-char-count">0</span>/200
                    </div>
                </div>
                
                <div style="background: ${dreamstylerColor}12; padding: 0.75rem 1rem; border-left: 3px solid ${dreamstylerColor}; margin-top: 0.5rem;">
                    <p style="color: rgba(26, 21, 32, 0.65); font-size: 0.75rem; margin: 0; line-height: 1.4; font-weight: 500;">
                        By sending this request, you acknowledge a debt of gratitude to the dreamstyler for any assistance provided.
                    </p>
                </div>
                
                <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
                    <button type="button" id="entreat-cancel" 
                        style="flex: 1; padding: 0.7rem; background: transparent; border: 1px solid rgba(0, 0, 0, 0.15); color: rgba(26, 21, 32, 0.6); cursor: pointer; font-size: 0.85rem;">
                        Cancel
                    </button>
                    <button type="submit" id="entreat-submit"
                        style="flex: 2; padding: 0.7rem; background: ${dreamstylerColor}; border: none; color: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
                        Entreat
                    </button>
                </div>
            </form>
        `;
        
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        
        // Character counter
        const requestField = document.getElementById('entreat-request');
        const charCount = document.getElementById('entreat-char-count');
        requestField?.addEventListener('input', () => {
            if (charCount) charCount.textContent = requestField.value.length;
        });
        
        // Close handlers
        const closePopup = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };
        
        document.getElementById('entreat-cancel')?.addEventListener('click', closePopup);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePopup();
        });
        
        // Form submission
        document.getElementById('entreat-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const domain = document.getElementById('entreat-domain')?.value?.trim();
            const repo = document.getElementById('entreat-repo')?.value?.trim();
            const request = document.getElementById('entreat-request')?.value?.trim();
            
            if (!domain || !repo || !request) {
                window.workCore?.showCelebration('Please fill in all fields.', 'error');
                return;
            }
            
            const submitBtn = document.getElementById('entreat-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
            }
            
            try {
                const dreamstylerDid = await this.resolveDreamstylerDid(dreamstylerHandle);
                if (!dreamstylerDid) {
                    throw new Error('Could not resolve dreamstyler handle');
                }
                
                const mentionText = `@${dreamstylerHandle}`;
                const postText = `${mentionText}, are you interested?\n\nDomain: ${domain}\nRepository: ${repo}\n\n${request}\n\nWe'd be indebted to your help.`;
                
                const mentionByteStart = 0;
                const mentionByteEnd = new TextEncoder().encode(mentionText).length;
                
                const record = {
                    facets: [{
                        index: {
                            byteStart: mentionByteStart,
                            byteEnd: mentionByteEnd
                        },
                        features: [{
                            $type: 'app.bsky.richtext.facet#mention',
                            did: dreamstylerDid
                        }]
                    }]
                };
                
                await window.oauthManager?.createPost(postText, record);
                
                closePopup();
                window.workCore?.showCelebration(`Request sent to @${dreamstylerHandle}`, 'success');
                
            } catch (error) {
                console.error('Entreat error:', error);
                window.workCore?.showCelebration(`Failed: ${error.message}`, 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entreat';
                }
            }
        });
        
        // Focus the first field
        document.getElementById('entreat-domain')?.focus();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DreamstylerRole;
}

// Make available globally
window.DreamstylerRole = DreamstylerRole;

// Global function for HTML onclick handlers
window.entreatDreamstyler = function(handle) {
    if (window.dreamstylerRole) {
        window.dreamstylerRole.entreatDreamstyler(handle);
    }
};
