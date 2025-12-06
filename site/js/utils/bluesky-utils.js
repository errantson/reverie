/**
 * Bluesky Utilities
 * Helper functions for Bluesky AT Protocol interactions
 */

/**
 * Resolve a Bluesky handle to DID
 * @param {string} handle - Bluesky handle (without @)
 * @returns {Promise<string|null>} DID or null if not found
 */
export async function resolveHandleToDid(handle) {
    const cleanHandle = handle.replace('@', '');
    
    try {
        const response = await fetch(
            `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${cleanHandle}`
        );
        
        if (!response.ok) {
            console.warn(`Failed to resolve handle ${cleanHandle}:`, response.status);
            return null;
        }
        
        const data = await response.json();
        return data.did || null;
    } catch (error) {
        console.error(`Error resolving handle ${cleanHandle}:`, error);
        return null;
    }
}

/**
 * Calculate facets for AT Protocol post text
 * @param {string} text - Post text
 * @returns {Promise<Array>} Array of facets
 */
export async function calculateFacets(text) {
    const facets = [];
    
    console.log('🔍 [calculateFacets] Analyzing text:', text);
    
    // Match @mentions
    const mentionRegex = /@([a-zA-Z0-9.-]+)/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
        const handle = match[1];
        console.log('👤 [calculateFacets] Found mention:', handle);
        const did = await resolveHandleToDid(handle);
        console.log('🆔 [calculateFacets] Resolved DID:', did);
        
        if (did) {
            facets.push({
                index: {
                    byteStart: new TextEncoder().encode(text.substring(0, match.index)).length,
                    byteEnd: new TextEncoder().encode(text.substring(0, match.index + match[0].length)).length
                },
                features: [{
                    $type: 'app.bsky.richtext.facet#mention',
                    did: did
                }]
            });
            console.log('✅ [calculateFacets] Added mention facet for', handle);
        } else {
            console.warn('⚠️ [calculateFacets] Could not resolve DID for', handle);
        }
    }
    
    // Match URLs (including ones without protocol)
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
    
    while ((match = urlRegex.exec(text)) !== null) {
        let url = match[0];
        console.log('🔗 [calculateFacets] Found URL:', url);
        // Add https:// if no protocol specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        facets.push({
            index: {
                byteStart: new TextEncoder().encode(text.substring(0, match.index)).length,
                byteEnd: new TextEncoder().encode(text.substring(0, match.index + match[0].length)).length
            },
            features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: url
            }]
        });
        console.log('✅ [calculateFacets] Added link facet for', url);
    }
    
    console.log('📊 [calculateFacets] Total facets created:', facets.length);
    return facets;
}

/**
 * Create a Bluesky post URL with text and optional facets
 * @param {string} text - Post text
 * @param {Array} [facets] - Optional facets array
 * @returns {string} Bluesky compose URL
 */
export function createBlueskyComposeUrl(text, facets = null) {
    const params = new URLSearchParams({ text });
    
    if (facets && facets.length > 0) {
        // Note: facets might not be supported in share URL, but included for completeness
        // They would typically be sent via API instead
    }
    
    return `https://bsky.app/intent/compose?${params.toString()}`;
}

/**
 * Proxy image URL through Reverie CDN
 * @param {string} imageUrl - Original image URL
 * @returns {string} Proxied URL
 */
export function proxyImageUrl(imageUrl) {
    return `/api/avatar/proxy?url=${encodeURIComponent(imageUrl)}`;
}
