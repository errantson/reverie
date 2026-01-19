/**
 * AT Protocol Interactions Utility
 * 
 * Unified handlers for AT Protocol interactions (like, repost, reply)
 * that work with both OAuth sessions and PDS sessions.
 * 
 * For OAuth-only sessions (atproto scope only), write operations require
 * stored app password credentials which are prompted on first use.
 */

class ATProtoInteractions {
    constructor() {
        this.session = null;
        this._credentialsCache = null; // Cache credentials check result
        this._credentialsCacheTime = 0;
        this._pendingCredentialsPromise = null; // Prevent duplicate prompts
    }

    /**
     * Get the current session (OAuth or PDS)
     */
    getSession() {
        if (window.oauthManager) {
            return window.oauthManager.getSession();
        }
        return null;
    }

    /**
     * Get the PDS endpoint URL from the session
     */
    getPdsEndpoint(session) {
        if (session?.handle?.endsWith('.reverie.house')) {
            return 'https://reverie.house';
        }
        return 'https://bsky.social';
    }

    /**
     * Check if session is OAuth or PDS-based
     * PDS sessions have accessJwt directly on the session object
     * OAuth sessions may have sub but no accessJwt (or accessJwt is inside SDK)
     */
    isPdsSession(session) {
        // PDS sessions have accessJwt directly on the session
        // The presence of 'sub' doesn't mean it's OAuth - it could be added for compatibility
        return session && session.accessJwt && typeof session.accessJwt === 'string';
    }

    /**
     * Check if user has stored credentials for write operations
     * @returns {Promise<boolean>}
     */
    async hasStoredCredentials() {
        const session = this.getSession();
        if (!session) return false;
        
        const userDid = session.did || session.sub;
        if (!userDid) return false;
        
        // Use cache if recent (30 seconds)
        const now = Date.now();
        if (this._credentialsCache !== null && (now - this._credentialsCacheTime) < 30000) {
            return this._credentialsCache;
        }
        
        try {
            // Use OAuth-authenticated endpoint
            const token = localStorage.getItem('oauth_token');
            if (token) {
                const response = await fetch('/api/user/credentials/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    this._credentialsCache = data.connected === true;
                    this._credentialsCacheTime = now;
                    return this._credentialsCache;
                }
            }
        } catch (error) {
            console.warn('⚠️ [ATProto] Failed to check credentials status:', error);
        }
        
        return false;
    }

    /**
     * Request app password from user and store credentials
     * @returns {Promise<boolean>} True if credentials were stored
     */
    async requestAndStoreCredentials() {
        // Prevent duplicate prompts
        if (this._pendingCredentialsPromise) {
            return this._pendingCredentialsPromise;
        }
        
        const session = this.getSession();
        if (!session) {
            throw new Error('No active session');
        }
        
        const userDid = session.did || session.sub;
        const handle = session.handle || 'your account';
        
        this._pendingCredentialsPromise = new Promise((resolve) => {
            if (!window.appPasswordRequest) {
                console.error('❌ [ATProto] AppPasswordRequest widget not available');
                resolve(false);
                return;
            }
            
            window.appPasswordRequest.show({
                title: 'Connect Account',
                description: `<p>To interact with posts from Reverie House, we need permission to act on your behalf.</p>`,
                featureName: 'interactions',
                buttonText: 'CONNECT ACCOUNT'
            }, async (appPassword) => {
                try {
                    // Use OAuth-authenticated endpoint
                    const token = localStorage.getItem('oauth_token');
                    const response = await fetch('/api/user/credentials/connect', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ app_password: appPassword })
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to store credentials');
                    }
                    
                    console.log('✅ [ATProto] Credentials stored successfully');
                    this._credentialsCache = true;
                    this._credentialsCacheTime = Date.now();
                    resolve(true);
                } catch (error) {
                    console.error('❌ [ATProto] Failed to store credentials:', error);
                    throw error;
                }
            });
        });
        
        try {
            return await this._pendingCredentialsPromise;
        } finally {
            this._pendingCredentialsPromise = null;
        }
    }

    /**
     * Ensure we have write capability - either PDS session or stored credentials
     * Prompts for app password if needed
     * @returns {Promise<boolean>}
     */
    async ensureWriteCapability() {
        const session = this.getSession();
        if (!session) {
            throw new Error('No active session');
        }
        
        // PDS sessions have direct write access
        if (this.isPdsSession(session)) {
            return true;
        }
        
        // OAuth sessions need stored credentials for write operations
        const hasCredentials = await this.hasStoredCredentials();
        if (hasCredentials) {
            return true;
        }
        
        // Prompt for app password
        console.log('🔐 [ATProto] OAuth-only session, requesting app password for write access');
        return await this.requestAndStoreCredentials();
    }

    /**
     * Execute a write operation using server-side credentials
     * @param {string} action - The action to perform (like, unlike, repost, unrepost)
     * @param {Object} params - Action parameters
     * @returns {Promise<Object>}
     */
    async executeWithCredentials(action, params) {
        const session = this.getSession();
        const userDid = session.did || session.sub;
        const token = localStorage.getItem('oauth_token');
        
        const response = await fetch('/api/interactions/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                action,
                user_did: userDid,
                ...params
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to ${action}`);
        }
        
        return await response.json();
    }

    /**
     * Refresh PDS session token if expired
     */
    async refreshPdsToken(session) {
        if (!session || !session.accessJwt) {
            throw new Error('No PDS session to refresh');
        }

        try {
            console.log('🔄 [ATProto] Refreshing PDS token...');
            const pdsEndpoint = this.getPdsEndpoint(session);
            
            const response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.server.refreshSession`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.refreshJwt}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Token refresh failed:', response.status, errorText);
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            
            // Update the session in localStorage
            const updatedSession = {
                ...session,
                accessJwt: data.accessJwt,
                refreshJwt: data.refreshJwt
            };
            
            localStorage.setItem('pds_session', JSON.stringify(updatedSession));
            
            // Update oauth manager if available
            if (window.oauthManager && window.oauthManager.session) {
                window.oauthManager.session = updatedSession;
            }
            
            console.log('✅ [ATProto] PDS token refreshed successfully');
            return updatedSession;
        } catch (error) {
            console.error('❌ [ATProto] Token refresh error:', error);
            
            // If refresh fails, clear the session and prompt re-login
            localStorage.removeItem('pds_session');
            if (window.oauthManager) {
                window.oauthManager.session = null;
            }
            
            throw new Error('Session expired. Please log in again.');
        }
    }

    /**
     * Like a post
     * @param {string} uri - The post URI
     * @param {string} cid - The post CID
     * @returns {Promise<Object>} The created like record
     */
    async likePost(uri, cid) {
        let session = this.getSession();
        if (!session) {
            throw new Error('No active session');
        }

        try {
            if (this.isPdsSession(session)) {
                // PDS session - use direct API call with accessJwt
                const pdsEndpoint = this.getPdsEndpoint(session);
                let response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.accessJwt}`
                    },
                    body: JSON.stringify({
                        repo: session.did,
                        collection: 'app.bsky.feed.like',
                        record: {
                            subject: { uri, cid },
                            createdAt: new Date().toISOString()
                        }
                    })
                });

                // If token expired, refresh and retry
                if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.error === 'ExpiredToken') {
                        console.log('🔄 [ATProto] Token expired, refreshing...');
                        session = await this.refreshPdsToken(session);
                        
                        // Retry the request with new token
                        response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.accessJwt}`
                            },
                            body: JSON.stringify({
                                repo: session.did,
                                collection: 'app.bsky.feed.like',
                                record: {
                                    subject: { uri, cid },
                                    createdAt: new Date().toISOString()
                                }
                            })
                        });
                    } else {
                        throw new Error(`Failed to like post: ${response.status}`);
                    }
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Like API error:', response.status, errorText);
                    throw new Error(`Failed to like post: ${response.status}`);
                }

                return await response.json();
            } else {
                // OAuth session - use server-side credentials
                // First ensure we have write capability (prompts for app password if needed)
                await this.ensureWriteCapability();
                
                // Execute via server using stored credentials
                return await this.executeWithCredentials('like', { uri, cid });
            }
        } catch (error) {
            console.error('❌ Like error:', error);
            throw error;
        }
    }

    /**
     * Unlike a post
     * @param {string} uri - The post URI
     */
    async unlikePost(uri) {
        let session = this.getSession();
        if (!session) {
            throw new Error('No active session');
        }

        try {
            if (this.isPdsSession(session)) {
                // PDS session
                const pdsEndpoint = this.getPdsEndpoint(session);

                // Find the like record
                let listResponse = await fetch(
                    `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=app.bsky.feed.like&limit=100`,
                    {
                        headers: {
                            'Authorization': `Bearer ${session.accessJwt}`
                        }
                    }
                );

                // Handle token expiration
                if (listResponse.status === 400) {
                    const errorData = await listResponse.json();
                    if (errorData.error === 'ExpiredToken') {
                        session = await this.refreshPdsToken(session);
                        listResponse = await fetch(
                            `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=app.bsky.feed.like&limit=100`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${session.accessJwt}`
                                }
                            }
                        );
                    }
                }

                if (!listResponse.ok) {
                    const errorText = await listResponse.text();
                    console.error('List likes API error:', listResponse.status, errorText);
                    throw new Error('Failed to fetch likes');
                }

                const data = await listResponse.json();
                const likeRecord = data.records.find(r => r.value.subject.uri === uri);

                if (!likeRecord) {
                    console.warn('Like record not found');
                    return;
                }

                const rkey = likeRecord.uri.split('/').pop();

                // Delete the like record
                const deleteResponse = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.deleteRecord`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.accessJwt}`
                    },
                    body: JSON.stringify({
                        repo: session.did,
                        collection: 'app.bsky.feed.like',
                        rkey: rkey
                    })
                });

                if (!deleteResponse.ok) {
                    const errorText = await deleteResponse.text();
                    console.error('Delete like API error:', deleteResponse.status, errorText);
                    throw new Error(`Failed to unlike post: ${deleteResponse.status}`);
                }
            } else {
                // OAuth session - use server-side credentials
                await this.ensureWriteCapability();
                return await this.executeWithCredentials('unlike', { uri });
            }
        } catch (error) {
            console.error('❌ Unlike error:', error);
            throw error;
        }
    }

    /**
     * Repost a post
     * @param {string} uri - The post URI
     * @param {string} cid - The post CID
     * @returns {Promise<Object>} The created repost record
     */
    async repostPost(uri, cid) {
        let session = this.getSession();
        if (!session) {
            throw new Error('No active session');
        }

        try {
            if (this.isPdsSession(session)) {
                // PDS session
                const pdsEndpoint = this.getPdsEndpoint(session);
                let response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.accessJwt}`
                    },
                    body: JSON.stringify({
                        repo: session.did,
                        collection: 'app.bsky.feed.repost',
                        record: {
                            subject: { uri, cid },
                            createdAt: new Date().toISOString()
                        }
                    })
                });

                // Handle token expiration
                if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.error === 'ExpiredToken') {
                        session = await this.refreshPdsToken(session);
                        response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.accessJwt}`
                            },
                            body: JSON.stringify({
                                repo: session.did,
                                collection: 'app.bsky.feed.repost',
                                record: {
                                    subject: { uri, cid },
                                    createdAt: new Date().toISOString()
                                }
                            })
                        });
                    }
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Repost API error:', response.status, errorText);
                    throw new Error(`Failed to repost: ${response.status}`);
                }

                return await response.json();
            } else {
                // OAuth session - use server-side credentials
                await this.ensureWriteCapability();
                return await this.executeWithCredentials('repost', { uri, cid });
            }
        } catch (error) {
            console.error('❌ Repost error:', error);
            throw error;
        }
    }

    /**
     * Unrepost a post
     * @param {string} uri - The post URI
     */
    async unrepostPost(uri) {
        let session = this.getSession();
        if (!session) {
            throw new Error('No active session');
        }

        try {
            if (this.isPdsSession(session)) {
                // PDS session
                const pdsEndpoint = this.getPdsEndpoint(session);

                // Find the repost record
                let listResponse = await fetch(
                    `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=app.bsky.feed.repost&limit=100`,
                    {
                        headers: {
                            'Authorization': `Bearer ${session.accessJwt}`
                        }
                    }
                );

                // Handle token expiration
                if (listResponse.status === 400) {
                    const errorData = await listResponse.json();
                    if (errorData.error === 'ExpiredToken') {
                        session = await this.refreshPdsToken(session);
                        listResponse = await fetch(
                            `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=app.bsky.feed.repost&limit=100`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${session.accessJwt}`
                                }
                            }
                        );
                    }
                }

                if (!listResponse.ok) {
                    const errorText = await listResponse.text();
                    console.error('List reposts API error:', listResponse.status, errorText);
                    throw new Error('Failed to fetch reposts');
                }

                const data = await listResponse.json();
                const repostRecord = data.records.find(r => r.value.subject.uri === uri);

                if (!repostRecord) {
                    console.warn('Repost record not found');
                    return;
                }

                const rkey = repostRecord.uri.split('/').pop();

                // Delete the repost record
                const deleteResponse = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.deleteRecord`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.accessJwt}`
                    },
                    body: JSON.stringify({
                        repo: session.did,
                        collection: 'app.bsky.feed.repost',
                        rkey: rkey
                    })
                });

                if (!deleteResponse.ok) {
                    const errorText = await deleteResponse.text();
                    console.error('Delete repost API error:', deleteResponse.status, errorText);
                    throw new Error(`Failed to unrepost: ${deleteResponse.status}`);
                }
            } else {
                // OAuth session - use server-side credentials
                await this.ensureWriteCapability();
                return await this.executeWithCredentials('unrepost', { uri });
            }
        } catch (error) {
            console.error('❌ Unrepost error:', error);
            throw error;
        }
    }

    /**
     * Open composer for reply
     * @param {Object} replyData - Reply data with uri, cid, handle, displayName, text
     */
    openReplyComposer(replyData) {
        const { uri, cid, handle, displayName, text } = replyData;

        // Use the composer widget if available
        if (window.bskyComposer) {
            window.bskyComposer.show({
                replyTo: {
                    uri,
                    cid,
                    author: {
                        handle,
                        displayName
                    },
                    text
                }
            });
        } else if (window.ComposerWidget) {
            new window.ComposerWidget({
                mode: 'reply',
                replyTo: {
                    uri,
                    cid,
                    authorDisplayName: displayName,
                    postText: text
                },
                prefillText: `@${handle} `
            });
        } else {
            alert('Composer not available. Please use the Bluesky app to reply.');
        }
    }

    /**
     * Share a post (copy link to clipboard)
     * @param {string} postUrl - The post URL
     * @param {string} authorHandle - The author's handle
     */
    async sharePost(postUrl, authorHandle) {
        try {
            await navigator.clipboard.writeText(postUrl);
            alert(`Link copied to clipboard!\n\nPost by @${authorHandle}`);
        } catch (error) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = postUrl;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert(`Link copied to clipboard!\n\nPost by @${authorHandle}`);
            } catch (err) {
                alert(`Failed to copy link. Please copy manually:\n\n${postUrl}`);
            }
            document.body.removeChild(textArea);
        }
    }
}

// Create global instance
window.atprotoInteractions = new ATProtoInteractions();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ATProtoInteractions;
}
