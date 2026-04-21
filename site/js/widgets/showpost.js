/**
 * ShowPost Widget
 * Displays a Bluesky or branchline post in a shadowbox overlay
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
            const parsed = this.parseAtUri(uri);
            if (!parsed) {
                throw new Error('Unsupported AT URI format');
            }

            const postData = parsed.collection === 'ink.branchline.bud'
                ? await this.fetchBranchlinePost(uri)
                : await this.fetchPost(uri);
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
            if (postData.recordType === 'ink.branchline.bud') {
                await this.renderBranchlinePost(postData, dreamerColor);
            } else {
                await this.renderPost(postData, dreamerColor);
            }
            
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

        // Parse branchline URL: https://branchline.ink/bud/{did}/{rkey}
        const branchlineMatch = urlOrUri.match(/branchline\.ink\/bud\/([^/]+)\/([^/?#]+)/);
        if (branchlineMatch) {
            const [, did, rkey] = branchlineMatch;
            return `at://${decodeURIComponent(did)}/ink.branchline.bud/${decodeURIComponent(rkey)}`;
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
                const response = await fetch(`/bsky/xrpc/com.atproto.identity.resolveHandle?handle=${handleOrDid}`);
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

    parseAtUri(uri) {
        const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)/);
        if (!match) return null;
        return {
            did: match[1],
            collection: match[2],
            rkey: match[3],
        };
    }

    /**
     * Convert AT Protocol URI to Bluesky URL
     */
    uriToUrl(uri) {
        // at://did:plc:abc123/app.bsky.feed.post/xyz789
        const parts = this.parseAtUri(uri);
        if (parts?.collection === 'app.bsky.feed.post') {
            const { did, rkey } = parts;
            // We need to resolve DID to handle, but use DID for now
            return `https://bsky.app/profile/${did}/post/${rkey}`;
        }
        if (parts?.collection === 'ink.branchline.bud') {
            const { did, rkey } = parts;
            return `https://branchline.ink/bud/${encodeURIComponent(did)}/${encodeURIComponent(rkey)}`;
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
        
        const response = await fetch(`/bsky/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`);

        if (!response.ok) {
            throw new Error('Failed to fetch post');
        }

        const data = await response.json();
        const post = data.thread?.post;
        if (!post) throw new Error('No post data in response');
        
        return this.extractPostData(post);
    }

    async fetchBranchlinePost(uri) {
        const response = await fetch('/api/preview-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uri }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch branchline record');
        }

        const data = await response.json();
        if (!data.ok || !data.record) {
            throw new Error(data.error || 'Invalid preview response');
        }

        const record = data.record;
        return {
            uri,
            recordType: record.$type || 'ink.branchline.bud',
            title: record.title || '',
            text: record.text || '',
            createdAt: record.createdAt || data.createdAt || null,
            formatting: Array.isArray(record.formatting) ? record.formatting : [],
            author: {
                did: data.did || '',
                handle: data.author?.handle || '',
                displayName: data.author?.displayName || '',
                avatar: data.author?.avatar || '',
            },
            externalUrl: data.externalUrl || this.uriToUrl(uri),
        };
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

    async renderBranchlinePost(postData, dreamerColor) {
        const postUrl = postData.externalUrl || this.uriToUrl(postData.uri) || '#';
        const titleHtml = this.escapeHtml(postData.title || 'Untitled Story');
        const textHtml = this.renderBranchlineText(postData.text || '', postData.formatting || []);
        const avatarUrl = postData.author.avatar || '/assets/icon_face.png';
        const displayName = postData.author.displayName || postData.author.handle || 'Unknown';
        const handle = postData.author.handle || '';
        const when = postData.createdAt ? this.getTimeAgo(new Date(postData.createdAt).getTime()) : 'recently';

        const textColor = this.getContrastColor(dreamerColor);
        const handleOpacity = textColor === '#ffffff' ? '0.8' : '0.6';
        const borderColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';

        // Keep footer persistent while the story content scrolls.
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.overflow = 'hidden';

        this.container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: ${dreamerColor};">
                <img src="${avatarUrl}" alt="${displayName}" style="width: 33.6px; height: 33.6px; border-radius: 50%; object-fit: cover; border: 1px solid ${borderColor};">
                <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: bold; color: ${textColor}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayName)}</span>
                    <span style="color: ${textColor}; opacity: ${handleOpacity}; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">@${this.escapeHtml(handle)}</span>
                </div>
                <button onclick="window.showPostWidget?.close()" style="background: none; border: none; font-size: 24px; color: ${textColor}; opacity: 0.8; cursor: pointer; padding: 4px 8px; line-height: 1;" title="Close">×</button>
            </div>
            <div style="padding: 16px 18px 14px 18px; overflow-y: auto; flex: 1; min-height: 0;">
                <h3 style="margin: 0 0 14px 0; font-size: 1.05rem; line-height: 1.35; text-align: center;">${titleHtml}</h3>
                <div style="font-size: 0.95rem; line-height: 1.7; color: #222; white-space: normal; text-align: left;">${textHtml}</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-top: 1px solid ${borderColor}; background: ${dreamerColor}; color: ${textColor}; flex-shrink: 0;">
                <span class="activity-time" style="cursor: default; color: ${textColor}; opacity: ${handleOpacity};">${when}</span>
                <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time" style="color: ${textColor}; font-weight: 600; text-decoration-color: ${textColor};">Branch Story</a>
            </div>
        `;
    }

    utf8ByteOffsetToCharIndex(text, byteOffset) {
        const target = Math.max(0, Number(byteOffset) || 0);
        let currentByte = 0;
        let currentIndex = 0;

        for (const symbol of text) {
            if (target <= currentByte) {
                return currentIndex;
            }
            currentByte += new TextEncoder().encode(symbol).length;
            currentIndex += symbol.length;
            if (target < currentByte) {
                return currentIndex;
            }
        }
        return currentIndex;
    }

    renderBranchlineText(text, formatting) {
        const safeText = typeof text === 'string' ? text : '';
        if (!safeText) {
            return '<p style="margin: 0; color: #666;">No text available</p>';
        }

        const ranges = Array.isArray(formatting)
            ? formatting
                .map((entry) => {
                    const type = entry?.type;
                    if (type !== 'bold' && type !== 'italic') return null;
                    const start = this.utf8ByteOffsetToCharIndex(safeText, entry?.start);
                    const end = this.utf8ByteOffsetToCharIndex(safeText, entry?.end);
                    if (end <= start) return null;
                    return { type, start, end };
                })
                .filter(Boolean)
                .sort((a, b) => a.start - b.start || a.end - b.end)
            : [];

        if (!ranges.length) {
            return this.escapeHtml(safeText).replace(/\n\n/g, '</p><p style="margin: 0 0 16px 0;">').replace(/\n/g, '<br>').replace(/^/, '<p style="margin: 0 0 16px 0;">').concat('</p>');
        }

        const starts = new Map();
        const ends = new Map();
        ranges.forEach((range) => {
            if (!starts.has(range.start)) starts.set(range.start, []);
            if (!ends.has(range.end)) ends.set(range.end, []);
            starts.get(range.start).push(range.type);
            ends.get(range.end).push(range.type);
        });

        const points = Array.from(new Set([0, safeText.length, ...starts.keys(), ...ends.keys()])).sort((a, b) => a - b);
        const active = new Set();
        let html = '';

        for (let i = 0; i < points.length - 1; i += 1) {
            const point = points[i];
            const nextPoint = points[i + 1];
            (ends.get(point) || []).forEach((type) => active.delete(type));
            (starts.get(point) || []).forEach((type) => active.add(type));
            if (nextPoint <= point) continue;

            let segment = this.escapeHtml(safeText.slice(point, nextPoint));
            if (active.has('bold')) segment = `<strong>${segment}</strong>`;
            if (active.has('italic')) segment = `<em>${segment}</em>`;
            html += segment;
        }

        html = html.replace(/\n\n/g, '</p><p style="margin: 0 0 16px 0;">').replace(/\n/g, '<br>');
        return `<p style="margin: 0 0 16px 0;">${html}</p>`;
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

