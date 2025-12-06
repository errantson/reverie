/**
 * Inbox Widget
 * 
 * Small popup widget for viewing system messages inbox
 * Similar to dialogue.js but for message management
 * 
 * EXPECTED FLOW:
 * 1. User clicks errantson button in header
 * 2. Header checks for unread messages via /api/messages/count
 * 3. If unread > 0: Opens this inbox widget
 * 4. If unread = 0: Shows default "construction" dialogue via Shadowbox
 * 5. User clicks message row -> viewMessage() called
 * 6. Message marked as read, inbox closes
 * 7. Message dialogue displays using window.dialogue.startFromData()
 * 8. When dialogue completes: Badge updated, user returns to page
 * 9. Next errantson click: If still have unread, show inbox; else show default
 */

class Inbox {
    constructor(options = {}) {
        this.container = null;
        this.inboxBox = null;
        this.onClose = options.onClose || null;
        this.messages = [];
    }

    /**
     * Create the inbox UI elements
     */
    createElements() {
        // Container (fullscreen overlay)
        this.container = document.createElement('div');
        this.container.className = 'inbox-overlay';
        
        // Inbox box
        this.inboxBox = document.createElement('div');
        this.inboxBox.className = 'inbox-box';
        
        // Header
        const header = document.createElement('div');
        header.className = 'inbox-header';
        header.innerHTML = `
            <div class="inbox-title">
                <img src="/assets/icon.png" alt="Reverie House" class="inbox-avatar">
                <span>Reverie House - Mailbox</span>
            </div>
            <button class="inbox-close" onclick="window.inbox.close()">✕</button>
        `;
        
        // Message count
        this.countElement = document.createElement('div');
        this.countElement.className = 'inbox-count';
        
        // Messages container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.className = 'inbox-messages';
        
        // Actions footer
        const footer = document.createElement('div');
        footer.className = 'inbox-footer';
        footer.innerHTML = `
            <button class="inbox-btn secondary" onclick="window.inbox.dismissAll()">Clear All Read</button>
            <button class="inbox-btn primary" onclick="window.inbox.close()">Close</button>
        `;
        
        // Assemble
        this.inboxBox.appendChild(header);
        this.inboxBox.appendChild(this.countElement);
        this.inboxBox.appendChild(this.messagesContainer);
        this.inboxBox.appendChild(footer);
        this.container.appendChild(this.inboxBox);
        
        // Add to page
        document.body.appendChild(this.container);
        
        // Click outside to close
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });
    }

    /**
     * Open the inbox and load messages
     */
    async open() {
        console.log('📬 [inbox.js] Opening inbox...');
        
        if (!this.container) {
            this.createElements();
        }
        
        // Show container with fade-in
        this.container.style.display = 'flex';
        setTimeout(() => {
            this.container.classList.add('visible');
        }, 50);
        
        // Load messages
        await this.loadMessages();
    }

    /**
     * Load messages from API
     */
    async loadMessages() {
        try {
            // Get user DID from OAuth manager
            const userDid = window.oauthManager?.currentSession?.did;
            
            if (!userDid) {
                console.warn('[Inbox] No user DID available');
                this.messages = [];
                this.renderMessages();
                return;
            }
            
            const response = await fetch(`/api/messages/inbox?user_did=${encodeURIComponent(userDid)}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                this.messages = result.data.messages || [];
                this.renderMessages();
            } else {
                this.showError('Failed to load messages');
            }
        } catch (error) {
            console.error('❌ [inbox.js] Failed to load messages:', error);
            this.showError('Network error loading messages');
        }
    }

    /**
     * Render the messages list
     */
    renderMessages() {
        const unread = this.messages.filter(m => m.status === 'unread').length;
        const total = this.messages.length;
        
        // Update count
        this.countElement.innerHTML = `
            <div class="inbox-stats">
                <span class="inbox-stat"><strong>${unread}</strong> unread</span>
                <span class="inbox-stat"><strong>${total}</strong> total</span>
            </div>
        `;
        
        // Render messages
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="inbox-empty">
                    <div class="inbox-empty-icon">📭</div>
                    <div class="inbox-empty-text">No messages</div>
                </div>
            `;
            return;
        }
        
        // Sort by priority (high first) then created_at (new first)
        const sorted = [...this.messages].sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.created_at - a.created_at;
        });
        
        this.messagesContainer.innerHTML = sorted.map((msg, idx) => {
            const isUnread = msg.status === 'unread';
            const timeAgo = this.getTimeAgo(msg.created_at);
            
            // Get first message text preview
            let preview = '';
            try {
                const messages = JSON.parse(msg.messages_json);
                if (messages.length > 0) {
                    preview = messages[0].text.substring(0, 60);
                    if (messages[0].text.length > 60) preview += '...';
                }
            } catch (e) {
                preview = '';
            }
            
            return `
                <div class="inbox-message ${isUnread ? 'unread' : ''}" data-id="${msg.id}" onclick="window.inbox.viewMessage(${msg.id})">
                    <div class="inbox-message-row">
                        <div class="inbox-message-title">${msg.title || msg.dialogue_key}</div>
                        ${preview ? `<div class="inbox-message-preview">${preview}</div>` : ''}
                        <div class="inbox-message-meta">
                            <span class="inbox-message-sender">errantson</span>
                            <span class="inbox-message-time">${timeAgo}</span>
                        </div>
                        <button class="inbox-message-btn dismiss" onclick="event.stopPropagation(); window.inbox.dismissMessage(${msg.id})" title="Dismiss message">
                            ×
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Get priority symbol (not emoji)
     */
    getPrioritySymbol(priority) {
        if (priority >= 100) return '●';  // Critical
        if (priority >= 75) return '●';   // High
        if (priority >= 50) return '○';   // Normal
        return '·';                        // Low
    }

    /**
     * Get human-readable time ago
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor(Date.now() / 1000) - timestamp;
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(timestamp * 1000).toLocaleDateString();
    }

    /**
     * View a message (displays it in dialogue widget)
     */
    async viewMessage(messageId) {
        console.log(`📖 [inbox.js] Viewing message ${messageId}`);
        
        try {
            // Fetch full message
            const response = await fetch(`/api/messages/${messageId}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                const msg = result.data;
                
                // Parse messages first to validate
                let messages;
                try {
                    messages = JSON.parse(msg.messages_json);
                } catch (e) {
                    console.error('❌ [inbox.js] Failed to parse messages_json:', e);
                    return;
                }
                
                // Mark as read (don't reload messages yet)
                await this.markRead(messageId, false);
                
                // Close inbox
                this.close();
                
                // Show in dialogue widget
                if (window.dialogue) {
                    console.log(`� [inbox.js] Displaying message dialogue: ${msg.dialogue_key}`);
                    
                    // Store original onComplete callback
                    const originalOnComplete = window.dialogue.onComplete;
                    
                    // Set temporary onComplete to update badge after dialogue closes
                    window.dialogue.onComplete = () => {
                        console.log('✅ [inbox.js] Message dialogue completed');
                        
                        // Update badge count
                        if (window.header && window.header.updateMessageBadge) {
                            window.header.updateMessageBadge();
                        }
                        
                        // Restore original callback
                        window.dialogue.onComplete = originalOnComplete;
                        
                        // Call original if it exists
                        if (originalOnComplete) {
                            originalOnComplete();
                        }
                    };
                    
                    // Start the dialogue
                    await window.dialogue.startFromData({
                        key: msg.dialogue_key,
                        messages: messages
                    });
                } else {
                    console.error('❌ [inbox.js] Dialogue widget not found on window');
                    
                    // Still update badge even if dialogue failed
                    if (window.header && window.header.updateMessageBadge) {
                        window.header.updateMessageBadge();
                    }
                }
            }
        } catch (error) {
            console.error('❌ [inbox.js] Failed to view message:', error);
        }
    }

    /**
     * Mark message as read
     */
    async markRead(messageId, reload = true) {
        try {
            const response = await fetch(`/api/messages/${messageId}/read`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.status === 'success' && reload) {
                await this.loadMessages();
                
                // Update badge
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            }
        } catch (error) {
            console.error('❌ [inbox.js] Failed to mark as read:', error);
        }
    }

    /**
     * Dismiss a message
     */
    async dismissMessage(messageId) {
        try {
            const response = await fetch(`/api/messages/${messageId}/dismiss`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                await this.loadMessages();
                
                // Update badge
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            }
        } catch (error) {
            console.error('❌ [inbox.js] Failed to dismiss message:', error);
        }
    }

    /**
     * Dismiss all read messages
     */
    async dismissAll() {
        const readIds = this.messages
            .filter(m => m.status === 'read')
            .map(m => m.id);
        
        if (readIds.length === 0) {
            return;
        }
        
        try {
            const response = await fetch('/api/messages/bulk-dismiss', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message_ids: readIds })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                await this.loadMessages();
                
                // Update badge
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            }
        } catch (error) {
            console.error('❌ [inbox.js] Failed to dismiss all:', error);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.messagesContainer.innerHTML = `
            <div class="inbox-empty">
                <div class="inbox-empty-icon">⚠️</div>
                <div class="inbox-empty-text">${message}</div>
            </div>
        `;
    }

    /**
     * Close the inbox
     */
    close() {
        if (!this.container) return;
        
        this.container.classList.remove('visible');
        setTimeout(() => {
            this.container.style.display = 'none';
        }, 300);
        
        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * Destroy the inbox widget
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.inboxBox = null;
    }
}

// Create global instance
window.inbox = new Inbox();

console.log('✅ [inbox.js] Inbox widget loaded');
