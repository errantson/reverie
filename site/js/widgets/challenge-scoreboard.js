/**
 * Challenge Scoreboard Widget
 * 
 * Displays the current challenge status in the header when a Cogitarian
 * challenge is active. Shows the two parties, who has favor, and time remaining.
 */

class ChallengeScoreboard {
    constructor() {
        this.challenge = null;
        this.updateInterval = null;
        this.container = null;
    }
    
    /**
     * Initialize the scoreboard - check for active challenge and render if found
     */
    async init() {
        await this.loadChallenge();
        
        if (this.challenge && this.challenge.status === 'active') {
            this.render();
            this.startUpdates();
        }
    }
    
    /**
     * Load active challenge data from API
     */
    async loadChallenge() {
        try {
            const resp = await fetch('/api/cogitarian/challenge/active');
            if (resp.ok) {
                const data = await resp.json();
                if (data.challenge) {
                    this.challenge = data.challenge;
                }
            }
        } catch (error) {
            console.warn('Scoreboard: Could not load challenge data:', error);
        }
    }
    
    /**
     * Calculate days remaining in challenge
     */
    getDaysRemaining() {
        if (!this.challenge || !this.challenge.expires_at) return 0;
        const now = new Date();
        const expires = new Date(this.challenge.expires_at);
        return Math.max(0, Math.ceil((expires - now) / (1000 * 60 * 60 * 24)));
    }
    
    /**
     * Get short display name (first name or handle truncated)
     */
    getShortName(name, handle) {
        if (name) {
            const firstName = name.split(' ')[0];
            return firstName.length > 10 ? firstName.substring(0, 8) + '…' : firstName;
        }
        if (handle) {
            return handle.length > 10 ? handle.substring(0, 8) + '…' : handle;
        }
        return '???';
    }
    
    /**
     * Render the scoreboard into the header
     */
    render() {
        if (!this.challenge) return;
        
        // Find the header center group to insert after
        const headerCenter = document.querySelector('.header-center-group');
        const betaNotice = document.querySelector('.beta-notice');
        
        if (!headerCenter && !betaNotice) {
            console.warn('Scoreboard: Could not find insertion point');
            return;
        }
        
        // Create container if it doesn't exist
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'challenge-scoreboard';
            this.container.id = 'challenge-scoreboard';
            
            // Insert after beta notice or header center
            const insertPoint = betaNotice || headerCenter;
            if (insertPoint && insertPoint.parentNode) {
                insertPoint.parentNode.insertBefore(this.container, insertPoint.nextSibling);
            }
        }
        
        const c = this.challenge;
        const daysLeft = this.getDaysRemaining();
        const isFavoringChallenger = c.favor === 'challenger';
        
        // Inline styles to avoid external CSS dependency
        this.container.innerHTML = `
            <style>
                .challenge-scoreboard {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.6rem;
                    background: linear-gradient(135deg, rgba(210, 95, 50, 0.1), rgba(210, 95, 50, 0.05));
                    border: 1px solid rgba(210, 95, 50, 0.3);
                    border-radius: 4px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin: 0 0.5rem;
                }
                
                .challenge-scoreboard:hover {
                    background: linear-gradient(135deg, rgba(210, 95, 50, 0.2), rgba(210, 95, 50, 0.1));
                    border-color: rgba(210, 95, 50, 0.5);
                }
                
                .scoreboard-party {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }
                
                .scoreboard-avatar {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid transparent;
                    object-fit: cover;
                }
                
                .scoreboard-avatar.favored {
                    border-color: #059669;
                    box-shadow: 0 0 4px rgba(5, 150, 105, 0.5);
                }
                
                .scoreboard-name {
                    font-weight: 500;
                    color: #374151;
                    max-width: 60px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .scoreboard-name.favored {
                    color: #059669;
                    font-weight: 600;
                }
                
                .scoreboard-vs {
                    font-weight: 700;
                    color: var(--role-cogitarian, #d25f32);
                    font-size: 0.65rem;
                }
                
                .scoreboard-days {
                    background: var(--role-cogitarian, #d25f32);
                    color: white;
                    padding: 0.15rem 0.4rem;
                    font-weight: 700;
                    font-size: 0.65rem;
                    margin-left: 0.3rem;
                }
                
                .scoreboard-icon {
                    font-size: 0.9rem;
                }
                
                /* Mobile: Hide names, show just avatars */
                @media (max-width: 768px) {
                    .challenge-scoreboard {
                        gap: 0.3rem;
                        padding: 0.2rem 0.4rem;
                    }
                    
                    .scoreboard-name {
                        display: none;
                    }
                    
                    .scoreboard-days {
                        font-size: 0.6rem;
                        padding: 0.1rem 0.3rem;
                    }
                }
                
                /* Tablet: Truncate more aggressively */
                @media (max-width: 1024px) and (min-width: 769px) {
                    .scoreboard-name {
                        max-width: 50px;
                    }
                }
            </style>
            
            <span class="scoreboard-icon">⚔️</span>
            
            <div class="scoreboard-party challenger">
                <img src="${c.challenger_avatar || '/assets/default-avatar.png'}" 
                     alt="${c.challenger_handle}" 
                     class="scoreboard-avatar ${isFavoringChallenger ? 'favored' : ''}"
                     title="${c.challenger_name || c.challenger_handle}">
                <span class="scoreboard-name ${isFavoringChallenger ? 'favored' : ''}"
                      title="${c.challenger_name || c.challenger_handle}">
                    ${this.getShortName(c.challenger_name, c.challenger_handle)}
                </span>
            </div>
            
            <span class="scoreboard-vs">vs</span>
            
            <div class="scoreboard-party cogitarian">
                <img src="${c.cogitarian_avatar || '/assets/default-avatar.png'}" 
                     alt="${c.cogitarian_handle}" 
                     class="scoreboard-avatar ${!isFavoringChallenger ? 'favored' : ''}"
                     title="${c.cogitarian_name || c.cogitarian_handle} (${c.current_rank})">
                <span class="scoreboard-name ${!isFavoringChallenger ? 'favored' : ''}"
                      title="${c.cogitarian_name || c.cogitarian_handle}">
                    ${this.getShortName(c.cogitarian_name, c.cogitarian_handle)}
                </span>
            </div>
            
            <span class="scoreboard-days" title="Days remaining">${daysLeft}d</span>
        `;
        
        // Click to go to challenge details
        this.container.addEventListener('click', () => {
            window.location.href = '/work#challenge';
        });
    }
    
    /**
     * Start periodic updates for countdown
     */
    startUpdates() {
        // Update every hour
        this.updateInterval = setInterval(() => {
            this.render();
        }, 3600000);
    }
    
    /**
     * Stop updates and remove scoreboard
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }
    
    /**
     * Force refresh challenge data and re-render
     */
    async refresh() {
        await this.loadChallenge();
        
        if (this.challenge && this.challenge.status === 'active') {
            this.render();
        } else {
            this.destroy();
        }
    }
}

// Initialize scoreboard after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Slight delay to let header render first
    setTimeout(() => {
        window.challengeScoreboard = new ChallengeScoreboard();
        window.challengeScoreboard.init();
    }, 500);
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChallengeScoreboard;
}
