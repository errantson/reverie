/**
 * Standardized Bubble System
 * 
 * Provides consistent bubble styling and creation across the site.
 * Used by work.html celebrations, souvenirs.html icon clicks, and homepage bubbles.
 */

class BubbleFactory {
    /**
     * Create a standardized bubble element with souvenir icon
     * @param {string} iconUrl - URL to the souvenir icon image
     * @param {number} size - Size of the bubble in pixels (default: random 50-80)
     * @param {object} options - Optional configuration
     * @returns {HTMLElement} The bubble element
     */
    static createBubble(iconUrl, size = null, options = {}) {
        const {
            clickable = false,
            onClick = null,
            souvenirKey = null,
            souvenirName = 'Unknown'
        } = options;

        // Vary bubble sizes for natural look (50-80px by default)
        if (!size) {
            size = 50 + Math.random() * 30;
        }

        const bubble = document.createElement('div');
        bubble.className = 'standard-bubble';
        
        bubble.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(200,220,255,0.4));
            border: 2px solid rgba(255,255,255,0.5);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15), 
                        inset -3px -3px 15px rgba(0,0,0,0.08),
                        inset 3px 3px 12px rgba(255,255,255,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: ${clickable ? 'auto' : 'none'};
            cursor: ${clickable ? 'pointer' : 'default'};
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        `;

        // Store souvenir data
        if (souvenirKey) {
            bubble.dataset.souvenirKey = souvenirKey;
            bubble.dataset.souvenirName = souvenirName;
        }

        // Add icon inside bubble - 80% of bubble size
        const icon = document.createElement('img');
        icon.src = iconUrl;
        icon.alt = souvenirName;
        icon.style.cssText = `
            width: ${size * 0.80}px;
            height: ${size * 0.80}px;
            opacity: 0.85;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
            pointer-events: none;
        `;

        bubble.appendChild(icon);

        // Add click handler if provided
        if (clickable && onClick) {
            bubble.addEventListener('click', onClick);
        }

        // Hover effect if clickable
        if (clickable) {
            bubble.addEventListener('mouseenter', () => {
                bubble.style.transform = 'scale(1.15)';
                bubble.style.boxShadow = '0 6px 30px rgba(0,0,0,0.25), inset -4px -4px 20px rgba(0,0,0,0.12), inset 4px 4px 18px rgba(255,255,255,0.6)';
            });
            bubble.addEventListener('mouseleave', () => {
                bubble.style.transform = 'scale(1)';
                bubble.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15), inset -3px -3px 15px rgba(0,0,0,0.08), inset 3px 3px 12px rgba(255,255,255,0.5)';
            });
        }

        return bubble;
    }

    /**
     * Load random souvenir icons from the API
     * @param {number} count - Number of random icons to get
     * @returns {Promise<Array>} Array of {icon, key, name} objects
     */
    static async getRandomSouvenirIcons(count = 20) {
        try {
            const response = await fetch('/api/souvenirs');
            const rawData = await response.json();

            // Get all souvenirs and pick random ones
            const souvenirs = Object.entries(rawData).map(([key, data]) => ({
                key: data.key,
                name: data.name,
                icon: data.icon
            }));

            // Shuffle and take count items
            const shuffled = souvenirs.sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(count, shuffled.length));
        } catch (err) {
            console.error('Error loading souvenir icons:', err);
            // Return fallback icons
            return [{
                key: 'dream',
                name: 'Dream',
                icon: '/assets/icon.png'
            }];
        }
    }
}

// Make available globally
window.BubbleFactory = BubbleFactory;
