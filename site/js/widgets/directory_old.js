/**
 * Directory Widget
 * Navigation directory for guiding users to different parts of the site
 */

class Directory {
    constructor() {
        console.log('✅ [directory.js] Directory widget initialized');
        this.loadStyles();
    }

    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/directory.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/directory.css';
            document.head.appendChild(link);
            console.log('✅ [directory.js] Styles loaded');
        }
    }

    /**
     * Show the directory
     * @param {Object} options - Configuration options
     * @param {Function} options.onSelect - Callback when user selects a destination (receives URL)
     * @param {Function} options.onClose - Callback when user closes without selecting
     */
    show(options = {}) {
        const { onSelect = null, onClose = null } = options;
        
        console.log('📂 [directory.js] Showing directory');
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'directory-overlay';
        
        // Create directory box
        const box = document.createElement('div');
        box.className = 'directory-box';
        
        box.innerHTML = `
            <div class="directory-header">
                <div class="directory-header-content">
                    <div class="directory-title">Reverie House</div>
                    <div class="directory-subtitle">Choose your path through the mindscape</div>
                </div>
                <button class="directory-close" aria-label="Close">&times;</button>
            </div>
            <div class="directory-content">
                <div class="directory-cards-grid">
                    <!-- Speak Your Name - Entry Quest -->
                    <div class="tcg-card tcg-card-legendary" data-destination="https://bsky.app/profile/did:plc:yauphjufk7phkwurn266ybx2/post/3lljjzcydwc25" data-newtab="true">
                        <div class="tcg-card-banner">ENTRY QUEST</div>
                        <div class="tcg-card-art">
                            <img src="/souvenirs/dream/phanera.png" alt="Dream Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Speak Your Name</div>
                            <div class="tcg-card-type">Bluesky Reply Quest</div>
                            <div class="tcg-card-desc">Reply to the Keeper's post on Bluesky to receive your first souvenir and enter the mindscape as a Dreamer.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">🎁 Dream Souvenir</span>
                        </div>
                    </div>

                    <!-- Explore Spectrum - Visualization -->
                    <div class="tcg-card tcg-card-rare" data-destination="spectrum.html">
                        <div class="tcg-card-banner">EXPLORE</div>
                        <div class="tcg-card-art">
                            <img src="/souvenirs/bell/phanera.png" alt="Bell Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Navigate the Spectrum</div>
                            <div class="tcg-card-type">3D Personality Map</div>
                            <div class="tcg-card-desc">See all Dreamers positioned in 6-dimensional space. Explore octants, find your place in the living mindscape.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">� Live Visualization</span>
                        </div>
                    </div>

                    <!-- Share Canon - Story Creation -->
                    <div class="tcg-card tcg-card-rare" data-destination="story.html">
                        <div class="tcg-card-banner">CREATE</div>
                        <div class="tcg-card-art">
                            <img src="/souvenirs/invite/phanera.png" alt="Invite Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Share Your Story</div>
                            <div class="tcg-card-type">Canon Contribution</div>
                            <div class="tcg-card-desc">Post your adventures, dreams, and journals on Bluesky. Tag #ReverieHouseLore to add to the shared canon.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">📜 Canon Entry</span>
                        </div>
                    </div>

                    <!-- Collect Souvenirs - Achievement System -->
                    <div class="tcg-card tcg-card-uncommon" data-destination="souvenirs.html">
                        <div class="tcg-card-banner">COLLECT</div>
                        <div class="tcg-card-art">
                            <img src="/souvenirs/residence/phanera.png" alt="Residence Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Gather Souvenirs</div>
                            <div class="tcg-card-type">Achievement Gallery</div>
                            <div class="tcg-card-desc">Discover phanera collectibles through quests and milestones. Each souvenir marks your journey through Reverie House.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">🎨 4 Collections</span>
                        </div>
                    </div>

                    <!-- Meet Dreamers - Community -->
                    <div class="tcg-card tcg-card-uncommon" data-destination="dreamer.html">
                        <div class="tcg-card-banner">DISCOVER</div>
                        <div class="tcg-card-art">
                            <img src="/souvenirs/dream/strange/phanera.png" alt="Strange Dream">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Meet Dreamers</div>
                            <div class="tcg-card-type">Community Profiles</div>
                            <div class="tcg-card-desc">Browse all players, view their octant positions, souvenir collections, and contributions to the shared canon.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">👥 Active Players</span>
                        </div>
                    </div>

                    <!-- Read Lore - Background -->
                    <div class="tcg-card tcg-card-common" data-destination="library.html">
                        <div class="tcg-card-banner">LEARN</div>
                        <div class="tcg-card-art">
                            <img src="/souvenirs/bell/phanera.png" alt="Bell Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Read the Novels</div>
                            <div class="tcg-card-type">Background Lore</div>
                            <div class="tcg-card-desc">Dive into Seeker's Reverie and Prince's Reverie—the foundational stories that shaped the mindscape you now explore.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">📚 2 Novels</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // Fade in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
        
        // Handle card selection
        const cardButtons = box.querySelectorAll('.tcg-card');
        cardButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const destination = btn.getAttribute('data-destination');
                const isNewTab = btn.getAttribute('data-newtab') === 'true';
                console.log('📂 [directory.js] Selected:', destination, isNewTab ? '(new tab)' : '');
                
                // Close overlay
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                
                // Handle external links in new tab
                if (isNewTab) {
                    window.open(destination, '_blank', 'noopener,noreferrer');
                } else if (onSelect) {
                    onSelect(destination);
                } else {
                    window.location.href = destination;
                }
            });
            
            // Add hover effect
            btn.addEventListener('mouseenter', () => {
                btn.classList.add('hover');
            });
        });
        
        // Handle close button
        const closeBtn = box.querySelector('.directory-close');
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            if (onClose) {
                onClose();
            }
        });
        
        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeBtn.click();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeBtn.click();
            }
        });
    }
}

// Auto-instantiate
if (typeof window !== 'undefined') {
    window.Directory = Directory;
    console.log('✅ [directory.js] Directory class registered on window');
}
