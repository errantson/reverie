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
            console.log('🎨 World config: Using cached data');
            return this.cache;
        }

        // Return existing promise if fetch in progress
        if (this.promise) {
            console.log('🎨 World config: Fetch already in progress, waiting...');
            return this.promise;
        }

        // Start new fetch
        console.log('🎨 World config: Fetching from /api/world...');
        this.promise = fetch('/api/world')
            .then(response => response.json())
            .then(data => {
                this.cache = data;
                this.lastFetch = Date.now();
                this.promise = null;
                console.log('✅ World config: Cached', data);
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
        console.log('🗑️ World config: Cache invalidated');
        this.cache = null;
        this.lastFetch = null;
        this.promise = null;
    }
}

// Create singleton instance
window.worldConfigCache = new WorldConfigCache();

console.log('🎨 World config cache initialized');
