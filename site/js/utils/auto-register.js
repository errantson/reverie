
class AutoRegister {
    constructor() {
        this.registrationEndpoint = '/api/register';
        this.checkInterval = null;
    }

    async init() {
        console.log('🎫 Auto-registration module initializing...');
        if (!window.oauthManager) {
            console.log('⏳ Waiting for OAuth manager...');
            setTimeout(() => this.init(), 100);
            return;
        }
        window.addEventListener('oauth:login', async (e) => {
            console.log('🎭 Fresh OAuth login detected');
            const session = e.detail?.session || window.oauthManager.getSession();
            if (session) {
                await this.checkAndRegister(session, true);
            }
        });
        window.addEventListener('oauth:profile-loaded', async (e) => {
            console.log('👤 Profile loaded (restored session)');
            const session = window.oauthManager.getSession();
            if (session) {
                await this.checkAndRegister(session, false);
            }
        });
        console.log('✅ Auto-registration listeners installed');
    }

    async checkAndRegister(session, shouldRedirect = false, retryCount = 0) {
        const maxRetries = 3;
        const retryDelays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
        
        try {
            const did = session.did || session.sub;
            const handle = session.handle || 'unknown';
            
            if (retryCount === 0) {
                console.log(`🎫 Auto-register utility: Checking registration for @${handle}`);
                console.log(`   DID: ${did}`);
                console.log(`   Should redirect: ${shouldRedirect}`);
            } else {
                console.log(`🔄 Retry attempt ${retryCount}/${maxRetries} for @${handle}`);
            }
            
            console.log(`   Calling ${this.registrationEndpoint}...`);
            const response = await fetch(this.registrationEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ did })
            });
            console.log(`   Response status: ${response.status}`);
            
            if (!response.ok) {
                const error = await response.text();
                
                // Check if this is a profile fetch error and we can retry
                if (response.status === 500 && retryCount < maxRetries) {
                    let errorData;
                    try {
                        errorData = JSON.parse(error);
                    } catch (e) {
                        errorData = { error };
                    }
                    
                    // If it's a "Could not fetch profile" error, retry with delay
                    if (typeof errorData.error === 'string' && 
                        errorData.error.toLowerCase().includes('could not fetch profile')) {
                        const delay = retryDelays[retryCount];
                        console.log(`⏳ Profile not ready yet, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return this.checkAndRegister(session, shouldRedirect, retryCount + 1);
                    }
                }
                
                console.error('❌ Registration failed:', error);
                return;
            }
            
            const result = await response.json();
            console.log('   Response data:', result);
            
            if (result.success) {
                const dreamerName = result.dreamer.name;
                if (result.message === 'Already registered') {
                    console.log(`✅ Welcome back, ${dreamerName}!`);
                } else {
                    console.log(`🎉 Welcome to Reverie, ${dreamerName}!`);
                    console.log(`   Your subdomain: ${dreamerName}.reverie.house`);
                    window.dispatchEvent(new CustomEvent('dreamer:registered', {
                        detail: result.dreamer
                    }));
                }
                if (shouldRedirect) {
                    console.log(`   Redirecting to /dreamer?name=${dreamerName}`);
                    window.location.href = `/dreamer?name=${dreamerName}`;
                }
            }
        } catch (error) {
            console.error('❌ Auto-registration error:', error);
            console.error('   Error details:', error.message);
            console.error('   Stack:', error.stack);
        }
    }
}
window.autoRegister = new AutoRegister();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.autoRegister.init();
    });
} else {
    window.autoRegister.init();
}
console.log('🎫 Auto-registration module loaded');
