/**
 * OrientationHandler - Universal orientation and viewport change detector
 * Handles device rotation and ensures UI elements remain properly positioned and sized
 */

class OrientationHandler {
    constructor() {
        this.callbacks = new Set();
        this.lastOrientation = this.getOrientation();
        this.lastViewportWidth = window.innerWidth;
        this.lastViewportHeight = window.innerHeight;
        this.debounceTimer = null;
        
        this.init();
    }

    init() {
        // Listen to standard orientation change event
        window.addEventListener('orientationchange', () => {
            this.handleOrientationChange();
        });

        // Listen to modern Screen Orientation API if available
        if (screen.orientation) {
            screen.orientation.addEventListener('change', () => {
                this.handleOrientationChange();
            });
        }

        // Listen to resize events as a fallback
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Listen to visual viewport changes (handles mobile browser chrome)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                this.handleViewportChange();
            });
        }
    }

    getOrientation() {
        // Check multiple sources for orientation
        if (screen.orientation) {
            return screen.orientation.type;
        }
        if (window.orientation !== undefined) {
            return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
        }
        return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }

    handleOrientationChange() {
        // Clear any pending debounce
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Wait for the orientation change to complete
        this.debounceTimer = setTimeout(() => {
            const newOrientation = this.getOrientation();
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;

            // Only trigger if there's an actual change
            if (newOrientation !== this.lastOrientation || 
                newWidth !== this.lastViewportWidth || 
                newHeight !== this.lastViewportHeight) {
                
                this.lastOrientation = newOrientation;
                this.lastViewportWidth = newWidth;
                this.lastViewportHeight = newHeight;

                this.notifyCallbacks({
                    type: 'orientation',
                    orientation: newOrientation,
                    width: newWidth,
                    height: newHeight
                });
            }
        }, 200);
    }

    handleResize() {
        // Clear any pending debounce
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce resize events
        this.debounceTimer = setTimeout(() => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            const newOrientation = this.getOrientation();

            // Check if this is a significant resize (not just address bar hide/show)
            const widthChange = Math.abs(newWidth - this.lastViewportWidth);
            const heightChange = Math.abs(newHeight - this.lastViewportHeight);
            const isSignificantChange = widthChange > 50 || heightChange > 100;

            if (isSignificantChange || newOrientation !== this.lastOrientation) {
                this.lastOrientation = newOrientation;
                this.lastViewportWidth = newWidth;
                this.lastViewportHeight = newHeight;

                this.notifyCallbacks({
                    type: 'resize',
                    orientation: newOrientation,
                    width: newWidth,
                    height: newHeight
                });
            }
        }, 100);
    }

    handleViewportChange() {
        // Handle visual viewport changes (mobile browser chrome)
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;

            if (newWidth !== this.lastViewportWidth || newHeight !== this.lastViewportHeight) {
                this.lastViewportWidth = newWidth;
                this.lastViewportHeight = newHeight;

                this.notifyCallbacks({
                    type: 'viewport',
                    orientation: this.getOrientation(),
                    width: newWidth,
                    height: newHeight
                });
            }
        }, 150);
    }

    notifyCallbacks(data) {
        this.callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('OrientationHandler callback error:', error);
            }
        });
    }

    /**
     * Register a callback to be notified of orientation/viewport changes
     * @param {Function} callback - Function to call when orientation changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        this.callbacks.add(callback);

        // Return unsubscribe function
        return () => {
            this.callbacks.delete(callback);
        };
    }

    /**
     * Get current device info
     */
    getDeviceInfo() {
        return {
            orientation: this.getOrientation(),
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: this.isMobile(),
            isPortrait: this.isPortrait(),
            isLandscape: this.isLandscape()
        };
    }

    isMobile() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        return width <= 768 || height <= 768;
    }

    isPortrait() {
        return window.innerHeight > window.innerWidth;
    }

    isLandscape() {
        return window.innerWidth > window.innerHeight;
    }
}

// Create singleton instance
if (typeof window !== 'undefined') {
    window.orientationHandler = new OrientationHandler();
}
