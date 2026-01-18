/**
 * Cogitarian Role Component
 * 
 * Handles the Cogitarian role:
 * - GitHub repository display
 * - Commit history
 * - Challenge system
 */

class CogitarianRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'cogitarian-content-section';
        this.repoInfo = null;
        this.commits = [];
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadRepoData = this.loadRepoData.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('cogitarian');
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
            if (event.detail.role === 'cogitarian') {
                this.show();
            } else {
                this.hide();
            }
        });
    }
    
    /**
     * Show the cogitarian content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.loadRepoData();
            this.loadActiveChallenge();
        }
    }
    
    /**
     * Hide the cogitarian content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Load GitHub repository data
     */
    async loadRepoData() {
        try {
            // Load repo info and commits in parallel
            const [repoResponse, commitsResponse] = await Promise.all([
                fetch('/api/github/repo-info'),
                fetch('/api/github/commits?limit=5')
            ]);
            
            if (repoResponse.ok) {
                const repoData = await repoResponse.json();
                this.repoInfo = repoData;
                this.renderRepoInfo();
            }
            
            if (commitsResponse.ok) {
                const commitsData = await commitsResponse.json();
                this.commits = commitsData.commits || [];
                this.renderCommits();
            }
        } catch (error) {
            console.error('Failed to load repo data:', error);
        }
    }
    
    /**
     * Render repository info
     */
    renderRepoInfo() {
        const container = document.getElementById('repo-info');
        if (!container || !this.repoInfo) return;
        
        const languages = Object.keys(this.repoInfo.languages || {}).join(', ') || 'N/A';
        const updatedAt = this.repoInfo.updated_at ? new Date(this.repoInfo.updated_at).toLocaleDateString() : 'N/A';
        const watchers = this.repoInfo.watchers_count || 0;
        const size = this.repoInfo.size ? `${(this.repoInfo.size / 1024).toFixed(1)} MB` : 'N/A';
        
        container.innerHTML = `
            <div class="repo-info-item">
                <span class="repo-info-label">Languages:</span>
                <span class="repo-info-value">${languages}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">Updated:</span>
                <span class="repo-info-value">${updatedAt}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">Watchers:</span>
                <span class="repo-info-value">${watchers}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">File Size:</span>
                <span class="repo-info-value">${size}</span>
            </div>
        `;
    }
    
    /**
     * Render commit history
     */
    renderCommits() {
        const container = document.getElementById('repo-data-content');
        if (!container) return;
        
        if (this.commits.length === 0) {
            container.innerHTML = '<div class="commits-section"><p style="color: #888;">No commits found</p></div>';
            return;
        }
        
        const commitsHtml = this.commits.map((commit, index) => {
            const message = commit.commit?.message?.split('\n')[0] || 'No message';
            const author = commit.commit?.author?.name || 'Unknown';
            const date = commit.commit?.author?.date ? 
                new Date(commit.commit.author.date).toLocaleDateString() : '';
            
            return `
                <div class="commit-row ${index % 2 === 0 ? 'even' : 'odd'}">
                    <span class="commit-message">${message}</span>
                    <span class="commit-meta">${author} • ${date}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="commits-section">
                ${commitsHtml}
            </div>
            <div class="contributors-section">
                <div class="contributors-label">Contributors</div>
                <div class="contributors-list" id="contributors-list">Loading...</div>
            </div>
        `;
        
        // Load contributors separately
        this.loadContributors();
    }
    
    /**
     * Load repository contributors
     */
    async loadContributors() {
        try {
            const response = await fetch('/api/github/contributors?limit=5');
            if (response.ok) {
                const data = await response.json();
                const contributorsEl = document.getElementById('contributors-list');
                if (contributorsEl && data.contributors) {
                    const html = data.contributors.map(c => 
                        `<a href="${c.html_url}" target="_blank" class="contributor-avatar-link">
                            <img src="${c.avatar_url}" alt="${c.login}" title="${c.login}" class="contributor-avatar">
                        </a>`
                    ).join('');
                    contributorsEl.innerHTML = html || 'None';
                }
            }
        } catch (error) {
            console.error('Failed to load contributors:', error);
        }
    }
    
    /**
     * Load active challenge if any
     */
    async loadActiveChallenge() {
        const banner = document.getElementById('active-challenge-banner');
        if (!banner) return;
        
        try {
            const response = await fetch('/api/cogitarian/active-challenge');
            if (response.ok) {
                const data = await response.json();
                if (data.active && data.challenge) {
                    this.renderChallengeBanner(data.challenge);
                    banner.style.display = 'block';
                } else {
                    banner.style.display = 'none';
                }
            } else {
                banner.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load active challenge:', error);
            banner.style.display = 'none';
        }
    }
    
    /**
     * Render challenge banner
     */
    async renderChallengeBanner(challenge) {
        // Update challenger info
        const challengerInfo = await window.workCore?.fetchDreamerInfo(challenge.challenger_did);
        const challengedInfo = await window.workCore?.fetchDreamerInfo(challenge.challenged_did);
        
        const challengerAvatar = document.getElementById('challenger-avatar');
        const challengerName = document.getElementById('challenger-name');
        const challengedAvatar = document.getElementById('challenged-avatar');
        const challengedName = document.getElementById('challenged-name');
        
        if (challengerAvatar && challengerInfo) {
            challengerAvatar.src = challengerInfo.avatar || '/assets/default-avatar.png';
        }
        if (challengerName && challengerInfo) {
            challengerName.textContent = challengerInfo.display_name || challengerInfo.handle || 'Challenger';
        }
        if (challengedAvatar && challengedInfo) {
            challengedAvatar.src = challengedInfo.avatar || '/assets/default-avatar.png';
        }
        if (challengedName && challengedInfo) {
            challengedName.textContent = challengedInfo.display_name || challengedInfo.handle || 'Cogitarian';
        }
        
        // Update days counter
        const daysEl = document.getElementById('challenge-banner-days');
        if (daysEl && challenge.created_at) {
            const days = Math.floor((Date.now() - new Date(challenge.created_at)) / (1000 * 60 * 60 * 24));
            daysEl.textContent = `Day ${days + 1}`;
        }
        
        // Update favor indicator
        const favorWho = document.getElementById('favor-who');
        if (favorWho) {
            favorWho.textContent = challenge.favor === 'challenger' ? 'Challenger' : 'Cogitarian';
        }
        
        // Update view link
        const viewLink = document.getElementById('challenge-view-link');
        if (viewLink && challenge.id) {
            viewLink.href = `/cogitarian/challenge/${challenge.id}`;
        }
    }
    
    /**
     * Open cogitarian challenge modal
     */
    async openChallenge(cogitarianDid, cogitarianHandle) {
        // Check if logged in
        if (!window.workCore?.getSession()) {
            if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        // Dispatch event to show challenge modal
        window.dispatchEvent(new CustomEvent('cogitarian:show-challenge', {
            detail: { cogitarianDid, cogitarianHandle }
        }));
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CogitarianRole;
}

// Make available globally
window.CogitarianRole = CogitarianRole;

// Global function for challenge button
window.openCogitarianChallenge = function(did, handle) {
    if (window.cogitarianRole) {
        window.cogitarianRole.openChallenge(did, handle);
    }
};
