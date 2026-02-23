/**
 * AvatarCache — shared singleton for resolved avatar URLs.
 *
 * Eliminates redundant /api/dreamers fetches across widgets (drawer, header,
 * eventstack, me page, etc.).  Every consumer should call AvatarCache.get(did)
 * before issuing its own network request.
 *
 * Usage:
 *   const url = AvatarCache.get(did);          // string | null
 *   AvatarCache.set(did, url);                 // store one
 *   AvatarCache.populateFromDreamers(arr);     // bulk store from /api/dreamers
 */
(() => {
    'use strict';

    const _cache = new Map();           // DID → avatar URL string
    const FALLBACK = '/assets/icon_face.png';

    const AvatarCache = {
        /** Return the cached avatar URL, or null if unknown. */
        get(did) {
            return _cache.get(did) || null;
        },

        /** Store a single DID → avatar mapping. */
        set(did, url) {
            if (did && url) _cache.set(did, url);
        },

        /** True if the cache already contains this DID. */
        has(did) {
            return _cache.has(did);
        },

        /** Bulk-populate from an array of dreamer objects (e.g. /api/dreamers). */
        populateFromDreamers(dreamers) {
            if (!Array.isArray(dreamers)) return;
            for (const d of dreamers) {
                if (d.did && d.avatar) _cache.set(d.did, d.avatar);
            }
        },

        /** Return the default fallback icon. */
        get fallback() {
            return FALLBACK;
        },

        /** Clear all entries (useful for logout). */
        clear() {
            _cache.clear();
        },

        /** Return the full Map (read-only snapshot). */
        getAll() {
            return new Map(_cache);
        },
    };

    window.AvatarCache = AvatarCache;
})();
