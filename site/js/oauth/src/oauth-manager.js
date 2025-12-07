
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
                    handleResolver: 'https://bsky.social',
                })
                console.log('✅ OAuth client created')
                const result = await this.client.init()
                if (result) {
                    const { session, state } = result
                    this.currentSession = session
                    if (state != null) {
                        console.log(`✅ ${session.sub} authenticated (state: ${state})`)
                        await this.loadProfile(session)
                        await this.autoRegister(session.sub)
                        window.dispatchEvent(new CustomEvent('oauth:login', { 
                            detail: { session: this.currentSession } 
                        }))
                    } else {
                        console.log(`✅ ${session.sub} restored (previous session)`)
                        await this.loadProfile(session)
                        await this.autoRegister(session.sub)
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
                console.log('✅ OAuth manager initialized')
            } catch (error) {
                console.error('❌ OAuth init error:', error)
                throw error
            }
        })()
        return this.initPromise
    }

    async loadProfile(session) {
        console.log('🔍 loadProfile: Fetching public profile for', session.sub)
        try {
            // For reverie.house accounts, fetch from local database to avoid public API cache
            let profile;
            const isReverieAccount = session.sub.includes('reverie.house') || 
                                     (await this.checkIfReverieAccount(session.sub));
            
            if (isReverieAccount) {
                console.log('   🏠 Reverie.house account detected - fetching from local database')
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
                        console.log('   ✅ Profile loaded from database:', profile)
                    }
                }
            }
            
            // Fallback to public API if not found in database or not reverie account
            if (!profile) {
                const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${session.sub}`
                console.log('   Fetching from public API:', url)
                const response = await fetch(url)
                console.log('   Response status:', response.status)
                if (!response.ok) {
                    throw new Error(`Profile fetch failed: ${response.status}`)
                }
                profile = await response.json()
                console.log('   ✅ Profile data:', profile)
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
            console.log('✅ Profile loaded!')
            console.log('   Handle:', this.currentSession.handle)
            console.log('   Display Name:', this.currentSession.displayName)
            console.log('   Avatar:', this.currentSession.avatar)
            window.dispatchEvent(new CustomEvent('oauth:profile-loaded', { 
                detail: { session: this.currentSession } 
            }))
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
        // Quick check: reverie.house DIDs are served by our PDS
        try {
            const response = await fetch(`https://reverie.house/xrpc/com.atproto.identity.resolveHandle?handle=${did}`)
            return response.ok
        } catch {
            return false
        }
    }

    async login(handle, returnTo = null) {
        await this.ensureInitialized()
        console.log('🔐 Starting OAuth login for:', handle)
        handle = handle.trim().toLowerCase()
        if (handle.startsWith('@')) {
            handle = handle.substring(1)
        }
        
        // Determine return URL - use provided value, or check sessionStorage, or use current page, or default to /story
        let state = returnTo
        
        if (!state) {
            // Check if homepage has set a return destination
            const savedReturnTo = sessionStorage.getItem('oauth_return_to');
            if (savedReturnTo) {
                state = savedReturnTo;
                sessionStorage.removeItem('oauth_return_to');
                console.log('🏠 Using saved return destination:', state);
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
        
        console.log('🏠 Will return to:', state)
        
        try {
            await this.client.signIn(handle, {
                state: state,
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
                console.log('✅ Restored PDS session from localStorage:', pdsSession.handle)
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
        console.log('📝 Creating post:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))
        
        // Handle both old style (reply_to as string) and new style (custom record object)
        let reply_to = null;
        if (typeof customRecord === 'string') {
            // Old style: second param is reply_to URI
            reply_to = customRecord;
            customRecord = null;
        } else if (customRecord && customRecord.reply) {
            // New style but has reply in custom record
            console.log('   Reply detected in custom record')
        }
        
        if (reply_to) {
            console.log('   Reply to:', reply_to)
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
            console.log('   PDS endpoint:', pdsUrl)
            
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
                console.log('   Reply metadata added (parent CID:', parentCid + ')')
            }
            
            // Resolve DIDs for mentions in facets
            if (record.facets) {
                console.log('   Resolving DIDs for facets...')
                record.facets = await this._resolveFacetDIDs(record.facets)
            }
            
            const session = await this.client.restore(this.currentSession.sub)
            const createUrl = `/xrpc/com.atproto.repo.createRecord`
            const payload = {
                repo: this.currentSession.sub,
                collection: 'app.bsky.feed.post',
                record: record
            }
            console.log('   Creating record at:', pdsUrl + createUrl)
            const response = await session.fetchHandler(createUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })
            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Post creation failed (${response.status}): ${error}`)
            }
            const result = await response.json()
            console.log('✅ Post created:', result.uri)
            return {
                uri: result.uri,
                cid: result.cid
            }
        } catch (error) {
            console.error('❌ Failed to create post:', error)
            throw error
        }
    }
    
    async uploadBlob(blob, mimeType = 'image/png') {
        await this.ensureInitialized()
        if (!this.currentSession) {
            throw new Error('Not logged in')
        }
        
        console.log('📤 Uploading blob:', mimeType, blob.size, 'bytes')
        
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
            
            console.log('   Uploading to:', pdsUrl + uploadUrl)
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
            console.log('✅ Blob uploaded:', result.blob)
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
                            console.log(`   Resolved @${feature.did} to ${resolved}`)
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
            const response = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`)
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
                const plcUrl = `https://plc.directory/${did}`
                const response = await fetch(plcUrl)
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
            const publicUrl = `https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`
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

    async autoRegister(did) {
        try {
            console.log('🔄 OAuth Manager auto-register called for:', did)
            const payload = { did }
            if (this.currentSession?.profile) {
                payload.profile = this.currentSession.profile
                console.log('   Including profile data in payload')
            }
            console.log('   Calling /api/auto-register...')
            const response = await fetch('/api/auto-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            console.log(`   Response status: ${response.status}`)
            if (response.ok) {
                const result = await response.json()
                console.log('   Response data:', result)
                
                // Store auth token if provided
                if (result.token) {
                    localStorage.setItem('oauth_token', result.token)
                    console.log('🔐 OAuth token stored')
                }
                
                if (result.newly_registered) {
                    console.log('✨ Auto-registered new dreamer:', result.dreamer?.name || 'unnamed')
                } else if (result.already_registered) {
                    console.log('✅ Dreamer already registered')
                    if (result.dreamer?.has_name) {
                        console.log(`   Name: ${result.dreamer.name}`)
                    } else {
                        console.log('   No name claimed yet')
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
            console.log('⚠️ No session to logout')
            return
        }
        try {
            await this.ensureInitialized()
            // Only try to revoke OAuth sessions, not PDS sessions
            if (this.client && !localStorage.getItem('pds_session')) {
                await this.client.revoke(this.currentSession.sub)
            }
            console.log('✅ Logged out')
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
            
            console.log('🔄 Dispatching oauth:logout event...');
            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('oauth:logout'))
            
            // Force a full page reload to ensure clean state
            console.log('🔄 Forcing page reload after logout...');
            setTimeout(() => {
                window.location.reload()
            }, 100) // Small delay to allow logout event handlers to complete
        }
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
console.log('🔐 OAuth Manager (SDK) loaded')
