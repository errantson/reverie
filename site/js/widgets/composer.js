/**
 * Composer Widget - Full-featured post composition modal
 * Cloned from dashboard compose UI for feature parity
 */

class ComposerWidget {
    constructor(options = {}) {
        this.options = {
            prefillText: options.prefillText || '',
            prefillImages: options.prefillImages || [],
            scheduledFor: options.scheduledFor || null,
            isLore: options.isLore !== false,  // Default to true unless explicitly false
            courierId: options.courierId || null,
            onSuccess: options.onSuccess || null,
            onCancel: options.onCancel || null,
            mode: options.mode || 'compose', // 'compose', 'edit', or 'reply'
            replyTo: options.replyTo || null // {uri, cid, author} for reply mode
        };
        
        this.selectedImages = [...this.options.prefillImages];
        this.currentView = 'text'; // 'text', 'attachments', or 'schedule'
        this.scheduledDate = this.options.scheduledFor ? new Date(this.options.scheduledFor * 1000) : null;
        
        this.render();
    }
    
    render() {
        const modal = document.createElement('div');
        modal.className = 'composer-modal-overlay';
        modal.innerHTML = `
            <div class="composer-modal-content" onclick="event.stopPropagation()">
                <div class="composer-modal-body">
                    <div class="compose-container">
                        <!-- Main compose area - switches between text and attachments -->
                        <div class="compose-view" id="composerView">
                            <!-- Text view (default) -->
                            <div class="compose-text-view" id="composerTextView">
                                <div class="compose-text-full">
                                    <div class="compose-text-header">
                                        <div class="compose-text-title">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                            ${this.getHeaderTitle()}
                                        </div>
                                        <div class="compose-text-header-right">
                                            <div class="compose-text-count" id="composerCharCount">0/300</div>
                                            <button class="composer-modal-close" onclick="window.currentComposer?.close()">×</button>
                                        </div>
                                    </div>
                                    
                                <div class="compose-textarea-wrapper">
                                    <textarea 
                                        class="dashboard-description-textarea-tall compose-textarea-main" 
                                        id="composerPostText"
                                        placeholder="${this.options.mode === 'reply' ? 'Write your reply...' : 'What\'s on your mind?'}"
                                    >${this.options.prefillText}</textarea>
                                </div>                                    <!-- View toggle buttons - bottom left of container -->
                                    <button class="compose-view-toggle-btn" id="composerMediaBtn" onclick="window.currentComposer?.toggleAttachmentsView()" title="Add images">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <polyline points="21 15 16 10 5 21"></polyline>
                                        </svg>
                                    </button>
                                    <span class="compose-view-toggle-text" id="composerMediaText">0/4 Images</span>
                                </div>
                            </div>
                            
                            <!-- Attachments view (toggled) -->
                            <div class="compose-attachments-view" id="composerAttachmentsView" style="display: none;">
                                <div class="compose-attachments-full">
                                    <div class="compose-attachments-header">
                                        <div class="compose-attachments-title">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                <polyline points="21 15 16 10 5 21"></polyline>
                                            </svg>
                                            Image Attachments
                                        </div>
                                        <div class="compose-text-header-right">
                                            <div class="compose-text-count" id="composerCharCountAttachments">0/300</div>
                                            <button class="composer-modal-close" onclick="window.currentComposer?.close()">×</button>
                                        </div>
                                    </div>
                                    
                                    <div class="compose-image-preview-large" id="composerImagePreview">
                                        <div class="compose-image-empty-large">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                <polyline points="21 15 16 10 5 21"></polyline>
                                            </svg>
                                            <p style="color: #999;">No images attached yet</p>
                                            <button class="compose-attach-btn-large" onclick="document.getElementById('composerImageInput').click()">
                                                Choose Images
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <input type="file" 
                                           id="composerImageInput" 
                                           accept="image/jpeg,image/png,image/gif,image/webp"
                                           multiple
                                           style="display: none;">
                                    
                                    <!-- Bottom action bar -->
                                    <div class="compose-attachments-footer">
                                        <!-- Toggle buttons - bottom left -->
                                        <button class="compose-view-toggle-btn" id="composerTextBtn" onclick="window.currentComposer?.toggleAttachmentsView()" title="Back to compose">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <span class="compose-view-toggle-text" id="composerMediaTextInAttachments">0/4 Images</span>
                                        
                                        <!-- Carousel navigation arrows -->
                                        <div class="compose-carousel-nav">
                                            <button class="compose-carousel-btn" onclick="window.currentComposer?.scrollImagesLeft()" title="Scroll left">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="15 18 9 12 15 6"></polyline>
                                                </svg>
                                            </button>
                                            <button class="compose-carousel-btn" onclick="window.currentComposer?.scrollImagesRight()" title="Scroll right">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="9 18 15 12 9 6"></polyline>
                                                </svg>
                                            </button>
                                        </div>
                                        
                                        <!-- Add more button -->
                                        <button class="compose-add-more-btn-footer" id="composerAddMoreBtn" onclick="document.getElementById('composerImageInput').click()" title="Add another image">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                            </svg>
                                            <span class="compose-add-more-text">Add Image</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="compose-footer">
                            <div class="compose-footer-left">
                                <button class="compose-schedule-icon-btn" id="composerScheduleIconBtn" onclick="window.currentComposer?.openCalendarPicker()" title="Schedule for later">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                </button>
                                
                                <div class="compose-schedule-display" id="composerScheduleDisplay" onclick="window.currentComposer?.openCalendarPicker()">
                                    <span class="compose-schedule-placeholder">Click to Schedule</span>
                                </div>
                                
                                <input type="hidden" id="composerScheduleTime">
                                
                                <label class="compose-lore-toggle-container">
                                    <input type="checkbox" id="composerIsLoreCheckbox" ${this.options.isLore ? 'checked' : ''}>
                                    <span class="compose-lore-slider"></span>
                                    <span class="compose-lore-label">Lore</span>
                                </label>
                            </div>
                            
                            <div class="compose-footer-right">
                                <button class="compose-footer-btn compose-footer-btn-secondary" onclick="window.currentComposer?.close()">
                                    Cancel
                                </button>
                                <button class="compose-footer-btn compose-footer-btn-primary" id="composerSubmitBtn" onclick="window.currentComposer?.${this.options.mode === 'edit' ? 'saveEdit' : 'post'}()">
                                    ${this.options.mode === 'edit' ? 'Save' : (this.options.mode === 'reply' ? 'Reply' : 'Post Now')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.modal = modal;
        document.body.appendChild(modal);
        
        // Set global reference
        window.currentComposer = this;
        
        // Attach event listeners
        this.attachListeners();
        
        // Update displays
        this.updateCharCount();
        this.updateImageDisplay();
        this.updateScheduleDisplay();
    }
    
    getHeaderTitle() {
        if (this.options.mode === 'edit') {
            return 'Edit Dream';
        } else if (this.options.mode === 'reply' && this.options.replyTo) {
            const authorName = this.options.replyTo.authorDisplayName || 'Unknown';
            const postText = this.options.replyTo.postText || '';
            // Truncate post text to ~50 chars
            const truncated = postText.length > 50 ? postText.substring(0, 50) + '...' : postText;
            return `<div style="font-size: 0.95em;">Replying to <strong>${this.escapeHtml(authorName)}</strong> — "<em style="color: #666;">${this.escapeHtml(truncated)}</em>"</div>`;
        } else {
            return 'Compose Dream';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    
    attachListeners() {
        const textarea = document.getElementById('composerPostText');
        const fileInput = document.getElementById('composerImageInput');
        
        // Character counter
        textarea?.addEventListener('input', () => this.updateCharCount());
        
        // File input handler
        fileInput?.addEventListener('change', (e) => this.handleImageSelect(e));
    }
    
    updateCharCount() {
        const textarea = document.getElementById('composerPostText');
        const charCount = document.getElementById('composerCharCount');
        const charCountAttachments = document.getElementById('composerCharCountAttachments');
        if (!textarea) return;
        
        const count = textarea.value.length;
        const countText = `${count}/300`;
        
        // Update both char counters
        if (charCount) {
            charCount.textContent = countText;
            charCount.classList.remove('warning', 'error');
            if (count > 300) {
                charCount.classList.add('error');
            } else if (count > 280) {
                charCount.classList.add('warning');
            }
        }
        
        if (charCountAttachments) {
            charCountAttachments.textContent = countText;
            charCountAttachments.classList.remove('warning', 'error');
            if (count > 300) {
                charCountAttachments.classList.add('error');
            } else if (count > 280) {
                charCountAttachments.classList.add('warning');
            }
        }
    }
    
    toggleAttachmentsView() {
        const textView = document.getElementById('composerTextView');
        const attachmentsView = document.getElementById('composerAttachmentsView');
        
        if (!textView || !attachmentsView) return;
        
        if (this.currentView === 'text') {
            textView.style.display = 'none';
            attachmentsView.style.display = 'block';
            this.currentView = 'attachments';
        } else {
            textView.style.display = 'block';
            attachmentsView.style.display = 'none';
            this.currentView = 'text';
        }
    }
    
    
    async handleImageSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        const maxImages = 4;
        
        for (let i = 0; i < files.length && this.selectedImages.length < maxImages; i++) {
            const file = files[i];
            
            // Validate file size (1MB max per Bluesky spec)
            if (file.size > 1000000) {
                alert(`Image "${file.name}" is too large. Max size is 1MB.`);
                continue;
            }
            
            // Read file as data URL for preview
            const reader = new FileReader();
            reader.onload = (e) => {
                this.selectedImages.push({
                    file: file,
                    dataUrl: e.target.result,
                    alt: ''
                });
                this.updateImageDisplay();
            };
            reader.readAsDataURL(file);
        }
        
        // Reset file input
        event.target.value = '';
    }
    
    updateImageDisplay() {
        const preview = document.getElementById('composerImagePreview');
        const mediaText = document.getElementById('composerMediaText');
        const mediaTextInAttachments = document.getElementById('composerMediaTextInAttachments');
        const count = document.getElementById('composerAttachmentsCount');
        
        if (!preview) return;
        
        // Update text indicators
        const imageCountText = `${this.selectedImages.length}/4 Images`;
        if (mediaText) mediaText.textContent = imageCountText;
        if (mediaTextInAttachments) mediaTextInAttachments.textContent = imageCountText;
        if (count) count.textContent = `${this.selectedImages.length}/4`;
        
        if (this.selectedImages.length === 0) {
            preview.innerHTML = `
                <div class="compose-image-empty-large">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p style="color: #999;">No images attached yet</p>
                    <button class="compose-attach-btn-large" onclick="document.getElementById('composerImageInput').click()">
                        Choose Images
                    </button>
                </div>
            `;
            return;
        }
        
        let html = '<div class="compose-images-grid-large">';
        
        this.selectedImages.forEach((img, index) => {
            const isEditingAlt = img.editingAlt || false;
            const imageUrl = img.dataUrl || img.url || img;
            html += `
                <div class="compose-image-item-large" id="composerImageItem${index}">
                    <div class="compose-image-preview-wrapper">
                        <img src="${imageUrl}" alt="${this.escapeHtml(img.alt || 'Preview ' + (index + 1))}" style="${isEditingAlt ? 'display:none;' : ''}">
                        ${isEditingAlt ? `
                            <div class="compose-image-alt-editor">
                                <div class="compose-image-alt-header">
                                    <span>ALT TEXT</span>
                                    <button class="compose-image-action-btn" onclick="window.currentComposer?.toggleAltEdit(${index})" style="background: transparent; box-shadow: none; min-width: auto;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </button>
                                </div>
                                <textarea 
                                    class="compose-image-alt-textarea" 
                                    id="composerAltText${index}"
                                    placeholder="Describe this image for accessibility..."
                                    maxlength="1000"
                                >${this.escapeHtml(img.alt || '')}</textarea>
                            </div>
                        ` : ''}
                        <div class="compose-image-actions" style="${isEditingAlt ? 'display:none;' : ''}">
                            <button class="compose-image-action-btn ${img.alt ? 'active' : ''}" onclick="window.currentComposer?.toggleAltEdit(${index})" title="Edit alt text">
                                ALT
                            </button>
                        </div>
                        <button class="compose-image-delete-btn" onclick="window.currentComposer?.removeImage(${index})" title="Remove image">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        preview.innerHTML = html;
    }
    
    toggleAltEdit(index) {
        const img = this.selectedImages[index];
        if (!img) return;
        
        if (img.editingAlt) {
            // Save alt text
            const textarea = document.getElementById(`composerAltText${index}`);
            if (textarea) {
                img.alt = textarea.value;
            }
            img.editingAlt = false;
        } else {
            // Start editing
            img.editingAlt = true;
        }
        
        this.updateImageDisplay();
    }
    
    
    removeImage(index) {
        this.selectedImages.splice(index, 1);
        this.updateImageDisplay();
    }
    
    scrollImagesLeft() {
        const grid = document.querySelector('.compose-images-grid-large');
        if (grid) {
            grid.scrollBy({ left: -300, behavior: 'smooth' });
        }
    }
    
    scrollImagesRight() {
        const grid = document.querySelector('.compose-images-grid-large');
        if (grid) {
            grid.scrollBy({ left: 300, behavior: 'smooth' });
        }
    }
    
    openCalendarPicker() {
        console.log('📅 [Composer] openCalendarPicker() called');
        console.log('📅 [Composer] window.calendarWidget exists:', !!window.calendarWidget);
        
        if (!window.calendarWidget) {
            console.error('❌ [Composer] Calendar widget not available');
            alert('Calendar not available. Please refresh the page.');
            return;
        }
        
        console.log('📅 [Composer] window.calendarWidget.show exists:', !!window.calendarWidget.show);
        console.log('✅ [Composer] Calendar widget is functional, opening picker...');
        
        const self = this;
        // Pass existing scheduledDate or null (not undefined)
        const initialDate = self.scheduledDate || null;
        console.log('📅 [Composer] Passing initialDate:', initialDate);
        
        window.calendarWidget.show(initialDate, (selectedDate) => {
            console.log('📅 [Composer] ===== CALLBACK TRIGGERED =====');
            console.log('📅 [Composer] selectedDate received:', selectedDate);
            console.log('📅 [Composer] selectedDate type:', typeof selectedDate);
            
            if (!selectedDate) {
                console.warn('⚠️ [Composer] No date selected');
                return;
            }
            
            self.scheduledDate = selectedDate;
            const timestamp = Math.floor(selectedDate.getTime() / 1000);
            
            console.log('📅 [Composer] Calculated timestamp:', timestamp);
            
            const scheduleTimeInput = document.getElementById('composerScheduleTime');
            if (scheduleTimeInput) {
                scheduleTimeInput.value = timestamp;
                console.log('📅 [Composer] Set scheduleTime.value to:', timestamp);
            }
            
            console.log('📅 [Composer] Calling updateScheduleDisplay...');
            self.updateScheduleDisplay();
            console.log('📅 [Composer] ===== CALLBACK COMPLETE =====');
        });
    }
    
    updateScheduleDisplay() {
        const display = document.getElementById('composerScheduleDisplay');
        const submitBtn = document.getElementById('composerSubmitBtn');
        
        if (!display) return;
        
        if (this.scheduledDate) {
            const dateStr = this.scheduledDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const timeStr = this.scheduledDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
            
            display.innerHTML = `<span class="compose-schedule-text">${dateStr}, ${timeStr}</span>`;
            display.classList.add('has-schedule');
            
            if (submitBtn) {
                submitBtn.textContent = this.options.mode === 'edit' ? 'Save' : 'Schedule Post';
            }
        } else {
            display.innerHTML = '<span class="compose-schedule-placeholder">Click to Schedule</span>';
            display.classList.remove('has-schedule');
            
            if (submitBtn) {
                submitBtn.textContent = this.options.mode === 'edit' ? 'Save' : 'Post Now';
            }
        }
    }
    
    
    async post() {
        const textarea = document.getElementById('composerPostText');
        const loreCheckbox = document.getElementById('composerIsLoreCheckbox');
        const submitBtn = document.getElementById('composerSubmitBtn');
        
        const postText = textarea?.value?.trim();
        if (!postText) {
            alert('Please enter some text for your post');
            return;
        }
        
        if (postText.length > 300) {
            alert('Post is too long. Maximum 300 characters.');
            return;
        }
        
        // Disable button
        if (submitBtn) {
            submitBtn.disabled = true;
            const postingText = this.options.mode === 'reply' ? 'Replying...' : 'Posting...';
            submitBtn.textContent = postingText;
        }
        
        try {
            const session = window.dashboardWidget?.session || window.oauthManager?.currentSession;
            if (!session?.did) {
                alert('Not logged in. Please log in first.');
                return;
            }
            
            // If scheduled, use courier endpoint
            if (this.scheduledDate) {
                const scheduled_for = Math.floor(this.scheduledDate.getTime() / 1000);
                
                const response = await fetch(`/api/courier/schedule?user_did=${encodeURIComponent(session.did)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        post_text: postText,
                        scheduled_for: scheduled_for,
                        is_lore: loreCheckbox?.checked || false,
                        post_images: this.selectedImages.length > 0 ? this.selectedImages : null
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to schedule post');
                }
                
                console.log('✅ [Composer] Post scheduled successfully');
                
            } else {
                // Immediate post via oauth-manager's createPost method
                console.log('📤 [Composer] Posting immediately');
                
                if (!window.oauthManager) {
                    throw new Error('OAuth manager not available');
                }
                
                // Build the record with all necessary fields
                const record = {
                    text: postText,
                    createdAt: new Date().toISOString()
                };
                
                // Add reply if in reply mode
                if (this.options.mode === 'reply' && this.options.replyTo) {
                    console.log('💬 [Composer] Adding reply reference:', this.options.replyTo);
                    record.reply = {
                        root: this.options.replyTo.root || {
                            uri: this.options.replyTo.uri,
                            cid: this.options.replyTo.cid
                        },
                        parent: {
                            uri: this.options.replyTo.uri,
                            cid: this.options.replyTo.cid
                        }
                    };
                }
                
                // Add images if present
                if (this.selectedImages.length > 0) {
                    const embedImages = [];
                    
                    for (const img of this.selectedImages) {
                        // Upload blob via oauth-manager
                        const blob = img.blob;
                        const uploadResult = await window.oauthManager.uploadBlob(blob, blob.type);
                        
                        embedImages.push({
                            alt: img.alt || '',
                            image: uploadResult.blob
                        });
                    }
                    
                    record.embed = {
                        $type: 'app.bsky.embed.images',
                        images: embedImages
                    };
                }
                
                // Create the post using oauth-manager's createPost method
                // This handles both PDS and OAuth sessions correctly
                await window.oauthManager.createPost(postText, record);
                console.log('✅ [Composer] Post created successfully');
            }
            
            // Success callback
            if (this.options.onSuccess) {
                this.options.onSuccess();
            }
            
            this.close();
            
        } catch (error) {
            console.error('❌ [Composer] Error posting:', error);
            alert(error.message || 'Failed to post. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                const buttonText = this.scheduledDate ? 'Schedule Post' : 
                                 (this.options.mode === 'reply' ? 'Reply' : 'Post Now');
                submitBtn.textContent = buttonText;
            }
        }
    }
    
    async saveEdit() {
        const textarea = document.getElementById('composerPostText');
        const loreCheckbox = document.getElementById('composerIsLoreCheckbox');
        const submitBtn = document.getElementById('composerSubmitBtn');
        
        const postText = textarea?.value?.trim();
        if (!postText) {
            alert('Please enter some text for your post');
            return;
        }
        
        if (postText.length > 300) {
            alert('Post is too long. Maximum 300 characters.');
            return;
        }
        
        // Disable button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }
        
        try {
            const session = window.dashboardWidget?.session || window.oauthManager?.currentSession;
            if (!session?.did) {
                alert('Not logged in. Please log in first.');
                return;
            }
            
            if (!this.options.courierId) {
                throw new Error('No courier ID provided');
            }
            
            const scheduled_for = this.scheduledDate ? Math.floor(this.scheduledDate.getTime() / 1000) : null;
            
            const response = await fetch(`/api/courier/${this.options.courierId}?user_did=${encodeURIComponent(session.did)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    post_text: postText,
                    scheduled_for: scheduled_for,
                    is_lore: loreCheckbox?.checked || false,
                    post_images: this.selectedImages.length > 0 ? this.selectedImages : null
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update post');
            }
            
            console.log('✅ [Composer] Post updated successfully');
            
            // Success callback
            if (this.options.onSuccess) {
                this.options.onSuccess();
            }
            
            this.close();
            
        } catch (error) {
            console.error('❌ [Composer] Error updating post:', error);
            alert(error.message || 'Failed to update post. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save';
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    close() {
        if (this.options.onCancel) {
            this.options.onCancel();
        }
        this.modal?.remove();
        window.currentComposer = null;
    }
}

// Export for global use
window.ComposerWidget = ComposerWidget;
console.log('✅ [composer.js] ComposerWidget loaded');
