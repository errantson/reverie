/**
 * AT Protocol Interactions Utility
 * 
 * Unified handlers for AT Protocol interactions (like, repost, reply)
 * that work with both OAuth sessions and PDS sessions.
 */

class ATProtoInteractions {
    constructor() {
        this.session = null;
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
     */
    isPdsSession(session) {
        return session && session.accessJwt && !session.sub;
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
                // OAuth session - use OAuth client's session.fetchHandler
                await window.oauthManager.ensureInitialized();
                const oauthSession = await window.oauthManager.client.restore(session.sub || session.did);
                const response = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repo: session.sub || session.did,
                        collection: 'app.bsky.feed.like',
                        record: {
                            subject: { uri, cid },
                            createdAt: new Date().toISOString()
                        }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Like API error:', response.status, errorText);
                    throw new Error(`Failed to like post: ${response.status}`);
                }

                return await response.json();
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
                // OAuth session
                await window.oauthManager.ensureInitialized();
                const oauthSession = await window.oauthManager.client.restore(session.sub || session.did);

                // Find the like record
                const listResponse = await oauthSession.fetchHandler(
                    `/xrpc/com.atproto.repo.listRecords?repo=${session.sub || session.did}&collection=app.bsky.feed.like&limit=100`,
                    { method: 'GET' }
                );

                if (!listResponse.ok) {
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
                const deleteResponse = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.deleteRecord', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repo: session.sub || session.did,
                        collection: 'app.bsky.feed.like',
                        rkey: rkey
                    })
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to unlike post');
                }
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
                // OAuth session
                await window.oauthManager.ensureInitialized();
                const oauthSession = await window.oauthManager.client.restore(session.sub || session.did);
                const response = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repo: session.sub || session.did,
                        collection: 'app.bsky.feed.repost',
                        record: {
                            subject: { uri, cid },
                            createdAt: new Date().toISOString()
                        }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Repost API error:', response.status, errorText);
                    throw new Error(`Failed to repost: ${response.status}`);
                }

                return await response.json();
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
                // OAuth session
                await window.oauthManager.ensureInitialized();
                const oauthSession = await window.oauthManager.client.restore(session.sub || session.did);

                // Find the repost record
                const listResponse = await oauthSession.fetchHandler(
                    `/xrpc/com.atproto.repo.listRecords?repo=${session.sub || session.did}&collection=app.bsky.feed.repost&limit=100`,
                    { method: 'GET' }
                );

                if (!listResponse.ok) {
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
                const deleteResponse = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.deleteRecord', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repo: session.sub || session.did,
                        collection: 'app.bsky.feed.repost',
                        rkey: rkey
                    })
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to unrepost');
                }
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
