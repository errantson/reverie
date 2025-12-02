/**
 * Messages Widget - User Inbox
 * 
 * Displays and manages user's system messages from errantson.
 * Messages are created from dialogue templates and stored per-user.
 */

class Messages {
    constructor() {
        this.messages = [];
        this.currentMessageId = null;
        this.onClose = null;
    }
    
    /**
     * Show inbox modal
     */
    async show(options = {}) {
        this.onClose = options.onClose;
        
        // Load messages
        await this.loadInbox();
        
        // Create or show existing modal
        this.renderInbox();
    }
    
    /**
     * Load inbox from API
     */
    async loadInbox(status = null) {
        try {
            // Get user DID from OAuth manager
            const userDid = window.oauthManager?.currentSession?.did;
            
            if (!userDid) {
                console.warn('[Messages] No user DID available');
                this.messages = [];
                this.counts = { total: 0, unread: 0, read: 0, dismissed: 0 };
                return;
            }
            
            const url = status 
                ? `/api/messages/inbox?user_did=${encodeURIComponent(userDid)}&status=${status}`
                : `/api/messages/inbox?user_did=${encodeURIComponent(userDid)}`;
            
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load inbox: ${response.status}`);
            }
            
            const data = await response.json();
            this.messages = data.messages || [];
            this.counts = {
                total: data.total || 0,
                unread: data.unread || 0,
                read: data.read || 0,
                dismissed: data.dismissed || 0
            };
            
            console.log('📬 [Messages] Loaded inbox:', this.counts);
            
        } catch (error) {
            console.error('❌ [Messages] Failed to load inbox:', error);
            this.messages = [];
            this.counts = { total: 0, unread: 0, read: 0, dismissed: 0 };
        }
    }
    
    /**
     * Render inbox UI
     */
    renderInbox() {
        // Use existing shadowbox or create new one
        if (!window.shadowbox) {
            console.error('❌ [Messages] Shadowbox not available');
            return;
        }
        
        const content = this.buildInboxHTML();
        
        window.shadowbox.show({
            title: '📬 Messages from Errantson',
            content: content,
            onClose: () => {
                if (this.onClose) this.onClose();
            }
        });
        
        // Attach event listeners
        this.attachEventListeners();
    }
    
    /**
     * Build inbox HTML
     */
    buildInboxHTML() {
        if (this.messages.length === 0) {
            return `
                <div style="padding: 2rem; text-align: center; color: var(--text-dim);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <div style="font-size: 1rem;">No messages yet</div>
                    <div style="font-size: 0.875rem; margin-top: 0.5rem;">
                        Messages from errantson will appear here
                    </div>
                </div>
            `;
        }
        
        // Group messages by status
        const unread = this.messages.filter(m => m.status === 'unread');
        const read = this.messages.filter(m => m.status === 'read');
        const dismissed = this.messages.filter(m => m.status === 'dismissed');
        
        let html = '<div class="messages-inbox">';
        
        // Unread section
        if (unread.length > 0) {
            html += `
                <div class="message-section">
                    <div class="message-section-header">
                        <span class="section-icon">🔴</span>
                        <span class="section-title">Unread (${unread.length})</span>
                    </div>
                    <div class="message-list">
                        ${unread.map(m => this.buildMessageCard(m)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Read section
        if (read.length > 0) {
            html += `
                <div class="message-section">
                    <div class="message-section-header">
                        <span class="section-icon">⚪</span>
                        <span class="section-title">Read (${read.length})</span>
                    </div>
                    <div class="message-list">
                        ${read.map(m => this.buildMessageCard(m)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Dismissed section (collapsed by default)
        if (dismissed.length > 0) {
            html += `
                <div class="message-section">
                    <div class="message-section-header collapsed" data-section="dismissed">
                        <span class="section-icon">✕</span>
                        <span class="section-title">Dismissed (${dismissed.length})</span>
                        <span class="section-toggle">▼</span>
                    </div>
                    <div class="message-list" style="display: none;">
                        ${dismissed.map(m => this.buildMessageCard(m)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Actions
        if (read.length > 0) {
            html += `
                <div class="inbox-actions">
                    <button class="btn-bulk-dismiss" data-action="bulk-dismiss">
                        Dismiss All Read
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
        
        return html;
    }
    
    /**
     * Build single message card
     */
    buildMessageCard(message) {
        const time = this.formatTimestamp(message.created_at);
        const priorityClass = this.getPriorityClass(message.priority);
        const priorityLabel = this.getPriorityLabel(message.priority);
        
        return `
            <div class="message-card" 
                 data-id="${message.id}"
                 data-status="${message.status}"
                 data-priority="${message.priority}">
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-key">${message.dialogue_key}</span>
                        ${message.priority >= 70 ? `<span class="priority-badge ${priorityClass}">${priorityLabel}</span>` : ''}
                    </div>
                    <div class="message-preview">${message.preview}</div>
                    <div class="message-meta">
                        <span class="message-time">${time}</span>
                        <span class="message-count">${message.message_count} ${message.message_count === 1 ? 'message' : 'messages'}</span>
                    </div>
                </div>
                <div class="message-actions">
                    ${message.status !== 'dismissed' ? `
                        <button class="btn-dismiss" data-id="${message.id}" title="Dismiss">×</button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Attach event listeners to inbox elements
     */
    attachEventListeners() {
        // Message card clicks (open message)
        document.querySelectorAll('.message-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking dismiss button
                if (e.target.classList.contains('btn-dismiss')) return;
                
                const messageId = parseInt(card.dataset.id);
                this.openMessage(messageId);
            });
        });
        
        // Dismiss buttons
        document.querySelectorAll('.btn-dismiss').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = parseInt(btn.dataset.id);
                this.dismissMessage(messageId);
            });
        });
        
        // Bulk dismiss
        const bulkBtn = document.querySelector('.btn-bulk-dismiss');
        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => this.bulkDismiss());
        }
        
        // Section toggles (for dismissed section)
        document.querySelectorAll('.message-section-header[data-section]').forEach(header => {
            header.addEventListener('click', () => {
                const list = header.nextElementSibling;
                const isCollapsed = header.classList.contains('collapsed');
                
                if (isCollapsed) {
                    header.classList.remove('collapsed');
                    list.style.display = 'block';
                } else {
                    header.classList.add('collapsed');
                    list.style.display = 'none';
                }
            });
        });
    }
    
    /**
     * Open a message
     */
    async openMessage(messageId) {
        try {
            console.log('📖 [Messages] Opening message:', messageId);
            
            // Fetch full message data
            const response = await fetch(`/api/messages/${messageId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load message: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Mark as read
            await this.markRead(messageId);
            
            // Close inbox
            if (window.shadowbox) {
                window.shadowbox.close();
            }
            
            // Show in dialogue widget
            if (window.Dialogue) {
                const dialogue = new window.Dialogue();
                dialogue.init();
                dialogue.currentMessageId = messageId; // Track for analytics
                dialogue.start(data.messages_json);
            }
            
        } catch (error) {
            console.error('❌ [Messages] Failed to open message:', error);
        }
    }
    
    /**
     * Mark message as read
     */
    async markRead(messageId) {
        try {
            await fetch(`/api/messages/${messageId}/read`, {
                method: 'POST',
                credentials: 'include'
            });
            
            // Update local state
            const message = this.messages.find(m => m.id === messageId);
            if (message) {
                message.status = 'read';
            }
            
        } catch (error) {
            console.error('❌ [Messages] Failed to mark as read:', error);
        }
    }
    
    /**
     * Dismiss a message
     */
    async dismissMessage(messageId) {
        try {
            await fetch(`/api/messages/${messageId}/dismiss`, {
                method: 'POST',
                credentials: 'include'
            });
            
            console.log('✓ [Messages] Dismissed message:', messageId);
            
            // Reload inbox
            await this.loadInbox();
            this.renderInbox();
            
            // Update badge
            if (window.header) {
                window.header.updateMessageBadge();
            }
            
        } catch (error) {
            console.error('❌ [Messages] Failed to dismiss:', error);
        }
    }
    
    /**
     * Bulk dismiss all read messages
     */
    async bulkDismiss() {
        if (!confirm('Dismiss all read messages?')) return;
        
        try {
            const response = await fetch('/api/messages/bulk-dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'read' }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to bulk dismiss');
            }
            
            const data = await response.json();
            console.log('✓ [Messages] Bulk dismissed:', data.dismissed_count);
            
            // Reload inbox
            await this.loadInbox();
            this.renderInbox();
            
            // Update badge
            if (window.header) {
                window.header.updateMessageBadge();
            }
            
        } catch (error) {
            console.error('❌ [Messages] Failed to bulk dismiss:', error);
        }
    }
    
    /**
     * Helper: Format timestamp
     */
    formatTimestamp(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const diff = now - timestamp;
        
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    }
    
    /**
     * Helper: Get priority class
     */
    getPriorityClass(priority) {
        if (priority >= 90) return 'priority-critical';
        if (priority >= 70) return 'priority-high';
        if (priority >= 50) return 'priority-medium';
        return 'priority-low';
    }
    
    /**
     * Helper: Get priority label
     */
    getPriorityLabel(priority) {
        if (priority >= 90) return 'URGENT';
        if (priority >= 70) return 'HIGH';
        if (priority >= 50) return 'MEDIUM';
        return 'LOW';
    }
}

// Export globally
window.Messages = Messages;

console.log('✅ [messages.js] Messages widget loaded');
