/**
 * {{DREAM_TITLE}} - Main Dream Logic
 */

import { DreamRuntime } from '../../_shared/js/dream-runtime.js';

class {{DREAM_CLASS}} {
    constructor() {
        this.runtime = new DreamRuntime({
            dreamId: '{{DREAM_ID}}',
            requireAuth: false,
            dataPermissions: ['read:spectrum', 'write:canon']
        });
        
        this.userData = null;
    }
    
    async initialize() {
        console.log('🌙 Initializing {{DREAM_ID}} dream...');
        
        await this.runtime.init();
        
        // Load user data if authenticated
        if (this.runtime.isAuthenticated()) {
            this.userData = await this.runtime.getUserData();
            console.log('👤 User authenticated:', this.userData.name);
        }
        
        // Setup dream experience
        this.setupDream();
        
        console.log('✅ {{DREAM_ID}} ready');
    }
    
    setupDream() {
        // Your dream setup logic here
        console.log('Setting up dream experience...');
        
        // Example: Create interactive element
        const canvas = document.getElementById('interactive-canvas');
        const button = document.createElement('button');
        button.textContent = 'Begin';
        button.className = 'dream-action-btn';
        button.style.position = 'absolute';
        button.style.top = '50%';
        button.style.left = '50%';
        button.style.transform = 'translate(-50%, -50%)';
        button.addEventListener('click', () => this.begin());
        canvas.appendChild(button);
    }
    
    async begin() {
        console.log('Dream beginning...');
        
        // Write to canon
        if (this.userData) {
            await this.runtime.writeCanon({
                event: 'entered the {{DREAM_ID}} dream',
                context: { dreamId: '{{DREAM_ID}}' }
            });
        }
        
        // Emit event for quest system
        this.runtime.emitEvent('entered', { timestamp: Date.now() });
        
        // Your dream logic continues...
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.dream = new {{DREAM_CLASS}}();
    await window.dream.initialize();
});

export default {{DREAM_CLASS}};
