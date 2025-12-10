/**
 * Souvenir Box Widget
 * Displays keepers, graph, and timeline in a carousel format
 */

class SouvenirBox {
    constructor() {
        this.container = null;
        this.currentViewIndex = 0;
        this.views = ['keepers', 'graph', 'timeline'];
        this.souvenir = null;
    }
    
    /**
     * Render the souvenir box
     * @param {Object} souvenir - Souvenir data with keepers array
     * @param {HTMLElement} targetElement - Element to render into
     */
    render(souvenir, targetElement) {
        this.container = targetElement;
        this.souvenir = souvenir;
        this.currentViewIndex = 0;
        
        this.container.innerHTML = `
            <div class="souvenir-box-header">
                <button class="carousel-nav prev" onclick="window.souvenirBoxInstance.prevView()">‹</button>
                <h2 class="souvenir-box-title">Keepers</h2>
                <button class="carousel-nav next" onclick="window.souvenirBoxInstance.nextView()">›</button>
            </div>
            <div class="souvenir-box-content">
                <!-- Content will be populated here -->
            </div>
        `;
        
        // Store instance globally for onclick handlers
        window.souvenirBoxInstance = this;
        
        this.updateView();
    }
    
    prevView() {
        this.currentViewIndex = (this.currentViewIndex - 1 + this.views.length) % this.views.length;
        this.updateView();
    }
    
    nextView() {
        this.currentViewIndex = (this.currentViewIndex + 1) % this.views.length;
        this.updateView();
    }
    
    updateView() {
        const viewType = this.views[this.currentViewIndex];
        const titleEl = this.container.querySelector('.souvenir-box-title');
        const contentEl = this.container.querySelector('.souvenir-box-content');
        
        switch(viewType) {
            case 'keepers':
                titleEl.textContent = 'Keepers';
                this.displayKeepers(contentEl);
                break;
            case 'graph':
                titleEl.textContent = 'Graph';
                this.displayGraph(contentEl);
                break;
            case 'timeline':
                titleEl.textContent = 'Timeline';
                this.displayTimeline(contentEl);
                break;
        }
    }
    
    displayKeepers(container) {
        if (!this.souvenir || !this.souvenir.keepers || this.souvenir.keepers.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic; padding: 20px; text-align: center;">No keepers yet</p>';
            return;
        }
        
        const keepersHtml = this.souvenir.keepers.map(keeper => {
            const avatarUrl = keeper.avatar || '/assets/icon_face.png';
            const timeText = this.timeAgo(keeper.epoch);
            
            return `
                <div class="keeper-item" data-did="${keeper.did}">
                    <img src="${avatarUrl}" alt="${keeper.name}" class="keeper-avatar" onerror="this.src='/assets/icon_face.png'">
                    <div class="keeper-info">
                        <span class="keeper-name dreamer-link" data-dreamer-did="${keeper.did}">${keeper.name}</span>
                        <span class="keeper-time">${timeText}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = keepersHtml;
        
        // Add click handlers
        container.querySelectorAll('.dreamer-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const did = link.getAttribute('data-dreamer-did');
                window.location.href = `/dreamer?did=${encodeURIComponent(did)}`;
            });
            
            link.addEventListener('mouseenter', (e) => {
                const did = link.getAttribute('data-dreamer-did');
                if (window.DreamerHoverWidget) {
                    window.DreamerHoverWidget.show(did, e.target);
                }
            });
            
            link.addEventListener('mouseleave', () => {
                if (window.DreamerHoverWidget) {
                    window.DreamerHoverWidget.scheduleHide();
                }
            });
        });
    }
    
    displayGraph(container) {
        container.innerHTML = '<p style="color: #999; font-style: italic; padding: 20px; text-align: center;">Graph view coming soon</p>';
    }
    
    displayTimeline(container) {
        container.innerHTML = '<p style="color: #999; font-style: italic; padding: 20px; text-align: center;">Timeline view coming soon</p>';
    }
    
    timeAgo(timestamp) {
        const now = Date.now() / 1000;
        const diff = now - timestamp;
        const days = Math.floor(diff / (24 * 60 * 60));
        
        if (days === 0) return "today";
        if (days === 1) return "yesterday";
        if (days <= 6) return `${days} days ago`;
        if (days === 7) return "one week ago";
        if (days <= 28) return "a few weeks ago";
        if (days <= 60) return "about a month ago";
        if (days <= 90) return "some months ago";
        
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months ago`;
        
        const years = Math.floor(days / 365);
        return years === 1 ? "a year ago" : `${years} years ago`;
    }
}

// Make globally available
window.SouvenirBox = SouvenirBox;
console.log('✅ [SouvenirBox] Widget loaded');
