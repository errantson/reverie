/**
 * Client-side error tracking for Reverie House
 * Automatically captures JavaScript errors and sends them to the server
 */

(function() {
    'use strict';

    const ERROR_ENDPOINT = '/api/admin/errors/client';
    const MAX_ERRORS_PER_SESSION = 50;
    let errorCount = 0;

    // Track if we've already logged this specific error to avoid duplicates
    const loggedErrors = new Set();

    /**
     * Send error to server
     */
    function logError(errorData) {
        // Rate limiting
        if (errorCount >= MAX_ERRORS_PER_SESSION) {
            console.warn('Error tracking limit reached for this session');
            return;
        }

        // Deduplication
        const errorKey = `${errorData.type}:${errorData.message}:${errorData.url}:${errorData.lineNumber}`;
        if (loggedErrors.has(errorKey)) {
            return; // Already logged this error
        }

        loggedErrors.add(errorKey);
        errorCount++;

        // Send to server (don't block or throw errors)
        try {
            fetch(ERROR_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`
                },
                body: JSON.stringify(errorData),
                // Use keepalive to ensure the request completes even if page unloads
                keepalive: true
            }).catch(err => {
                // Silently fail - we don't want error tracking to cause more errors
                console.debug('Failed to log error to server:', err);
            });
        } catch (e) {
            // Silently fail
            console.debug('Error tracking failed:', e);
        }
    }

    /**
     * Handle uncaught JavaScript errors
     */
    window.addEventListener('error', function(event) {
        const errorData = {
            type: event.error?.name || 'Error',
            message: event.message || event.error?.message || 'Unknown error',
            stack: event.error?.stack,
            url: event.filename || window.location.href,
            lineNumber: event.lineno,
            columnNumber: event.colno,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            pageUrl: window.location.href
        };

        logError(errorData);
    }, true);

    /**
     * Handle unhandled promise rejections
     */
    window.addEventListener('unhandledrejection', function(event) {
        const errorData = {
            type: 'UnhandledPromiseRejection',
            message: event.reason?.message || event.reason || 'Promise rejected',
            stack: event.reason?.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            pageUrl: window.location.href
        };

        logError(errorData);
    });

    /**
     * Manually log errors (can be called by application code)
     */
    window.logClientError = function(type, message, additionalData = {}) {
        const errorData = {
            type: type || 'ClientError',
            message: message || 'Unknown error',
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            pageUrl: window.location.href,
            ...additionalData
        };

        logError(errorData);
    };

    /**
     * Track network errors (optional - for fetch/XHR monitoring)
     */
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).catch(error => {
            // Log network errors
            logError({
                type: 'NetworkError',
                message: `Fetch failed: ${error.message}`,
                url: args[0],
                stack: error.stack,
                userAgent: navigator.userAgent,
                timestamp: Date.now(),
                pageUrl: window.location.href
            });
            
            // Re-throw so application code can handle it
            throw error;
        });
    };

    console.log('✅ Reverie House error tracking initialized');
})();
