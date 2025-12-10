/**
 * Souvenirs Page Widget
 * Handles souvenirs page specific functionality including background
 */

class SouvenirsPage {
    constructor() {
        this.initialized = false;
        this.souvenirKey = null;
        this.currentSouvenir = null;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        console.log('🎁 [SouvenirsPage] Initializing...');

        // Get souvenir key from URL
        const params = new URLSearchParams(window.location.search);
        this.souvenirKey = params.get('key') || 'residence';

        // Load souvenir data to get phanera
        await this.loadSouvenirData();

        // Initialize background system with souvenir's phanera
        if (typeof Background !== 'undefined' && this.currentSouvenir) {
            console.log('🎁 [SouvenirsPage] Background class found, creating instance...');
            const phaneraUrl = this.currentSouvenir.phanera || 'souvenirs/residence/phanera.png';
            window.background = new Background('static', { phaneraUrl: phaneraUrl });
            console.log('🎁 [SouvenirsPage] Background instance created with phanera:', phaneraUrl);
            await window.background.init();
            console.log('🎁 [SouvenirsPage] Background initialized successfully');
        } else {
            console.warn('🎁 [SouvenirsPage] Background class not available or souvenir not loaded');
        }
    }

    async loadSouvenirData() {
        console.log('🎁 [SouvenirsPage] Loading souvenir data for key:', this.souvenirKey);
        try {
            const response = await fetch('/api/souvenirs');
            const allSouvenirs = await response.json();
            
            if (allSouvenirs[this.souvenirKey]) {
                this.currentSouvenir = allSouvenirs[this.souvenirKey];
                console.log('🎁 [SouvenirsPage] Loaded souvenir:', this.currentSouvenir.name);
            } else {
                console.error('❌ [SouvenirsPage] Souvenir not found:', this.souvenirKey);
                // Fallback to residence
                this.currentSouvenir = { phanera: 'souvenirs/residence/phanera.png' };
            }
        } catch (error) {
            console.error('❌ [SouvenirsPage] Error loading souvenirs:', error);
            // Fallback to residence
            this.currentSouvenir = { phanera: 'souvenirs/residence/phanera.png' };
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.souvenirsPage = new SouvenirsPage();
    window.souvenirsPage.init();
});

console.log('✅ [souvenirs.js] Souvenirs page widget loaded');