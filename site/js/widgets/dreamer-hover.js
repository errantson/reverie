/**
 * Dreamer Hover Card Widget
 * 
 * Shows a hover card with dreamer information when hovering over dreamer links.
 * Requires the dreamer to have a data-dreamer-did attribute.
 * 
 * Usage:
 * 1. Include this script in your page
 * 2. Include the CSS: /css/widgets/dreamer-hover.css
 * 3. Create links with class="dreamer-link" and data-dreamer-did="did:..."
 * 4. Initialize: const hoverWidget = new DreamerHoverWidget(dreamersArray);
 * 
 * The widget will automatically attach to all .dreamer-link elements via event delegation.
 */

class DreamerHoverWidget {
    constructor(dreamersData = []) {
        this.dreamers = dreamersData;
        this.hoverCard = null;
        this.hoverTimeout = null;
        this.currentHoverDid = null;
        this.isInitialized = false;
        
            }
    
    /**
     * Update the dreamers data
     */
    setDreamers(dreamersData) {
        this.dreamers = dreamersData;
            }
    
    /**
     * Initialize event listeners
     * Should be called after DOM is ready
     */
    init() {
        if (this.isInitialized) {
            console.warn('[DreamerHoverWidget] Already initialized');
            return;
        }
        
        // Set up event delegation for dreamer links
        document.addEventListener('mouseover', (e) => {
            const link = e.target.closest('.dreamer-link');
            if (link && link.dataset.dreamerDid) {
                this.show(link, link.dataset.dreamerDid);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const link = e.target.closest('.dreamer-link');
            if (link) {
                this.hide();
            }
        });
        
        this.isInitialized = true;
            }
    
    /**
     * Create the hover card element if it doesn't exist
     */
    createCard() {
        if (!this.hoverCard) {
            this.hoverCard = document.createElement('div');
            this.hoverCard.className = 'dreamer-hover-card';
            document.body.appendChild(this.hoverCard);
        }
        return this.hoverCard;
    }
    
    /**
     * Show the hover card for a specific dreamer
     */
    show(linkElement, did) {
        // Clear any pending hover
        clearTimeout(this.hoverTimeout);
        
        // Delay showing to avoid flashing on quick mouse-through
        this.hoverTimeout = setTimeout(async () => {
            const dreamer = this.dreamers.find(d => d.did === decodeURIComponent(did));
            if (!dreamer) {
                console.warn('[DreamerHoverWidget] Dreamer not found:', did);
                return;
            }

            const card = this.createCard();
            this.currentHoverDid = did;

            // Build hover card content
            const avatar = dreamer.avatar || '/assets/icon_face.png';
            const name = dreamer.name || dreamer.display_name || dreamer.handle;
            const handle = dreamer.handle;
            const description = dreamer.description || 'Little is said. Less is known.';
            
            // Get arrival date
            const arrivalDate = dreamer.arrival ? new Date(dreamer.arrival * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'Unknown';

            // Build souvenirs HTML
            let souvenirsHTML = '';
            if (dreamer.souvenirs && Object.keys(dreamer.souvenirs).length > 0) {
                try {
                    const response = await fetch('/api/souvenirs');
                    const rawSouvenirs = await response.json();
                    const userFormKeys = Object.keys(dreamer.souvenirs);
                    const souvenirIcons = [];
                    
                    userFormKeys.forEach(formKey => {
                        // rawSouvenirs is keyed by souvenir key, each entry has a 'key' field
                        // that matches the souvenir_key from dreamer_souvenirs
                        for (const [souvenirKey, souvenirData] of Object.entries(rawSouvenirs)) {
                            if (souvenirData.key === formKey) {
                                souvenirIcons.push({
                                    icon: souvenirData.icon,
                                    name: souvenirData.name,
                                    key: formKey
                                });
                                break;
                            }
                        }
                    });
                    
                    
                    if (souvenirIcons.length > 0) {
                        souvenirsHTML = '<div class="dreamer-hover-souvenirs">';
                        souvenirIcons.forEach(s => {
                            souvenirsHTML += `<img src="${s.icon}" alt="${s.name}" title="${s.name}" class="dreamer-hover-souvenir-icon">`;
                        });
                        souvenirsHTML += '</div>';
                    }
                } catch (err) {
                    console.error('[DreamerHoverWidget] Error loading souvenirs:', err);
                }
            }

            card.innerHTML = `
                <div class="dreamer-hover-header">
                    <img src="${avatar}" alt="${name}" class="dreamer-hover-avatar" onerror="this.src='/assets/icon_face.png'">
                    <div class="dreamer-hover-info">
                        <div class="dreamer-hover-name">${name}</div>
                        <div class="dreamer-hover-handle">@${handle}</div>
                    </div>
                </div>
                ${description ? `<div class="dreamer-hover-description">${description}</div>` : ''}
                <div class="dreamer-hover-stats">
                    <div class="dreamer-hover-stat">
                        <div class="dreamer-hover-stat-value">${arrivalDate}</div>
                        <div class="dreamer-hover-stat-label">Arrived</div>
                    </div>
                    ${souvenirsHTML}
                </div>
            `;

            // Position the card near the link
            this.positionCard(card, linkElement);
            card.classList.add('visible');
        }, 300); // 300ms delay before showing
    }
    
    /**
     * Position the card relative to the trigger element
     */
    positionCard(card, linkElement) {
        const rect = linkElement.getBoundingClientRect();
        const cardWidth = 320;
        const cardHeight = card.offsetHeight || 200;
        
        // Try to position below and to the right of the link
        let left = rect.left;
        let top = rect.bottom + 8;

        // Adjust if it would go off-screen
        if (left + cardWidth > window.innerWidth - 20) {
            left = window.innerWidth - cardWidth - 20;
        }
        if (left < 20) {
            left = 20;
        }
        if (top + cardHeight > window.innerHeight - 20) {
            // Position above instead
            top = rect.top - cardHeight - 8;
        }
        if (top < 20) {
            top = 20;
        }

        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
    }
    
    /**
     * Hide the hover card
     */
    hide() {
        clearTimeout(this.hoverTimeout);
        if (this.hoverCard) {
            this.hoverCard.classList.remove('visible');
            this.currentHoverDid = null;
        }
    }
    
    /**
     * Destroy the widget and clean up
     */
    destroy() {
        this.hide();
        if (this.hoverCard) {
            this.hoverCard.remove();
            this.hoverCard = null;
        }
        this.isInitialized = false;
            }
}

// Export to window for global access
if (typeof window !== 'undefined') {
    window.DreamerHoverWidget = DreamerHoverWidget;
}

// Also support module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DreamerHoverWidget;
}

