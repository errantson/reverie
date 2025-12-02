/**
 * Messager - Rotating message system for header
 * Manages a rotating set of messages with fade transitions
 */

class Messager {
    constructor(containerId = 'header-message-display') {
        this.containerId = containerId;
        this.container = null;
        this.messages = [];
        this.currentIndex = 0;
        this.rotationInterval = null;
        this.rotationDuration = 8000; // 8 seconds per message
        this.fadeDuration = 800; // 800ms fade transition
        this.isRotating = false;
        
        // Default messages
        this.defaultMessages = [
            'Welcome to Reverie House',
            'Supported by reading',
            'Dreams preserved through collective service',
            'Join our wild mindscape',
            'Every dreamer matters'
        ];
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.warn('Messager: Container not found:', this.containerId);
            return;
        }
        
        // Start with default messages
        this.messages = [...this.defaultMessages];
        
        // Load custom messages if available
        this.loadCustomMessages();
        
        console.log('✉️ Messager initialized with', this.messages.length, 'messages');
    }
    
    async loadCustomMessages() {
        try {
            // Try to load messages from world API or config
            const response = await fetch('/api/world');
            if (response.ok) {
                const data = await response.json();
                if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
                    // Use messages from world data
                    this.messages = data.messages.map(m => m.text || m);
                    console.log('✉️ Loaded custom messages from world data');
                }
            }
        } catch (error) {
            console.warn('Messager: Could not load custom messages, using defaults');
        }
    }
    
    start() {
        if (this.isRotating) return;
        
        this.isRotating = true;
        this.currentIndex = 0;
        this.showMessage(this.currentIndex);
        
        // Start rotation interval
        this.rotationInterval = setInterval(() => {
            this.rotateToNext();
        }, this.rotationDuration);
        
        console.log('✉️ Messager rotation started');
    }
    
    stop() {
        if (!this.isRotating) return;
        
        this.isRotating = false;
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
        }
        
        // Fade out current message
        if (this.container) {
            this.container.style.opacity = '0';
            this.container.style.transform = 'translateY(-10px)';
        }
        
        console.log('✉️ Messager rotation stopped');
    }
    
    rotateToNext() {
        if (!this.container || this.messages.length === 0) return;
        
        // Fade out current message
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateY(-10px)';
        
        // After fade out, update to next message
        setTimeout(() => {
            this.currentIndex = (this.currentIndex + 1) % this.messages.length;
            this.showMessage(this.currentIndex);
        }, this.fadeDuration);
    }
    
    showMessage(index) {
        if (!this.container || !this.messages[index]) return;
        
        this.container.textContent = this.messages[index];
        
        // Trigger reflow for transition
        void this.container.offsetWidth;
        
        // Fade in
        this.container.style.opacity = '1';
        this.container.style.transform = 'translateY(0)';
    }
    
    setMessages(newMessages) {
        if (!Array.isArray(newMessages) || newMessages.length === 0) {
            console.warn('Messager: Invalid messages provided');
            return;
        }
        
        this.messages = newMessages;
        
        // Restart rotation if currently rotating
        if (this.isRotating) {
            this.stop();
            this.start();
        }
        
        console.log('✉️ Messager messages updated:', this.messages.length);
    }
    
    addMessage(message) {
        if (!message) return;
        this.messages.push(message);
        console.log('✉️ Message added:', message);
    }
    
    showTemporary(message, duration = 5000) {
        if (!this.container || !message) return;
        
        // Pause rotation
        const wasRotating = this.isRotating;
        if (wasRotating) {
            this.stop();
        }
        
        // Show temporary message
        this.container.textContent = message;
        this.container.style.opacity = '1';
        this.container.style.transform = 'translateY(0)';
        
        // Resume rotation after duration
        setTimeout(() => {
            if (wasRotating) {
                this.start();
            }
        }, duration);
    }
    
    getCurrentMessage() {
        return this.messages[this.currentIndex] || '';
    }
    
    destroy() {
        this.stop();
        this.messages = [];
        this.container = null;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for header to render
    setTimeout(() => {
        window.messager = new Messager('header-message-display');
        
        // Start rotation after initialization
        if (window.messager.container) {
            window.messager.start();
        }
    }, 500);
});

// Export
window.Messager = Messager;
