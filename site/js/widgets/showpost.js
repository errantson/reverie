/**
 * ShowPost Widget
 * Displays a Bluesky post in a shadowbox overlay
 * Similar to profile.js activity card but as a standalone popup
 */

class ShowPost {
    constructor() {
        this.shadowbox = null;
        this.container = null;
        this.loadStyles();
    }
    
    loadStyles() {
        // Helper to load stylesheet
        const loadStylesheet = (href) => {
            if (document.querySelector(`link[href*="${href}"]`)) {
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        };
        
        // Load CSS needed for activity card styling
        loadStylesheet('/css/widgets/profile.css?v=4');
    }

    /**
     * Show a post from a URI or URL
     * @param {string} uriOrUrl - AT Protocol URI (at://...) or Bluesky URL (https://bsky.app/...)
     */
    async show(uriOrUrl) {
        // Convert URL to URI if needed
        const uri = await this.urlToUri(uriOrUrl);
        
        if (!uri) {
            console.error('[ShowPost] Invalid URI/URL:', uriOrUrl);
            return;
        }

        // Create shadowbox
        this.shadowbox = new Shadowbox({
            showCloseButton: false,
            onClose: () => {
                this.cleanup();
            }
        });
        this.shadowbox.create();

        // Fetch post data and color BEFORE creating visible container
        try {
            const postData = await this.fetchPost(uri);
            const dreamerColor = await this.fetchDreamerColor(postData.author.did, postData.author.handle);
            
            // Now create post container with correct color from the start
            this.container = document.createElement('div');
            this.container.className = 'showpost-container';
            this.container.style.cssText = `
                background: white;
                border: 2px solid ${dreamerColor};
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
                --user-color: ${dreamerColor};
            `;

            this.shadowbox.contentContainer.appendChild(this.container);
            
            // Render content
            await this.renderPost(postData, dreamerColor);
            
            // Fade in smoothly
            requestAnimationFrame(() => {
                this.container.style.opacity = '1';
            });
        } catch (error) {
            console.error('[ShowPost] Error fetching post:', error);
            
            // Create container for error message
            this.container = document.createElement('div');
            this.container.className = 'showpost-container';
            this.container.style.cssText = `
                background: white;
                border: 2px solid #d0c7f0;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            `;
            this.container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #c44;">
                    Unable to load post
                </div>
            `;
            this.shadowbox.contentContainer.appendChild(this.container);
        }
    }

    /**
     * Convert Bluesky URL to AT Protocol URI
     */
    async urlToUri(urlOrUri) {
        if (urlOrUri.startsWith('at://')) {
            return urlOrUri;
        }

        // Parse bsky.app URL: https://bsky.app/profile/{handle}/post/{rkey}
        const match = urlOrUri.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
        if (match) {
            const [, handleOrDid, rkey] = match;
            
            // If it's already a DID, we can construct the URI directly
            if (handleOrDid.startsWith('did:')) {
                return `at://${handleOrDid}/app.bsky.feed.post/${rkey}`;
            }
            
            // Otherwise resolve handle to DID
            try {
                const response = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handleOrDid}`);
                if (response.ok) {
                    const data = await response.json();
                    return `at://${data.did}/app.bsky.feed.post/${rkey}`;
                }
            } catch (error) {
                console.error('[ShowPost] Error resolving handle:', error);
            }
        }

        return null;
    }

    /**
     * Convert AT Protocol URI to Bluesky URL
     */
    uriToUrl(uri) {
        // at://did:plc:abc123/app.bsky.feed.post/xyz789
        const match = uri.match(/at:\/\/([^/]+)\/app\.bsky\.feed\.post\/(.+)/);
        if (match) {
            const [, did, rkey] = match;
            // We need to resolve DID to handle, but use DID for now
            return `https://bsky.app/profile/${did}/post/${rkey}`;
        }
        return uri;
    }

    /**
     * Fetch dreamer color from API
     */
    async fetchDreamerColor(did, handle) {
        try {
            const response = await fetch('/api/dreamers');
            if (response.ok) {
                const dreamers = await response.json();
                const dreamer = dreamers.find(d => d.did === did || d.handle === handle);
                if (dreamer && dreamer.color_hex) {
                    return dreamer.color_hex;
                }
            }
        } catch (error) {
            console.warn('[ShowPost] Could not fetch dreamer color:', error);
        }
        return '#d0c7f0'; // Default color
    }

    /**
     * Fetch post data from Bluesky public API
     */
    async fetchPost(uriOrUrl) {
        if (typeof uriOrUrl !== 'string') {
            throw new Error(`Invalid argument: expected string, got ${typeof uriOrUrl}`);
        }
        
        const uri = uriOrUrl.startsWith('at://') ? uriOrUrl : await this.urlToUri(uriOrUrl);
        
        if (!uri) {
            throw new Error('Invalid post URL or URI');
        }
        
        const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`);

        if (!response.ok) {
            throw new Error('Failed to fetch post');
        }

        const data = await response.json();
        const post = data.thread?.post;
        if (!post) throw new Error('No post data in response');
        
        return this.extractPostData(post);
    }
    
    /**
     * Extract relevant post data from API response
     */
    extractPostData(post) {
        const data = {
            uri: post.uri,
            text: post.record.text || '',
            createdAt: post.record.createdAt,
            images: [],
            likeCount: post.likeCount || 0,
            repostCount: post.repostCount || 0,
            replyCount: post.replyCount || 0,
            author: {
                did: post.author?.did || '',
                handle: post.author?.handle || '',
                displayName: post.author?.displayName || '',
                avatar: post.author?.avatar || ''
            }
        };
        
        // Extract images from embed
        if (post.embed) {
            if (post.embed.images) {
                data.images = post.embed.images.map(img => ({
                    thumb: img.thumb,
                    fullsize: img.fullsize,
                    alt: img.alt || ''
                }));
            } else if (post.embed.$type === 'app.bsky.embed.images#view') {
                data.images = post.embed.images.map(img => ({
                    thumb: img.thumb,
                    fullsize: img.fullsize,
                    alt: img.alt || ''
                }));
            }
        }
        
        return data;
    }

    /**
     * Render post content (similar to profile.js activity card)
     */
    async renderPost(postData, dreamerColor) {
        // Build post HTML similar to profile.js
        const timeAgo = this.getTimeAgo(new Date(postData.createdAt).getTime());
        const postUrl = postData.uri ? this.uriToUrl(postData.uri) : '#';
        
        // Linkify text with user color for links
        const linkedText = await this.linkifyText(postData.text || '', dreamerColor);
        const hasText = postData.text && postData.text.trim().length > 0;
        
        // Get interaction counts
        const likeCount = postData.likeCount || 0;
        const repostCount = postData.repostCount || 0;
        const replyCount = postData.replyCount || 0;
        
        // Build interaction stats (read-only, links to bsky)
        const interactionStats = `
            <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${likeCount} like${likeCount === 1 ? '' : 's'}</a>
            <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
            <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${repostCount} repost${repostCount === 1 ? '' : 's'}</a>
            <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
            <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</a>
        `;
        
        // Build info overlay
        const infoOverlay = `
            <div class="activity-info-overlay">
                <div class="activity-overlay-content">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${timeAgo}</a>
                        <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                        ${interactionStats}
                    </div>
                </div>
            </div>
        `;
        
        // Build content based on whether there are images
        let contentHtml = '';
        if (postData.images && postData.images.length > 0) {
            const img = postData.images[0];
            
            if (hasText) {
                contentHtml = `
                    <div class="activity-image-container">
                        <img src="${img.thumb || img.fullsize}" alt="${img.alt || 'Post image'}" class="activity-image" onclick="window.open('${img.fullsize}', '_blank')">
                        <div class="activity-text-overlay">
                            <div class="activity-text-overlay-content">
                                <div class="activity-text">${linkedText}</div>
                            </div>
                        </div>
                        ${infoOverlay}
                    </div>
                `;
            } else {
                contentHtml = `
                    <div class="activity-image-container">
                        <img src="${img.thumb || img.fullsize}" alt="${img.alt || 'Post image'}" class="activity-image" onclick="window.open('${img.fullsize}', '_blank')">
                        ${infoOverlay}
                    </div>
                `;
            }
        } else {
            contentHtml = `
                <div class="activity-text-content activity-text-only-centered">
                    <div class="activity-text">${linkedText}</div>
                    ${infoOverlay}
                </div>
            `;
        }
        
        // Build header with avatar, name, and close button
        const avatarUrl = postData.author.avatar || '/assets/icon_face.png';
        const displayName = postData.author.displayName || postData.author.handle || 'Unknown';
        const handle = postData.author.handle || '';
        
        // Calculate contrast colors
        const textColor = this.getContrastColor(dreamerColor);
        const handleOpacity = textColor === '#ffffff' ? '0.8' : '0.6';
        const borderColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
        
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: ${dreamerColor};">
                <img src="${avatarUrl}" alt="${displayName}" style="width: 33.6px; height: 33.6px; border-radius: 50%; object-fit: cover; border: 1px solid ${borderColor};">
                <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: bold; color: ${textColor}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayName)}</span>
                    <span style="color: ${textColor}; opacity: ${handleOpacity}; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">@${this.escapeHtml(handle)}</span>
                </div>
                <button onclick="window.showPostWidget?.close()" style="background: none; border: none; font-size: 24px; color: ${textColor}; opacity: 0.8; cursor: pointer; padding: 4px 8px; line-height: 1;" title="Close">×</button>
            </div>
            <div class="activity-box" style="border: none;">
                ${contentHtml}
            </div>
        `;
    }

    /**
     * Get contrasting text color (black or white) based on background color
     * Leans toward white text, only uses black for truly bright colors
     */
    getContrastColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Only use black text for very bright colors (luminance > 0.7)
        return luminance > 0.7 ? '#000000' : '#ffffff';
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Get time ago string
     */
    getTimeAgo(timestamp) {
        const now = Date.now();
        const seconds = Math.floor((now - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        }
        if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        }
        if (seconds < 2592000) {
            const days = Math.floor(seconds / 86400);
            return `${days} day${days === 1 ? '' : 's'} ago`;
        }
        if (seconds < 31536000) {
            const months = Math.floor(seconds / 2592000);
            return `${months} month${months === 1 ? '' : 's'} ago`;
        }
        const years = Math.floor(seconds / 31536000);
        return `${years} year${years === 1 ? '' : 's'} ago`;
    }

    /**
     * Linkify text (from profile.js)
     */
    async linkifyText(text, dreamerColor = '#734ba1') {
        if (!text) return '';
        
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        // Patterns to match
        const handleRegex = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g;
        const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
        const hashtagRegex = /#[a-zA-Z0-9_]+/g;
        
        // Find all matches with their types
        const matches = [];
        let match;
        
        // Find handles
        handleRegex.lastIndex = 0;
        while ((match = handleRegex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0],
                type: 'handle'
            });
        }
        
        // Find URLs
        urlRegex.lastIndex = 0;
        while ((match = urlRegex.exec(text)) !== null) {
            const isPartOfHandle = matches.some(m => 
                m.type === 'handle' && 
                match.index >= m.index - 1 && 
                match.index < m.index + m.length
            );
            if (!isPartOfHandle) {
                matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0],
                    type: 'url'
                });
            }
        }
        
        // Find hashtags
        hashtagRegex.lastIndex = 0;
        while ((match = hashtagRegex.exec(text)) !== null) {
            const isPartOfOther = matches.some(m => 
                match.index >= m.index && 
                match.index < m.index + m.length
            );
            if (!isPartOfOther) {
                matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0],
                    type: 'hashtag'
                });
            }
        }
        
        // Sort by index
        matches.sort((a, b) => a.index - b.index);
        
        // Fetch dreamers for handle resolution
        let allDreamers = [];
        try {
            const response = await fetch('/api/dreamers');
            if (response.ok) {
                allDreamers = await response.json();
            }
        } catch (error) {
            console.error('Error fetching dreamers for linkify:', error);
        }
        
        // Build the final HTML
        const parts = [];
        let lastIndex = 0;
        
        matches.forEach(match => {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(escapeHtml(text.substring(lastIndex, match.index)));
            }
            
            if (match.type === 'handle') {
                const handle = match.text.substring(1);
                const dreamer = allDreamers.find(d => 
                    d.handle && d.handle.toLowerCase() === handle.toLowerCase()
                );
                
                if (dreamer) {
                    parts.push(`<a href="/dreamer?did=${encodeURIComponent(dreamer.did)}" class="activity-handle-link" style="color: ${dreamerColor};">${escapeHtml(match.text)}</a>`);
                } else {
                    parts.push(`<a href="https://bsky.app/profile/${encodeURIComponent(handle)}" target="_blank" class="activity-handle-link" style="color: ${dreamerColor};">${escapeHtml(match.text)}</a>`);
                }
            } else if (match.type === 'url') {
                let url = match.text;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                parts.push(`<a href="${escapeHtml(url)}" target="_blank" class="activity-url-link" style="color: ${dreamerColor};">${escapeHtml(match.text)}</a>`);
            } else if (match.type === 'hashtag') {
                const tag = match.text.substring(1);
                parts.push(`<a href="https://bsky.app/hashtag/${encodeURIComponent(tag)}" target="_blank" class="activity-hashtag-link" style="color: ${dreamerColor};">${escapeHtml(match.text)}</a>`);
            }
            
            lastIndex = match.index + match.length;
        });
        
        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(escapeHtml(text.substring(lastIndex)));
        }
        
        // Join parts and convert newlines
        return parts.join('').replace(/\n/g, '<br>');
    }

    /**
     * Cleanup when shadowbox closes
     */
    cleanup() {
        this.container = null;
        this.shadowbox = null;
    }

    /**
     * Close the shadowbox
     */
    close() {
        if (this.shadowbox) {
            this.shadowbox.close();
        }
    }
}

// Make globally available
window.ShowPost = ShowPost;

// Helper function for easy access
window.showPost = function(uriOrUrl) {
    // Handle event object being passed (from inline onclick)
    if (uriOrUrl instanceof Event || (typeof uriOrUrl === 'object' && uriOrUrl?.target)) {
        console.error('[ShowPost] Event object passed instead of URL - this is a bug in the onclick handler');
        return;
    }
    
    // Ensure we have a string
    if (typeof uriOrUrl !== 'string') {
        console.error('[ShowPost] Invalid argument type:', typeof uriOrUrl, 'Value:', uriOrUrl);
        return;
    }
    
    const widget = new ShowPost();
    window.showPostWidget = widget; // Store globally so close button can access it
    widget.show(uriOrUrl);
};

console.log('✅ [ShowPost] Widget loaded and available');
