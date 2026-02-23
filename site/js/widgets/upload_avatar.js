/**
 * Avatar Upload Widget
 * Handles avatar updates using the logged-in session
 */

class UploadAvatar {
    constructor() {
        this.modal = null;
        console.log('✅ [UploadAvatar] Avatar upload widget initialized');
    }

    async initiate() {
        console.log('🖼️ [UploadAvatar] Initiate called');
        
        // Get PDS session from login (try multiple sources)
        const pdsSessionStr = localStorage.getItem('pds_session');
        if (pdsSessionStr) {
            try {
                const pdsSession = JSON.parse(pdsSessionStr);
                if (pdsSession.accessJwt && pdsSession.did) {
                    console.log('🔑 [UploadAvatar] Using pds_session for avatar upload');
                    this.pdsSession = pdsSession;
                    this.showAvatarUpload();
                    return;
                }
            } catch (e) {
                console.warn('[UploadAvatar] Failed to parse pds_session:', e);
            }
        }

        // Try OAuth session
        const oauthSession = window.oauthManager?.getSession?.() || window.oauthManager?.currentSession;
        if (oauthSession?.accessJwt && (oauthSession.did || oauthSession.sub)) {
            console.log('🔑 [UploadAvatar] Using OAuth session for avatar upload');
            this.pdsSession = {
                accessJwt: oauthSession.accessJwt,
                did: oauthSession.did || oauthSession.sub,
                serviceEndpoint: oauthSession.serviceEndpoint || oauthSession.pdsEndpoint,
            };
            this.showAvatarUpload();
            return;
        }

        // Try MePage session
        if (window.MePage?.session && window.MePage?.getToken?.()) {
            console.log('🔑 [UploadAvatar] Using MePage session for avatar upload');
            this.pdsSession = {
                accessJwt: window.MePage.getToken(),
                did: window.MePage.session.did,
                serviceEndpoint: window.MePage.session.serviceEndpoint || window.MePage.session.pdsEndpoint,
            };
            this.showAvatarUpload();
            return;
        }
        
        // No valid session - show error
        this.showError('Please log in to update your avatar.');
    }

    showError(message) {
        this.modal = document.createElement('div');
        this.modal.className = 'avatar-upload-modal';
        this.modal.innerHTML = `
            <div class="avatar-upload-content">
                <h3>Cannot Update Avatar</h3>
                <p>${message}</p>
                <div class="avatar-upload-actions">
                    <button class="cancel-btn" onclick="window.uploadAvatar.cancel()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.modal);
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.cancel();
        });
    }

    showAvatarUpload() {
        // Get current avatar from MePage dreamer data or profile strip
        const currentAvatar = window.MePage?.dreamer?.avatar
            || document.getElementById('meAvatarImg')?.src
            || '/assets/icon_face.png';

        this.modal = document.createElement('div');
        this.modal.className = 'avatar-upload-modal';
        this.modal.innerHTML = `
            <div class="avatar-upload-content">
                <h3>Update Avatar</h3>
                <p>Choose a new avatar image for your profile.</p>
                
                <div class="avatar-preview-area">
                    <img id="avatarPreview" src="${currentAvatar}" alt="Avatar preview">
                </div>
                
                <div class="avatar-file-input-group">
                    <input type="file" 
                           id="avatarFileInput" 
                           accept="image/png,image/jpeg,image/jpg"
                           onchange="window.uploadAvatar.previewImage(this)">
                    <label for="avatarFileInput" class="file-input-label">
                        Choose Image
                    </label>
                    <span class="file-input-hint">PNG or JPEG</span>
                </div>
                
                <div class="avatar-upload-actions">
                    <button class="cancel-btn" onclick="window.uploadAvatar.cancel()">Cancel</button>
                    <button class="upload-btn" onclick="window.uploadAvatar.uploadImage()">Upload Avatar</button>
                </div>
                <div class="avatar-upload-status" id="avatarUploadStatus"></div>
            </div>
        `;
        document.body.appendChild(this.modal);

        // Close modal when clicking outside the content
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.cancel();
        });
    }

    previewImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('avatarPreview');
                if (preview) {
                    preview.src = e.target.result;
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    /**
     * Resize an image file to fit within Bluesky's size limits (~1MB)
     */
    async resizeImageForUpload(file, maxSize = 800, quality = 0.9) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                let { width, height } = img;
                
                // Scale down if larger than maxSize
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round(height * maxSize / width);
                        width = maxSize;
                    } else {
                        width = Math.round(width * maxSize / height);
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Try to get under 900KB by reducing quality if needed
                const tryCompress = (q) => {
                    canvas.toBlob((blob) => {
                        if (blob.size > 900000 && q > 0.5) {
                            tryCompress(q - 0.1);
                        } else {
                            console.log(`📐 [UploadAvatar] Resized: ${img.width}x${img.height} → ${width}x${height}, quality: ${q.toFixed(1)}, size: ${(blob.size/1024).toFixed(1)}KB`);
                            resolve(blob);
                        }
                    }, 'image/jpeg', q);
                };
                
                tryCompress(quality);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    async uploadImage() {
        const fileInput = document.getElementById('avatarFileInput');
        const statusEl = document.getElementById('avatarUploadStatus');

        if (!fileInput.files || !fileInput.files[0]) {
            statusEl.textContent = 'Please select an image';
            statusEl.className = 'avatar-upload-status error';
            return;
        }

        const file = fileInput.files[0];

        statusEl.textContent = 'Processing image...';
        statusEl.className = 'avatar-upload-status uploading';

        try {
            // Resize image to fit Bluesky's ~1MB limit
            const resizedBlob = await this.resizeImageForUpload(file, 800, 0.9);
            console.log('📐 [UploadAvatar] Resized image size:', resizedBlob.size, 'bytes');
            
            const token = localStorage.getItem('oauth_token');
            const formData = new FormData();
            formData.append('avatar', resizedBlob, file.name);
            
            // Include PDS session for direct upload
            if (this.pdsSession && this.pdsSession.accessJwt) {
                formData.append('access_jwt', this.pdsSession.accessJwt);
                formData.append('pds_endpoint', this.pdsSession.serviceEndpoint || this.pdsSession.pdsEndpoint || 'https://reverie.house');
            }

            statusEl.textContent = 'Uploading avatar...';
            const response = await fetch('/api/user/update-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update avatar');
            }

            statusEl.textContent = 'Avatar updated successfully!';
            statusEl.className = 'avatar-upload-status success';

            setTimeout(() => {
                this.cancel();
                location.reload();
            }, 1500);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.className = 'avatar-upload-status error';
        }
    }

    cancel() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

// Initialize global instance
try {
    window.uploadAvatar = new UploadAvatar();
} catch (error) {
    console.error('❌ [UploadAvatar] Failed to initialize:', error);
}
