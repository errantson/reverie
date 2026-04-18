
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
class OAuthManager {
    constructor() {
        this.client = null
        this.currentSession = null
        this.initPromise = null
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise
        }
        this.initPromise = (async () => {
            try {
                this.client = new BrowserOAuthClient({
                    clientMetadata: {
                        client_id: "https://reverie.house/client-metadata.json",
                        client_name: "Reverie House",
                        client_uri: "https://reverie.house",
                        logo_uri: "https://reverie.house/assets/icon.png",
                        redirect_uris: ["https://reverie.house/oauth/callback"],
                        scope: "atproto transition:generic",
                        grant_types: ["authorization_code", "refresh_token"],
                        response_types: ["code"],
                        application_type: "web",
                        token_endpoint_auth_method: "none",
                        dpop_bound_access_tokens: true
                    },
                    handleResolver: 'https://reverie.house',
                })
                const result = await this.client.init()
                if (result) {
                    const { session, state } = result
                    this.currentSession = session
                    if (state != null) {
                        await this.loadProfile(session)
                        await this.autoRegister(session.sub)
                        // Dispatch profile-loaded AFTER autoRegister so oauth_token is available
                        window.dispatchEvent(new CustomEvent('oauth:profile-loaded', { 
                            detail: { session: this.currentSession } 
                        }))
                        window.dispatchEvent(new CustomEvent('oauth:login', { 
                            detail: { session: this.currentSession } 
                        }))
                        // Main Door login completed — sideDoorLogin flag cleared by login.js
                        if (localStorage.getItem('mainDoorLogin') === 'true') {
                            localStorage.removeItem('mainDoorLogin')
                        }
                    } else {
                        await this.loadProfile(session)
                        await this.autoRegister(session.sub)
                        // Dispatch profile-loaded AFTER autoRegister so oauth_token is available
                        window.dispatchEvent(new CustomEvent('oauth:profile-loaded', { 
                            detail: { session: this.currentSession } 
                        }))
                    }
                } else {
                    // No OAuth session - check for PDS session (app password login)
                    const pdsSessionStr = localStorage.getItem('pds_session')
                    if (pdsSessionStr) {
                        try {
                            const pdsSession = JSON.parse(pdsSessionStr)
                            if (pdsSession.did || pdsSession.sub) {
                                this.currentSession = pdsSession
                                // Refresh the backend token
                                await this.autoRegister(pdsSession.did || pdsSession.sub)
                                // Dispatch profile-loaded AFTER autoRegister so oauth_token is available
                                window.dispatchEvent(new CustomEvent('oauth:profile-loaded', { 
                                    detail: { session: this.currentSession } 
                                }))
                            }
                        } catch (e) {
                            console.error('❌ Failed to restore PDS session:', e)
                        }
                    }
                }
                this.client.addEventListener('deleted', (event) => {
                    const { sub, cause } = event.detail
                    console.error(`❌ Session for ${sub} deleted (cause: ${cause})`)
                    if (this.currentSession?.sub === sub) {
                        this.currentSession = null
                        window.dispatchEvent(new CustomEvent('oauth:logout', { 
                            detail: { sub, cause } 
                        }))
                    }
                })
            } catch (error) {
                // Suppress "user rejected" as it's not really an error
                const isUserCancel = error.message?.includes('rejected') || error.message?.includes('cancelled')
                if (!isUserCancel) {
                    console.error('❌ OAuth init error:', error)
                }
                throw error
            }
        })()
        return this.initPromise
    }

    async loadProfile(session) {
        try {
            // For reverie.house accounts, fetch from local database to avoid public API cache
            let profile;
            const isReverieAccount = session.sub.includes('reverie.house') || 
                                     (await this.checkIfReverieAccount(session.sub));
            
            if (isReverieAccount) {
                const dbResponse = await fetch(`/api/dreamers`)
                if (dbResponse.ok) {
                    const dreamers = await dbResponse.json()
                    const dreamer = dreamers.find(d => d.did === session.sub)
                    if (dreamer) {
                        profile = {
                            handle: dreamer.handle,
                            displayName: dreamer.display_name || dreamer.name,
                            description: dreamer.description,
                            avatar: dreamer.avatar,
                            banner: dreamer.banner,
                            followersCount: dreamer.followers_count,
                            followsCount: dreamer.follows_count,
                            postsCount: dreamer.posts_count,
                            createdAt: dreamer.created_at
                        }
                    }
                }
            }
            
            // Fallback to public API if not found in database or not reverie account
            if (!profile) {
                const url = `/bsky/xrpc/app.bsky.actor.getProfile?actor=${session.sub}`
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(`Profile fetch failed: ${response.status}`)
                }
                profile = await response.json()
            }
            this.currentSession = {
                ...session,
                handle: profile.handle,
                displayName: profile.displayName || profile.handle,
                avatar: profile.avatar,
                did: session.sub,
                profile: {
                    handle: profile.handle,
                    displayName: profile.displayName,
                    description: profile.description,
                    avatar: profile.avatar,
                    banner: profile.banner,
                    followersCount: profile.followersCount,
                    followsCount: profile.followsCount,
                    postsCount: profile.postsCount,
                    indexedAt: profile.indexedAt,
                    createdAt: profile.createdAt,
                    labels: profile.labels,
                }
            }
            // Note: oauth:profile-loaded is dispatched in init() AFTER autoRegister completes
        } catch (error) {
            console.error('❌ Profile fetch failed:', error.message)
            this.currentSession = {
                ...session,
                did: session.sub,
                handle: session.sub,
                displayName: session.sub,
                profile: null
            }
        }
    }

    async checkIfReverieAccount(did) {
        // Check if this DID's PDS is reverie.house
        try {
            const didDoc = await this._resolveDIDDocument(did)
            if (didDoc?.service) {
                const pds = didDoc.service.find(s => s.id === '#atproto_pds')
                return pds?.serviceEndpoint === 'https://reverie.house'
            }
            return false
        } catch {
            return false
        }
    }

    async login(handle, returnTo = null, options = {}) {
        await this.ensureInitialized()
        handle = handle.trim().toLowerCase()
        if (handle.startsWith('@')) {
            handle = handle.substring(1)
        }
        
        // Determine scope - Main Door gets full access, Side Door gets minimal
        const scope = options.scope || 'atproto transition:generic'
        
        // Determine return URL - use provided value, or check sessionStorage, or use current page, or default to /story
        let state = returnTo
        
        if (!state) {
            // Check if homepage has set a return destination
            const savedReturnTo = sessionStorage.getItem('oauth_return_to');
            if (savedReturnTo) {
                state = savedReturnTo;
                sessionStorage.removeItem('oauth_return_to');
            }
        }
        
        if (!state) {
            // Use current page if not homepage or login page
            const currentPath = window.location.pathname
            if (currentPath !== '/' && currentPath !== '/index.html' && !currentPath.includes('/oauth-callback')) {
                state = currentPath + window.location.search
            } else {
                state = '/story'
            }
        }
        
        
        try {
            await this.client.signIn(handle, {
                state: state,
                scope: scope,
            })
        } catch (error) {
            console.error('❌ OAuth login error:', error)
            if (error.message?.includes('back')) {
                throw new Error('Login cancelled')
            }
            throw error
        }
    }

    getSession() {
        // First check if we have an OAuth session
        if (this.currentSession) {
            return this.currentSession
        }
        
        // Check for PDS session stored by login.js
        try {
            const pdsSessionStr = localStorage.getItem('pds_session')
            if (pdsSessionStr) {
                const pdsSession = JSON.parse(pdsSessionStr)
                // Restore the PDS session to currentSession
                this.currentSession = pdsSession
                return this.currentSession
            }
        } catch (error) {
            console.error('❌ Error restoring PDS session:', error)
        }
        
        return null
    }

    async createPost(text, customRecord = null) {
        await this.ensureInitialized()
        if (!this.currentSession) {
            throw new Error('Not logged in')
        }
        
        // Handle both old style (reply_to as string) and new style (custom record object)
        let reply_to = null;
        if (typeof customRecord === 'string') {
            // Old style: second param is reply_to URI
            reply_to = customRecord;
            customRecord = null;
        } else if (customRecord && customRecord.reply) {
            // New style but has reply in custom record
        }
        
        if (reply_to) {
        }
        
        try {
            const didDoc = await this._resolveDIDDocument(this.currentSession.sub)
            if (!didDoc || !didDoc.service) {
                throw new Error('Could not resolve PDS endpoint')
            }
            const pdsService = didDoc.service.find(s => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer')
            if (!pdsService || !pdsService.serviceEndpoint) {
                throw new Error('No PDS service found in DID document')
            }
            const pdsUrl = pdsService.serviceEndpoint
            
            // Build record - merge custom record with defaults
            const record = {
                $type: 'app.bsky.feed.post',
                text: text,
                createdAt: new Date().toISOString(),
                ...(customRecord || {})
            }
            
            // Handle old-style reply_to parameter
            if (reply_to) {
                const parentCid = await this._getPostCID(reply_to, pdsUrl)
                if (!parentCid) {
                    throw new Error('Failed to fetch parent post CID')
                }
                record.reply = {
                    root: {
                        uri: reply_to,
                        cid: parentCid
                    },
                    parent: {
                        uri: reply_to,
                        cid: parentCid
                    }
                }
            }
            
            // Resolve DIDs for mentions in facets
            if (record.facets) {
                record.facets = await this._resolveFacetDIDs(record.facets)
            }
            
            // Check if this is a PDS session (has accessJwt) or OAuth-only session
            // PDS sessions can post directly, OAuth sessions need stored credentials
            const pdsSession = localStorage.getItem('pds_session');
            if (pdsSession) {
                // Use PDS session directly
                const session = JSON.parse(pdsSession);
                const createUrl = `${pdsUrl}/xrpc/com.atproto.repo.createRecord`;
                const payload = {
                    repo: session.did,
                    collection: 'app.bsky.feed.post',
                    record: record
                };
                const response = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.accessJwt}`
                    },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Post creation failed (${response.status}): ${error}`);
                }
                const result = await response.json();
                return {
                    uri: result.uri,
                    cid: result.cid
                };
            } else {
                // OAuth-only session - use server-side credentials
                
                // Check if we have stored credentials using OAuth-authenticated endpoint
                const authToken = localStorage.getItem('oauth_token');
                let hasCredentials = false;
                
                if (authToken) {
                    try {
                        const statusResponse = await fetch('/api/user/credentials/status', {
                            headers: { 'Authorization': `Bearer ${authToken}` }
                        });
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            hasCredentials = statusData.connected === true;
                        }
                    } catch (e) {
                        console.warn('Could not check credential status:', e);
                    }
                }
                
                if (!hasCredentials) {
                    // Prompt for app password
                    const credentialsStored = await this._requestCredentials();
                    if (!credentialsStored) {
                        throw new Error('App password required to post');
                    }
                }
                
                // Post via server-side API using stored credentials
                const token = localStorage.getItem('oauth_token');
                const postResponse = await fetch('/api/post/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        user_did: this.currentSession.sub || this.currentSession.did,
                        record: record
                    })
                });
                
                if (!postResponse.ok) {
                    const error = await postResponse.json();
                    throw new Error(error.error || `Post creation failed: ${postResponse.status}`);
                }
                
                const result = await postResponse.json();
                return {
                    uri: result.uri,
                    cid: result.cid
                };
            }
        } catch (error) {
            console.error('❌ Failed to create post:', error)
            throw error
        }
    }
    
    async _requestCredentials() {
        return new Promise((resolve) => {
            if (!window.appPasswordRequest) {
                console.error('❌ AppPasswordRequest widget not available');
                resolve(false);
                return;
            }
            
            window.appPasswordRequest.show({
                title: 'Connect Account',
                description: `<p>To post from Reverie House, we need permission to act on your behalf.</p>`,
                featureName: 'posting',
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
                    
                    resolve(true);
                } catch (error) {
                    console.error('❌ Failed to store credentials:', error);
                    throw error;
                }
            });
        });
    }
    
    async _promptForCredentials() {
        // Called after Main Door login to immediately prompt for credentials
        const session = this.getSession();
        if (!session) {
            console.warn('⚠️ No session for credential prompt');
            return;
        }
        
        // Check if already has credentials using OAuth-authenticated endpoint
        try {
            const token = localStorage.getItem('oauth_token');
            if (token) {
                const statusResp = await fetch('/api/user/credentials/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (statusResp.ok) {
                    const status = await statusResp.json();
                    if (status.connected) {
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('Could not check credential status:', e);
        }
        
        // Prompt for credentials
        try {
            await this._requestCredentials();
        } catch (error) {
            console.warn('⚠️ Credential prompt cancelled or failed:', error);
        }
    }
    
    async uploadBlob(blob, mimeType = 'image/png') {
        await this.ensureInitialized()
        if (!this.currentSession) {
            throw new Error('Not logged in')
        }
        
        
        try {
            const didDoc = await this._resolveDIDDocument(this.currentSession.sub)
            if (!didDoc || !didDoc.service) {
                throw new Error('Could not resolve PDS endpoint')
            }
            const pdsService = didDoc.service.find(s => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer')
            if (!pdsService || !pdsService.serviceEndpoint) {
                throw new Error('No PDS service found in DID document')
            }
            const pdsUrl = pdsService.serviceEndpoint
            
            const session = await this.client.restore(this.currentSession.sub)
            const uploadUrl = `/xrpc/com.atproto.repo.uploadBlob`
            
            const response = await session.fetchHandler(uploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': mimeType,
                },
                body: blob
            })
            
            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Blob upload failed (${response.status}): ${error}`)
            }
            
            const result = await response.json()
            return result
        } catch (error) {
            console.error('❌ Failed to upload blob:', error)
            throw error
        }
    }
    
    async _resolveFacetDIDs(facets) {
        // Resolve handles to DIDs in mention facets
        const resolvedFacets = []
        for (const facet of facets) {
            const resolvedFacet = { ...facet }
            for (const feature of facet.features) {
                if (feature.$type === 'app.bsky.richtext.facet#mention') {
                    // If the DID looks like a handle, resolve it
                    if (!feature.did.startsWith('did:')) {
                        try {
                            const resolved = await this._resolveHandle(feature.did)
                            feature.did = resolved
                        } catch (error) {
                            console.warn(`   Could not resolve handle ${feature.did}:`, error.message)
                        }
                    }
                }
            }
            resolvedFacets.push(resolvedFacet)
        }
        return resolvedFacets
    }
    
    async _resolveHandle(handle) {
        try {
            const response = await fetch(`/bsky/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`)
            if (response.ok) {
                const data = await response.json()
                return data.did
            }
            throw new Error(`Handle resolution failed: ${response.status}`)
        } catch (error) {
            console.error('Error resolving handle:', error)
            throw error
        }
    }

    async _resolveDIDDocument(did) {
        try {
            if (did.startsWith('did:plc:')) {
                const response = await fetch(`https://plc.directory/${did}`)
                if (response.ok) {
                    return await response.json()
                }
            } else if (did.startsWith('did:web:')) {
                const host = did.replace('did:web:', '').replace(/%3A/g, ':')
                const response = await fetch(`https://${host}/.well-known/did.json`)
                if (response.ok) {
                    return await response.json()
                }
            }
            throw new Error('Could not resolve DID document')
        } catch (error) {
            console.error('Error resolving DID:', error)
            throw error
        }
    }

    async _getPostCID(postUri, pdsUrl) {
        try {
            const uriParts = postUri.replace('at://', '').split('/')
            const repo = uriParts[0]
            const collection = uriParts.slice(1, -1).join('/')
            const rkey = uriParts[uriParts.length - 1]
            const getRecordUrl = `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`
            const response = await fetch(getRecordUrl)
            if (response.ok) {
                const data = await response.json()
                return data.cid
            }
            const publicUrl = `/bsky/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`
            const publicResponse = await fetch(publicUrl)
            if (publicResponse.ok) {
                const data = await publicResponse.json()
                return data.cid
            }
            throw new Error('Could not fetch post CID')
        } catch (error) {
            console.error('Error getting post CID:', error)
            return null
        }
    }

    /**
     * Generic createRecord — writes any AT Proto record to the user's PDS.
     * Supports both OAuth DPoP sessions and PDS app-password sessions.
     * @param {string} collection - e.g. 'farm.lore.content'
     * @param {object} record - Record fields (without $type, added automatically)
     * @param {string} [rkey] - Optional record key
     * @returns {{ uri: string, cid: string }}
     */
    async createRecord(collection, record, rkey) {
        await this.ensureInitialized();
        if (!this.currentSession) {
            throw new Error('Not logged in');
        }

        const did = this.currentSession.sub || this.currentSession.did;
        const payload = {
            repo: did,
            collection,
            record: { $type: collection, ...record },
        };
        if (rkey) payload.rkey = rkey;

        // Check for PDS session (app password) first
        const pdsSession = localStorage.getItem('pds_session');
        if (pdsSession) {
            const session = JSON.parse(pdsSession);
            const didDoc = await this._resolveDIDDocument(did);
            const pdsService = didDoc?.service?.find(s => s.id === '#atproto_pds');
            const pdsUrl = pdsService?.serviceEndpoint;
            if (!pdsUrl) throw new Error('Could not resolve PDS endpoint');

            const response = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.accessJwt}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`createRecord failed (${response.status}): ${error}`);
            }

            const result = await response.json();
            return { uri: result.uri, cid: result.cid };
        }

        // OAuth DPoP session
        try {
            const session = await this.client.restore(did);
            const response = await session.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`createRecord failed (${response.status}): ${error}`);
            }

            const result = await response.json();
            return { uri: result.uri, cid: result.cid };
        } catch (error) {
            if (error.message?.includes('deleted') || error.message?.includes('expired')) {
                this.currentSession = null;
                window.dispatchEvent(new CustomEvent('oauth:logout', {
                    detail: { sub: did, cause: error.message }
                }));
                throw new Error('Your session has expired. Please log in again.');
            }
            throw error;
        }
    }

    /**
     * Generic deleteRecord — removes a record from the user's PDS.
     * Supports both OAuth DPoP sessions and PDS app-password sessions.
     * @param {string} collection - e.g. 'farm.lore.character'
     * @param {string} rkey - The record key to delete
     */
    async deleteRecord(collection, rkey) {
        await this.ensureInitialized();
        if (!this.currentSession) {
            throw new Error('Not logged in');
        }

        const did = this.currentSession.sub || this.currentSession.did;

        // Check for PDS session (app password) first
        const pdsSession = localStorage.getItem('pds_session');
        if (pdsSession) {
            const session = JSON.parse(pdsSession);
            const didDoc = await this._resolveDIDDocument(did);
            const pdsService = didDoc?.service?.find(s => s.id === '#atproto_pds');
            const pdsUrl = pdsService?.serviceEndpoint;
            if (!pdsUrl) throw new Error('Could not resolve PDS endpoint');

            const response = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.accessJwt}`,
                },
                body: JSON.stringify({ repo: did, collection, rkey }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`deleteRecord failed (${response.status}): ${error}`);
            }

            return;
        }

        // OAuth DPoP session
        try {
            const session = await this.client.restore(did);
            const response = await session.fetchHandler('/xrpc/com.atproto.repo.deleteRecord', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo: did, collection, rkey }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`deleteRecord failed (${response.status}): ${error}`);
            }

        } catch (error) {
            if (error.message?.includes('deleted') || error.message?.includes('expired')) {
                this.currentSession = null;
                window.dispatchEvent(new CustomEvent('oauth:logout', {
                    detail: { sub: did, cause: error.message }
                }));
                throw new Error('Your session has expired. Please log in again.');
            }
            throw error;
        }
    }

    async autoRegister(did) {
        try {
            const payload = { did }
            if (this.currentSession?.profile) {
                payload.profile = this.currentSession.profile
            }
            const response = await fetch('/api/auto-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            if (response.ok) {
                const result = await response.json()
                
                // Store auth token if provided
                if (result.token) {
                    localStorage.setItem('oauth_token', result.token)
                }
                
                if (result.newly_registered) {
                } else if (result.already_registered) {
                    if (result.dreamer?.has_name) {
                    } else {
                    }
                }
            } else {
                const errorText = await response.text()
                console.error('❌ Auto-register failed:', response.status, errorText)
            }
        } catch (error) {
            console.error('❌ Error auto-registering:', error)
            console.error('   Stack:', error.stack)
        }
    }

    async logout() {
        if (!this.currentSession) {
            return
        }
        try {
            await this.ensureInitialized()
            // Only try to revoke OAuth sessions, not PDS sessions
            if (this.client && !localStorage.getItem('pds_session')) {
                await this.client.revoke(this.currentSession.sub)
            }
        } catch (error) {
            console.error('❌ Logout error:', error)
            // Continue with cleanup even if revoke fails
        } finally {
            // Clear session
            this.currentSession = null
            
            // Clear all auth tokens and session data
            localStorage.removeItem('oauth_token')
            localStorage.removeItem('admin_token')
            localStorage.removeItem('pds_session')  // Also clear PDS session
            localStorage.removeItem('BSKY_AGENT(sub)')  // Also clear PDS agent sub
            sessionStorage.removeItem('admin_session')
            sessionStorage.clear()
            
            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('oauth:logout'))
            
            // Force a full page reload to ensure clean state
            setTimeout(() => {
                window.location.reload()
            }, 100) // Small delay to allow logout event handlers to complete
        }
    }

    /**
     * Upgrade a Side Door session to Main Door by logging out and
     * immediately re-initiating OAuth with full scope.
     * The user is seamlessly redirected to authorize with write access.
     */
    async upgradeToMainDoor() {
        const handle = this.currentSession?.handle || this.currentSession?.sub
        if (!handle) {
            console.warn('⚠️ No session to upgrade')
            return
        }

        try {
            await this.ensureInitialized()
            // Revoke the existing read-only session
            if (this.client && !localStorage.getItem('pds_session')) {
                await this.client.revoke(this.currentSession.sub)
            }
        } catch (error) {
            console.error('⚠️ Revoke during upgrade failed (continuing):', error)
        }

        // Clear session state
        this.currentSession = null
        localStorage.removeItem('oauth_token')
        localStorage.removeItem('admin_token')
        localStorage.removeItem('BSKY_AGENT(sub)')
        sessionStorage.removeItem('admin_session')

        // Set flags for Main Door re-login
        localStorage.setItem('mainDoorLogin', 'true')
        localStorage.removeItem('sideDoorLogin')

        // Immediately re-initiate OAuth with full scope — redirects the browser
        await this.login(handle, null, { scope: 'atproto transition:generic' })
    }

    async ensureInitialized() {
        if (!this.client) {
            await this.init()
        }
    }
}
const oauthManager = new OAuthManager()
oauthManager.init().catch(error => {
    console.error('Failed to initialize OAuth:', error)
})
export default oauthManager
window.oauthManager = oauthManager
