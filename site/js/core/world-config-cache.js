/**
 * World Config Cache
 * Prevents redundant /api/world fetches across widgets
 */
class WorldConfigCache {
    constructor() {
        this.cache = null;
        this.promise = null;
        this.lastFetch = null;
        this.TTL = 5 * 60 * 1000; // 5 minutes
    }

    async fetch() {
        // Return cached if still valid
        if (this.cache && this.lastFetch && (Date.now() - this.lastFetch < this.TTL)) {
            return this.cache;
        }

        // Return existing promise if fetch in progress
        if (this.promise) {
            return this.promise;
        }

        // Start new fetch
        this.promise = fetch('/api/world')
            .then(response => response.json())
            .then(data => {
                this.cache = data;
                this.lastFetch = Date.now();
                this.promise = null;
                return data;
            })
            .catch(error => {
                console.error('❌ World config: Fetch failed', error);
                this.promise = null;
                throw error;
            });

        return this.promise;
    }

    get() {
        return this.cache;
    }

    invalidate() {
        this.cache = null;
        this.lastFetch = null;
        this.promise = null;
    }
}

// Create singleton instance
window.worldConfigCache = new WorldConfigCache();

