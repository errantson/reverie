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
                <img src="/assets/logo.png" alt="Reverie House" class="directory-logo">
                <button class="directory-close" aria-label="Close">&times;</button>
            </div>
            <div class="directory-content">
                <div class="directory-cards-grid">
                    <!-- 1. Speak Your Name -->
                    <div class="tcg-card tcg-card-legendary" data-destination="https://bsky.app/profile/reverie.house/post/3lljjzcydwc25" data-newtab="true">
                        <div class="tcg-card-banner">SPEAK YOUR NAME</div>
                        <div class="tcg-card-art">
                            <img src="/assets/guide/01.png" alt="Dream Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Introduce Yourself</div>
                            <div class="tcg-card-type">FIRST STEPS</div>
                            <div class="tcg-card-desc">Speak your name and become known. This is the first choice on your path as a dreamweaver.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">🗣 Reveal Yourself</span>
                        </div>
                    </div>

                    <!-- 2. Join An Adventure -->
                    <div class="tcg-card tcg-card-origin" data-destination="https://bsky.app/profile/reverie.house/post/3lvu664ajls2r" data-newtab="true">
                        <div class="tcg-card-banner">JOIN AN ADVENTURE</div>
                        <div class="tcg-card-art">
                            <img src="/assets/guide/02.png" alt="Bell Souvenir">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Find Your Origins</div>
                            <div class="tcg-card-type">Spectrum of Dreams</div>
                            <div class="tcg-card-desc">Forces like oblivion and entropy sculpt our feelings and drive our motion through our wild mindscape. Discover the depth of our reverie spectrum and learn how to navigate the axes of dreaming.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">🌟 Personal Coordinates</span>
                        </div>
                    </div>

                    <!-- 3. Solve The Mystery -->
                    <div class="tcg-card tcg-card-work" data-destination="https://bsky.app/profile/reverie.house/post/3m4ytsatbzs2h" data-newtab="true">
                        <div class="tcg-card-banner">SOLVE THE MYSTERY</div>
                        <div class="tcg-card-art">
                            <img src="/assets/guide/03.png" alt="Residence">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Uncover Strange Dreams</div>
                            <div class="tcg-card-type">Answer The Call</div>
                            <div class="tcg-card-desc">Peculiar dreams and stranger dreamers exist in our wild mindscape, and clever dreamweavers may find more than souvenirs in their discoveries.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">🔎 Explore Our Wild Mindscape</span>
                        </div>
                    </div>

                    <!-- 4. Enjoy A Good Book -->
                    <div class="tcg-card tcg-card-common" data-destination="https://reverie.house/books" data-newtab="true">
                        <div class="tcg-card-banner">ENJOY A GOOD BOOK</div>
                        <div class="tcg-card-art">
                            <img src="/assets/guide/04.png" alt="Letter">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Read The Library</div>
                            <div class="tcg-card-type">Free To Enjoy</div>
                            <div class="tcg-card-desc">Seeker's Reverie is the first novel in the Reverie House canon and an excellent introduction to our wild mindscape. All stories are free to read in their entirety.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">📚 Free to Read <em>(all of it!)</em></span>
                        </div>
                    </div>

                    <!-- 5. Meet Fellow Dreamweavers -->
                    <div class="tcg-card tcg-card-rare" data-destination="https://reverie.house/dreamers" data-newtab="true">
                        <div class="tcg-card-banner">MEET FELLOW DREAMWEAVERS</div>
                        <div class="tcg-card-art">
                            <img src="/assets/guide/05.png" alt="Bell">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Discover Other Dreamweavers</div>
                            <div class="tcg-card-type">Your Community</div>
                            <div class="tcg-card-desc">Many other dreamweavers have already found their way to Reverie House and are beginning to tell their stories within our wild mindscape.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">🧙‍♂️ Dreamer Directory</span>
                        </div>
                    </div>

                    <!-- 6. Become Part of The Story -->
                    <div class="tcg-card tcg-card-uncommon" data-destination="https://reverie.house/story" data-newtab="true">
                        <div class="tcg-card-banner">BECOME PART OF THE STORY</div>
                        <div class="tcg-card-art">
                            <img src="/assets/guide/06.png" alt="Letter">
                        </div>
                        <div class="tcg-card-body">
                            <div class="tcg-card-title">Share Your Dreams</div>
                            <div class="tcg-card-type">Joining Shared Canon</div>
                            <div class="tcg-card-desc">Contribute your adventures and dreams in mediums you prefer, and share them to the collective lore for others to enjoy.</div>
                        </div>
                        <div class="tcg-card-footer">
                            <span class="tcg-card-reward">📜 Evolving Storyline</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // Fade in using composited animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('visible');
            });
        });
        
        // Use event delegation for better performance
        const closeOverlay = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
            if (onClose) {
                onClose();
            }
        };
        
        // Click on overlay to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
        
        box.addEventListener('click', (e) => {
            const card = e.target.closest('.tcg-card');
            
            if (card) {
                e.preventDefault();
                const destination = card.getAttribute('data-destination');
                const isNewTab = card.getAttribute('data-newtab') === 'true';
                console.log('📂 [directory.js] Selected:', destination, isNewTab ? '(new tab)' : '');
                
                // Handle external links in new tab (keep widget open)
                if (isNewTab) {
                    window.open(destination, '_blank', 'noopener,noreferrer');
                } else {
                    // Only close overlay for internal navigation
                    overlay.classList.remove('visible');
                    setTimeout(() => overlay.remove(), 300);
                    
                    if (onSelect) {
                        onSelect(destination);
                    } else {
                        window.location.href = destination;
                    }
                }
            }
        });
        
        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeOverlay();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
    }
}

// Auto-instantiate
if (typeof window !== 'undefined') {
    window.Directory = Directory;
    console.log('✅ [directory.js] Directory class registered on window');
}
