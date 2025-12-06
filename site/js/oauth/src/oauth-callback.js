
import oauthManager from './oauth-manager.js'
(async () => {
    const statusEl = document.getElementById('status')
    const errorEl = document.getElementById('error')
    function setStatus(message) {
        if (statusEl) statusEl.textContent = message
        console.log('OAuth Callback:', message)
    }
    function setError(message) {
        if (errorEl) errorEl.textContent = message
        console.error('OAuth Callback Error:', message)
    }
    try {
        setStatus('Processing authorization...')
        await oauthManager.init()
        const session = oauthManager.getSession()
        if (session) {
            setStatus('Login successful! Redirecting...')
            const params = new URLSearchParams(window.location.search)
            const state = params.get('state')
            const returnTo = state || '/story'
            console.log('🏠 Redirecting to:', returnTo)
            setTimeout(() => {
                window.location.href = returnTo
            }, 500)
        } else {
            setError('No session created')
            setTimeout(() => {
                window.location.href = '/'
            }, 2000)
        }
    } catch (error) {
        console.error('Callback error:', error)
        setError(`Login failed: ${error.message}`)
        setTimeout(() => {
            window.location.href = '/'
        }, 3000)
    }
})()
