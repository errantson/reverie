
import oauthManager from './oauth-manager.js'
(async () => {
    const statusEl = document.getElementById('status')
    const errorEl = document.getElementById('error')
    
    function setStatus(message) {
        if (statusEl) statusEl.textContent = message
    }
    
    function setError(message, isUserAction = false) {
        if (errorEl) {
            errorEl.textContent = message
            errorEl.classList.remove('hidden')
        }
        // Only log unexpected errors, not user-initiated cancellations
        if (!isUserAction) {
            console.warn('OAuth callback:', message)
        }
    }
    
    try {
        await oauthManager.init()
        const session = oauthManager.getSession()
        
        if (session) {
            // Immediate redirect - no delay
            const params = new URLSearchParams(window.location.search)
            const state = params.get('state')
            const returnTo = state || '/story'
            window.location.replace(returnTo)
        } else {
            // User cancelled - not an error, just a choice
            setError('Login was cancelled', true)
            setTimeout(() => window.location.replace('/'), 1500)
        }
    } catch (error) {
        // User-friendly error messages
        let msg = error.message || 'Login failed'
        const isUserCancel = msg.includes('rejected') || msg.includes('cancelled')
        if (isUserCancel) {
            msg = 'Login was cancelled'
        }
        setError(msg, isUserCancel)
        setTimeout(() => window.location.replace('/'), 1500)
    }
})()
