/**
 * Souvenir Info Card Widget
 * Displays souvenir icon, title, description, and keeper count
 */

class SouvenirInfoCard {
    constructor() {
        this.container = null;
    }
    
    /**
     * Render the info card
     * @param {Object} souvenir - Souvenir data object
     * @param {HTMLElement} targetElement - Element to render into
     */
    render(souvenir, targetElement) {
        console.log('💳 [InfoCard] render() called with souvenir:', souvenir?.name);
        console.log('💳 [InfoCard] Target element:', targetElement);
        
        this.container = targetElement;
        
        if (!souvenir) {
            console.error('❌ [InfoCard] No souvenir data provided');
            this.container.innerHTML = '<p>Loading...</p>';
            return;
        }
        
        const keeperCount = souvenir.keepers?.length || 0;
        const keeperText = this.getKeeperText(keeperCount, souvenir.keepers);
        
        this.container.innerHTML = `
            <div class="souvenir-info">
                <div class="souvenir-image">
                    <div style="
                        width: 150px;
                        height: 150px;
                        border-radius: 50%;
                        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(200,220,255,0.4));
                        border: 3px solid rgba(255,255,255,0.6);
                        box-shadow: 0 6px 24px rgba(0,0,0,0.15), 
                                    inset -4px -4px 18px rgba(0,0,0,0.08),
                                    inset 4px 4px 15px rgba(255,255,255,0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <img src="${souvenir.icon || '/assets/icon_face.png'}" 
                             alt="${souvenir.name}" 
                             class="souvenir-icon-wave souvenir-icon-hover"
                             style="cursor: pointer; width: 120px; height: 120px; opacity: 0.85; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
                    </div>
                </div>
                <div class="souvenir-text">
                    <h2 class="souvenir-title">${souvenir.name}</h2>
                    <p class="souvenir-description">${souvenir.description || ''}</p>
                    <p class="souvenir-details">${keeperText}</p>
                </div>
            </div>
        `;
    }
    
    getKeeperText(count, keepers) {
        const words = {
            0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
            6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
            11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen",
            16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty"
        };
        
        const numberToWord = (num) => words[num] || num.toString();
        
        if (count === 0) return "no keepers";
        
        // Get earliest keeper timestamp
        if (keepers && keepers.length > 0) {
            const earliestEpoch = Math.min(...keepers.map(k => k.epoch));
            const timeText = this.timeAgo(earliestEpoch);
            
            if (count === 1) {
                return `one keeper of ${timeText}`;
            }
            return `${numberToWord(count)} keepers of ${timeText}`;
        }
        
        return count === 1 ? "one keeper" : `${numberToWord(count)} keepers`;
    }
    
    timeAgo(timestamp) {
        const now = Date.now() / 1000;
        const diff = now - timestamp;
        const seconds = Math.floor(diff);
        const days = Math.floor(diff / (24 * 60 * 60));
        
        if (seconds < 0) return "in the future";
        
        // Very recent times (under 1 hour)
        if (seconds < 60) return "just now";
        else if (seconds < 300) return "now";  // 5 minutes
        else if (seconds < 1800) return "recent";  // 30 minutes  
        else if (seconds < 3600) return "the hour";  // 1 hour
        
        // Hours (1-24)
        else if (seconds < 86400) {  // 24 hours
            const hours = Math.floor(seconds / 3600);
            if (hours === 1) return "an hour";
            else if (hours < 6) return `${this.numberWord(hours)} hours`;
            else if (hours < 12) {
                const currentHour = new Date().getHours();
                return currentHour >= 12 ? "this morning" : "earlier";
            }
            else if (hours < 18) return "earlier";
            else return "yesterday";
        }
        
        // Days with high nuance
        else if (days === 1) return "yesterday";
        else if (days === 2) return "two days";
        else if (days === 3) return "three days";
        else if (days <= 6) return "a few days";
        else if (days === 7) return "one week";
        else if (days <= 10) return "more than a week";
        else if (days === 14) return "two weeks";
        else if (days <= 17) return "more than two weeks";
        else if (days <= 28) return "a few weeks";
        
        // Months
        else if (days <= 45) return "about a month";
        else if (days <= 60) return "two months";
        else if (days <= 90) return "some months";
        
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months`;
        
        const years = Math.floor(days / 365);
        return years === 1 ? "a year" : `${years} years`;
    }
    
    numberWord(num) {
        const words = {
            2: "two", 3: "three", 4: "four", 5: "five"
        };
        return words[num] || num.toString();
    }
}

// Make globally available
window.SouvenirInfoCard = SouvenirInfoCard;
console.log('✅ [SouvenirInfoCard] Widget loaded');
