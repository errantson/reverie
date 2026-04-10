/**
 * Auth Gate Utility
 * Shared helpers for Side Door detection and write-access gating.
 * Provides a unified upgrade prompt across the entire site.
 */

if (!window.AuthGate) {

class AuthGate {
    /**
     * Check if the current user is a Side Door (read-only) user.
     * @returns {boolean}
     */
    static isSideDoorUser() {
        if (localStorage.getItem('pds_session')) return false;
        if (localStorage.getItem('mainDoorLogin') === 'true') return false;
        return localStorage.getItem('sideDoorLogin') === 'true';
    }

    /**
     * Require write access before proceeding. Returns true if the user
     * already has write access or successfully obtains it via credential prompt.
     * Returns false if the user cancels or is not logged in.
     *
     * @param {Object} [options]
     * @param {string} [options.feature] - Human-readable feature name for the prompt
     * @returns {Promise<boolean>}
     */
    static async requireWriteAccess(options = {}) {
        if (!this.isSideDoorUser()) return true;

        // Show the upgrade modal and wait for user decision
        const accepted = await this.showUpgradeModal(options.feature);
        if (!accepted) return false;

        // User chose to log in — upgrade via OAuth
        if (window.oauthManager?.upgradeToMainDoor) {
            await window.oauthManager.upgradeToMainDoor();
            // Redirects the browser, won't reach here unless something failed
        }

        return false;
    }

    /**
     * Show a modal explaining that the feature requires full login,
     * with Close and Login buttons.
     * @param {string} [featureName] - Human-readable feature name
     * @returns {Promise<boolean>} true if user chose to log in
     */
    static showUpgradeModal(featureName) {
        return new Promise((resolve) => {
            // Remove any existing modal
            const existing = document.querySelector('.auth-gate-modal-overlay');
            if (existing) existing.remove();

            const safeName = featureName
                ? featureName.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'})[c])
                : '';

            const overlay = document.createElement('div');
            overlay.className = 'auth-gate-modal-overlay';
            overlay.innerHTML = `
                <div class="auth-gate-modal">
                    <svg class="auth-gate-modal-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <h3 class="auth-gate-modal-title">${safeName ? `${safeName} requires full access` : 'Full access required'}</h3>
                    <p class="auth-gate-modal-text">You logged in with read-only access. To use this feature, you need to log in again with full permissions.</p>
                    <div class="auth-gate-modal-buttons">
                        <button class="auth-gate-modal-close">Close</button>
                        <button class="auth-gate-modal-login">Log in</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            const close = (accepted) => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 200);
                resolve(accepted);
            };

            overlay.querySelector('.auth-gate-modal-close').addEventListener('click', () => close(false));
            overlay.querySelector('.auth-gate-modal-login').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    }

    /**
     * Show a brief tooltip/toast explaining why a feature is locked,
     * with a prompt to upgrade. Used for visual-only gating (disabled tabs etc).
     * @param {HTMLElement} target - The element near which to show the prompt
     * @param {string} [featureName] - What the user was trying to do
     */
    static showUpgradeHint(target, featureName) {
        // For hints, just show the full modal instead of a tiny tooltip
        this.showUpgradeModal(featureName).then(accepted => {
            if (accepted && window.oauthManager?.upgradeToMainDoor) {
                window.oauthManager.upgradeToMainDoor();
            }
        });
    }
}

window.AuthGate = AuthGate;

// Convenience alias
window.isSideDoorUser = () => AuthGate.isSideDoorUser();
window.requireWriteAccess = (opts) => AuthGate.requireWriteAccess(opts);


} // end if (!window.AuthGate)
